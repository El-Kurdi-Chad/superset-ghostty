import type { GhosttyAppearance } from "main/lib/ghostty/helpers";
import { useSyncExternalStore } from "react";
import type { TerminalAppearance } from "./index";

// Whether terminals use the user's Ghostty look (font, colors, cursor). On by
// default; the 👻 button in the terminal header flips it for every terminal.
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

export function useGhosttyMode(): boolean {
	return useSyncExternalStore(subscribe, readPreference);
}

/**
 * Superset's terminal appearance with the user's Ghostty settings on top.
 * Ghostty's fonts go first and Superset's stack stays as the fallback for
 * glyphs they lack.
 */
export function applyGhosttyAppearance(
	base: TerminalAppearance,
	ghostty: GhosttyAppearance,
): TerminalAppearance {
	const theme = { ...base.theme, ...ghostty.theme };
	// Ghostty draws an unset cursor in the text color.
	theme.cursor =
		ghostty.theme.cursor ?? ghostty.theme.foreground ?? base.theme.cursor;
	return {
		...base,
		theme,
		background: theme.background ?? base.background,
		fontFamily: [
			...ghostty.fontFamilies.map((family) => `"${family}"`),
			base.fontFamily,
		].join(", "),
		fontSize: ghostty.fontSize ?? base.fontSize,
		cursorStyle: ghostty.cursorStyle ?? base.cursorStyle,
		cursorBlink: ghostty.cursorBlink ?? base.cursorBlink,
	};
}
