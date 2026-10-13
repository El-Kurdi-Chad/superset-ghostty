import { useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { Ghost, SquareArrowOutUpRight } from "lucide-react";
import { useWorkspaceHostTarget } from "renderer/hooks/host-service/useWorkspaceHostUrl";
import { electronTrpc } from "renderer/lib/electron-trpc";
import {
	setGhosttyPreference,
	useGhosttyMode,
} from "renderer/lib/terminal/appearance/ghostty";
import { useWorkspaceWsUrl } from "renderer/routes/_authenticated/_dashboard/v2-workspace/providers/WorkspaceTrpcProvider/WorkspaceTrpcProvider";

const headerButtonClass =
	"hidden rounded p-1 transition-colors @min-[200px]/pane-header:block";

/** Switches every terminal between the user's Ghostty look and Superset's. */
export function GhosttyModeToggle() {
	const { t } = useLingui();
	const enabled = useGhosttyMode();
	const label = enabled
		? t({ message: "Use Superset's terminal style" })
		: t({ message: "Use my Ghostty style" });
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={() => setGhosttyPreference(!enabled)}
					aria-label={label}
					aria-pressed={enabled}
					className={cn(
						headerButtonClass,
						enabled
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

/**
 * Header button: open this session in a tab of the Ghostty app too (macOS,
 * Ghostty 1.3+, workspaces on this Mac). The tab attaches to the same session.
 */
export function GhosttyOpenInAppButton({
	workspaceId,
	terminalId,
}: {
	workspaceId: string;
	terminalId: string;
}) {
	const { t } = useLingui();
	const status = electronTrpc.ghostty.status.useQuery(undefined, {
		staleTime: 60_000,
	});
	const host = useWorkspaceHostTarget(workspaceId);
	const websocketUrl = useWorkspaceWsUrl(`/terminal/${terminalId}`);
	const openTerminal = electronTrpc.ghostty.openTerminal.useMutation();
	if (
		status.data?.available !== true ||
		host.status !== "ready" ||
		host.kind !== "local"
	) {
		return null;
	}

	const label = t({ message: "Open in the Ghostty app" });
	const open = async () => {
		try {
			const result = await openTerminal.mutateAsync({
				terminalId,
				workspaceId,
				websocketUrl,
				focus: true,
			});
			if (result.status === "unsupported") {
				toast.error(label, { description: result.reason });
			}
		} catch (error) {
			toast.error(label, {
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={() => void open()}
					disabled={openTerminal.isPending}
					aria-label={label}
					className={cn(
						headerButtonClass,
						"text-muted-foreground/60 hover:text-muted-foreground",
					)}
				>
					<SquareArrowOutUpRight className="size-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
