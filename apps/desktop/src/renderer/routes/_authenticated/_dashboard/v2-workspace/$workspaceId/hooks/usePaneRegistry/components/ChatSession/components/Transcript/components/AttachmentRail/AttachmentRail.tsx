import type { ImageAttachment } from "@superset/chat/protocol";
import { cn } from "@superset/ui/utils";
import { AttachmentImage } from "../AttachmentImage";

/**
 * The images an item carries, as a wrapped row of thumbnails. Each tile keeps
 * its box while it loads, so a row near the viewport does not shift.
 */
export function AttachmentRail({
	className,
	images,
}: {
	images: readonly ImageAttachment[];
	className?: string;
}) {
	if (images.length === 0) return null;
	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			{images.map((image) => (
				<AttachmentImage
					alt={image.alt}
					key={image.path}
					path={image.path}
					type={image.mimeType}
				/>
			))}
		</div>
	);
}
