import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import type { PullRequestCommentCardProps } from "./PullRequestCommentCard";

const reactActGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
const { cleanup, fireEvent, render } = await import("@testing-library/react");
const { QueryClient } = await import("@tanstack/react-query");
const { workspaceTrpc } = await import("@superset/workspace-client");
const { PullRequestCommentCard } = await import("./PullRequestCommentCard");

function renderCard(
	props: Pick<
		PullRequestCommentCardProps,
		"comment" | "replies" | "onOpenInDiff"
	>,
) {
	return render(
		<workspaceTrpc.Provider
			client={workspaceTrpc.createClient({ links: [] })}
			queryClient={new QueryClient()}
		>
			<PullRequestCommentCard
				workspaceId="ws"
				onOpenComment={() => {}}
				{...props}
			/>
		</workspaceTrpc.Provider>,
	);
}
afterEach(cleanup);
afterAll(async () => {
	reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
const comment = {
	id: "c1",
	authorLogin: "reviewer",
	body: "Keep the **selected line** visible.\n\nRead [the context](https://github.com/example/repo/pull/1).",
	kind: "review" as const,
	path: "src/app.ts",
	line: 42,
	diffSide: "LEFT" as const,
	isResolved: false,
};
describe("review cards", () => {
	test("the header names the author, the file and its state, and replies sit under the body", () => {
		const view = renderCard({
			comment: { ...comment, threadId: "T1", isResolved: true },
			replies: [
				{
					...comment,
					id: "c2",
					authorLogin: "author",
					body: "Fixed in the next push.",
				},
			],
		});
		const header = view.getByText("reviewer").closest("header");
		expect(header?.textContent).toContain("src/app.ts:42");
		expect(header?.textContent).toContain("Resolved");
		expect(header?.textContent).not.toContain("Keep the");
		const card = header?.parentElement;
		const root = view.getByText(/Keep the/);
		const reply = view.getByText("Fixed in the next push.");
		expect(card?.contains(root)).toBe(true);
		expect(card?.contains(reply)).toBe(true);
		expect(
			Boolean(
				root.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING,
			),
		).toBe(true);
		expect(view.getByRole("button", { name: "Unresolve" })).toBeTruthy();
	});
	test("renders the full comment body without making it a navigation button", () => {
		const onOpenInDiff = mock(() => {});
		const view = renderCard({ comment, onOpenInDiff });
		const body = view.getByText(/Keep the/);
		expect(body.textContent).toBe("Keep the selected line visible.");
		expect(view.getByText("selected line").tagName).toBe("STRONG");
		expect(view.getByRole("link", { name: "the context" })).toHaveProperty(
			"href",
			"https://github.com/example/repo/pull/1",
		);
		expect(body.closest("button")).toBeNull();
		fireEvent.click(body);
		expect(onOpenInDiff).not.toHaveBeenCalled();
	});
	test.each([
		["LEFT", "deletions"],
		["RIGHT", "additions"],
	] as const)("opens the %s diff from the file link", (diffSide, side) => {
		const onOpenInDiff = mock(() => {});
		const view = renderCard({
			comment: { ...comment, diffSide },
			onOpenInDiff,
		});
		fireEvent.click(view.getByRole("button", { name: /^src\/app\.ts/ }));
		expect(onOpenInDiff).toHaveBeenCalledWith(
			"src/app.ts",
			42,
			undefined,
			side,
		);
	});
});
