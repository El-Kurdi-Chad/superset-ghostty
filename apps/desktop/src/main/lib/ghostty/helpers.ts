import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function readBundleVersion(appPath: string): string | null {
	try {
		const plist = readFileSync(join(appPath, "Contents/Info.plist"), "utf8");
		return (
			plist.match(
				/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
			)?.[1] ?? null
		);
	} catch {
		return null;
	}
}

export function isAtLeast(version: string, minimum: number[]): boolean {
	const parts = version.split(".").map((part) => Number.parseInt(part, 10));
	for (let i = 0; i < minimum.length; i++) {
		const part = Number.isNaN(parts[i]) ? 0 : (parts[i] ?? 0);
		if (part !== minimum[i]) return part > (minimum[i] ?? 0);
	}
	return true;
}

/**
 * The host-service dir under `hostsRoot` whose manifest serves `endpointUrl`,
 * or null when no local host does (remote and cloud workspaces).
 */
export function findLocalHostDir(
	hostsRoot: string,
	endpointUrl: string,
): string | null {
	// Compare host:port only: the pane dials ws:// while the manifest says http://.
	let host: string;
	try {
		host = new URL(endpointUrl).host;
	} catch {
		return null;
	}
	let entries: string[];
	try {
		entries = readdirSync(hostsRoot);
	} catch {
		return null;
	}
	for (const entry of entries) {
		const dir = join(hostsRoot, entry);
		try {
			const manifest = JSON.parse(
				readFileSync(join(dir, "manifest.json"), "utf8"),
			) as { endpoint?: string };
			if (manifest.endpoint && new URL(manifest.endpoint).host === host) {
				return dir;
			}
		} catch {}
	}
	return null;
}

const ANSI_NAMES = [
	"black",
	"red",
	"green",
	"yellow",
	"blue",
	"magenta",
	"cyan",
	"white",
	"brightBlack",
	"brightRed",
	"brightGreen",
	"brightYellow",
	"brightBlue",
	"brightMagenta",
	"brightCyan",
	"brightWhite",
] as const;

const THEME_KEYS = {
	background: "background",
	foreground: "foreground",
	"cursor-color": "cursor",
	"cursor-text": "cursorAccent",
	"selection-background": "selectionBackground",
	"selection-foreground": "selectionForeground",
} as const;

type ThemeKey =
	| (typeof ANSI_NAMES)[number]
	| (typeof THEME_KEYS)[keyof typeof THEME_KEYS];

export interface GhosttyAppearance {
	fontFamilies: string[];
	fontSize: number | null;
	cursorStyle: "block" | "bar" | "underline" | null;
	cursorBlink: boolean | null;
	/** macos-option-as-alt: Option sends Alt instead of composing characters. */
	optionAsAlt: boolean;
	theme: Partial<Record<ThemeKey, string>>;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
// Font names end up in a CSS font shorthand; keep them to plain names.
const FONT_NAME = /^[^"'\\;{}<>]{1,100}$/;

/** Reads the output of `ghostty +show-config --default` (one `key = value` per line). */
export function parseGhosttyConfig(text: string): GhosttyAppearance {
	const appearance: GhosttyAppearance = {
		fontFamilies: [],
		fontSize: null,
		cursorStyle: null,
		cursorBlink: null,
		optionAsAlt: false,
		theme: {},
	};
	for (const line of text.split("\n")) {
		const match = line.match(/^([a-z0-9-]+) = (.*)$/);
		if (!match) continue;
		const key = match[1] as string;
		const value = (match[2] as string).trim().replace(/^"(.*)"$/, "$1");
		if (key === "font-family") {
			if (FONT_NAME.test(value)) appearance.fontFamilies.push(value);
		} else if (key === "font-size") {
			const size = Number(value);
			if (size > 0 && size < 200) appearance.fontSize = size;
		} else if (key === "palette") {
			const entry = value.match(/^(\d+)=(#[0-9a-f]{6})$/i);
			const name = entry ? ANSI_NAMES[Number(entry[1])] : undefined;
			if (entry && name) appearance.theme[name] = entry[2];
		} else if (key in THEME_KEYS) {
			if (HEX_COLOR.test(value)) {
				appearance.theme[THEME_KEYS[key as keyof typeof THEME_KEYS]] = value;
			}
		} else if (key === "cursor-style") {
			if (value === "block_hollow") appearance.cursorStyle = "block";
			else if (value === "block" || value === "bar" || value === "underline") {
				appearance.cursorStyle = value;
			}
		} else if (key === "cursor-style-blink") {
			if (value === "true" || value === "false") {
				appearance.cursorBlink = value === "true";
			}
		} else if (key === "macos-option-as-alt") {
			appearance.optionAsAlt = ["true", "left", "right"].includes(value);
		}
	}
	return appearance;
}

export const appleScriptString = (value: string) =>
	`"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

export const shellQuote = (value: string) =>
	`'${value.replaceAll("'", "'\\''")}'`;
