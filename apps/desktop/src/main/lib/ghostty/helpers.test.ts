import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appleScriptString,
	findLocalHostDir,
	isAtLeast,
	shellQuote,
} from "./helpers";

describe("isAtLeast", () => {
	test("compares dotted versions numerically", () => {
		expect(isAtLeast("1.3.1", [1, 3, 0])).toBe(true);
		expect(isAtLeast("1.3.0", [1, 3, 0])).toBe(true);
		expect(isAtLeast("1.10.0", [1, 3, 0])).toBe(true);
		expect(isAtLeast("2.0", [1, 3, 0])).toBe(true);
		expect(isAtLeast("1.2.9", [1, 3, 0])).toBe(false);
		expect(isAtLeast("0.9", [1, 3, 0])).toBe(false);
	});

	test("treats garbage segments as zero", () => {
		expect(isAtLeast("1.3.0-tip", [1, 3, 0])).toBe(true);
		expect(isAtLeast("tip", [1, 3, 0])).toBe(false);
	});
});

describe("findLocalHostDir", () => {
	const root = mkdtempSync(join(tmpdir(), "ghostty-hosts-"));
	const host = (name: string, manifest: unknown) => {
		mkdirSync(join(root, name));
		writeFileSync(join(root, name, "manifest.json"), JSON.stringify(manifest));
	};
	host("org-a", { endpoint: "http://127.0.0.1:48036", authToken: "x" });
	host("org-b", { endpoint: "http://127.0.0.1:51000", authToken: "y" });
	host("broken", "not json at all");
	afterAll(() => rmSync(root, { recursive: true, force: true }));

	test("matches the ws:// URL the pane dials against the http:// manifest", () => {
		expect(
			findLocalHostDir(root, "ws://127.0.0.1:51000/terminal/abc?token=t"),
		).toBe(join(root, "org-b"));
	});

	test("returns null for a host that is not on this machine", () => {
		expect(findLocalHostDir(root, "wss://relay.example.com/hosts/1")).toBe(
			null,
		);
		expect(findLocalHostDir(root, "ws://127.0.0.1:9/terminal/abc")).toBe(null);
	});

	test("returns null for a bad URL or a missing hosts dir", () => {
		expect(findLocalHostDir(root, "not a url")).toBe(null);
		expect(findLocalHostDir(join(root, "nope"), "ws://127.0.0.1:48036")).toBe(
			null,
		);
	});
});

describe("quoting", () => {
	test("AppleScript strings escape quotes and backslashes", () => {
		expect(appleScriptString('a "b" \\c')).toBe('"a \\"b\\" \\\\c"');
	});

	test("shell quoting survives single quotes", () => {
		expect(shellQuote("/Apps/It's Here/x")).toBe("'/Apps/It'\\''s Here/x'");
	});
});
