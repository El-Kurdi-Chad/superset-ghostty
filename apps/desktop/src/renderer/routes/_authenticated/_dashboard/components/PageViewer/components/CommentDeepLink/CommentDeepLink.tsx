import { useComments } from "@superset/ui/page-comments";
import { useEffect, useRef } from "react";

interface CommentDeepLinkProps {
	threadId: string | null;
	openPanel: boolean;
}

/**
 * Applies a comment deep link once threads have loaded: opens the comments
 * panel and, when the link names a thread that still exists, activates it so
 * the panel scrolls to it. One-shot — later navigation inside the viewer is
 * the reader's own.
 */
export function CommentDeepLink({ threadId, openPanel }: CommentDeepLinkProps) {
	const { isLoading, threads, setPanelOpen, setActiveThreadId } = useComments();
	const applied = useRef(false);

	useEffect(() => {
		if (applied.current) return;
		if (!threadId && !openPanel) {
			applied.current = true;
			return;
		}
		if (isLoading) return;
		applied.current = true;
		setPanelOpen(true);
		if (threadId && threads.some((thread) => thread.id === threadId)) {
			setActiveThreadId(threadId);
		}
	}, [
		isLoading,
		openPanel,
		setActiveThreadId,
		setPanelOpen,
		threadId,
		threads,
	]);

	return null;
}
