import type { AvailableCommand } from "@superset/chat/protocol";
import { Chip } from "@superset/chat-ui/Chip";
import type { ClipboardEvent } from "react";
import { env } from "renderer/env.renderer";
import { commandChip } from "../../../../../../utils/commandChip";
import type { MessageSegment } from "../../../../../../utils/messageElements";
import { ChatLink } from "../../../../../ChatLink";
import { LinkPreviewChip } from "./components/LinkPreviewChip";
import { findPreviewLink, splitTextLinks } from "./utils/textLinks";

function segmentChip(
	segment: MessageSegment,
	commands: ReadonlyMap<string, AvailableCommand> | undefined,
) {
	const { element, text } = segment;
	if (!element) return null;
	if (element.elementKind === "slash_command" && text.startsWith("/")) {
		const name = text.slice(1);
		return commandChip(name, commands?.get(name)?.description);
	}
	return {
		label: element.label ?? text.split("/").pop() ?? text,
		serialized: text,
	};
}

const SOURCE_TEXT = "data-source-text";

/**
 * A pill or a chip shows a label where the message has a URL or a mention, so
 * a plain copy would hand back text the sender never typed.
 */
function copySourceText(event: ClipboardEvent<HTMLElement>) {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
	const range = selection.getRangeAt(0);
	const ancestor = range.commonAncestorContainer;
	if (!event.currentTarget.contains(ancestor)) return;

	const element =
		ancestor instanceof Element ? ancestor : ancestor.parentElement;
	const within = element?.closest(`[${SOURCE_TEXT}]`);
	let text = within?.getAttribute(SOURCE_TEXT);
	if (text == null) {
		const copied = range.cloneContents();
		for (const part of copied.querySelectorAll(`[${SOURCE_TEXT}]`)) {
			part.textContent = part.getAttribute(SOURCE_TEXT);
		}
		text = copied.textContent ?? "";
	}
	event.clipboardData.setData("text/plain", text);
	event.preventDefault();
}

export function UserMessageText({
	commands,
	segments,
}: {
	segments: readonly MessageSegment[];
	commands?: ReadonlyMap<string, AvailableCommand> | undefined;
}) {
	const runs = segments.map((segment) =>
		segment.element ? [] : splitTextLinks(segment.text),
	);
	const preview = findPreviewLink(runs.flat(), env.NEXT_PUBLIC_WEB_URL);
	return (
		<span onCopy={copySourceText}>
			{segments.map((segment, index) => {
				const chip = segmentChip(segment, commands);
				if (chip) {
					return (
						<span
							data-source-text={segment.text}
							// biome-ignore lint/suspicious/noArrayIndexKey: segments have no identity beyond their order
							key={index}
						>
							<Chip chip={chip} />
						</span>
					);
				}
				return runs[index]?.map((part, partIndex) => {
					if (part.kind === "text") return part.text;
					return (
						<span
							data-source-text={part.url}
							// biome-ignore lint/suspicious/noArrayIndexKey: parts have no identity beyond their order
							key={`${index}:${partIndex}`}
						>
							{part === preview ? (
								<LinkPreviewChip url={part.url} />
							) : (
								<ChatLink href={part.url}>{part.url}</ChatLink>
							)}
						</span>
					);
				});
			})}
		</span>
	);
}
