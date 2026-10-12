import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import {
	PullRequestConversationComposer,
	type PullRequestConversationComposerHandle,
} from "./PullRequestConversationComposer";

afterEach(cleanup);

const target = { projectId: "p1", hostUrl: "http://host.test", prNumber: 1 };

function renderComposer(
	replyTo: { commentId: number; author: { login: string } } | null = null,
) {
	const handle = createRef<PullRequestConversationComposerHandle>();
	const client = new QueryClient();
	const composer = (
		reply: { commentId: number; author: { login: string } } | null,
	) => (
		<QueryClientProvider client={client}>
			<PullRequestConversationComposer
				ref={handle}
				target={target}
				replyTo={reply}
			/>
		</QueryClientProvider>
	);
	const view = render(composer(replyTo));
	return {
		view,
		handle,
		field: () => view.getByRole("textbox") as HTMLTextAreaElement,
		setReplyTo: (
			reply: { commentId: number; author: { login: string } } | null,
		) => view.rerender(composer(reply)),
	};
}

describe("the Activity composer", () => {
	test("a quote lands after the conversation draft and the field takes focus", () => {
		const { handle, field } = renderComposer();
		fireEvent.change(field(), { target: { value: "Half a thought" } });
		act(() => handle.current?.quote("> LGTM"));
		expect(field().value).toBe("Half a thought\n\n> LGTM\n\n");
		expect(document.activeElement).toBe(field());
	});

	test("a thread reply has its own draft, and the conversation draft comes back", () => {
		const { field, setReplyTo, view } = renderComposer();
		fireEvent.change(field(), { target: { value: "For the conversation" } });
		setReplyTo({ commentId: 7, author: { login: "maya" } });
		expect(field().value).toBe("");
		expect(view.getByText("Replying to maya")).toBeTruthy();
		fireEvent.change(field(), { target: { value: "For the thread" } });
		setReplyTo(null);
		expect(field().value).toBe("For the conversation");
	});
});
