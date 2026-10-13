# Superset × Ghostty

This is an **unofficial fork** of [Superset](https://github.com/superset-sh/superset)
(Elastic License 2.0). It changes one thing: **terminals open in
[Ghostty](https://ghostty.org) instead of Superset's built-in terminal.**

Create a terminal or start an agent in Superset and a Ghostty tab opens with
it. Everything else stays Superset: workspaces, agents, notifications, diffs,
`superset terminals read`, session persistence.

## How it works

Superset already runs every terminal session in its own background service and
lets several screens attach to the same session. The built-in pane is one of
those screens. This fork adds another: a tiny client that runs inside a Ghostty
tab and attaches to the session over the same local connection.

- **The session still belongs to Superset.** Close the Ghostty tab and the
  session keeps running; press *Show in Ghostty* to get it back, with its
  history.
- **Close the pane in Superset** (or type `exit`) and the session ends and its
  Ghostty tab closes.
- No secret goes through Ghostty: the client reads the local service's address
  and key from `~/.superset/host/<org>/manifest.json` when it connects.
- The terminal pane shows *This terminal runs in Ghostty* with a **Show in
  Ghostty** button. The 👻 button in the pane header switches every pane back
  to the built-in terminal (and back again).

Only workspaces on your own Mac open in Ghostty; remote and cloud workspaces
keep the built-in terminal.

## Requirements

- macOS
- Ghostty **1.3 or newer** (the version with the AppleScript API)
- The first time, macOS asks whether Superset may control Ghostty: allow it
  (System Settings → Privacy & Security → Automation).

Optional, in `~/.config/ghostty/config`: `confirm-close-surface = false`, so
closing a Superset tab in Ghostty doesn't ask for confirmation (closing it only
detaches; the session keeps running in Superset).

## Install

1. Download `Superset-<version>-arm64.dmg` from
   [Releases](https://github.com/El-Kurdi-Chad/superset-ghostty/releases)
   (Apple Silicon).
2. Quit Superset, then drag the app from the DMG into Applications. It
   replaces the official app and keeps your workspaces and sign-in.
3. The app is not notarized, so macOS blocks the first launch. Run
   `xattr -cr /Applications/Superset.app`, or right-click the app → Open.
4. Create a terminal. When macOS asks whether Superset may control Ghostty,
   click OK.

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
| `apps/desktop/src/resources/ghostty/superset-ghostty-attach.mjs` | the client that runs in the Ghostty tab |
| `apps/desktop/src/main/lib/ghostty/index.ts` | opens / focuses Ghostty tabs through AppleScript |
| `apps/desktop/src/lib/trpc/routers/ghostty.ts` | exposes that to the UI |
| `…/TerminalPane/GhosttyTerminalPane.tsx`, `ghosttyMode.ts` | the pane shown instead of the built-in terminal, and the toggle |
| `apps/desktop/src/main/lib/auto-updater.ts` | auto-update off |

Not affiliated with Superset or Ghostty. Superset is © its authors under the
[Elastic License 2.0](LICENSE.md); this fork keeps that license and adds the
changes listed above.
