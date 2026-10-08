import type { ReactNode } from "react";
import type { PullRequestDetail } from "../../hooks/usePullRequestDetail";
import { PullRequestConversation } from "../PullRequestConversation";
import type { PullRequestCommentTarget } from "../PullRequestConversationComposer";
import { PullRequestInfo } from "../PullRequestInfo";
import { PullRequestItemHeader } from "../PullRequestItemHeader";
import { PullRequestMarkdown } from "../PullRequestMarkdown";
import { PullRequestPageBody } from "../PullRequestPageBody";

interface PullRequestSummaryContentProps {
	data: PullRequestDetail;
	/** Where a new conversation comment posts; null hides the composer. */
	commentTarget?: PullRequestCommentTarget | null;
	/** Review-thread rows the workspace pane adds to the Comments section. */
	children?: ReactNode;
	threadCount?: number;
	aside?: ReactNode;
}

/** The Summary tab: header, info rail, description, then the Comments section. */
export function PullRequestSummaryContent({
	data,
	commentTarget = null,
	children,
	threadCount,
	aside,
}: PullRequestSummaryContentProps) {
	return (
		<PullRequestPageBody
			header={
				<PullRequestItemHeader data={data} actionTarget={commentTarget} />
			}
			info={(variant) => <PullRequestInfo data={data} variant={variant} />}
			aside={aside}
		>
			<PullRequestMarkdown body={data.body} />
			<div className="mt-8">
				<PullRequestConversation
					data={data}
					commentTarget={commentTarget}
					threadCount={threadCount}
				>
					{children}
				</PullRequestConversation>
			</div>
		</PullRequestPageBody>
	);
}
