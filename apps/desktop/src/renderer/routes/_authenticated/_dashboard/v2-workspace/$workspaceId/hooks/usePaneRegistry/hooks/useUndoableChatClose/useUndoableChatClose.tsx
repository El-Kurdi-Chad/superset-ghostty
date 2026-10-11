import { useLingui } from "@lingui/react/macro";
import type { Pane, WorkspaceStore } from "@superset/panes";
import { toast } from "@superset/ui/sonner";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { ChatPaneData, PaneViewerData } from "../../../../types";
import {
	isChatSessionClosed,
	markChatSessionClosed,
} from "../../../../utils/closedChatSessions";
import {
	setPendingChatStops,
	takePendingChatStops,
} from "../../../../utils/pendingChatStops";
import { ChatClosedToast } from "./components/ChatClosedToast";
import { createClosedChatBatches } from "./utils/closedChatBatches";

const UNDO_WINDOW_MS = 10_000;

interface ClosedChat {
	pane: Pane<PaneViewerData>;
	sessionId: string;
	title: string;
	reopen: () => void;
}

export function useUndoableChatClose({
	workspaceId,
	store,
	stopChat,
}: {
	workspaceId: string;
	store: StoreApi<WorkspaceStore<PaneViewerData>>;
	stopChat: (sessionId: string) => Promise<boolean>;
}): (pane: Pane<PaneViewerData>) => void {
	const { t } = useLingui();
	const latest = useRef({ workspaceId, store, stopChat });
	latest.current = { workspaceId, store, stopChat };

	const [batches] = useState(() =>
		createClosedChatBatches<ClosedChat>({
			show: ({ id, chats }) =>
				toast.custom(
					() => (
						<ChatClosedToast
							durationMs={UNDO_WINDOW_MS}
							onUndo={() => batches.undo(id)}
							titles={chats.map((chat) => chat.title)}
						/>
					),
					{
						id,
						duration: UNDO_WINDOW_MS,
						onAutoClose: () => batches.expire(id),
						onDismiss: () => batches.expire(id),
					},
				),
			hide: (id) => toast.dismiss(id),
			restore: (chat) => {
				chat.reopen();
				latest.current.store.getState().addTab({ panes: [chat.pane] });
			},
			stop: (chat) => void latest.current.stopChat(chat.sessionId),
			persist: (chats) =>
				setPendingChatStops(
					latest.current.workspaceId,
					chats.map((chat) => chat.sessionId),
				),
		}),
	);

	useEffect(() => {
		for (const sessionId of takePendingChatStops(workspaceId)) {
			void latest.current.stopChat(sessionId);
		}
	}, [workspaceId]);

	useEffect(() => () => batches.flush(), [batches]);

	return useCallback(
		(pane) => {
			const data = pane.data as ChatPaneData;
			const { sessionId } = data;
			if (!sessionId || isChatSessionClosed(sessionId)) return;
			batches.add({
				pane,
				sessionId,
				title: pane.titleOverride ?? data.chatTitle ?? t({ message: "Chat" }),
				reopen: markChatSessionClosed(sessionId),
			});
		},
		[batches, t],
	);
}
