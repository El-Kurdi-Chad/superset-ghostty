import { Trans } from "@lingui/react/macro";
import { Skeleton } from "@superset/ui/skeleton";
import type { NormalizedComment } from "../../../../../../components/CommentsSection/types";
import { PullRequestCommentCard } from "../PullRequestCommentCard";
import type { PullRequestCommentCardProps } from "../PullRequestCommentCard/PullRequestCommentCard";

interface PullRequestCommentsProps
	extends Omit<PullRequestCommentCardProps, "comment"> {
	comments: NormalizedComment[];
	isLoading: boolean;
	isError: boolean;
}

/** The workspace's review threads as rows in the Comments section, open ones first. */
export function PullRequestComments({
	comments,
	isLoading,
	isError,
	...props
}: PullRequestCommentsProps) {
	if (isError) {
		return (
			<p className="py-3 text-sm text-destructive">
				<Trans>Unable to load review status</Trans>
			</p>
		);
	}
	if (isLoading) {
		return (
			<>
				<Skeleton className="h-10 w-full rounded-lg" />
				<Skeleton className="h-10 w-full rounded-lg" />
			</>
		);
	}
	const ordered = [
		...comments.filter((comment) => !comment.isResolved),
		...comments.filter((comment) => comment.isResolved),
	];
	return (
		<>
			{ordered.map((comment) => (
				<PullRequestCommentCard key={comment.id} comment={comment} {...props} />
			))}
		</>
	);
}
