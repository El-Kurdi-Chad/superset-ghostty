import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { PullRequestDetailComment } from "../../../../hooks/usePullRequestDetail";
import { PullRequestActivityReplyProvider } from "../../../../providers/PullRequestActivityReplyProvider";
import { PullRequestActivityComment } from "./PullRequestActivityComment";

afterEach(() => {
	window.getSelection()?.removeAllRanges();
	cleanup();
});

const comment: PullRequestDetailComment = {
	id: "c1",
	kind: "comment",
	author: { login: "maya", name: null },
	body: "Please rename the hook.\n\nAnd add a test for it.",
	createdAt: "2026-10-03T10:00:00Z",
	reviewState: null,
	url: "https://github.com/example/repo/pull/1#issuecomment-1",
};

function renderComment(quote: ((text: string) => void) | null) {
	return render(
		<PullRequestActivityReplyProvider
			value={quote ? { quote, replyToThread: () => {} } : null}
		>
			<PullRequestActivityComment
				comment={comment}
				prUrl="https://github.com/example/repo/pull/1"
			/>
		</PullRequestActivityReplyProvider>,
	);
}

describe("replying to a conversation comment", () => {
	test("Reply quotes the comment into the composer", () => {
		const quote = mock((_text: string) => {});
		const view = renderComment(quote);
		fireEvent.click(view.getByRole("button", { name: "Reply" }));
		expect(quote).toHaveBeenCalledTimes(1);
		const quoted = quote.mock.calls[0]?.[0] ?? "";
		expect(quoted.startsWith("> Please rename the hook.")).toBe(true);
		expect(quoted).toContain("And add a test for it.");
		expect(quoted.split("\n").every((line) => line.startsWith(">"))).toBe(true);
	});

	test("a selection inside the comment is what gets quoted", () => {
		const quote = mock((_text: string) => {});
		const view = renderComment(quote);
		const text = view.getByText("And add a test for it.").firstChild;
		if (!text) throw new Error("no text node to select");
		const range = document.createRange();
		range.setStart(text, 4);
		range.setEnd(text, 14);
		window.getSelection()?.addRange(range);
		fireEvent.click(view.getByRole("button", { name: "Reply" }));
		expect(quote).toHaveBeenCalledWith("> add a test");
	});

	test("with no composer to take it, Reply opens the comment on GitHub", () => {
		const view = renderComment(null);
		expect(view.queryByRole("button", { name: "Reply" })).toBeNull();
		expect(view.getByRole("link", { name: "Reply" })).toHaveProperty(
			"href",
			comment.url,
		);
	});
});
