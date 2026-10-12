import { createContext, useContext } from "react";
import type { PullRequestActivityAuthor } from "../../utils/pullRequestAuthorLabel";

/** A review-thread comment the composer will answer; the id is the REST one GitHub's reply endpoint takes. */
export interface PullRequestReplyTarget {
	commentId: number;
	author: PullRequestActivityAuthor | null;
}

/** How a card's Reply reaches the composer at the end of the Activity section. */
export interface PullRequestActivityReplyActions {
	/** Answer a review thread through GitHub's reply endpoint. */
	replyToThread: (target: PullRequestReplyTarget) => void;
	/** Start a conversation comment that opens with this quote; GitHub threads no conversation comments. */
	quote: (quote: string) => void;
}

const PullRequestActivityReplyContext =
	createContext<PullRequestActivityReplyActions | null>(null);

export const PullRequestActivityReplyProvider =
	PullRequestActivityReplyContext.Provider;

/** Null where no composer can take a reply: the cloud route, an older host. */
export function usePullRequestActivityReply(): PullRequestActivityReplyActions | null {
	return useContext(PullRequestActivityReplyContext);
}
