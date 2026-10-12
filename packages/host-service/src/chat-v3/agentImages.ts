import { createHash } from "node:crypto";
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import type { AcpImageSource, AcpStoredImage } from "@superset/chat-runtime";
import {
	sanitizeAttachmentFileName,
	WORKSPACE_ATTACHMENTS_DIR,
} from "@superset/shared/workspace-attachments";
import mimeTypes from "mime-types";

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const NAME_HASH_CHARS = 12;

function posixRelative(from: string, to: string): string | null {
	const path = relative(from, to);
	if (path === "" || path.startsWith("..") || path.startsWith(sep)) return null;
	return path.split(sep).join("/");
}

function extensionFor(mimeType: string, name: string | undefined): string {
	const fromName = name ? extname(name).slice(1).toLowerCase() : "";
	if (fromName) return fromName;
	return mimeTypes.extension(mimeType) || "img";
}

function stemFor(name: string | undefined): string {
	const sanitized = name
		? sanitizeAttachmentFileName(basename(name, extname(name)))
		: null;
	return sanitized ?? "image";
}

function attachmentsDir(cwd: string): string {
	const dir = join(cwd, WORKSPACE_ATTACHMENTS_DIR);
	mkdirSync(dir, { recursive: true });
	try {
		closeSync(openSync(join(dir, ".gitignore"), "wx"));
		writeFileSync(join(dir, ".gitignore"), "*\n");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
	}
	return dir;
}

function bytesOf(source: AcpImageSource): Uint8Array | null {
	if (source.kind === "bytes") return source.bytes;
	try {
		return readFileSync(source.path);
	} catch {
		return null;
	}
}

/**
 * A session replay sends every image again. The hash in the name makes it
 * land on the file written the first time.
 */
export function storeAgentImage(
	source: AcpImageSource,
	cwd: string,
): AcpStoredImage | null {
	const dir = join(cwd, WORKSPACE_ATTACHMENTS_DIR);
	if (source.kind === "file") {
		const inside = posixRelative(dir, resolve(source.path));
		if (inside && !inside.includes("/") && existsSync(source.path)) {
			return { path: `${WORKSPACE_ATTACHMENTS_DIR}/${inside}` };
		}
	}
	const bytes = bytesOf(source);
	if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES)
		return null;
	const name =
		source.kind === "file" ? (source.name ?? source.path) : source.name;
	const hash = createHash("sha256")
		.update(bytes)
		.digest("hex")
		.slice(0, NAME_HASH_CHARS);
	const fileName = `${stemFor(name)}-${hash}.${extensionFor(source.mimeType, name)}`;
	const target = join(attachmentsDir(cwd), fileName);
	if (!existsSync(target)) writeFileSync(target, bytes);
	return { path: `${WORKSPACE_ATTACHMENTS_DIR}/${fileName}` };
}
