import { afterEach, describe, expect, test } from "bun:test";
import { collectHighlights, textRanges } from "./transcriptHighlights";

function mount(html: string): HTMLElement {
	const root = document.createElement("div");
	root.innerHTML = html;
	document.body.appendChild(root);
	return root;
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("textRanges", () => {
	test("finds a hit split across inline elements, case-insensitively", () => {
		const root = mount("<p>Hello <b>Wor</b>ld, world</p>");
		const ranges = textRanges(root, "world");
		expect(ranges.map((range) => range.toString())).toEqual(["World", "world"]);
	});

	test("does not join text across paragraphs", () => {
		const root = mount("<p>wor</p><p>ld</p>");
		expect(textRanges(root, "world")).toEqual([]);
	});
});

describe("collectHighlights", () => {
	test("paints every marked item and points at the current occurrence", () => {
		const root = mount(
			'<div data-find-item="a"><p>world one</p><p>world two</p></div>' +
				'<div data-find-item="b"><span>WORLD</span></div>' +
				"<div>world outside the transcript text</div>",
		);
		const plan = collectHighlights(root, "world", {
			rowKey: "a",
			itemId: "a",
			occurrence: 1,
		});
		expect(plan.ranges).toHaveLength(3);
		expect(plan.current?.endContainer.textContent).toBe("world two");
		expect(plan.currentElement?.getAttribute("data-find-item")).toBe("a");
	});

	test("clamps to the last rendered hit when the data counted more", () => {
		const root = mount('<div data-find-item="a"><p>only one world</p></div>');
		const plan = collectHighlights(root, "world", {
			rowKey: "a",
			itemId: "a",
			occurrence: 4,
		});
		expect(plan.current?.toString()).toBe("world");
	});
});
