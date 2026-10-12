import {
	displayText,
	readBookkeeping,
	type SessionSnapshot,
	userMessageText,
} from "@superset/chat/core";
import { type Item, isKnownItem } from "@superset/chat/protocol";
import { parseAttachmentTags } from "../../../../utils/attachmentTags";
import { thoughtSummary } from "../../components/ReasoningRow/utils/thoughtSummary";
import type { TranscriptRow } from "../transcriptRows";

/** One stretch of transcript text the find bar searches, as its row shows it. */
export type FindSegment = {
	rowKey: string;
	itemId: string;
	text: string;
};

export type FindMatch = {
	rowKey: string;
	itemId: string;
	/** Which hit inside the item's text, counted from the first. */
	occurrence: number;
};

export function findNeedle(query: string): string {
	return query.trim().toLowerCase();
}

function itemText(
	item: Item,
	snapshot: SessionSnapshot,
	harness: string | undefined,
): string {
	if (!isKnownItem(item)) return "";
	switch (item.kind) {
		case "user_message": {
			const raw = userMessageText(item);
			if (readBookkeeping(harness, raw)) return "";
			return parseAttachmentTags(raw).text;
		}
		case "agent_message":
			return displayText(snapshot, item.id);
		case "reasoning":
			return thoughtSummary(displayText(snapshot, item.id));
		case "tool_call":
			return item.title;
		case "plan":
			return item.entries.map((entry) => entry.text).join("\n");
		default:
			return "";
	}
}

/**
 * The searchable text of a transcript, row by row: what a reader would see
 * scrolling past. Tool output, notices and approvals stay out.
 */
export function findSegments(
	rows: readonly TranscriptRow[],
	snapshot: SessionSnapshot,
	harness: string | undefined,
): FindSegment[] {
	const segments: FindSegment[] = [];
	for (const row of rows) {
		if (row.kind === "tool_run") {
			for (const tool of row.items) {
				segments.push({ rowKey: row.key, itemId: tool.id, text: tool.title });
			}
			continue;
		}
		if (row.kind === "outbox") {
			const text = parseAttachmentTags(userMessageText(row.entry)).text;
			if (text) {
				segments.push({ rowKey: row.key, itemId: row.entry.clientId, text });
			}
			continue;
		}
		if (row.kind !== "item") continue;
		const text = itemText(row.item, snapshot, harness);
		if (text) segments.push({ rowKey: row.key, itemId: row.item.id, text });
	}
	return segments;
}

export function countOccurrences(haystack: string, needle: string): number {
	if (!needle) return 0;
	let count = 0;
	for (
		let index = haystack.indexOf(needle);
		index !== -1;
		index = haystack.indexOf(needle, index + needle.length)
	) {
		count += 1;
	}
	return count;
}

export function findMatches(
	segments: readonly FindSegment[],
	needle: string,
): FindMatch[] {
	if (!needle) return [];
	const matches: FindMatch[] = [];
	for (const segment of segments) {
		const count = countOccurrences(segment.text.toLowerCase(), needle);
		for (let occurrence = 0; occurrence < count; occurrence += 1) {
			matches.push({
				rowKey: segment.rowKey,
				itemId: segment.itemId,
				occurrence,
			});
		}
	}
	return matches;
}

export function sameMatch(a: FindMatch, b: FindMatch): boolean {
	return a.itemId === b.itemId && a.occurrence === b.occurrence;
}
