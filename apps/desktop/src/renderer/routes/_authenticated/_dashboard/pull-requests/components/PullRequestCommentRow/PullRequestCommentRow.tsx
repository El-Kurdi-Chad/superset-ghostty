import { Trans } from "@lingui/react/macro";
import { formatDateTime, formatRelativeTime } from "@superset/i18n/format";
import { Avatar, AvatarFallback, AvatarImage } from "@superset/ui/avatar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import { cn } from "@superset/ui/utils";
import { ChevronsUpDown } from "lucide-react";
import { type ReactNode, useState } from "react";

export interface PullRequestCommentRowAuthor {
	login: string;
	name?: string | null;
	avatarUrl?: string | null;
}

interface PullRequestCommentRowProps {
	author: PullRequestCommentRowAuthor | null;
	/** Muted text after the author: a review state, a file path. */
	meta?: ReactNode;
	createdAt?: string | null;
	/** Right-aligned label: a severity, "Resolved", "Outdated". */
	status?: ReactNode;
	defaultOpen?: boolean;
	className?: string;
	children: ReactNode;
}

/** A comment folded to one soft row: who, what kind, when, and its state. */
export function PullRequestCommentRow({
	author,
	meta,
	createdAt,
	status,
	defaultOpen = false,
	className,
	children,
}: PullRequestCommentRowProps) {
	const [open, setOpen] = useState(defaultOpen);
	const created = createdAt ? new Date(createdAt) : null;
	const createdValid = created !== null && !Number.isNaN(created.getTime());
	const login = author?.login ?? "ghost";
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className={cn(
				"min-w-0 rounded-lg bg-muted/50 [.dark_&]:bg-muted/30",
				className,
			)}
		>
			<CollapsibleTrigger className="flex h-10 w-full min-w-0 items-center gap-2 px-3 text-left">
				<Avatar className="size-5 shrink-0 rounded-full ring-1 ring-border/50">
					<AvatarImage
						src={
							author?.avatarUrl ??
							(author
								? `https://github.com/${author.login}.png?size=64`
								: undefined)
						}
						alt=""
					/>
					<AvatarFallback className="text-[9px]">
						{login.slice(0, 1).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<span className="min-w-0 flex-1 truncate text-sm">
					<span className="font-medium text-foreground" title={login}>
						{author?.name ?? login}
					</span>
					{meta ? (
						<span className="ml-1.5 text-muted-foreground">{meta}</span>
					) : null}
				</span>
				{createdValid ? (
					<time
						dateTime={created.toISOString()}
						title={formatDateTime(created)}
						className="shrink-0 text-[11px] tabular-nums text-muted-foreground @max-[30rem]/detail:hidden"
					>
						{formatRelativeTime(created)}
					</time>
				) : null}
				{status ? (
					<span className="shrink-0 text-xs font-medium">{status}</span>
				) : null}
				<span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
					<span className="@max-[30rem]/detail:sr-only">
						{open ? <Trans>Collapse</Trans> : <Trans>Expand</Trans>}
					</span>
					<ChevronsUpDown className="size-3.5" />
				</span>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="min-w-0 border-t border-border/50 px-3 pb-3 pt-3">
					{children}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
