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

export function isLinkedPresetLaunchable(
	agentId: string | null | undefined,
	agents: readonly AgentLaunchConfig[] | undefined,
	isAgentPresetEnabled: IsAgentPresetEnabled,
): boolean {
	if (!isLinkedPresetVisible(agentId, agents, isAgentPresetEnabled)) {
		return false;
	}
	if (!agentId || agents || getPresetById(agentId)) return true;
	return [...AGENT_PRESET_FEATURE_FLAGS.keys()].every(isAgentPresetEnabled);
}
