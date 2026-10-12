import { FileIcon } from "renderer/lib/fileIcons";
import { useChatPaneActions } from "../../../../providers/ChatPaneActionsProvider";
import type { FenceFile } from "../../utils/fencedCode";

const PATH_CLASSNAME =
	"min-w-0 truncate font-mono text-muted-foreground text-xs";

export function FenceFilePath({ file }: { file: FenceFile }) {
	const { openLink } = useChatPaneActions();
	return (
		<div className="flex min-w-0 items-center gap-1.5">
			<FileIcon className="size-4 shrink-0" fileName={file.fileName} />
			{openLink ? (
				<button
					className={`${PATH_CLASSNAME} underline-offset-2 hover:text-link-hover hover:underline`}
					onClick={(event) => openLink(file.href, event)}
					title={file.path}
					type="button"
				>
					{file.path}
				</button>
			) : (
				<span className={PATH_CLASSNAME} title={file.path}>
					{file.path}
				</span>
			)}
		</div>
	);
}
