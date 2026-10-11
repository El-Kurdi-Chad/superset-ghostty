import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "../../../../db/schema";
import { projects, pullRequests, workspaces } from "../../../../db/schema";
import type { HostServiceContext } from "../../../../types";
import { createCallerFactory, router } from "../../../index";
import { getLinkedWorkspace } from "./get-linked-workspace";

const MIGRATIONS_FOLDER = resolve(import.meta.dir, "../../../../../drizzle");
const PROJECT_ID = "project-1";
const PR_ID = "pr-1";
const PR_NUMBER = 42;

const createCaller = createCallerFactory(router({ getLinkedWorkspace }));

function createCallerWithDb() {
	const sqlite = new Database(":memory:");
	sqlite.exec("PRAGMA foreign_keys = ON");
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
	db.insert(projects).values({ id: PROJECT_ID, repoPath: "/tmp/repo" }).run();
	db.insert(pullRequests)
		.values({
			id: PR_ID,
			projectId: PROJECT_ID,
			repoProvider: "github",
			repoOwner: "octocat",
			repoName: "hello",
			prNumber: PR_NUMBER,
			url: "https://github.com/octocat/hello/pull/42",
			title: "Fix",
			state: "open",
			headBranch: "fix",
			headSha: "abc",
		})
		.run();
	const caller = createCaller({
		db,
		isAuthenticated: true,
	} as unknown as HostServiceContext);
	return { db, caller };
}

function workspace(
	id: string,
	updatedAt: number,
	archive: { archivedAt: number; archiveReason: "user" | "deleted" } | null,
) {
	return {
		id,
		projectId: PROJECT_ID,
		worktreePath: `/tmp/${id}`,
		branch: "fix",
		pullRequestId: PR_ID,
		updatedAt,
		createdAt: updatedAt,
		archivedAt: archive?.archivedAt ?? null,
		archiveReason: archive?.archiveReason ?? null,
	};
}

describe("pullRequests.getLinkedWorkspace", () => {
	test("a live workspace wins over a more recently archived one on the same PR", async () => {
		const { db, caller } = createCallerWithDb();
		db.insert(workspaces)
			.values([
				workspace("ws-live", 1_000, null),
				workspace("ws-put-away", 2_000, {
					archivedAt: 2_000,
					archiveReason: "user",
				}),
			])
			.run();
		expect(
			await caller.getLinkedWorkspace({
				projectId: PROJECT_ID,
				prNumber: PR_NUMBER,
			}),
		).toEqual({ workspaceId: "ws-live" });
	});

	test("the most recently active live workspace breaks a tie", async () => {
		const { db, caller } = createCallerWithDb();
		db.insert(workspaces)
			.values([
				workspace("ws-older", 1_000, null),
				workspace("ws-newer", 2_000, null),
			])
			.run();
		expect(
			await caller.getLinkedWorkspace({
				projectId: PROJECT_ID,
				prNumber: PR_NUMBER,
			}),
		).toEqual({ workspaceId: "ws-newer" });
	});

	test("answers none when every linked workspace is archived or destroyed", async () => {
		const { db, caller } = createCallerWithDb();
		db.insert(workspaces)
			.values([
				workspace("ws-put-away", 1_000, {
					archivedAt: 1_000,
					archiveReason: "user",
				}),
				workspace("ws-gone", 2_000, {
					archivedAt: 2_000,
					archiveReason: "deleted",
				}),
			])
			.run();
		expect(
			await caller.getLinkedWorkspace({
				projectId: PROJECT_ID,
				prNumber: PR_NUMBER,
			}),
		).toEqual({ workspaceId: null });
	});
});
