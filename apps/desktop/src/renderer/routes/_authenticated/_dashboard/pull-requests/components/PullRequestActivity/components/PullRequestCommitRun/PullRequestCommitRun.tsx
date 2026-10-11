import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import type {
	PullRequestDetailCommit,
	PullRequestDetailCommitAuthor,
} from "../../../../hooks/usePullRequestDetail";
import { describePullRequestTime } from "../../../../utils/describePullRequestTime";
import { pullRequestAuthorLabel } from "../../../PullRequestActivityCard";
import { PullRequestActivityAvatar } from "../PullRequestActivityAvatar";
import { PullRequestTimelineEventLine } from "../PullRequestTimelineEventLine";
import { PullRequestTimelineStop } from "../PullRequestTimelineStop";
import { PullRequestCommitStop } from "./components/PullRequestCommitStop";

interface PullRequestCommitRunProps {
	author: PullRequestDetailCommitAuthor | null;
	commits: PullRequestDetailCommit[];
	first: boolean;
	last: boolean;
}

/** One push on the rail: "name added N commits · time", then each commit. */
export function PullRequestCommitRun({
	author,
	commits,
	first,
	last,
}: PullRequestCommitRunProps) {
	const { t } = useLingui();
	const count = commits.length;
	return (
		<>
			<PullRequestTimelineStop
				first={first}
				last={false}
				node={<PullRequestActivityAvatar author={author} />}
			>
				<PullRequestTimelineEventLine
					name={pullRequestAuthorLabel(author)}
					action={t({
						message: plural(count, {
							one: "added a commit",
							other: "added # commits",
						}),
					})}
					time={describePullRequestTime(commits[count - 1]?.committedDate)}
				/>
			</PullRequestTimelineStop>
			{commits.map((commit, index) => (
				<PullRequestCommitStop
					key={commit.oid}
					commit={commit}
					last={last && index === count - 1}
				/>
			))}
		</>
	);
}
