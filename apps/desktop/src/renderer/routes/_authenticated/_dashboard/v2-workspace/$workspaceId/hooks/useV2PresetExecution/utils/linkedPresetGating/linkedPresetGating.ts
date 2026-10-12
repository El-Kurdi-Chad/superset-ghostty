import {
	AGENT_PRESET_FEATURE_FLAGS,
	getPresetById,
} from "@superset/shared/host-agent-presets";
import {
	type AgentLaunchConfig,
	findLinkedAgent,
} from "renderer/lib/agent-launch-command";

type IsAgentPresetEnabled = (presetId: string) => boolean;

export function isLinkedPresetVisible(
	agentId: string | null | undefined,
	agents: readonly AgentLaunchConfig[] | undefined,
	isAgentPresetEnabled: IsAgentPresetEnabled,
): boolean {
	if (!agentId) return true;
	return isAgentPresetEnabled(
		findLinkedAgent(agents, agentId)?.presetId ?? agentId,
	);
}

function runsGatedAgent(
	commands: readonly string[],
	isAgentPresetEnabled: IsAgentPresetEnabled,
): boolean {
	const programs = commands.map((command) => command.trim().split(/\s+/)[0]);
	return [...AGENT_PRESET_FEATURE_FLAGS.keys()].some((presetId) => {
		const binary = getPresetById(presetId)?.command;
		return (
			!isAgentPresetEnabled(presetId) &&
			binary !== undefined &&
			programs.includes(binary)
		);
	});
}

export function isLinkedPresetLaunchable(
	preset: { agentId?: string | null; commands: readonly string[] },
	agents: readonly AgentLaunchConfig[] | undefined,
	isAgentPresetEnabled: IsAgentPresetEnabled,
): boolean {
	if (!isLinkedPresetVisible(preset.agentId, agents, isAgentPresetEnabled)) {
		return false;
	}
	if (findLinkedAgent(agents, preset.agentId)) return true;
	return !runsGatedAgent(preset.commands, isAgentPresetEnabled);
}
