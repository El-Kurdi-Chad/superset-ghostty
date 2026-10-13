import { describe, expect, test } from "bun:test";
import { applyGhosttyAppearance } from "./ghostty";
import { getDefaultTerminalAppearance } from "./index";

const base = getDefaultTerminalAppearance();
const empty = {
	fontFamilies: [],
	fontSize: null,
	cursorStyle: null,
	cursorBlink: null,
	optionAsAlt: false,
	theme: {},
};

describe("applyGhosttyAppearance", () => {
	test("puts Ghostty's font, colors and cursor over Superset's", () => {
		const result = applyGhosttyAppearance(base, {
			...empty,
			fontFamilies: ["Berkeley Mono"],
			fontSize: 13,
			cursorStyle: "bar",
			cursorBlink: false,
			theme: { background: "#282c34", foreground: "#ffffff", red: "#cc6666" },
		});
		expect(result.fontFamily).toBe(`"Berkeley Mono", ${base.fontFamily}`);
		expect(result.fontSize).toBe(13);
		expect(result.cursorStyle).toBe("bar");
		expect(result.cursorBlink).toBe(false);
		expect(result.background).toBe("#282c34");
		expect(result.theme.red).toBe("#cc6666");
		expect(result.theme.cursor).toBe("#ffffff");
		expect(result.theme.green).toBe(base.theme.green);
	});

	test("keeps Superset's settings where Ghostty has none", () => {
		const result = applyGhosttyAppearance(base, empty);
		expect(result.fontFamily).toBe(base.fontFamily);
		expect(result.fontSize).toBe(base.fontSize);
		expect(result.background).toBe(base.background);
		expect(result.theme).toEqual(base.theme);
	});
});
