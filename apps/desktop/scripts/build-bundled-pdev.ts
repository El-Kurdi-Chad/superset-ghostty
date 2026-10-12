import { spawn } from "node:child_process";
import {
	chmodSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { config } from "dotenv";

export const PDEV_VERSION = "0.1.0";
export const PDEV_RELEASE_REPO = "superset-sh/router";
export const PDEV_RELEASE_TAG = `pdev@${PDEV_VERSION}`;
const BUNDLED_FROM_FILE = ".bundled-from";

const PDEV_TARGETS: Record<string, readonly string[]> = {
	darwin: ["arm64", "x64"],
	linux: ["arm64", "x64"],
};

export function pdevAssetName(
	platform: string,
	arch: string,
	version: string = PDEV_VERSION,
): string | null {
	if (!PDEV_TARGETS[platform]?.includes(arch)) return null;
	return `pdev-${version}-${platform}-${arch}.tar.gz`;
}

export function releaseToken(env: NodeJS.ProcessEnv): string | undefined {
	return env.PDEV_RELEASE_TOKEN || env.GH_TOKEN || env.GITHUB_TOKEN;
}

function run(command: string, args: string[]): Promise<void> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, { stdio: "inherit" });
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) {
				resolvePromise();
				return;
			}
			reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
		});
	});
}

export function installPdevFolder(
	sourceDir: string,
	destDir: string,
	bundledFrom: string,
): void {
	const binary = join(sourceDir, "pdev");
	if (!existsSync(binary)) {
		throw new Error(`No pdev executable at ${binary}`);
	}
	rmSync(destDir, { recursive: true, force: true });
	mkdirSync(dirname(destDir), { recursive: true });
	cpSync(sourceDir, destDir, { recursive: true });
	chmodSync(join(destDir, "pdev"), 0o755);
	writeFileSync(join(destDir, BUNDLED_FROM_FILE), bundledFrom);
}

export async function extractPdevTarball(
	tarball: string,
	destDir: string,
	bundledFrom: string,
): Promise<void> {
	const extractDir = mkdtempSync(join(tmpdir(), "pdev-extract-"));
	try {
		await run("tar", ["-xzf", tarball, "-C", extractDir]);
		installPdevFolder(join(extractDir, "pdev"), destDir, bundledFrom);
	} finally {
		rmSync(extractDir, { recursive: true, force: true });
	}
}

export function isBundled(destDir: string, bundledFrom: string): boolean {
	const marker = join(destDir, BUNDLED_FROM_FILE);
	return (
		existsSync(join(destDir, "pdev")) &&
		existsSync(marker) &&
		readFileSync(marker, "utf-8") === bundledFrom
	);
}

async function downloadAsset(
	assetName: string,
	token: string,
	outfile: string,
): Promise<void> {
	const api = `https://api.github.com/repos/${PDEV_RELEASE_REPO}/releases/tags/${encodeURIComponent(PDEV_RELEASE_TAG)}`;
	const headers = {
		Authorization: `Bearer ${token}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};
	const releaseResponse = await fetch(api, {
		headers: { ...headers, Accept: "application/vnd.github+json" },
	});
	if (!releaseResponse.ok) {
		throw new Error(
			`Could not read release ${PDEV_RELEASE_TAG} on ${PDEV_RELEASE_REPO}: HTTP ${releaseResponse.status}. The token needs read access to that repo's releases.`,
		);
	}
	const release = (await releaseResponse.json()) as {
		assets: Array<{ name: string; url: string }>;
	};
	const asset = release.assets.find((entry) => entry.name === assetName);
	if (!asset) {
		throw new Error(`Release ${PDEV_RELEASE_TAG} has no asset ${assetName}`);
	}

	const redirect = await fetch(asset.url, {
		headers: { ...headers, Accept: "application/octet-stream" },
		redirect: "manual",
	});
	const location = redirect.headers.get("location");
	const download = location ? await fetch(location) : redirect;
	if (!download.ok) {
		throw new Error(`Could not download ${assetName}: HTTP ${download.status}`);
	}
	writeFileSync(outfile, Buffer.from(await download.arrayBuffer()));
}

export async function main(
	env: NodeJS.ProcessEnv = process.env,
	destDir: string = resolve(import.meta.dirname, "../dist/resources/bin/pdev"),
) {
	const platform = env.TARGET_PLATFORM ?? process.platform;
	const arch = env.TARGET_ARCH ?? process.arch;

	if (env.PDEV_BUNDLE_DIR) {
		installPdevFolder(
			resolve(env.PDEV_BUNDLE_DIR),
			destDir,
			`local:${env.PDEV_BUNDLE_DIR}`,
		);
		console.log(`[desktop] bundled pdev copied from ${env.PDEV_BUNDLE_DIR}`);
		return;
	}

	const assetName = pdevAssetName(platform, arch);
	if (!assetName) {
		rmSync(destDir, { recursive: true, force: true });
		console.log(`[desktop] pdev is not bundled for ${platform}/${arch}`);
		return;
	}

	if (isBundled(destDir, assetName)) {
		console.log(`[desktop] bundled pdev is up to date (${assetName})`);
		return;
	}

	const required = env.PDEV_BUNDLE_REQUIRED === "1";
	const token = releaseToken(env);
	if (!token) {
		const message = `No PDEV_RELEASE_TOKEN, GH_TOKEN or GITHUB_TOKEN to download ${assetName} from ${PDEV_RELEASE_REPO}`;
		if (required) throw new Error(message);
		rmSync(destDir, { recursive: true, force: true });
		console.warn(`[desktop] ${message}; pdev is not bundled`);
		return;
	}

	const downloadDir = mkdtempSync(join(tmpdir(), "pdev-download-"));
	try {
		const tarball = join(downloadDir, assetName);
		await downloadAsset(assetName, token, tarball);
		await extractPdevTarball(tarball, destDir, assetName);
		console.log(`[desktop] bundled pdev written to ${destDir}`);
	} catch (error) {
		if (required) throw error;
		rmSync(destDir, { recursive: true, force: true });
		console.warn(`[desktop] pdev is not bundled: ${String(error)}`);
	} finally {
		rmSync(downloadDir, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	config({
		path: resolve(import.meta.dirname, "../../../.env"),
		override: false,
		quiet: true,
	});
	await main();
}
