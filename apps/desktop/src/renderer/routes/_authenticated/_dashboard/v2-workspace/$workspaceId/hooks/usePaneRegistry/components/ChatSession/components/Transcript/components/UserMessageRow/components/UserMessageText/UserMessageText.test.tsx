import { afterEach, expect, mock, test } from "bun:test";
import type { AppRouter } from "@superset/host-service/trpc";
import { workspaceTrpc } from "@superset/workspace-client";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import {
	ChatPaneActionsProvider,
	type OpenLink,
} from "../../../../../../providers/ChatPaneActionsProvider";
import { UserMessageText } from "./UserMessageText";

afterEach(cleanup);

const PR = "https://github.com/superset-sh/superset/pull/8329";
const DOCS = "https://agentclientprotocol.com/protocol/content";
const LATER = "https://example.com/later";

async function renderText(
	text: string,
	preview: { title: string | null; iconDataUrl: string | null },
	openLink: OpenLink = () => true,
) {
	const asked: unknown[] = [];
	const link: TRPCLink<AppRouter> = () => (call) =>
		observable((observer) => {
			asked.push(call.op.input);
			observer.next({ result: { data: preview } });
			observer.complete();
		});
	const queryClient = new QueryClient();
	const view = render(
		<workspaceTrpc.Provider
			client={workspaceTrpc.createClient({ links: [link] })}
			queryClient={queryClient}
		>
			<ChatPaneActionsProvider openLink={openLink} workspaceId="workspace-1">
				<UserMessageText segments={[{ text }]} />
			</ChatPaneActionsProvider>
		</workspaceTrpc.Provider>,
	);
	await waitFor(() => {
		expect(asked.length).toBeGreaterThan(0);
		expect(queryClient.isFetching()).toBe(0);
	});
	return { asked, view };
}

test("a service link is a pill, the first other link its page title, the rest plain", async () => {
	const { asked, view } = await renderText(
		`Look at ${PR} and ${DOCS}\nthen ${LATER}.`,
		{ title: "Content · Agent Client Protocol", iconDataUrl: null },
	);
	const title = view.getByText("Content · Agent Client Protocol");
	expect(title.closest("a")?.title).toBe(DOCS);
	expect(asked).toEqual([{ url: DOCS }]);
	expect(view.getByText("superset-sh/superset#8329").closest("a")?.href).toBe(
		PR,
	);
	expect(view.getByText(LATER).className).toContain("text-link");
	expect(view.container.textContent).toBe(
		"Look at superset-sh/superset#8329 and aContent · Agent Client Protocol\nthen https://example.com/later.",
	);
});

test("the chip shows the bare host when no title comes back, and opens like a link", async () => {
	const openLink = mock<OpenLink>(() => true);
	const { view } = await renderText(
		`Compare with ${DOCS}`,
		{ title: null, iconDataUrl: null },
		openLink,
	);
	const host = view.getByText("agentclientprotocol.com");
	expect(host.previousElementSibling?.textContent).toBe("a");

	// The test DOM follows an anchor while the click still bubbles, before
	// React's handler can cancel it, so the click is cancelled on the way down.
	view.container.addEventListener("click", (event) => event.preventDefault(), {
		capture: true,
	});
	fireEvent.click(host);
	expect(openLink.mock.calls.map(([href]) => href)).toEqual([DOCS]);
});

test("the site's icon replaces the letter when the host returns one", async () => {
	const icon = "data:image/png;base64,iVBORw0KGgo=";
	const { view } = await renderText(DOCS, {
		title: "Content",
		iconDataUrl: icon,
	});
	const box = view.getByText("Content").previousElementSibling;
	expect(box?.querySelector("img")?.getAttribute("src")).toBe(icon);
});
