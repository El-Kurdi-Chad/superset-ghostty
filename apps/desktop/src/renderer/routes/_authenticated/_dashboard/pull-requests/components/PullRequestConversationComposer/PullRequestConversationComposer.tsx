import { Trans, useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { toast } from "@superset/ui/sonner";
import { useMutation } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import {
	type Ref,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { FaGithub } from "react-icons/fa";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useInvalidatePullRequestDetail } from "../../hooks/usePullRequestDetail";
import { appendQuoteToDraft } from "../../utils/quotePullRequestComment";

export interface PullRequestCommentTarget {
	projectId: string;
	hostUrl: string;
	prNumber: number;
}

export interface PullRequestConversationComposerHandle {
	focus: () => void;
	/** Puts the quote after what is written and the caret after the quote. */
	quote: (quote: string) => void;
}

interface PullRequestConversationComposerProps {
	target: PullRequestCommentTarget;
	/** A comment of the review thread to answer (GitHub's REST id); without it the comment goes to the conversation. */
	threadCommentId?: number;
	/** What the box opens with: the quote a reply to a conversation comment starts from. */
	initialBody?: string;
	/** Set for a reply opened under a card: the box takes focus, offers Cancel, and closes once the reply posts. */
	onClose?: () => void;
	ref?: Ref<PullRequestConversationComposerHandle>;
}

function placeCaretAtEnd(field: HTMLTextAreaElement) {
	field.setSelectionRange(field.value.length, field.value.length);
	field.scrollTop = field.scrollHeight;
}

/**
 * The comment box of the Activity section: "Leave a comment" at its end, and
 * the reply box that opens under a card. Posts as the gh user; Enter sends,
 * Shift+Enter breaks a line (comments accept markdown).
 */
export function PullRequestConversationComposer({
	target,
	threadCommentId,
	initialBody = "",
	onClose,
	ref,
}: PullRequestConversationComposerProps) {
	const { t } = useLingui();
	const isReply = onClose !== undefined;
	const [body, setBody] = useState(initialBody);
	const fieldRef = useRef<HTMLTextAreaElement>(null);
	// mutation.isPending updates on React's schedule, too late to stop a
	// rapid double Enter from posting twice.
	const submittingRef = useRef(false);
	const invalidate = useInvalidatePullRequestDetail(target);
	useEffect(() => {
		const field = fieldRef.current;
		if (!isReply || !field) return;
		field.focus();
		placeCaretAtEnd(field);
	}, [isReply]);
	useImperativeHandle(
		ref,
		() => ({
			focus: () => fieldRef.current?.focus(),
			quote: (quote) => {
				setBody((current) => appendQuoteToDraft(current, quote));
				const field = fieldRef.current;
				if (!field) return;
				field.focus();
				// The draft lands on the next render; only then is there an end
				// to put the caret at and scroll to.
				requestAnimationFrame(() => placeCaretAtEnd(field));
			},
		}),
		[],
	);
	const post = useMutation({
		mutationFn: async (text: string) => {
			const client = getHostServiceClientByUrl(target.hostUrl);
			if (threadCommentId !== undefined) {
				await client.pullRequests.replyToThread.mutate({
					projectId: target.projectId,
					prNumber: target.prNumber,
					commentId: threadCommentId,
					body: text,
				});
				return;
			}
			await client.pullRequests.addComment.mutate({
				projectId: target.projectId,
				prNumber: target.prNumber,
				body: text,
			});
		},
		onSuccess: () => {
			setBody("");
			onClose?.();
			void invalidate();
		},
		onError: (error) => {
			toast.error(
				isReply
					? t({ message: "Couldn't post reply" })
					: t({ message: "Couldn't post comment" }),
				{ description: errorMessage(error) },
			);
		},
	});
	const trimmed = body.trim();
	const canSubmit = trimmed.length > 0 && !post.isPending;
	const submit = () => {
		if (!canSubmit || submittingRef.current) return;
		submittingRef.current = true;
		post.mutate(trimmed, {
			onSettled: () => {
				submittingRef.current = false;
			},
		});
	};
	const placeholder = isReply
		? t({ message: "Write a reply" })
		: t({ message: "Leave a comment" });
	return (
		<div className="rounded-xl border border-border/60 bg-background shadow-sm">
			<textarea
				ref={fieldRef}
				rows={Math.max(3, Math.min(8, body.split("\n").length))}
				value={body}
				disabled={post.isPending}
				placeholder={placeholder}
				aria-label={placeholder}
				onChange={(event) => setBody(event.target.value)}
				onKeyDown={(event) => {
					if (
						event.key === "Enter" &&
						!event.shiftKey &&
						!event.nativeEvent.isComposing
					) {
						event.preventDefault();
						submit();
					}
				}}
				className="block w-full resize-none bg-transparent px-3 pt-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
			/>
			<div className="flex items-center justify-end gap-1.5 px-2 pb-2">
				<span
					className="mr-auto flex items-center gap-1.5 pl-1 text-[11px] text-muted-foreground"
					title={t({ message: "Commenting as your GitHub account" })}
				>
					<FaGithub className="size-3" />
				</span>
				{onClose ? (
					<button
						type="button"
						onClick={onClose}
						className="h-7 shrink-0 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<Trans>Cancel</Trans>
					</button>
				) : null}
				<button
					type="button"
					disabled={!canSubmit}
					aria-label={
						isReply
							? t({ message: "Post reply" })
							: t({ message: "Post comment" })
					}
					onClick={submit}
					className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-foreground transition-colors hover:bg-muted disabled:opacity-40"
				>
					<ArrowUp strokeWidth={2.25} className="size-4" />
				</button>
			</div>
		</div>
	);
}
