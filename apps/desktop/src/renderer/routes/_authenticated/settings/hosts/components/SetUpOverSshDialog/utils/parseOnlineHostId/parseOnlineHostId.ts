import stripAnsi from "strip-ansi";

export function parseOnlineHostId(output: string): string | null {
	const matches = [
		...stripAnsi(output).matchAll(/\(([0-9a-f]{32})\) is online/g),
	];
	return matches.at(-1)?.[1] ?? null;
}
