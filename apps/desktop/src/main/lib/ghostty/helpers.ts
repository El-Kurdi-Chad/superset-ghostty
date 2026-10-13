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

export const appleScriptString = (value: string) =>
	`"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

export const shellQuote = (value: string) =>
	`'${value.replaceAll("'", "'\\''")}'`;
