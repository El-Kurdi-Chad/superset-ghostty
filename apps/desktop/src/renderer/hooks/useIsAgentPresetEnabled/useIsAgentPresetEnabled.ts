import { isAgentPresetEnabled } from "@superset/shared/host-agent-presets";
import { useActiveFeatureFlags } from "posthog-js/react";
import { useCallback } from "react";

export function useIsAgentPresetEnabled(): (presetId: string) => boolean {
	const activeFeatureFlags = useActiveFeatureFlags();
	return useCallback(
		(presetId: string) =>
			isAgentPresetEnabled(presetId, activeFeatureFlags ?? []),
		[activeFeatureFlags],
	);
}
