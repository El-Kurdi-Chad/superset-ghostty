import {
	getGhosttyAppearance,
	getGhosttyStatus,
	openTerminalInGhostty,
} from "main/lib/ghostty";
import { z } from "zod";
import { publicProcedure, router } from "..";

export const createGhosttyRouter = () =>
	router({
		status: publicProcedure.query(() => getGhosttyStatus()),

		appearance: publicProcedure.query(() => getGhosttyAppearance()),

		openTerminal: publicProcedure
			.input(
				z.object({
					terminalId: z.string().min(1).max(64),
					workspaceId: z.string().min(1).max(64),
					websocketUrl: z.string().url(),
					focus: z.boolean(),
				}),
			)
			.mutation(({ input }) => openTerminalInGhostty(input)),
	});
