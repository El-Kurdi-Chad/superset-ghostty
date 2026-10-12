import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useRef } from "react";
import type { PullRequestDetailComment } from "../../../../hooks/usePullRequestDetail";
import { usePullRequestActivityReply } from "../../../../providers/PullRequestActivityReplyProvider";
import {
	type PullRequestCommentSeverity,
	parseFindingComment,
} from "../../../../utils/parseFindingComment";
import { quotePullRequestComment } from "../../../../utils/quotePullRequestComment";
import { PullRequestActivityCard } from "../../../PullRequestActivityCard";
import { PullRequestMarkdown } from "../../../PullRequestMarkdown";
import { PullRequestReplyAction } from "../../../PullRequestReplyAction";
import { PullRequestReviewStateLabel } from "../PullRequestReviewStateLabel";

/** The reader's selection when it lies inside this element; one elsewhere on the page is not about this comment. */
function selectedTextWithin(element: HTMLElement): string {
	const selection = window.getSelection();
	if (!selection || selection.isCollapsed) return "";
	const { anchorNode, focusNode } = selection;
	return anchorNode &&
		focusNode &&
		element.contains(anchorNode) &&
		element.contains(focusNode)
		? selection.toString()
		: "";
}

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

interface PullRequestActivityCommentProps {
	comment: PullRequestDetailComment;
	prUrl: string;
}

/**
 * A conversation comment or review as a card; a bot finding leads with its
 * title and severity. Reply starts a conversation comment that quotes this
 * one, which is as close as GitHub's unthreaded conversation gets to a reply.
 */
export function PullRequestActivityComment({
	comment,
	prUrl,
}: PullRequestActivityCommentProps) {
	const reply = usePullRequestActivityReply();
	const bodyRef = useRef<HTMLDivElement>(null);
	const finding = parseFindingComment(comment.body);
	const body = (finding ? finding.body : comment.body).trim();
	const quoteIntoComposer = () => {
		const element = bodyRef.current;
		reply?.quote(
			quotePullRequestComment({
				selection: element ? selectedTextWithin(element) : "",
				text: element?.innerText ?? "",
			}),
		);
	};
	return (
		<PullRequestActivityCard
			author={comment.author}
			meta={
				<>
					{comment.kind === "review" ? (
						<PullRequestReviewStateLabel state={comment.reviewState} />
					) : null}
					{finding ? (
						<span
							className={cn("shrink-0", SEVERITY_CLASS_NAME[finding.severity])}
						>
							<SeverityLabel severity={finding.severity} />
						</span>
					) : null}
				</>
			}
			createdAt={comment.createdAt}
			url={comment.url}
			actions={
				<PullRequestReplyAction
					onReply={reply ? quoteIntoComposer : null}
					href={comment.url ?? prUrl}
				/>
			}
		>
			{finding || body ? (
				<div ref={bodyRef} className="min-w-0">
					{finding ? (
						<p className="mb-2 text-sm font-semibold text-foreground">
							{finding.title}
						</p>
					) : null}
					{body ? <PullRequestMarkdown body={body} size="comment" /> : null}
				</div>
			) : null}
		</PullRequestActivityCard>
	);
}
