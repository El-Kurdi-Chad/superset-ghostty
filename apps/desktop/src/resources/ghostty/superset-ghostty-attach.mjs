#!/usr/bin/env node
// Runs inside a Ghostty tab and attaches it to a Superset terminal session, the
// same way the built-in xterm pane does: same host-service WebSocket, same PTY.
// The session stays owned by Superset (persistence, agent status, `terminals
// read` keep working); Ghostty is just the screen and keyboard.
//
// Launched by the desktop app with ELECTRON_RUN_AS_NODE=1, so it must stay a
// dependency-free script. Configuration comes from the environment:
//   SUPERSET_GHOSTTY_TERMINAL_ID   terminal session id
//   SUPERSET_GHOSTTY_WORKSPACE_ID  workspace that owns it
//   SUPERSET_GHOSTTY_HOST_DIR      ~/.superset/host/<organizationId>
//   SUPERSET_GHOSTTY_QUERY         extra attach params (create, themeType, colors)
//   SUPERSET_GHOSTTY_TAB_ID_FILE   where the app wrote this tab's Ghostty id
//
// Endpoint and token are read from the host manifest at every dial rather than
// passed in, so no secret sits in Ghostty's config and a host-service restart
// (new port, new token) is picked up on reconnect.

import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";

const terminalId = process.env.SUPERSET_GHOSTTY_TERMINAL_ID;
const workspaceId = process.env.SUPERSET_GHOSTTY_WORKSPACE_ID;
const hostDir = process.env.SUPERSET_GHOSTTY_HOST_DIR;
const extraQuery = process.env.SUPERSET_GHOSTTY_QUERY ?? "";
const tabIdFile = process.env.SUPERSET_GHOSTTY_TAB_ID_FILE;

const stdin = process.stdin;
const stdout = process.stdout;

function fail(message) {
	stdout.write(`\r\n\x1b[31m[superset] ${message}\x1b[0m\r\n`);
	restoreTty();
	process.exit(1);
}

if (!terminalId || !workspaceId || !hostDir) {
	fail("missing SUPERSET_GHOSTTY_* environment, launch this from Superset.");
}

function buildUrl({ create }) {
	const manifest = JSON.parse(
		readFileSync(join(hostDir, "manifest.json"), "utf8"),
	);
	const url = new URL(
		`/terminal/${encodeURIComponent(terminalId)}`,
		manifest.endpoint,
	);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	for (const [key, value] of new URLSearchParams(extraQuery)) {
		// create-on-attach only makes sense for the first dial; a reconnect that
		// re-creates an exited session would resurrect a shell the user closed.
		if (key === "create" && !create) continue;
		url.searchParams.set(key, value);
	}
	url.searchParams.set("workspaceId", workspaceId);
	// "new" = blank screen, send the history ring's tail.
	url.searchParams.set("seq", anchor ? `${anchor.epoch}:${anchor.seq}` : "new");
	url.searchParams.set("token", manifest.authToken);
	return url.toString();
}

let rawMode = false;
function restoreTty() {
	if (rawMode && stdin.isTTY) stdin.setRawMode(false);
	rawMode = false;
}

let socket = null;
let finished = false;
let dialCount = 0;
let attachedOnce = false;
let reconnectDelay = 250;
// Position in the host's output stream, so a redial gets exactly the bytes it
// missed. Counting is armed by `synced`: frames before it are host-synthesized
// (mode preamble) and are not part of the stream.
let anchor = null;
let counting = false;

function send(message) {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(message));
	}
}

function sendSize() {
	if (stdout.columns && stdout.rows) {
		send({ type: "resize", cols: stdout.columns, rows: stdout.rows });
	}
}

// Ghostty 1.3 keeps AppleScript-created tabs open after their command exits
// ("Press any key to close"), so close our own tab once the session is over.
// The helper outlives us and waits a beat: closing a tab whose process is still
// running would make Ghostty ask for confirmation.
function closeOwnTab() {
	let ghosttyId = "";
	try {
		ghosttyId = readFileSync(tabIdFile, "utf8").trim();
	} catch {}
	if (!/^[A-Za-z0-9-]{1,64}$/.test(ghosttyId)) return;
	spawn(
		"/bin/sh",
		[
			"-c",
			'sleep 0.3; osascript -e "tell application \\"Ghostty\\" to perform action \\"close_surface\\" on terminal id \\"$1\\""',
			"sh",
			ghosttyId,
		],
		{ detached: true, stdio: "ignore" },
	).unref();
}

function finish(code, message, { sessionOver = false } = {}) {
	if (finished) return;
	finished = true;
	if (message) stdout.write(`\r\n\x1b[2m[superset] ${message}\x1b[0m\r\n`);
	restoreTty();
	if (sessionOver) closeOwnTab();
	if (tabIdFile) rmSync(tabIdFile, { force: true });
	try {
		socket?.close(1000, "ghostty client done");
	} catch {}
	process.exit(code);
}

function dial() {
	let url;
	try {
		url = buildUrl({ create: dialCount === 0 });
	} catch (error) {
		scheduleReconnect(`host-service unreachable (${error.message})`);
		return;
	}
	dialCount += 1;
	const ws = new WebSocket(url);
	ws.binaryType = "arraybuffer";
	socket = ws;

	ws.addEventListener("open", () => {
		reconnectDelay = 250;
	});

	ws.addEventListener("message", (event) => {
		if (typeof event.data !== "string") {
			stdout.write(Buffer.from(event.data));
			if (counting && anchor) anchor.seq += event.data.byteLength;
			return;
		}
		let message;
		try {
			message = JSON.parse(event.data);
		} catch {
			return;
		}
		switch (message.type) {
			case "attached":
				counting = false;
				// Drop whatever the tab printed before us (login banner) so the
				// session's history starts on a clean screen.
				if (!attachedOnce) stdout.write("\x1b[H\x1b[2J");
				attachedOnce = true;
				sendSize();
				send({ type: "focus", focused: true });
				break;
			case "synced":
				// A redial the host could not catch up exactly gets the tail again:
				// clear first so it doesn't stack on what is already on screen.
				if (anchor && message.mode === "tail")
					stdout.write("\x1b[3J\x1b[H\x1b[2J");
				anchor = { epoch: message.epoch, seq: message.seq };
				counting = true;
				break;
			case "ping":
				send({ type: "pong" });
				break;
			case "title":
				// OSC 2: the Ghostty tab follows the title Superset shows.
				if (message.title) stdout.write(`\x1b]2;${message.title}\x07`);
				break;
			case "exit":
				finish(0, null, { sessionOver: true });
				break;
			case "error":
				if (message.code === "session-gone")
					finish(0, message.message, { sessionOver: true });
				else if (message.code !== "attach-retryable")
					stdout.write(`\r\n\x1b[31m[superset] ${message.message}\x1b[0m\r\n`);
				break;
		}
	});

	ws.addEventListener("close", () => {
		if (socket !== ws || finished) return;
		counting = false;
		scheduleReconnect("connection to Superset lost, reconnecting…");
	});
	ws.addEventListener("error", () => {});
}

function scheduleReconnect(reason) {
	if (finished) return;
	if (!attachedOnce && dialCount > 20) {
		finish(1, `could not attach to the session (${reason})`);
		return;
	}
	stdout.write(`\r\n\x1b[2m[superset] ${reason}\x1b[0m\r\n`);
	setTimeout(dial, reconnectDelay);
	reconnectDelay = Math.min(reconnectDelay * 2, 5000);
}

// Ghostty only emits focus reports (CSI I / CSI O) when the program asked for
// them; the host already synthesizes those from per-client focus, so turn them
// into focus messages instead of forwarding them twice.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching ESC is the point
const FOCUS_REPORT = /\x1b\[([IO])/g;
const decoder = new StringDecoder("utf8");

if (stdin.isTTY) {
	stdin.setRawMode(true);
	rawMode = true;
}
stdin.on("data", (chunk) => {
	let data = decoder.write(chunk);
	if (!data) return;
	data = data.replace(FOCUS_REPORT, (_match, kind) => {
		send({ type: "focus", focused: kind === "I" });
		return "";
	});
	if (data) send({ type: "input", data });
});
stdin.on("end", () => finish(0));

stdout.on("resize", sendSize);
// Closing the Ghostty tab detaches; the session keeps running in Superset.
for (const signal of ["SIGHUP", "SIGTERM", "SIGINT"]) {
	process.on(signal, () => finish(0));
}

dial();
