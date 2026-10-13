#!/usr/bin/env node
// Turns your Ghostty colors into a Superset theme file, for the official
// Superset app (which keeps its auto-updates):
//
//   node scripts/ghostty-superset-theme.mjs > ghostty-theme.json
//
// Then Superset → Settings → Appearance → Import, and pick "Ghostty".
// Ghostty resolves its own config (your file, your theme, its defaults).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ANSI = [
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
];
const KEYS = {
	background: "background",
	foreground: "foreground",
	"cursor-color": "cursor",
	"cursor-text": "cursorAccent",
	"selection-background": "selectionBackground",
	"selection-foreground": "selectionForeground",
};
const HEX = /^#[0-9a-f]{6}$/i;

const ghostty =
	[
		"/Applications/Ghostty.app/Contents/MacOS/ghostty",
		join(homedir(), "Applications/Ghostty.app/Contents/MacOS/ghostty"),
	].find((path) => existsSync(path)) ?? "ghostty";
const config = execFileSync(ghostty, ["+show-config", "--default"], {
	encoding: "utf8",
});

const terminal = {};
for (const line of config.split("\n")) {
	const match = line.match(/^([a-z0-9-]+) = (.*)$/);
	if (!match) continue;
	const [, key, value] = match;
	if (key === "palette") {
		const entry = value.match(/^(\d+)=(#[0-9a-f]{6})$/i);
		const name = entry && ANSI[Number(entry[1])];
		if (name) terminal[name] = entry[2];
	} else if (KEYS[key] && HEX.test(value)) {
		terminal[KEYS[key]] = value;
	}
}
terminal.cursor ??= terminal.foreground;

const background = terminal.background ?? "#000000";
const [r, g, b] = [1, 3, 5].map((i) =>
	Number.parseInt(background.slice(i, i + 2), 16),
);
const type = 0.299 * r + 0.587 * g + 0.114 * b > 128 ? "light" : "dark";

console.log(
	JSON.stringify({ id: "ghostty", name: "Ghostty", type, terminal }, null, 2),
);
