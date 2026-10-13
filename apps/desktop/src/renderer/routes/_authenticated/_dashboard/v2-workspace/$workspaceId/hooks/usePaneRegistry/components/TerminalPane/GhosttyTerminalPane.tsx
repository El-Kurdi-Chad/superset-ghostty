import { useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { useWorkspaceWsUrl, workspaceTrpc } from "@superset/workspace-client";
import { Ghost } from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useWorkspaceHostTarget } from "renderer/hooks/host-service/useWorkspaceHostUrl";
import { useTerminalAppearance } from "renderer/hooks/useTerminalAppearance";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { terminalQueryColors } from "renderer/lib/terminal/terminal-query-colors";
import type { TerminalPaneData } from "renderer/routes/_authenticated/_dashboard/v2-workspace/$workspaceId/types";
import { useTheme } from "renderer/stores/theme";
import { resolveTerminalThemeType } from "renderer/stores/theme/utils";
import { setGhosttyPreference, useGhosttyMode } from "./ghosttyMode";
import { TerminalPane as BuiltinTerminalPane } from "./TerminalPane";

type TerminalPaneProps = ComponentProps<typeof BuiltinTerminalPane>;

// Panes remount on tab and workspace switches. Auto-open once per terminal per
// app run, so closing a Ghostty tab on purpose doesn't make it pop back up.
const autoOpened = new Set<string>();

/**
 * Terminal pane that shows its session in Ghostty when Ghostty mode is on and
 * the workspace lives on this Mac; otherwise the built-in xterm pane.
 */
export function TerminalPane(props: TerminalPaneProps) {
	const mode = useGhosttyMode();
	const host = useWorkspaceHostTarget(props.workspaceId);
	const [fallback, setFallback] = useState(false);

	// Wait for both answers instead of flashing the built-in pane, whose socket
	// would attach (and maybe create the session) only to be torn down.
	const hostKnown = host.status === "ready" || host.status === "not-found";
	if (!mode.ready || (mode.enabled && !hostKnown)) {
		return <div className="h-full w-full" />;
	}

	const local = host.status === "ready" && host.kind === "local";
	if (!mode.enabled || !local || fallback) {
		return <BuiltinTerminalPane {...props} />;
	}
	return (
		<GhosttyPlaceholder {...props} onUnsupported={() => setFallback(true)} />
	);
}

function GhosttyPlaceholder({
	ctx,
	workspaceId,
	onUnsupported,
}: TerminalPaneProps & { onUnsupported: () => void }) {
	const { t } = useLingui();
	const { terminalId, createOnAttach } = ctx.pane.data as TerminalPaneData;
	const openTerminal = electronTrpc.ghostty.openTerminal.useMutation();

	// Same attach params the built-in pane sends, so a session created from
	// Ghostty gets the same theme-derived env (COLORFGBG) and color answers.
	const appearance = useTerminalAppearance();
	const themeType = resolveTerminalThemeType({
		activeThemeType: useTheme()?.type,
	});
	const websocketUrl = new URL(useWorkspaceWsUrl(`/terminal/${terminalId}`));
	websocketUrl.searchParams.set("themeType", themeType);
	websocketUrl.searchParams.set(
		"colors",
		JSON.stringify(terminalQueryColors(appearance.theme)),
	);
	if (createOnAttach) websocketUrl.searchParams.set("create", "1");
	const websocketUrlRef = useRef(websocketUrl.toString());
	websocketUrlRef.current = websocketUrl.toString();

	const sessions = workspaceTrpc.terminal.list.useQuery(
		{ workspaceId },
		{ refetchInterval: 3_000 },
	);
	const live = sessions.data?.sessions.some(
		(session) => session.terminalId === terminalId && !session.exited,
	);
	const seenLive = useRef(false);
	if (live) seenLive.current = true;
	const ended = seenLive.current && sessions.isFetched && !live;

	const openRef = useRef(openTerminal.mutateAsync);
	openRef.current = openTerminal.mutateAsync;
	const onUnsupportedRef = useRef(onUnsupported);
	onUnsupportedRef.current = onUnsupported;

	const open = async (focus: boolean) => {
		try {
			const result = await openRef.current({
				terminalId,
				workspaceId,
				websocketUrl: websocketUrlRef.current,
				focus,
			});
			if (result.status === "unsupported") {
				toast.error(t({ message: "Can't open this terminal in Ghostty" }), {
					description: result.reason,
				});
				onUnsupportedRef.current();
			}
		} catch (error) {
			toast.error(t({ message: "Can't open this terminal in Ghostty" }), {
				description: error instanceof Error ? error.message : String(error),
			});
			onUnsupportedRef.current();
		}
	};
	const openOnceRef = useRef(open);
	openOnceRef.current = open;

	useEffect(() => {
		if (autoOpened.has(terminalId)) return;
		autoOpened.add(terminalId);
		void openOnceRef.current(false);
	}, [terminalId]);

	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
			<Ghost className="size-8 text-muted-foreground" />
			<div className="text-sm text-muted-foreground">
				{ended
					? t({ message: "This session has ended." })
					: t({ message: "This terminal runs in Ghostty." })}
			</div>
			{!ended && (
				<Button
					size="sm"
					disabled={openTerminal.isPending}
					onClick={() => void open(true)}
				>
					{t({ message: "Show in Ghostty" })}
				</Button>
			)}
			<button
				type="button"
				className="text-xs text-muted-foreground/70 underline-offset-2 hover:underline"
				onClick={() => setGhosttyPreference(false)}
			>
				{t({ message: "Use the built-in terminal instead" })}
			</button>
		</div>
	);
}

/** Header button: switch every terminal pane between Ghostty and built-in. */
export function GhosttyModeToggle({ workspaceId }: { workspaceId: string }) {
	const { t } = useLingui();
	const mode = useGhosttyMode();
	const host = useWorkspaceHostTarget(workspaceId);
	if (!mode.available || host.status !== "ready" || host.kind !== "local") {
		return null;
	}
	const label = mode.enabled
		? t({ message: "Use the built-in terminal" })
		: t({ message: "Open terminals in Ghostty" });
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={() => setGhosttyPreference(!mode.enabled)}
					aria-label={label}
					aria-pressed={mode.enabled}
					className={cn(
						"hidden rounded p-1 transition-colors @min-[200px]/pane-header:block",
						mode.enabled
							? "bg-secondary text-foreground"
							: "text-muted-foreground/60 hover:text-muted-foreground",
					)}
				>
					<Ghost className="size-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
