import { useSyncExternalStore } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";

// Whether terminal panes open in Ghostty. On by default whenever Ghostty is
// installed; the header toggle flips it for every pane at once.
const STORAGE_KEY = "superset-ghostty:enabled";
const listeners = new Set<() => void>();

function readPreference(): boolean {
	try {
		return window.localStorage.getItem(STORAGE_KEY) !== "false";
	} catch {
		return true;
	}
}

export function setGhosttyPreference(enabled: boolean) {
	try {
		window.localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {}
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useGhosttyMode() {
	const preferred = useSyncExternalStore(subscribe, readPreference);
	const status = electronTrpc.ghostty.status.useQuery(undefined, {
		staleTime: 60_000,
	});
	const available = status.data?.available === true;
	return {
		ready: status.isFetched,
		available,
		enabled: available && preferred,
	};
}
