import stripAnsi from "strip-ansi";

/** The host id from the last line `superset hosts add` prints on success. */
export function parseOnlineHostId(output: string): string | null {
	const matches = [
		...stripAnsi(output).matchAll(/\(([0-9a-f]{32})\) is online/g),
	];
	return matches.at(-1)?.[1] ?? null;
}
