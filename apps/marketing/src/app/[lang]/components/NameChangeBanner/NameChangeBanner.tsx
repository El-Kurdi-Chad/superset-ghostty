import { Trans } from "@lingui/react/macro";

export function NameChangeBanner() {
	return (
		<div className="border-b border-border bg-muted/40 px-4 py-2 text-center text-sm text-muted-foreground">
			<Trans>Superset is getting a new name soon.</Trans>
		</div>
	);
}
