import { describe, expect, it } from "bun:test";
import {
	isLinkedPresetLaunchable,
	isLinkedPresetVisible,
} from "./linkedPresetGating";

const flagOff = (presetId: string) => presetId !== "pdev";
const flagOn = () => true;
const agents = [
	{ id: "uuid-pdev", presetId: "pdev", command: "pdev", args: [] },
	{ id: "uuid-claude", presetId: "claude", command: "claude", args: [] },
];

describe("isLinkedPresetVisible", () => {
	it("keeps presets with no linked agent", () => {
		expect(isLinkedPresetVisible(undefined, undefined, flagOff)).toBe(true);
	});

	it("hides a preset linked to a gated agent by UUID or preset id", () => {
		expect(isLinkedPresetVisible("uuid-pdev", agents, flagOff)).toBe(false);
		expect(isLinkedPresetVisible("pdev", undefined, flagOff)).toBe(false);
		expect(isLinkedPresetVisible("uuid-pdev", agents, flagOn)).toBe(true);
	});

	it("keeps presets linked to ungated agents", () => {
		expect(isLinkedPresetVisible("uuid-claude", agents, flagOff)).toBe(true);
		expect(isLinkedPresetVisible("claude", undefined, flagOff)).toBe(true);
	});

	it("keeps a UUID link visible while the agent list is unresolved", () => {
		expect(isLinkedPresetVisible("uuid-claude", undefined, flagOff)).toBe(true);
	});
});

describe("isLinkedPresetLaunchable", () => {
	it("holds a UUID link until the agent list resolves while a flag is off", () => {
		expect(isLinkedPresetLaunchable("uuid-pdev", undefined, flagOff)).toBe(
			false,
		);
		expect(isLinkedPresetLaunchable("uuid-pdev", undefined, flagOn)).toBe(true);
	});

	it("launches presets the agent list or a preset id resolves", () => {
		expect(isLinkedPresetLaunchable("uuid-claude", agents, flagOff)).toBe(true);
		expect(isLinkedPresetLaunchable("claude", undefined, flagOff)).toBe(true);
		expect(isLinkedPresetLaunchable("uuid-pdev", agents, flagOff)).toBe(false);
	});

	it("launches a UUID link whose agent was deleted", () => {
		expect(isLinkedPresetLaunchable("uuid-gone", agents, flagOff)).toBe(true);
	});
});
