import { Trans } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useKnownHosts } from "renderer/hooks/known-hosts/useKnownHosts";
import { SetUpOverSshDialog } from "./components/SetUpOverSshDialog";

export const Route = createFileRoute("/_authenticated/settings/hosts/")({
	component: HostsIndexPage,
});

function HostsIndexPage() {
	const navigate = useNavigate();

	const { hosts, settled } = useKnownHosts();
	const [sshDialogOpen, setSshDialogOpen] = useState(false);
	const isPending = !settled;

	const firstHostId = useMemo(() => {
		const sorted = [...hosts].sort((a, b) => a.name.localeCompare(b.name));
		const online = sorted.find((h) => h.isOnline);
		return (online ?? sorted[0])?.machineId ?? null;
	}, [hosts]);

	useEffect(() => {
		if (firstHostId) {
			navigate({
				to: "/settings/hosts/$hostId",
				params: { hostId: firstHostId },
				replace: true,
			});
		}
	}, [firstHostId, navigate]);

	if (hosts.length === 0) {
		if (isPending) return null;
		return (
			<div className="flex flex-col items-center justify-center gap-3 h-full p-6 text-sm text-muted-foreground">
				<Trans>No hosts yet.</Trans>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setSshDialogOpen(true)}
				>
					<Trans>Set up a host over SSH</Trans>
				</Button>
				<SetUpOverSshDialog
					open={sshDialogOpen}
					onOpenChange={setSshDialogOpen}
				/>
			</div>
		);
	}

	return null;
}
