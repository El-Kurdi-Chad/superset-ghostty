function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}

/** An ssh destination: no spaces, and no leading dash that ssh would read as an option. */
export function isValidSshTarget(target: string): boolean {
	return /^[^\s-][^\s]*$/.test(target);
}

/**
 * The shell command the dialog runs. SUPERSET_ORGANIZATION_ID lets the
 * bundled CLI act as the app's account through the local host, the same
 * way it does in a workspace terminal; without a local host it signs in.
 */
export function buildHostsAddCommand(
	target: string,
	organizationId: string,
): string {
	const org = shellQuote(organizationId);
	return [
		`export SUPERSET_ORGANIZATION_ID=${org}`,
		`superset auth whoami >/dev/null 2>&1 || superset auth login --organization ${org} || exit 1`,
		`superset hosts add --org ${org} ${shellQuote(target)}`,
	].join("; ");
}
