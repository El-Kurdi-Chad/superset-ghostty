import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FONT_SETTINGS_QUERY_KEY } from "renderer/lib/font-settings";
import {
	getDefaultTerminalAppearance,
	resolveTerminalAppearance,
	type TerminalAppearance,
} from "renderer/lib/terminal/appearance";
import {
	applyGhosttyAppearance,
	useGhosttyMode,
} from "renderer/lib/terminal/appearance/ghostty";
import { detectInstalledNerdFontFamilies } from "renderer/lib/terminal/appearance/installed-nerd-fonts";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import { useTerminalTheme } from "renderer/stores/theme";

const fallbackTheme = getDefaultTerminalAppearance().theme;

export function useTerminalAppearance(): TerminalAppearance {
	const terminalTheme = useTerminalTheme();
	const { data: fontSettings } = useQuery({
		queryKey: FONT_SETTINGS_QUERY_KEY,
		queryFn: () => electronTrpcClient.settings.getFontSettings.query(),
		staleTime: 30_000,
	});
	// Installed Nerd Fonts join the font stack as icon-glyph fallbacks; the
	// enumeration is cached for the renderer's lifetime (module-level too, so
	// the query never re-runs the OS enumeration).
	const { data: installedIconFonts } = useQuery({
		queryKey: ["installed-nerd-font-families"],
		queryFn: detectInstalledNerdFontFamilies,
		staleTime: Number.POSITIVE_INFINITY,
	});

	const ghosttyMode = useGhosttyMode();
	const { data: ghostty } = useQuery({
		queryKey: ["ghostty-appearance"],
		queryFn: () => electronTrpcClient.ghostty.appearance.query(),
		staleTime: 30_000,
		enabled: ghosttyMode,
	});

	return useMemo(() => {
		const theme = terminalTheme ?? fallbackTheme;
		const appearance = resolveTerminalAppearance(
			theme,
			fontSettings,
			installedIconFonts,
		);
		return ghosttyMode && ghostty
			? applyGhosttyAppearance(appearance, ghostty)
			: appearance;
	}, [terminalTheme, fontSettings, installedIconFonts, ghosttyMode, ghostty]);
}
