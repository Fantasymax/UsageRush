# UsageRush

Keep your **Claude** and **Codex** usage windows on a schedule *you* choose.

Subscription CLIs (Claude Code, Codex) meter you with a rolling **5-hour window**: the
window starts with your *first* message and resets 5 hours later. If you only ever
start when you happen to sit down, your reset times drift around unpredictably and
windows you didn't use go to waste.

UsageRush fires a tiny "ping" right **after** each reset so the next window opens on a
predictable, memorable clock time instead of whenever you next show up. It only fills
the gaps when you're *idle* — when you're actively using a tool, your own activity
already keeps the window alive and UsageRush stays out of the way.

> Status: **v0.1** — Windows (Task Scheduler) + Claude are complete and dogfooded.
> macOS (launchd) and Linux (cron) are implemented but **beta** (untested by the
> author — reports welcome). Codex is wired in (5h window confirmed) and **off by
> default**: its `codex exec` ping consumes your weekly Codex limit, so enable it
> only if you have weekly headroom.

## How it works

- **Rolling window detection.** UsageRush reads the timestamps your CLI already writes
  to its session logs (`~/.claude/projects/**/*.jsonl`, `~/.codex/sessions/**/*.jsonl`)
  and computes when the current window resets — no scraping, no API keys.
- **A stateless tick.** Your OS scheduler runs `usagerush tick` every few minutes. Each
  run decides whether a ping is due, pings if so, self-checks, and exits. No daemon to
  crash; reboots and sleep are handled by the OS scheduler.
- **Fire *after* the reset.** Pings land a small buffer (default 90s) *after* the reset,
  never before — so the ping is unambiguously the first message of the new window and
  cleanly anchors it.

### Two modes (per provider)

| Mode | What you get | Cost |
|------|--------------|------|
| **fixed** (default) | Resets land on the **same clock times every day** (e.g. `09:00 / 15:00 / 21:00 / 03:00`). Predictable and easy to plan around. | ~1h idle gap per window (a 5h window on a 6h grid). |
| **chain** | Back-to-back windows, maximum coverage (~4.8/day). | Reset times **drift ~+1h/day** (5h doesn't divide 24h). |

Because a 5-hour window can't tile a 24-hour day evenly, you pick which property you
want. `usagerush setup` shows you the exact resulting refresh table before you commit.

### When your own usage "preempts" an anchor

If you're already using Claude when an anchor time arrives, *your* message opened the
window — not our ping. That's fine: you have a live window, just not at the anchor
clock-time. UsageRush does **not** ping redundantly or nag; it shows you the real
schedule and automatically snaps back to your grid at the next anchor you're idle for.
`usagerush status` always prints the "assuming you go idle from now" projection,
including when it converges back to the grid.

## Install

```sh
# From source (works today — zero dependencies, nothing to build):
git clone https://github.com/Fantasymax/UsageRush.git
cd UsageRush && npm link        # puts `usagerush` on your PATH

# Or, once published to npm:
# npm install -g usagerush
```

Requires Node.js >= 18 and the provider CLI(s) you want to keep alive (`claude`,
`codex`) installed and logged in.

## Quick start

```sh
usagerush setup        # detect windows, choose mode + anchors, see the refresh table
usagerush install      # schedule the tick (add --no-login for a logon-independent task; needs admin)
usagerush status       # windows, refresh table, idle projection, recent pings
usagerush doctor       # self-check + self-heal + anything that needs your attention
```

Non-interactive (scripting/CI):

```sh
usagerush setup --provider claude --mode fixed --anchors 09:00,15:00,21:00,03:00 --enable --yes
usagerush install --interval 5
```

## Commands

| Command | Description |
|---------|-------------|
| `setup` | Wizard (or flags) to configure providers, mode, anchors. |
| `install` / `uninstall` | Add/remove the OS scheduler tick. `--no-login` uses an S4U task (Windows, needs admin) that runs even when no one is logged in. |
| `tick` | One engine run (what the scheduler calls). `--force` to ping now. |
| `ping` | Force a ping now for all enabled providers. |
| `status` | Read-only health, refresh table, projection. |
| `doctor` | Diagnose missed/drifted/auth issues, self-heal, summarize. |

## Configuration

Everything lives under `~/.usagerush/` (override with `USAGERUSH_DIR`):

- `config.json` — tick interval, buffer, per-provider mode/anchors/window, notifications.
- `state-<provider>.json` — last ping, detected window, recent-ping ring buffer.
- `usagerush.log` — rotating activity log.

Diagnostics self-heal silently; a cross-platform desktop notification fires only when
**you** need to act (e.g. a provider's login expired).

## Privacy & safety

UsageRush never hardcodes machine paths or credentials — it resolves your home dir at
runtime and reads only timestamps from logs you already have. Pings go through your
authenticated CLI (your subscription), not raw API keys. A ping costs a few cents and
opens/keeps a window; that's the entire footprint.

## Platform support

| OS | Scheduler | Status |
|----|-----------|--------|
| Windows | Task Scheduler (incl. S4U no-login) | ✅ |
| macOS | launchd LaunchAgent | ✅ beta (untested by author — reports welcome) |
| Linux | cron | ✅ beta (untested by author — reports welcome) |

> macOS note: the LaunchAgent runs while you're logged in. True no-login operation
> needs a LaunchDaemon (root) and isn't installed automatically.
>
> Linux note: the cron entry runs via the cron daemon regardless of login (requires
> `cron` installed and running); `usagerush install` edits your user crontab and
> preserves your other entries.

## License

MIT © FantasyMax
