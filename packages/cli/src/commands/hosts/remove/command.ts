import * as p from "@clack/prompts";
import { boolean, CLIError, positional } from "@superset/cli-framework";
import { hostIdFromMachineId } from "@superset/shared/host-info";
import { command } from "../../../lib/command";
import { shellQuote } from "../../../lib/shell-quote";
import {
	hostKeyName,
	revokeKeysNamed,
} from "../../../lib/ssh-host-setup/host-key";
import { PROBE_SCRIPT, parseProbe } from "../../../lib/ssh-host-setup/probe";
import { uninstallServiceScript } from "../../../lib/ssh-host-setup/service";
import { SshSession } from "../../../lib/ssh-host-setup/ssh-session";

export default command({
	sandbox: false,
	description:
		"Undo `hosts add`: stop the host over SSH, remove its service, and revoke its API key",
	args: [
		positional("target")
			.required()
			.desc("SSH destination the host was added with"),
	],
	options: {
		yes: boolean().desc("Skip the confirmation prompt"),
	},
	run: async ({ ctx, args, options }) => {
		const target = args.target as string;
		p.intro(`superset hosts remove ${target}`);
		const ssh = await SshSession.open(target);
		try {
			const probe = await ssh.run(PROBE_SCRIPT);
			if (probe.exitCode !== 0) {
				throw new CLIError(
					`Could not inspect ${target}`,
					probe.stderr.trim() || undefined,
				);
			}
			const facts = parseProbe(probe.stdout);
			const hostId = hostIdFromMachineId(facts.machineId);

			if (!options.yes) {
				if (!process.stdin.isTTY) {
					throw new CLIError(
						`This stops the host on ${target}. Pass --yes to confirm.`,
					);
				}
				const confirmed = await p.confirm({
					message: `Stop the host on ${target} (${facts.hostname}) and sign it out? Its terminals end too.`,
				});
				if (p.isCancel(confirmed) || !confirmed) {
					return { data: { cancelled: true }, message: "Cancelled" };
				}
			}

			const uninstall = await ssh.run(uninstallServiceScript(facts.bin));
			const removed = [...uninstall.stdout.matchAll(/removed=(\w+)/g)].map(
				(match) => match[1],
			);
			if (facts.bin) {
				await ssh.run(
					`${shellQuote(facts.bin)} stop --terminals >/dev/null 2>&1; ${shellQuote(facts.bin)} auth logout >/dev/null 2>&1`,
				);
			}
			const revoked = await revokeKeysNamed(
				ctx.api,
				hostKeyName(facts.hostname, hostId),
			);

			p.log.success(
				[
					removed.length > 0
						? `Removed the ${removed.join(" and ")} service`
						: "No service was installed",
					"stopped the host and signed it out",
					revoked > 0 ? "revoked its API key" : "found no API key to revoke",
				].join("; "),
			);
			p.outro(
				"The CLI stays installed in ~/superset. The host stays listed, offline, until you delete it in Settings → Hosts.",
			);
			return {
				data: { hostId, removedServices: removed, revokedKeys: revoked },
				message: `Removed the host on ${target}`,
			};
		} finally {
			await ssh.close();
		}
	},
});
