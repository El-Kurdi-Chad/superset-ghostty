import { Trans, useLingui } from "@lingui/react/macro";
import { ArrowUpRight } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import type {
	PullRequestDetail,
	PullRequestDetailComment,
} from "../../hooks/usePullRequestDetail";
import {
	type PullRequestCommentTarget,
	PullRequestConversationComposer,
} from "../PullRequestConversationComposer";
import { PullRequestConversationComment } from "./components/PullRequestConversationComment";

/** GitHub files a review for every batch of inline comments; one with no
 *  body and no verdict is only that container, not something to read. */
function isEmptyReviewShell(comment: PullRequestDetailComment): boolean {
	return (
		comment.kind === "review" &&
		comment.body.trim() === "" &&
		comment.reviewState !== "APPROVED" &&
		comment.reviewState !== "CHANGES_REQUESTED"
	);
}

interface PullRequestConversationProps {
	data: PullRequestDetail;
	/** Where a new comment posts; null hides the composer. */
	commentTarget: PullRequestCommentTarget | null;
	/** Review-thread rows the host adds after the conversation. */
	children?: ReactNode;
	/** How many rows `children` holds, for the heading count. */
	threadCount?: number;
}

/**
 * The Comments section: conversation comments and reviews oldest first as
 * folded rows, the host's review threads after them, and the composer last.
 * Older hosts and the cloud route send no comments, so without threads or a
 * composer there is nothing to show.
 */
export function PullRequestConversation({
	data,
	commentTarget,
	children,
	threadCount = 0,
}: PullRequestConversationProps) {
	const { t } = useLingui();
	const comments = useMemo(
		() =>
			(data.comments ?? [])
				.filter((comment) => !isEmptyReviewShell(comment))
				.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
		[data.comments],
	);
	if (data.comments === undefined && !children && !commentTarget) return null;
	const total = comments.length + threadCount;
	return (
		<section className="min-w-0" data-pr-comments>
			<div className="flex h-10 items-center gap-2">
				<h2 className="text-sm font-medium">
					<Trans>Comments</Trans>
				</h2>
				{data.comments !== undefined || threadCount > 0 ? (
					<span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
						{total}
					</span>
				) : null}
				<a
					href={data.url}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={t({ message: "Open on GitHub" })}
					className="ml-auto flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
				>
					<ArrowUpRight className="size-4" />
				</a>
			</div>
			<div className="space-y-1.5">
				{comments.map((comment, index) => (
					<PullRequestConversationComment
						key={comment.id}
						comment={comment}
						prUrl={data.url}
						defaultOpen={comments.length <= 2 && index === comments.length - 1}
					/>
				))}
				{children}
				{total === 0 && data.comments !== undefined ? (
					<p className="py-3 text-center text-sm text-muted-foreground">
						<Trans>No comments</Trans>
					</p>
				) : null}
			</div>
			{commentTarget ? (
				<div className="mt-3">
					<PullRequestConversationComposer target={commentTarget} />
				</div>
			) : null}
		</section>
	);
}
