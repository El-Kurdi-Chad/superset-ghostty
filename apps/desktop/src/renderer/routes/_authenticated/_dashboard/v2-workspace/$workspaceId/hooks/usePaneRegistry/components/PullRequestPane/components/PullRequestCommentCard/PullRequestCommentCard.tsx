import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { workspaceTrpc } from "@superset/workspace-client";
import { useEffect, useState } from "react";
import {
	LuArrowUpRight,
	LuCheck,
	LuCopy,
	LuFileCode,
	LuMessageSquare,
	LuUndo2,
} from "react-icons/lu";
import { CommentBody } from "renderer/components/CommentBody";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import { PullRequestCommentRow } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestCommentRow";
import type { NormalizedComment } from "../../../../../../components/CommentsSection/types";
import type { CommentPaneData, DiffFocusSide } from "../../../../../../types";

export interface PullRequestCommentCardProps {
	workspaceId: string;
	comment: NormalizedComment;
	onOpenComment: (comment: CommentPaneData) => void;
	onOpenInDiff?: (
		path: string,
		line?: number,
		openInNewTab?: boolean,
		side?: DiffFocusSide,
	) => void;
}
export function PullRequestCommentCard({
	workspaceId,
	comment,
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
	return (
		<PullRequestCommentRow
			author={{ login: comment.authorLogin, avatarUrl: comment.avatarUrl }}
			meta={
				comment.path ? (
					<span className="font-mono text-xs">
						{comment.path}
						{comment.line != null ? `:${comment.line}` : ""}
					</span>
				) : null
			}
			createdAt={comment.createdAt}
			status={
				comment.isResolved ? (
					<span className="text-emerald-600 [.dark_&]:text-emerald-400">
						<Trans>Resolved</Trans>
					</span>
				) : comment.isOutdated ? (
					<span className="text-muted-foreground">
						<Trans>Outdated</Trans>
					</span>
				) : null
			}
		>
			<article className="min-w-0" data-review-comment={comment.id}>
				<div className="mb-2 flex min-w-0 items-center gap-1">
					{comment.path && onOpenInDiff ? (
						<button
							type="button"
							onClick={openCode}
							title={comment.path}
							className="mr-auto flex min-w-0 items-center gap-1.5 text-left font-mono text-xs text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<LuFileCode className="size-3.5 shrink-0 text-muted-foreground" />
							<span className="min-w-0 truncate">{comment.path}</span>
							{comment.line != null ? (
								<span className="shrink-0 text-muted-foreground">
									:{comment.line}
								</span>
							) : null}
							<LuArrowUpRight className="size-3.5 shrink-0" />
						</button>
					) : (
						<span className="mr-auto" />
					)}
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
				</div>
				<div className="min-w-0">
					<CommentBody body={comment.body} />
				</div>
				{comment.threadId || (comment.path && onOpenInDiff) ? (
					<footer className="mt-3 flex items-center justify-between gap-3">
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
						{comment.path && onOpenInDiff ? (
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
					</footer>
				) : null}
			</article>
		</PullRequestCommentRow>
	);
}
