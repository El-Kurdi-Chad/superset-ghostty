import { afterEach, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { type ComponentProps, createRef } from "react";
import {
	PullRequestConversationComposer,
	type PullRequestConversationComposerHandle,
} from "./PullRequestConversationComposer";

afterEach(cleanup);

const target = { projectId: "p1", hostUrl: "http://host.test", prNumber: 1 };

function renderComposer(
	props: Omit<
		ComponentProps<typeof PullRequestConversationComposer>,
		"target" | "ref"
	> = {},
) {
	const handle = createRef<PullRequestConversationComposerHandle>();
	const view = render(
		<QueryClientProvider client={new QueryClient()}>
			<PullRequestConversationComposer
				ref={handle}
				target={target}
				{...props}
			/>
		</QueryClientProvider>,
	);
	return {
		view,
		handle,
		field: () => view.getByRole("textbox") as HTMLTextAreaElement,
	};
}

describe("the Activity comment box", () => {
	test("at the end of the section it is a plain comment box that leaves focus alone", () => {
		const { view, field } = renderComposer();
		expect(field().placeholder).toBe("Leave a comment");
		expect(view.getByRole("button", { name: "Post comment" })).toBeTruthy();
		expect(view.queryByRole("button", { name: "Cancel" })).toBeNull();
		expect(document.activeElement).not.toBe(field());
	});

	test("under a card it opens on the quote with the caret after it, and Cancel closes it", () => {
		const onClose = mock(() => {});
		const { view, field } = renderComposer({
			initialBody: "> LGTM\n\n",
			onClose,
		});
		expect(field().placeholder).toBe("Write a reply");
		expect(field().value).toBe("> LGTM\n\n");
		expect(document.activeElement).toBe(field());
		expect(field().selectionStart).toBe("> LGTM\n\n".length);
		expect(view.getByRole("button", { name: "Post reply" })).toBeTruthy();
		fireEvent.click(view.getByRole("button", { name: "Cancel" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test("a second quote joins what is already written", () => {
		const { handle, field } = renderComposer({
			initialBody: "> first\n\n",
			onClose: () => {},
		});
		fireEvent.change(field(), { target: { value: "> first\n\nAgreed." } });
		act(() => handle.current?.quote("> second"));
		expect(field().value).toBe("> first\n\nAgreed.\n\n> second\n\n");
	});
});
