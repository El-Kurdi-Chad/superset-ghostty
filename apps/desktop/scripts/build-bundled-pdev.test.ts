import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	extractPdevTarball,
	isBundled,
	main,
	pdevAssetName,
	releaseToken,
} from "./build-bundled-pdev";

describe("build-bundled-pdev", () => {
	let tempDir: string;
	let sourceDir: string;
	let destDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(path.join(tmpdir(), "superset-pdev-bundle-"));
		sourceDir = path.join(tempDir, "src", "pdev");
		destDir = path.join(tempDir, "dist", "resources", "bin", "pdev");
		mkdirSync(path.join(sourceDir, "assets"), { recursive: true });
		writeFileSync(path.join(sourceDir, "pdev"), "#!/bin/sh\necho 0.1.0\n");
		writeFileSync(path.join(sourceDir, "assets", "theme.json"), "{}");
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("maps release targets and skips Windows", () => {
		expect(pdevAssetName("darwin", "arm64", "0.1.0")).toBe(
			"pdev-0.1.0-darwin-arm64.tar.gz",
		);
		expect(pdevAssetName("linux", "x64", "0.1.0")).toBe(
			"pdev-0.1.0-linux-x64.tar.gz",
		);
		expect(pdevAssetName("win32", "x64")).toBeNull();
		expect(pdevAssetName("linux", "ia32")).toBeNull();
	});

	it("prefers the dedicated release token", () => {
		expect(
			releaseToken({
				PDEV_RELEASE_TOKEN: "a",
				GH_TOKEN: "b",
				GITHUB_TOKEN: "c",
			}),
		).toBe("a");
		expect(releaseToken({ GITHUB_TOKEN: "c" })).toBe("c");
		expect(releaseToken({})).toBeUndefined();
	});

	it("extracts the pdev folder from a release tarball", async () => {
		const tarball = path.join(tempDir, "pdev.tar.gz");
		const proc = Bun.spawnSync([
			"tar",
			"-czf",
			tarball,
			"-C",
			path.dirname(sourceDir),
			"pdev",
		]);
		expect(proc.exitCode).toBe(0);

		await extractPdevTarball(
			tarball,
			destDir,
			"pdev-0.1.0-darwin-arm64.tar.gz",
		);

		expect(statSync(path.join(destDir, "pdev")).mode & 0o111).not.toBe(0);
		expect(existsSync(path.join(destDir, "assets", "theme.json"))).toBe(true);
		expect(isBundled(destDir, "pdev-0.1.0-darwin-arm64.tar.gz")).toBe(true);
		expect(isBundled(destDir, "pdev-0.1.0-darwin-x64.tar.gz")).toBe(false);
	});

	it("copies a local pdev folder when PDEV_BUNDLE_DIR is set", async () => {
		await main({ PDEV_BUNDLE_DIR: sourceDir }, destDir);

		expect(readFileSync(path.join(destDir, "pdev"), "utf-8")).toContain(
			"0.1.0",
		);
		expect(existsSync(path.join(destDir, "assets", "theme.json"))).toBe(true);
	});

	it("skips without a token unless the bundle is required", async () => {
		const env = { TARGET_PLATFORM: "darwin", TARGET_ARCH: "arm64" };

		await main(env, destDir);
		expect(existsSync(destDir)).toBe(false);

		await expect(
			main({ ...env, PDEV_BUNDLE_REQUIRED: "1" }, destDir),
		).rejects.toThrow("PDEV_RELEASE_TOKEN");
	});

	it("removes a stale bundle for a target pdev does not ship", async () => {
		await main({ PDEV_BUNDLE_DIR: sourceDir }, destDir);

		await main({ TARGET_PLATFORM: "win32", TARGET_ARCH: "x64" }, destDir);

		expect(existsSync(destDir)).toBe(false);
	});
});
