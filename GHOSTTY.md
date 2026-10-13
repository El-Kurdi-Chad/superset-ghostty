# Superset × Ghostty

This is an **unofficial fork** of [Superset](https://github.com/superset-sh/superset)
(Elastic License 2.0). It changes one thing: **Superset's terminals take your
[Ghostty](https://ghostty.org) look**: your font, size, colors and cursor,
straight from your Ghostty config.

The terminal stays Superset's own, inside the pane, with everything it does:
copy and paste, search, clickable links and file paths, image paste, rich
input, scrollback, agents, notifications.

## How it works

- At startup Superset asks Ghostty for its resolved settings
  (`ghostty +show-config --default`: your config file, your theme and Ghostty's
  defaults) and applies them to every terminal. Nothing to configure.
- The 👻 button in a terminal header switches between your Ghostty style and
  Superset's own terminal style, for every terminal at once.
- The ↗ button next to it opens the same session in a tab of the Ghostty app.
  Both stay attached to the same session: type in either. Closing the Ghostty
  tab only detaches it, and `exit` closes it.
- No secret goes through Ghostty: that tab reads the local service's address
  and key from `~/.superset/host/<org>/manifest.json` when it connects.

Without Ghostty installed, terminals keep Superset's style.

## Rather keep the official app?

This fork has no auto-update. If you want Superset's updates, keep the
official app and give it your Ghostty colors as a theme:

```bash
curl -fsSLO https://raw.githubusercontent.com/El-Kurdi-Chad/superset-ghostty/ghostty-terminals/scripts/ghostty-superset-theme.mjs
node ghostty-superset-theme.mjs > ghostty-theme.json
```

Then Superset → Settings → Appearance → Import, and pick **Ghostty**. Set the
terminal font in the same settings if your Ghostty font isn't JetBrains Mono
13. The theme is a snapshot: run it again after changing Ghostty's colors.

## Install

1. Download `Superset-<version>-arm64.dmg` from
   [Releases](https://github.com/El-Kurdi-Chad/superset-ghostty/releases)
   (Apple Silicon).
2. Quit Superset, then drag the app from the DMG into Applications. It
   replaces the official app and keeps your workspaces and sign-in.
3. The app is not notarized, so macOS blocks the first launch. Run
   `xattr -cr /Applications/Superset.app`, or right-click the app → Open.

The ↗ button needs Ghostty 1.3 or newer. The first time you use it, macOS asks
whether Superset may control Ghostty: click OK.

Auto-update is off in this fork (the official update would replace it).
Download the next release to upgrade, or reinstall the official app to go back.

## Build from source

```bash
git clone https://github.com/El-Kurdi-Chad/superset-ghostty.git
cd superset-ghostty
bun install
cd apps/desktop
bun run build
open release/mac-arm64/Superset.app
```

## What changed

| File | Change |
|---|---|
| `apps/desktop/src/main/lib/ghostty/` | reads Ghostty's settings; opens and focuses Ghostty tabs through AppleScript |
| `apps/desktop/src/renderer/lib/terminal/appearance/ghostty.ts` | applies them to the terminal appearance, and the on/off preference |
| `apps/desktop/src/renderer/hooks/useTerminalAppearance/` | uses that appearance |
| `…/TerminalPaneHeaderExtras/components/GhosttyButtons/` | the 👻 and ↗ buttons |
| `apps/desktop/src/resources/ghostty/superset-ghostty-attach.mjs` | the client that runs in a Ghostty tab |
| `apps/desktop/src/main/lib/auto-updater.ts` | auto-update off |

Not affiliated with Superset or Ghostty. Superset is © its authors under the
[Elastic License 2.0](LICENSE.md); this fork keeps that license and adds the
changes listed above.
