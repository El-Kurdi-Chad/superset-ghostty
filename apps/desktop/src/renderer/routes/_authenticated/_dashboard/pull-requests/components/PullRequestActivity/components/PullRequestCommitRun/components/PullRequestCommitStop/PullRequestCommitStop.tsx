import { cn } from "@superset/ui/utils";
import type { PullRequestDetailCommit } from "../../../../../../hooks/usePullRequestDetail";
import { TIMELINE_GAP_CLASS_NAME } from "../../../PullRequestTimelineStop";

interface PullRequestCommitStopProps {
	commit: PullRequestDetailCommit;
	last: boolean;
}

/** A commit's subject and short SHA on the rail; the line runs through its dot so a push reads as one stretch. */
export function PullRequestCommitStop({
	commit,
	last,
}: PullRequestCommitStopProps) {
	return (
		<li className="flex gap-3">
			<div aria-hidden className="flex w-5 shrink-0 flex-col items-center">
				<span className="h-1.5 w-px shrink-0 bg-border" />
				<span className="size-2 shrink-0 rounded-full border-[1.5px] border-muted-foreground/60" />
				{last ? null : <span className="w-px flex-1 bg-border" />}
			</div>
			<div className={cn("min-w-0 flex-1", !last && TIMELINE_GAP_CLASS_NAME)}>
				<a
					href={commit.url}
					target="_blank"
					rel="noopener noreferrer"
					title={commit.messageHeadline}
					className="group flex h-5 w-full min-w-0 items-center gap-3 text-xs"
				>
					<span className="min-w-0 flex-1 truncate text-foreground/80 transition-colors group-hover:text-foreground">
						{commit.messageHeadline}
					</span>
					<span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 transition-colors group-hover:text-muted-foreground">
						{commit.oid.slice(0, 7)}
					</span>
				</a>
			</div>
		</li>
	);
}
