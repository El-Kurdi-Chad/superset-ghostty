import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { describePullRequestTime } from "../../utils/describePullRequestTime";
import { PullRequestClampedBody } from "./components/PullRequestClampedBody";

export interface PullRequestActivityAuthor {
	/** Null when GitHub maps the actor to no account. */
	login: string | null;
	name?: string | null;
	avatarUrl?: string | null;
}

export function pullRequestAuthorLabel(
	author: PullRequestActivityAuthor | null,
): string {
	return author?.login ?? author?.name ?? "ghost";
}

interface PullRequestActivityCardProps {
	author: PullRequestActivityAuthor | null;
	/** Muted parts after the name, each behind a "·": a review state, a file path, "Resolved". */
	meta?: ReactNode;
	createdAt?: string | null;
	/** Where the time links: the comment's own page on GitHub. */
	url?: string | null;
	/** Icon buttons and links at the header's right end. */
	actions?: ReactNode;
	/** Rendered under the body in their own bordered section. */
	replies?: ReactNode;
	footer?: ReactNode;
	className?: string;
	children?: ReactNode;
}

/**
 * A comment hung on the activity rail: a header line of who, what kind and
 * when, then the body folded past a scannable height.
 */
export function PullRequestActivityCard({
	author,
	meta,
	createdAt,
	url,
	actions,
	replies,
	footer,
	className,
	children,
}: PullRequestActivityCardProps) {
	const time = describePullRequestTime(createdAt);
	const hasContent = Boolean(children || replies || footer);
	return (
		<article
			className={cn(
				"min-w-0 overflow-hidden rounded-md border border-border/60 bg-muted/40 [.dark_&]:bg-muted/20",
				className,
			)}
		>
			<header
				className={cn(
					"flex min-h-9 min-w-0 items-start gap-2 px-3 py-1.5 text-xs text-muted-foreground",
					hasContent && "border-b border-border/60",
				)}
			>
				<div className="flex min-h-6 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 [&>*+*]:before:me-2 [&>*+*]:before:text-muted-foreground [&>*+*]:before:content-['·']">
					<span
						className="min-w-0 truncate font-medium text-foreground"
						title={author?.name ?? undefined}
					>
						{pullRequestAuthorLabel(author)}
					</span>
					{meta}
					{time && url ? (
						<a
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							title={time.absolute}
							className="shrink-0 transition-colors hover:text-foreground"
						>
							{time.relative}
						</a>
					) : time ? (
						<time
							dateTime={time.iso}
							title={time.absolute}
							className="shrink-0"
						>
							{time.relative}
						</time>
					) : null}
				</div>
				{actions ? (
					<div className="flex min-h-6 shrink-0 items-center gap-0.5">
						{actions}
					</div>
				) : null}
			</header>
			{children ? (
				<div className="min-w-0 px-3 py-2.5">
					<PullRequestClampedBody>{children}</PullRequestClampedBody>
				</div>
			) : null}
			{replies ? (
				<div className="min-w-0 border-t border-border/60 px-3">{replies}</div>
			) : null}
			{footer ? (
				<footer className="flex min-w-0 items-center justify-between gap-3 border-t border-border/60 px-2 py-1.5">
					{footer}
				</footer>
			) : null}
		</article>
	);
}
