import {
	AGENT_PRESET_FEATURE_FLAGS,
	getPresetById,
} from "@superset/shared/host-agent-presets";
import {
	type AgentLaunchConfig,
	findLinkedAgent,
} from "renderer/lib/agent-launch-command";

export function isLinkedPresetEnabled(
	agentId: string | null | undefined,
	agents: readonly AgentLaunchConfig[] | undefined,
	isAgentPresetEnabled: (presetId: string) => boolean,
): boolean {
	if (!agentId) return true;
	const linked = findLinkedAgent(agents, agentId);
	if (linked) return isAgentPresetEnabled(linked.presetId ?? agentId);
	if (agents || getPresetById(agentId)) return isAgentPresetEnabled(agentId);
	return [...AGENT_PRESET_FEATURE_FLAGS.keys()].every(isAgentPresetEnabled);
}
