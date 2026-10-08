import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import type { PullRequestDetailComment } from "../../../../hooks/usePullRequestDetail";
import {
	type PullRequestCommentSeverity,
	parseFindingComment,
} from "../../../../utils/parseFindingComment";
import { PullRequestCommentRow } from "../../../PullRequestCommentRow";
import { PullRequestMarkdown } from "../../../PullRequestMarkdown";

const SEVERITY_CLASS_NAME: Record<PullRequestCommentSeverity, string> = {
	High: "text-red-600 [.dark_&]:text-[#f87171]",
	Medium: "text-amber-600 [.dark_&]:text-[#fbbf24]",
	Low: "text-muted-foreground",
};

function SeverityLabel({ severity }: { severity: PullRequestCommentSeverity }) {
	switch (severity) {
		case "High":
			return <Trans>High severity</Trans>;
		case "Medium":
			return <Trans>Medium severity</Trans>;
		default:
			return <Trans>Low severity</Trans>;
	}
}

function ReviewStateLabel({ state }: { state: string | null }) {
	switch (state) {
		case "APPROVED":
			return <Trans>approved</Trans>;
		case "CHANGES_REQUESTED":
			return <Trans>requested changes</Trans>;
		case "COMMENTED":
			return <Trans>reviewed</Trans>;
		default:
			return null;
	}
}

interface PullRequestConversationCommentProps {
	comment: PullRequestDetailComment;
	prUrl: string;
	defaultOpen?: boolean;
}

/** One conversation comment or review as a folded row; a bot finding shows its severity. */
export function PullRequestConversationComment({
	comment,
	prUrl,
	defaultOpen = false,
}: PullRequestConversationCommentProps) {
	const finding = parseFindingComment(comment.body);
	const body = finding ? finding.body : comment.body;
	return (
		<PullRequestCommentRow
			author={comment.author}
			meta={
				comment.kind === "review" ? (
					<ReviewStateLabel state={comment.reviewState} />
				) : null
			}
			createdAt={comment.createdAt}
			status={
				finding ? (
					<span className={cn(SEVERITY_CLASS_NAME[finding.severity])}>
						<SeverityLabel severity={finding.severity} />
					</span>
				) : null
			}
			defaultOpen={defaultOpen}
		>
			{finding ? (
				<p className="mb-2 text-sm font-semibold text-foreground">
					{finding.title}
				</p>
			) : null}
			{body.trim() ? (
				<PullRequestMarkdown body={body} />
			) : (
				<p className="text-sm italic text-muted-foreground">
					<Trans>No review body.</Trans>
				</p>
			)}
			<div className="mt-2 flex justify-end">
				<a
					href={comment.url ?? prUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
				>
					<Trans>Reply</Trans>
				</a>
			</div>
		</PullRequestCommentRow>
	);
}
