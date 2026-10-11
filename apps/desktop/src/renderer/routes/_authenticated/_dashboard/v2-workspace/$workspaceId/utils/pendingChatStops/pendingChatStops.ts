const STORAGE_KEY = "pending-chat-stops-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface PendingChatStop {
	workspaceId: string;
	sessionId: string;
	closedAt: number;
}

function read(): PendingChatStop[] {
	try {
		const parsed: unknown = JSON.parse(
			localStorage.getItem(STORAGE_KEY) ?? "[]",
		);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry: PendingChatStop) => Date.now() - entry.closedAt < MAX_AGE_MS,
		);
	} catch {
		return [];
	}
}

function write(entries: PendingChatStop[]): void {
	if (entries.length === 0) localStorage.removeItem(STORAGE_KEY);
	else localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function readPendingChatStopIds(): string[] {
	return read().map((entry) => entry.sessionId);
}

export function setPendingChatStops(
	workspaceId: string,
	sessionIds: string[],
): void {
	const closedAt = Date.now();
	write([
		...read().filter((entry) => entry.workspaceId !== workspaceId),
		...sessionIds.map((sessionId) => ({ workspaceId, sessionId, closedAt })),
	]);
}

export function takePendingChatStops(workspaceId: string): string[] {
	const entries = read();
	write(entries.filter((entry) => entry.workspaceId !== workspaceId));
	return entries
		.filter((entry) => entry.workspaceId === workspaceId)
		.map((entry) => entry.sessionId);
}
