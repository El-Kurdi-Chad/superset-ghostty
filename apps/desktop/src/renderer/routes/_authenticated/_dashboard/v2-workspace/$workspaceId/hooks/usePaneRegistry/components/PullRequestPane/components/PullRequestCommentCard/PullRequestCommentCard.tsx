import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { workspaceTrpc } from "@superset/workspace-client";
import { useEffect, useState } from "react";
import {
	LuArrowUpRight,
	LuCheck,
	LuCopy,
	LuMessageSquare,
	LuUndo2,
} from "react-icons/lu";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import { PullRequestActivityCard } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestActivityCard";
import { PullRequestMarkdown } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestMarkdown";
import type { NormalizedComment } from "../../../../../../components/CommentsSection/types";
import type { CommentPaneData, DiffFocusSide } from "../../../../../../types";
import { PullRequestCommentReply } from "./components/PullRequestCommentReply";

export interface PullRequestCommentCardProps {
	workspaceId: string;
	comment: NormalizedComment;
	/** Later comments in the same thread. */
	replies?: NormalizedComment[];
	onOpenComment: (comment: CommentPaneData) => void;
	onOpenInDiff?: (
		path: string,
		line?: number,
		openInNewTab?: boolean,
		side?: DiffFocusSide,
	) => void;
}

/** A review thread on the activity rail: file and state in the header, the thread's actions, replies under the body. */
export function PullRequestCommentCard({
	workspaceId,
	comment,
	replies = [],
	onOpenComment,
	onOpenInDiff,
}: PullRequestCommentCardProps) {
	const { t } = useLingui();
	const [copied, setCopied] = useState(false);
	const utils = workspaceTrpc.useUtils();
	const resolve = workspaceTrpc.git.setReviewThreadResolution.useMutation({
		onSuccess: () => {
			void utils.git.getPullRequestThreads.invalidate({ workspaceId });
		},
		onError: () => {
			toast.error(t({ message: "Couldn't update thread" }));
		},
	});
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 1500);
		return () => clearTimeout(timer);
	}, [copied]);
	const canOpenCode = Boolean(comment.path && onOpenInDiff);
	const openCode = () => {
		if (comment.path)
			onOpenInDiff?.(
				comment.path,
				comment.line,
				undefined,
				comment.diffSide === "LEFT"
					? "deletions"
					: comment.diffSide === "RIGHT"
						? "additions"
						: undefined,
			);
	};
	const openComment = () =>
		onOpenComment({
			commentId: comment.id,
			authorLogin: comment.authorLogin,
			avatarUrl: comment.avatarUrl,
			body: comment.body,
			url: comment.url,
			path: comment.path,
			line: comment.line,
		});
	const copy = async () => {
		try {
			await electronTrpcClient.external.copyText.mutate(comment.body);
			setCopied(true);
		} catch {
			toast.error(t({ message: "Couldn't copy comment" }));
		}
	};
	const location = comment.path
		? `${comment.path}${comment.line != null ? `:${comment.line}` : ""}`
		: null;
	return (
		<PullRequestActivityCard
			author={{ login: comment.authorLogin, avatarUrl: comment.avatarUrl }}
			meta={
				<>
					{location && canOpenCode ? (
						<button
							type="button"
							onClick={openCode}
							title={comment.path}
							className="min-w-0 truncate font-mono text-[11px] text-foreground/80 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{location}
						</button>
					) : location ? (
						<span
							title={comment.path}
							className="min-w-0 truncate font-mono text-[11px]"
						>
							{location}
						</span>
					) : null}
					{comment.isResolved ? (
						<span className="shrink-0 text-emerald-600 [.dark_&]:text-emerald-400">
							<Trans>Resolved</Trans>
						</span>
					) : comment.isOutdated ? (
						<span className="shrink-0">
							<Trans>Outdated</Trans>
						</span>
					) : null}
				</>
			}
			createdAt={comment.createdAt}
			url={comment.url}
			actions={
				<>
					<Button
						size="icon"
						variant="ghost"
						className="size-6 text-muted-foreground"
						onClick={() => void copy()}
						aria-label={
							copied ? t({ message: "Copied" }) : t({ message: "Copy comment" })
						}
					>
						{copied ? (
							<LuCheck className="size-3.5" />
						) : (
							<LuCopy className="size-3.5" />
						)}
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-6 text-muted-foreground"
						onClick={openComment}
						aria-label={t({ message: "Open as comment pane" })}
					>
						<LuMessageSquare className="size-3.5" />
					</Button>
					{comment.url ? (
						<Button
							asChild
							size="icon"
							variant="ghost"
							className="size-6 text-muted-foreground"
						>
							<a
								href={comment.url}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={t({ message: "Open comment on GitHub" })}
							>
								<LuArrowUpRight className="size-3.5" />
							</a>
						</Button>
					) : null}
				</>
			}
			replies={
				replies.length > 0
					? replies.map((reply) => (
							<PullRequestCommentReply key={reply.id} comment={reply} />
						))
					: null
			}
			footer={
				comment.threadId || canOpenCode ? (
					<>
						{comment.threadId ? (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
								disabled={resolve.isPending}
								onClick={() => {
									if (comment.threadId)
										resolve.mutate({
											workspaceId,
											threadId: comment.threadId,
											resolved: !comment.isResolved,
										});
								}}
							>
								{comment.isResolved ? (
									<LuUndo2 className="size-3.5" />
								) : (
									<LuCheck className="size-3.5" />
								)}
								{comment.isResolved ? (
									<Trans>Unresolve</Trans>
								) : (
									<Trans>Resolve conversation</Trans>
								)}
							</Button>
						) : (
							<span />
						)}
						{canOpenCode ? (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 gap-1.5 px-2 text-xs"
								onClick={openCode}
							>
								<Trans>Open in diff</Trans>
								<LuArrowUpRight className="size-3.5" />
							</Button>
						) : null}
					</>
				) : null
			}
		>
			<PullRequestMarkdown body={comment.body} size="comment" />
		</PullRequestActivityCard>
	);
}
