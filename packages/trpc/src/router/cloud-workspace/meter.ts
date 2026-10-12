import { ensureAutumnCustomer } from "@superset/auth/billing";
import { db, dbWs } from "@superset/db/client";
import { cloudWorkspaceSessions, cloudWorkspaces } from "@superset/db/schema";
import { and, count, eq, inArray, isNull, lt, max, or, sql } from "drizzle-orm";
import { autumn, BOX_MINUTES_FEATURE_ID } from "../../lib/billing/autumn";
import {
	listActiveWorkspaceSandboxes,
	listSandboxSessions,
	type SandboxSession,
} from "../../lib/sandbox";
import { publishCloudWorkspaceJob } from "./jobs";

export const STANDARD_BOX_VCPUS = 8;
const MIN_RUNNING_REPORT_MS = 60_000;
const RECONCILE_LOOKBACK_MS = 30 * 60 * 1000;
const RECONCILE_CONCURRENCY = 25;
const FIRST_SIGHT_GRACE_MS = 24 * 60 * 60 * 1000;
const RECORDED_EVENT_WINDOW_MS = 5 * 60 * 1000;
const RECORDED_EVENT_PAGES = 5;

type SessionRow = typeof cloudWorkspaceSessions.$inferSelect;

export class UsageReportError extends AggregateError {}

export function boxMinutes(ms: number, vcpus: number): number {
	return (ms / 60_000) * (vcpus / STANDARD_BOX_VCPUS);
}

export function observedMs(session: SandboxSession, now: number): number {
	return Math.max(0, (session.endedAt ?? now) - session.startedAt);
}

export function unreportedMs(row: SessionRow): number {
	const delta = row.observedMs - row.reportedMs;
	if (row.stoppedAt === null && delta < MIN_RUNNING_REPORT_MS) return 0;
	return Math.max(0, delta);
}

export function initialReportedMs(
	session: SandboxSession,
	now: number,
	context: { reporting: boolean; firstSight: boolean },
): number {
	const ms = observedMs(session, now);
	if (!context.reporting) return ms;
	const endedLongAgo =
		session.endedAt !== null && session.endedAt < now - FIRST_SIGHT_GRACE_MS;
	return context.firstSight && endedLongAgo ? ms : 0;
}

export function rangeKey(row: SessionRow, to: number): string {
	return `${row.id}:${row.reportedMs}-${to}`;
}

async function usageAlreadyRecorded(args: {
	organizationId: string;
	key: string;
	timestamp: number;
}): Promise<boolean> {
	if (!autumn) return false;
	let startCursor: string | undefined;
	for (let page = 0; page < RECORDED_EVENT_PAGES; page += 1) {
		const { list, nextCursor } = await autumn.events.list({
			customerId: args.organizationId,
			featureId: BOX_MINUTES_FEATURE_ID,
			customRange: {
				start: args.timestamp - RECORDED_EVENT_WINDOW_MS,
				end: args.timestamp + RECORDED_EVENT_WINDOW_MS,
			},
			limit: 100,
			...(startCursor ? { startCursor } : {}),
		});
		if (list.some((event) => event.properties?.rangeKey === args.key)) {
			return true;
		}
		if (!nextCursor) return false;
		startCursor = nextCursor;
	}
	throw new Error(
		`[cloud-workspace] could not confirm whether ${args.key} was recorded`,
	);
}

export function meteringCutoff(bounds: {
	oldestOpenStart: Date | null;
	lastStop: Date | null;
	workspaceCreatedAt: Date;
}): number {
	return (
		bounds.oldestOpenStart ??
		bounds.lastStop ??
		bounds.workspaceCreatedAt
	).getTime();
}

async function recordSessions(workspace: {
	id: string;
	providerSandboxId: string;
	createdAt: Date;
	billable: boolean;
}): Promise<void> {
	const reporting = autumn !== null && workspace.billable;
	const [bounds] = await db
		.select({
			oldestOpenStart:
				sql<Date | null>`min(${cloudWorkspaceSessions.startedAt}) filter (where ${cloudWorkspaceSessions.stoppedAt} is null)`.mapWith(
					cloudWorkspaceSessions.startedAt,
				),
			lastStop: max(cloudWorkspaceSessions.stoppedAt),
			count: count(),
		})
		.from(cloudWorkspaceSessions)
		.where(eq(cloudWorkspaceSessions.cloudWorkspaceId, workspace.id));
	const firstSight = (bounds?.count ?? 0) === 0;
	const sessions = await listSandboxSessions(
		workspace.providerSandboxId,
		meteringCutoff({
			oldestOpenStart: bounds?.oldestOpenStart ?? null,
			lastStop: bounds?.lastStop ?? null,
			workspaceCreatedAt: workspace.createdAt,
		}),
	);
	if (sessions === null) {
		await db
			.update(cloudWorkspaceSessions)
			.set({
				stoppedAt: sql`${cloudWorkspaceSessions.startedAt} + make_interval(secs => ${cloudWorkspaceSessions.observedMs} / 1000.0)`,
			})
			.where(
				and(
					eq(cloudWorkspaceSessions.cloudWorkspaceId, workspace.id),
					isNull(cloudWorkspaceSessions.stoppedAt),
				),
			);
		return;
	}
	if (sessions.length === 0) return;
	const now = Date.now();
	const observed = sql`greatest(${cloudWorkspaceSessions.observedMs}, excluded.observed_ms)`;
	await db
		.insert(cloudWorkspaceSessions)
		.values(
			sessions.map((session) => ({
				id: session.id,
				cloudWorkspaceId: workspace.id,
				vcpus: session.vcpus,
				startedAt: new Date(session.startedAt),
				stoppedAt: session.endedAt === null ? null : new Date(session.endedAt),
				observedMs: observedMs(session, now),
				reportedMs: initialReportedMs(session, now, { reporting, firstSight }),
			})),
		)
		.onConflictDoUpdate({
			target: cloudWorkspaceSessions.id,
			set: {
				stoppedAt: sql`coalesce(excluded.stopped_at, ${cloudWorkspaceSessions.stoppedAt})`,
				observedMs: observed,
				...(reporting ? {} : { reportedMs: observed }),
				updatedAt: new Date(),
			},
		});
}

async function reportSession(args: {
	row: SessionRow;
	organizationId: string;
	createdByUserId: string | null;
	projectId: string | null;
}): Promise<number> {
	const { row } = args;
	if (!autumn) return 0;
	const tracker = autumn;
	const isResend = row.inflightToMs !== null;
	let to = row.inflightToMs;
	if (to === null) {
		if (unreportedMs(row) === 0) return 0;
		const claimed = await db
			.update(cloudWorkspaceSessions)
			.set({ inflightToMs: row.observedMs })
			.where(
				and(
					eq(cloudWorkspaceSessions.id, row.id),
					eq(cloudWorkspaceSessions.reportedMs, row.reportedMs),
					isNull(cloudWorkspaceSessions.inflightToMs),
				),
			)
			.returning({ id: cloudWorkspaceSessions.id });
		if (claimed.length === 0) return 0;
		to = row.observedMs;
	}
	const range = to;
	const delta = range - row.reportedMs;
	const key = rangeKey(row, range);
	const timestamp = row.startedAt.getTime() + range;
	return dbWs.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`box-usage:${row.id}`}, 0))`,
		);
		const [current] = await tx
			.select({ inflightToMs: cloudWorkspaceSessions.inflightToMs })
			.from(cloudWorkspaceSessions)
			.where(eq(cloudWorkspaceSessions.id, row.id));
		if (current?.inflightToMs !== range) return 0;
		const recorded =
			isResend &&
			(await usageAlreadyRecorded({
				organizationId: args.organizationId,
				key,
				timestamp,
			}));
		if (!recorded) {
			const result = await tracker.track(
				{
					customerId: args.organizationId,
					featureId: BOX_MINUTES_FEATURE_ID,
					value: boxMinutes(delta, row.vcpus),
					timestamp,
					overageBehavior: "overflow",
					async: false,
					properties: {
						cloudWorkspaceId: row.cloudWorkspaceId,
						sessionId: row.id,
						projectId: args.projectId,
						userId: args.createdByUserId,
						vcpus: row.vcpus,
						wallMs: delta,
						rangeKey: key,
					},
				},
				{ headers: { "Idempotency-Key": key } },
			);
			if (!result.balance) {
				throw new Error(
					`[cloud-workspace] ${args.organizationId} has no ${BOX_MINUTES_FEATURE_ID} balance; usage for ${key} was not recorded`,
				);
			}
		}
		await tx
			.update(cloudWorkspaceSessions)
			.set({ reportedMs: range, inflightToMs: null })
			.where(eq(cloudWorkspaceSessions.id, row.id));
		return delta;
	});
}

export async function meterCloudWorkspace(
	cloudWorkspaceId: string,
): Promise<{ reportedMs: number }> {
	const [workspace] = await db
		.select({
			provider: cloudWorkspaces.provider,
			providerSandboxId: cloudWorkspaces.providerSandboxId,
			organizationId: cloudWorkspaces.organizationId,
			createdByUserId: cloudWorkspaces.createdByUserId,
			createdAt: cloudWorkspaces.createdAt,
			status: cloudWorkspaces.status,
			projectId: cloudWorkspaces.projectId,
		})
		.from(cloudWorkspaces)
		.where(eq(cloudWorkspaces.id, cloudWorkspaceId));
	if (!workspace || workspace.provider !== "vercel") return { reportedMs: 0 };

	const billable = workspace.status !== "failed";
	await recordSessions({
		id: cloudWorkspaceId,
		providerSandboxId: workspace.providerSandboxId,
		createdAt: workspace.createdAt,
		billable,
	});
	if (!autumn || !billable) return { reportedMs: 0 };

	const unsettled = await db
		.select()
		.from(cloudWorkspaceSessions)
		.where(
			and(
				eq(cloudWorkspaceSessions.cloudWorkspaceId, cloudWorkspaceId),
				lt(
					cloudWorkspaceSessions.reportedMs,
					cloudWorkspaceSessions.observedMs,
				),
			),
		);
	if (
		!unsettled.some((row) => row.inflightToMs !== null || unreportedMs(row) > 0)
	) {
		return { reportedMs: 0 };
	}

	let reportedMs = 0;
	const failures: unknown[] = [];
	try {
		await ensureAutumnCustomer(workspace.organizationId);
	} catch (error) {
		throw new UsageReportError(
			[error],
			`[cloud-workspace] ${cloudWorkspaceId} Autumn customer unavailable`,
		);
	}
	for (const row of unsettled) {
		try {
			reportedMs += await reportSession({
				row,
				organizationId: workspace.organizationId,
				createdByUserId: workspace.createdByUserId,
				projectId: workspace.projectId,
			});
		} catch (error) {
			failures.push(error);
		}
	}
	if (failures.length > 0) {
		throw new UsageReportError(
			failures,
			`[cloud-workspace] ${cloudWorkspaceId} usage report failed`,
		);
	}
	return { reportedMs };
}

export async function queueMeterCloudWorkspace(
	cloudWorkspaceId: string,
): Promise<void> {
	await publishCloudWorkspaceJob({
		path: "/api/cloud-workspaces/meter",
		body: { cloudWorkspaceId },
		runLocally: (body) => meterCloudWorkspace(body.cloudWorkspaceId),
	}).catch((error) => {
		console.error(
			`[cloud-workspace] could not queue the meter for ${cloudWorkspaceId}`,
			error,
		);
	});
}

export async function reconcileCloudWorkspaceUsage(): Promise<{
	queued: number;
	failed: number;
}> {
	const names = await listActiveWorkspaceSandboxes(
		Date.now() - RECONCILE_LOOKBACK_MS,
	);
	const [running, unsettled] = await Promise.all([
		names.length === 0
			? []
			: db
					.select({ id: cloudWorkspaces.id })
					.from(cloudWorkspaces)
					.where(
						and(
							eq(cloudWorkspaces.provider, "vercel"),
							inArray(cloudWorkspaces.providerSandboxId, names),
						),
					),
		db
			.selectDistinct({ id: cloudWorkspaceSessions.cloudWorkspaceId })
			.from(cloudWorkspaceSessions)
			.where(
				autumn
					? or(
							isNull(cloudWorkspaceSessions.stoppedAt),
							lt(
								cloudWorkspaceSessions.reportedMs,
								cloudWorkspaceSessions.observedMs,
							),
						)
					: isNull(cloudWorkspaceSessions.stoppedAt),
			),
	]);
	const ids = [...new Set([...running, ...unsettled].map((row) => row.id))];

	let failed = 0;
	for (let i = 0; i < ids.length; i += RECONCILE_CONCURRENCY) {
		const results = await Promise.allSettled(
			ids.slice(i, i + RECONCILE_CONCURRENCY).map((cloudWorkspaceId) =>
				publishCloudWorkspaceJob({
					path: "/api/cloud-workspaces/meter",
					body: { cloudWorkspaceId },
					runLocally: (body) => meterCloudWorkspace(body.cloudWorkspaceId),
				}),
			),
		);
		for (const result of results) {
			if (result.status === "rejected") {
				failed += 1;
				console.error(
					"[cloud-workspace] reconcile queue failed",
					result.reason,
				);
			}
		}
	}
	return { queued: ids.length - failed, failed };
}
