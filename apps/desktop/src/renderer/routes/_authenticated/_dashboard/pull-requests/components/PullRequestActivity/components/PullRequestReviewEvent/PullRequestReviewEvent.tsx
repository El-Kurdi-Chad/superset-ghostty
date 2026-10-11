import { CircleCheck, CircleX, MessageSquare } from "lucide-react";
import type { PullRequestDetailComment } from "../../../../hooks/usePullRequestDetail";
import { describePullRequestTime } from "../../../../utils/describePullRequestTime";
import { pullRequestAuthorLabel } from "../../../PullRequestActivityCard";
import type { PullRequestReviewVerdict } from "../../utils/buildPullRequestTimeline";
import { PullRequestReviewStateLabel } from "../PullRequestReviewStateLabel";
import { PullRequestTimelineEventLine } from "../PullRequestTimelineEventLine";
import { PullRequestTimelineStop } from "../PullRequestTimelineStop";

const VERDICT_ICON = {
	APPROVED: {
		Icon: CircleCheck,
		className: "text-emerald-600 [.dark_&]:text-emerald-400",
	},
	CHANGES_REQUESTED: {
		Icon: CircleX,
		className: "text-rose-600 [.dark_&]:text-rose-400",
	},
	DISMISSED: { Icon: MessageSquare, className: "text-muted-foreground" },
} as const;

interface PullRequestReviewEventProps {
	comment: PullRequestDetailComment;
	verdict: PullRequestReviewVerdict;
	first: boolean;
	last: boolean;
}

/** A review without a note: its verdict's icon on the rail and one line of who and when. */
export function PullRequestReviewEvent({
	comment,
	verdict,
	first,
	last,
}: PullRequestReviewEventProps) {
	const { Icon, className } = VERDICT_ICON[verdict];
	return (
		<PullRequestTimelineStop
			first={first}
			last={last}
			node={<Icon strokeWidth={1.75} className={`size-4 ${className}`} />}
		>
			<PullRequestTimelineEventLine
				name={pullRequestAuthorLabel(comment.author)}
				action={<PullRequestReviewStateLabel state={verdict} />}
				time={describePullRequestTime(comment.createdAt)}
			/>
		</PullRequestTimelineStop>
	);
}
