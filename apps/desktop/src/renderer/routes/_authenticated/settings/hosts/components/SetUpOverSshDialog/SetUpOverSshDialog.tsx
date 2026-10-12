import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { Input } from "@superset/ui/input";
import { cn } from "@superset/ui/utils";
import { useEffect, useState } from "react";
import { LuCheck, LuTriangleAlert } from "react-icons/lu";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import { CommandTerminal } from "renderer/routes/_authenticated/components/CommandTerminal";
import {
	buildHostsAddCommand,
	isValidSshTarget,
} from "./utils/buildHostsAddCommand";

type Phase = "form" | "running" | "success" | "failed";

interface SetUpOverSshDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SetUpOverSshDialog({
	open,
	onOpenChange,
}: SetUpOverSshDialogProps) {
	const { t } = useLingui();
	const organizationId = useActiveOrganizationId();
	const cloudUtils = cloudTrpc.useUtils();
	const [phase, setPhase] = useState<Phase>("form");
	const [target, setTarget] = useState("");
	const [run, setRun] = useState<{ command: string; attempt: number } | null>(
		null,
	);

	useEffect(() => {
		if (open) setPhase("form");
	}, [open]);

	const trimmed = target.trim();
	const canStart = isValidSshTarget(trimmed) && organizationId !== null;

	const start = () => {
		if (!canStart) return;
		setRun((prev) => ({
			command: buildHostsAddCommand(trimmed, organizationId),
			attempt: (prev?.attempt ?? 0) + 1,
		}));
		setPhase("running");
	};

	const handleExit = (exitCode: number | null) => {
		if (exitCode === 0) {
			setPhase("success");
			void cloudUtils.host.roster.invalidate();
		} else {
			setPhase("failed");
		}
	};

	return (
		<Dialog
			open={open}
			modal
			onOpenChange={(next) => {
				if (phase !== "running") onOpenChange(next);
			}}
		>
			<DialogContent
				className="gap-3 sm:max-w-[752px]"
				showCloseButton={phase !== "running"}
				onEscapeKeyDown={(event) => {
					if (phase === "running") event.preventDefault();
				}}
				onInteractOutside={(event) => {
					if (phase === "running") event.preventDefault();
				}}
				onFocusOutside={(event) => {
					if (phase === "running") event.preventDefault();
				}}
			>
				<DialogHeader>
					<DialogTitle>
						<Trans>Set up a host over SSH</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>
							Installs Superset on a machine you can reach with ssh, signs
							Superset in to your account, and keeps it running as a service.
						</Trans>
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex items-center gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						start();
					}}
				>
					<Input
						autoFocus
						value={target}
						onChange={(event) => setTarget(event.target.value)}
						placeholder={t({ message: "user@host or an ssh config alias" })}
						aria-label={t({ message: "SSH destination" })}
						disabled={phase === "running"}
						className="font-mono"
					/>
					<Button type="submit" disabled={!canStart || phase === "running"}>
						{phase === "failed" ? <Trans>Retry</Trans> : <Trans>Set up</Trans>}
					</Button>
				</form>
				{phase === "success" && (
					<div className="flex min-h-11 items-center gap-2.5 rounded-md border bg-muted/40 px-3.5 text-sm">
						<LuCheck className="size-3.5 shrink-0 text-emerald-500" />
						<Trans>
							The host is online. Pick it when you create a workspace.
						</Trans>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="ml-auto"
							onClick={() => onOpenChange(false)}
						>
							<Trans>Done</Trans>
						</Button>
					</div>
				)}
				{phase === "failed" && (
					<div className="flex min-h-11 items-center gap-2.5 rounded-md border bg-muted/40 px-3.5 text-sm">
						<LuTriangleAlert className="size-3.5 shrink-0 text-destructive" />
						<Trans>Setup stopped. The reason is in the output below.</Trans>
					</div>
				)}
				{phase !== "form" && run && (
					<div
						className={cn(
							"h-[280px] w-full overflow-hidden rounded-lg border bg-[#151110] p-3",
							phase === "failed" && "opacity-80",
						)}
					>
						<CommandTerminal
							key={run.attempt}
							command={run.command}
							onExit={handleExit}
						/>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
