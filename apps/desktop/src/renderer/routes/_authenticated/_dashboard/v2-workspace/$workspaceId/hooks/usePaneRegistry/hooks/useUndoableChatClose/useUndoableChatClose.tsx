import { useLingui } from "@lingui/react/macro";
import type { Pane, WorkspaceStore } from "@superset/panes";
import { toast } from "@superset/ui/sonner";
import { useCallback, useEffect, useRef } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { ChatPaneData, PaneViewerData } from "../../../../types";
import {
	isChatSessionClosed,
	markChatSessionClosed,
} from "../../../../utils/closedChatSessions";
import { ChatClosedToast } from "./components/ChatClosedToast";

const UNDO_WINDOW_MS = 10_000;

interface ClosedChat {
	pane: Pane<PaneViewerData>;
	sessionId: string;
	title: string;
	reopen: () => void;
}

interface ClosedChatBatch {
	chats: ClosedChat[];
	toastId: string;
	settled: boolean;
	settle: (undo: boolean) => void;
}

export function useUndoableChatClose({
	store,
	stopChat,
}: {
	store: StoreApi<WorkspaceStore<PaneViewerData>>;
	stopChat: (sessionId: string) => Promise<boolean>;
}): (pane: Pane<PaneViewerData>) => void {
	const { t } = useLingui();
	const batchRef = useRef<ClosedChatBatch | null>(null);

	useEffect(
		() => () => {
			const batch = batchRef.current;
			if (!batch) return;
			batch.settle(false);
			toast.dismiss(batch.toastId);
		},
		[],
	);

	return useCallback(
		(pane) => {
			const data = pane.data as ChatPaneData;
			const { sessionId } = data;
			if (!sessionId || isChatSessionClosed(sessionId)) return;

			const previous = batchRef.current;
			if (previous) {
				previous.settled = true;
				toast.dismiss(previous.toastId);
			}
			const batch: ClosedChatBatch = {
				chats: [
					...(previous?.chats ?? []),
					{
						pane,
						sessionId,
						title:
							pane.titleOverride ?? data.chatTitle ?? t({ message: "Chat" }),
						reopen: markChatSessionClosed(sessionId),
					},
				],
				toastId: crypto.randomUUID(),
				settled: false,
				settle: (undo) => {
					if (batch.settled) return;
					batch.settled = true;
					if (batchRef.current === batch) batchRef.current = null;
					for (const chat of batch.chats) {
						if (undo) {
							chat.reopen();
							store.getState().addTab({ panes: [chat.pane] });
						} else {
							void stopChat(chat.sessionId);
						}
					}
				},
			};
			batchRef.current = batch;

			toast.custom(
				() => (
					<ChatClosedToast
						durationMs={UNDO_WINDOW_MS}
						onUndo={() => {
							batch.settle(true);
							toast.dismiss(batch.toastId);
						}}
						titles={batch.chats.map((chat) => chat.title)}
					/>
				),
				{
					id: batch.toastId,
					duration: UNDO_WINDOW_MS,
					onAutoClose: () => batch.settle(false),
					onDismiss: () => batch.settle(false),
				},
			);
		},
		[store, stopChat, t],
	);
}
