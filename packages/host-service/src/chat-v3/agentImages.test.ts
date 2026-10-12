import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storeAgentImage } from "./agentImages";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

let cwd: string;
let outside: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "agent-images-cwd-"));
	outside = mkdtempSync(join(tmpdir(), "agent-images-out-"));
});
afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
	rmSync(outside, { recursive: true, force: true });
});

describe("storeAgentImage", () => {
	it("writes inline bytes under the workspace attachments dir, ignored by git, once per content", () => {
		const first = storeAgentImage(
			{ kind: "bytes", mimeType: "image/png", bytes: PNG },
			cwd,
		);
		const again = storeAgentImage(
			{ kind: "bytes", mimeType: "image/png", bytes: PNG, name: "shot.png" },
			cwd,
		);
		expect(first?.path).toMatch(
			/^\.superset\/attachments\/image-[0-9a-f]{12}\.png$/,
		);
		expect(again?.path).toMatch(
			/^\.superset\/attachments\/shot-[0-9a-f]{12}\.png$/,
		);
		const dir = join(cwd, ".superset", "attachments");
		expect(readdirSync(dir).sort()).toEqual(
			[".gitignore", first?.path.split("/").pop(), again?.path.split("/").pop()]
				.filter((entry): entry is string => Boolean(entry))
				.sort(),
		);
		expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe("*\n");
		expect(
			storeAgentImage({ kind: "bytes", mimeType: "image/png", bytes: PNG }, cwd)
				?.path,
		).toBe(first?.path);
		expect(readdirSync(dir)).toHaveLength(3);
	});

	it("copies a linked file in, and answers one already in the attachments dir as it is", () => {
		const linked = join(outside, "home page.png");
		writeFileSync(linked, PNG);
		const copied = storeAgentImage(
			{ kind: "file", mimeType: "image/png", path: linked },
			cwd,
		);
		expect(copied?.path).toMatch(
			/^\.superset\/attachments\/home_page-[0-9a-f]{12}\.png$/,
		);
		expect(
			readFileSync(join(cwd, copied?.path ?? "")).equals(Buffer.from(PNG)),
		).toBe(true);

		const dir = join(cwd, ".superset", "attachments");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "upload.png"), PNG);
		expect(
			storeAgentImage(
				{ kind: "file", mimeType: "image/png", path: join(dir, "upload.png") },
				cwd,
			),
		).toEqual({ path: ".superset/attachments/upload.png" });
	});

	it("answers null for a file it cannot read or an empty image", () => {
		expect(
			storeAgentImage(
				{
					kind: "file",
					mimeType: "image/png",
					path: join(outside, "gone.png"),
				},
				cwd,
			),
		).toBe(null);
		expect(
			storeAgentImage(
				{ kind: "bytes", mimeType: "image/png", bytes: new Uint8Array() },
				cwd,
			),
		).toBe(null);
	});
});
