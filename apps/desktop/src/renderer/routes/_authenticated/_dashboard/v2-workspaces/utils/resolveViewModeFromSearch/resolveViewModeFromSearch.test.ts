import { describe, expect, test } from "bun:test";
import { resolveViewModeFromSearch } from "./resolveViewModeFromSearch";

describe("view mode from the mounted page's URL", () => {
	test("a bare URL restores the last live view from Archived", () => {
		expect(
			resolveViewModeFromSearch(undefined, {
				viewMode: "archived",
				liveViewMode: "list",
			}),
		).toBe("list");
	});

	test("a bare URL leaves a live view alone", () => {
		expect(
			resolveViewModeFromSearch(undefined, {
				viewMode: "list",
				liveViewMode: "list",
			}),
		).toBeNull();
	});

	test("a link to a view follows it, and a matching one is a no-op", () => {
		expect(
			resolveViewModeFromSearch("archived", {
				viewMode: "board",
				liveViewMode: "board",
			}),
		).toBe("archived");
		expect(
			resolveViewModeFromSearch("board", {
				viewMode: "board",
				liveViewMode: "board",
			}),
		).toBeNull();
	});
});
