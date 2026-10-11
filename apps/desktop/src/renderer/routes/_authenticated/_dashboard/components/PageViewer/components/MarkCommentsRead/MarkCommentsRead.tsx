import { useComments } from "@superset/ui/page-comments";
import { useEffect, useMemo, useRef } from "react";
import { cloudTrpc } from "renderer/lib/cloud-trpc";

interface MarkCommentsReadProps {
	pageId: string;
}

/**
 * Advances the viewer's read watermark while the comments UI is actually
 * showing — the panel, comment mode, or an open thread — not merely because
 * the page is open with its pins hidden. The pages list is invalidated so
 * the grid's unread dots clear when the reader goes back.
 */
export function MarkCommentsRead({ pageId }: MarkCommentsReadProps) {
	const { isLoading, threads, panelOpen, enabled, activeThreadId } =
		useComments();
	const utils = cloudTrpc.useUtils();
	const { mutate } = cloudTrpc.pageComment.markRead.useMutation({
		onSuccess: () => void utils.page.listPaginated.invalidate(),
	});

	const newestCommentAt = useMemo(() => {
		let newest = 0;
		for (const thread of threads) {
			for (const comment of thread.comments) {
				const at = new Date(comment.createdAt).getTime();
				if (at > newest) newest = at;
			}
		}
		return newest;
	}, [threads]);

	const markedAt = useRef(0);
	const commentsVisible = panelOpen || enabled || activeThreadId !== null;

	useEffect(() => {
		if (!commentsVisible || isLoading || newestCommentAt === 0) return;
		if (newestCommentAt <= markedAt.current) return;
		markedAt.current = newestCommentAt;
		mutate({ pageId });
	}, [commentsVisible, isLoading, mutate, newestCommentAt, pageId]);

	return null;
}
