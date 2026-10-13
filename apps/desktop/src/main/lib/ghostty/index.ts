/**
 * Ghostty integration: the user's Ghostty look for Superset's terminals, and
 * "Open in the Ghostty app" for a session.
 *
 * An opened session gets a Ghostty tab running `superset-ghostty-attach.mjs`, which
 * attaches to the session over the local host-service WebSocket exactly like
 * the pane does. The PTY stays owned by Superset; Ghostty is only the screen.
 * Tabs are driven through Ghostty's AppleScript API (Ghostty >= 1.3, macOS).
 */
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { SUPERSET_HOME_DIR } from "main/lib/app-environment";
import {
	appleScriptString,
	findLocalHostDir,
	type GhosttyAppearance,
	isAtLeast,
	parseGhosttyConfig,
	readBundleVersion,
	shellQuote,
} from "./helpers";

export type { GhosttyAppearance };

const MIN_GHOSTTY_VERSION = [1, 3, 0];
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export type GhosttyStatus =
	| { available: true; version: string }
	| { available: false; reason: string };

function findGhosttyApp(): string | null {
	const candidates = [
		"/Applications/Ghostty.app",
		join(homedir(), "Applications/Ghostty.app"),
	];
	return candidates.find((path) => existsSync(path)) ?? null;
}

export function getGhosttyStatus(): GhosttyStatus {
	if (process.platform !== "darwin") {
		return { available: false, reason: "Ghostty mode is macOS only" };
	}
	const appPath = findGhosttyApp();
	if (!appPath) return { available: false, reason: "Ghostty is not installed" };
	const version = readBundleVersion(appPath);
	if (!version || !isAtLeast(version, MIN_GHOSTTY_VERSION)) {
		return {
			available: false,
			reason: `Ghostty ${MIN_GHOSTTY_VERSION.join(".")} or newer is required (found ${version ?? "unknown"})`,
		};
	}
	return { available: true, version };
}

/**
 * The user's Ghostty font, colors and cursor, resolved by Ghostty itself
 * (config file, theme and defaults), or null when Ghostty isn't installed.
 */
export function getGhosttyAppearance(): Promise<GhosttyAppearance | null> {
	const appPath = process.platform === "darwin" ? findGhosttyApp() : null;
	if (!appPath) return Promise.resolve(null);
	return new Promise((resolve) => {
		execFile(
			join(appPath, "Contents/MacOS/ghostty"),
			["+show-config", "--default"],
			{ timeout: 5_000, maxBuffer: 4 * 1024 * 1024 },
			(error, stdout) => resolve(error ? null : parseGhosttyConfig(stdout)),
		);
	});
}

function attachClientPath(): string {
	if (app.isPackaged) {
		return join(
			process.resourcesPath,
			"app.asar.unpacked/resources/ghostty/superset-ghostty-attach.mjs",
		);
	}
	return join(
		app.getAppPath(),
		"src/resources/ghostty/superset-ghostty-attach.mjs",
	);
}

function runDir(): string {
	const dir = join(app.getPath("userData"), "ghostty");
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	return dir;
}

// Superset terminal id -> Ghostty terminal id, kept on disk so a restarted app
// focuses the tab it opened before instead of opening a duplicate.
function registryPath(): string {
	return join(runDir(), "tabs.json");
}

function readRegistry(): Record<string, string> {
	try {
		return JSON.parse(readFileSync(registryPath(), "utf8"));
	} catch {
		return {};
	}
}

function writeRegistry(registry: Record<string, string>) {
	// Insertion order is oldest first; keep the most recent tabs only.
	const recent = Object.fromEntries(Object.entries(registry).slice(-200));
	writeFileSync(registryPath(), JSON.stringify(recent), { mode: 0o600 });
}

function runAppleScript(script: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = execFile(
			"osascript",
			["-"],
			{ timeout: 15_000 },
			(error, stdout, stderr) => {
				if (error) reject(new Error(stderr.trim() || error.message));
				else resolve(stdout.trim());
			},
		);
		child.stdin?.end(script);
	});
}

async function ghosttyTerminalExists(ghosttyId: string): Promise<boolean> {
	try {
		const result = await runAppleScript(
			`tell application "Ghostty" to exists terminal id ${appleScriptString(ghosttyId)}`,
		);
		return result === "true";
	} catch {
		return false;
	}
}

export interface OpenInGhosttyInput {
	terminalId: string;
	workspaceId: string;
	/** The ws:// URL the built-in pane would dial (token is ignored). */
	websocketUrl: string;
	/** true = bring an already open tab to the front. */
	focus: boolean;
}

export type OpenInGhosttyResult =
	| { status: "opened" | "focused" | "already-open" }
	| { status: "unsupported"; reason: string };

export async function openTerminalInGhostty(
	input: OpenInGhosttyInput,
): Promise<OpenInGhosttyResult> {
	const status = getGhosttyStatus();
	if (!status.available)
		return { status: "unsupported", reason: status.reason };
	if (
		!ID_PATTERN.test(input.terminalId) ||
		!ID_PATTERN.test(input.workspaceId)
	) {
		return { status: "unsupported", reason: "invalid terminal id" };
	}
	const hostDir = findLocalHostDir(
		join(SUPERSET_HOME_DIR, "host"),
		input.websocketUrl,
	);
	if (!hostDir) {
		return {
			status: "unsupported",
			reason: "Ghostty mode only works for workspaces on this Mac",
		};
	}

	const registry = readRegistry();
	const known = registry[input.terminalId];
	if (known && (await ghosttyTerminalExists(known))) {
		if (!input.focus) return { status: "already-open" };
		await runAppleScript(`
tell application "Ghostty"
	focus terminal id ${appleScriptString(known)}
	activate
end tell`);
		return { status: "focused" };
	}

	// Attach params the pane would send; the client adds workspaceId, seq and
	// the token itself, read from the host manifest at dial time.
	const query = new URLSearchParams();
	const source = new URL(input.websocketUrl).searchParams;
	for (const key of ["create", "themeType", "colors"]) {
		const value = source.get(key);
		if (value) query.set(key, value);
	}

	// The client reads this file on session exit to close its own tab: Ghostty
	// 1.3 keeps AppleScript-created tabs open after the command ends.
	const tabIdFile = join(runDir(), `${randomUUID()}.id`);
	const env = [
		"ELECTRON_RUN_AS_NODE=1",
		`SUPERSET_GHOSTTY_TERMINAL_ID=${input.terminalId}`,
		`SUPERSET_GHOSTTY_WORKSPACE_ID=${input.workspaceId}`,
		`SUPERSET_GHOSTTY_HOST_DIR=${hostDir}`,
		`SUPERSET_GHOSTTY_QUERY=${query.toString()}`,
		`SUPERSET_GHOSTTY_TAB_ID_FILE=${tabIdFile}`,
	];
	// Electron prints a codesign warning on stderr in node mode; keep the tab clean.
	const command = `${shellQuote(process.execPath)} ${shellQuote(attachClientPath())} 2>/dev/null`;

	const ghosttyId = await runAppleScript(`
tell application "Ghostty"
	set cfg to new surface configuration
	set command of cfg to ${appleScriptString(command)}
	set wait after command of cfg to false
	set environment variables of cfg to {${env.map(appleScriptString).join(", ")}}
	if (count of windows) is 0 then
		set w to new window with configuration cfg
		set t to focused terminal of selected tab of w
	else
		set tb to new tab in front window with configuration cfg
		set t to focused terminal of tb
	end if
	activate
	return id of t
end tell`);

	writeFileSync(tabIdFile, ghosttyId, { mode: 0o600 });
	registry[input.terminalId] = ghosttyId;
	writeRegistry(registry);
	return { status: "opened" };
}
