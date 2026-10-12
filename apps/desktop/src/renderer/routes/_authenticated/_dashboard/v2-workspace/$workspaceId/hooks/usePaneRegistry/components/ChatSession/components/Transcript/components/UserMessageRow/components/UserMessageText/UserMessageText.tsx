import type { AvailableCommand } from "@superset/chat/protocol";
import { Chip } from "@superset/chat-ui/Chip";
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
	return segments.map((segment, index) => {
		const chip = segmentChip(segment, commands);
		if (chip) {
			return (
				<Chip
					chip={chip}
					// biome-ignore lint/suspicious/noArrayIndexKey: segments have no identity beyond their order
					key={index}
				/>
			);
		}
		return runs[index]?.map((part, partIndex) => {
			const key = `${index}:${partIndex}`;
			if (part.kind === "text") return part.text;
			return part === preview ? (
				<LinkPreviewChip key={key} url={part.url} />
			) : (
				<ChatLink href={part.url} key={key}>
					{part.url}
				</ChatLink>
			);
		});
	});
}
