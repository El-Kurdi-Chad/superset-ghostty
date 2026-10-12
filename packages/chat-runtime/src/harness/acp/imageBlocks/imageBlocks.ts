import type { AcpContentBlock } from "../wire";

/** An image an ACP block carries: inline bytes, or a file the agent linked. */
export type AcpImageSource =
	| { kind: "bytes"; mimeType: string; bytes: Uint8Array; name?: string }
	| { kind: "file"; mimeType: string; path: string; name?: string };

const MIME_BY_EXTENSION: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	bmp: "image/bmp",
	svg: "image/svg+xml",
	ico: "image/x-icon",
	avif: "image/avif",
};

function isImageMime(mimeType: unknown): mimeType is string {
	return typeof mimeType === "string" && mimeType.startsWith("image/");
}

function mimeOfPath(path: string): string | null {
	const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
	return MIME_BY_EXTENSION[extension] ?? null;
}

function nameOf(block: AcpContentBlock): string | undefined {
	const { name, title } = block as { name?: unknown; title?: unknown };
	if (typeof name === "string" && name !== "") return name;
	if (typeof title === "string" && title !== "") return title;
	return undefined;
}

/**
 * The image behind a content block, or null when the block is not one this
 * can store: an `image` block with base64 data, or a `resource_link` to a
 * local file whose type (declared, else by extension) is an image.
 */
export function imageSourceOf(
	block: AcpContentBlock | undefined,
): AcpImageSource | null {
	if (!block) return null;
	if (block.type === "image") {
		const { data, mimeType } = block as { data?: unknown; mimeType?: unknown };
		if (typeof data !== "string" || data === "" || !isImageMime(mimeType))
			return null;
		return {
			kind: "bytes",
			mimeType,
			bytes: new Uint8Array(Buffer.from(data, "base64")),
			...(nameOf(block) ? { name: nameOf(block) } : {}),
		};
	}
	if (block.type === "resource_link") {
		const { uri, mimeType } = block as { uri?: unknown; mimeType?: unknown };
		if (typeof uri !== "string" || !uri.startsWith("file://")) return null;
		const path = decodeURIComponent(uri.slice("file://".length));
		const resolvedMime = isImageMime(mimeType) ? mimeType : mimeOfPath(path);
		if (!resolvedMime) return null;
		return {
			kind: "file",
			mimeType: resolvedMime,
			path,
			...(nameOf(block) ? { name: nameOf(block) } : {}),
		};
	}
	return null;
}

function isImageBlock(value: Record<string, unknown>): boolean {
	return value.type === "image";
}

/**
 * The same value with every inline image payload emptied. A tool result's
 * raw fields can repeat the image the content block carried, in ACP's shape
 * or the model API's, and the journal stores raw fields as they are.
 */
export function withoutImageData(raw: unknown): unknown {
	if (Array.isArray(raw)) {
		const next = raw.map(withoutImageData);
		return next.some((value, index) => value !== raw[index]) ? next : raw;
	}
	if (raw === null || typeof raw !== "object") return raw;
	const record = raw as Record<string, unknown>;
	if (isImageBlock(record)) {
		if (typeof record.data === "string") return { ...record, data: "" };
		const source = record.source;
		if (
			source &&
			typeof source === "object" &&
			typeof (source as Record<string, unknown>).data === "string"
		) {
			return { ...record, source: { ...source, data: "" } };
		}
	}
	let changed = false;
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		const replaced = withoutImageData(value);
		if (replaced !== value) changed = true;
		next[key] = replaced;
	}
	return changed ? next : raw;
}
