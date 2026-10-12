import { describe, expect, it } from "bun:test";
import { isLinkedPresetEnabled } from "./isLinkedPresetEnabled";

const flagOff = (presetId: string) => presetId !== "pdev";
const flagOn = () => true;
const agents = [
	{ id: "uuid-pdev", presetId: "pdev", command: "pdev", args: [] },
	{ id: "uuid-claude", presetId: "claude", command: "claude", args: [] },
];

describe("isLinkedPresetEnabled", () => {
	it("keeps presets with no linked agent", () => {
		expect(isLinkedPresetEnabled(undefined, undefined, flagOff)).toBe(true);
	});

	it("hides a preset linked to a gated agent by UUID or preset id", () => {
		expect(isLinkedPresetEnabled("uuid-pdev", agents, flagOff)).toBe(false);
		expect(isLinkedPresetEnabled("pdev", undefined, flagOff)).toBe(false);
		expect(isLinkedPresetEnabled("uuid-pdev", agents, flagOn)).toBe(true);
	});

	it("keeps presets linked to ungated agents", () => {
		expect(isLinkedPresetEnabled("uuid-claude", agents, flagOff)).toBe(true);
		expect(isLinkedPresetEnabled("claude", undefined, flagOff)).toBe(true);
	});

	it("holds a UUID link until the agent list resolves while a flag is off", () => {
		expect(isLinkedPresetEnabled("uuid-pdev", undefined, flagOff)).toBe(false);
		expect(isLinkedPresetEnabled("uuid-pdev", undefined, flagOn)).toBe(true);
	});

	it("keeps a UUID link whose agent was deleted", () => {
		expect(isLinkedPresetEnabled("uuid-gone", agents, flagOff)).toBe(true);
	});
});
