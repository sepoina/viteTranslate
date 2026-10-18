# Source

- Skill: `impeccable` 4.6.0 from [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/main/.claude/skills/impeccable), commit `2f46b7a8b059af00d20dd13b64dbe165e7c6a742` (2026-10-18), Apache 2.0 (`LICENSE`, `NOTICE.md`).
- Copied verbatim: `SKILL.md` and `reference/`. Text only. Left out: `scripts/` (a launcher that downloads and runs a native binary from GitHub Releases) and the repo's `.claude/agents/` (the skill falls back to `reference/degraded/`).
- Local change: a note at the top of Setup in `SKILL.md` that sends the agent straight to the skill's own "Launcher unavailable" path. Lost without the binary: live mode, the design detector and its hook, critique snapshots, concept seeds.
- Temporary: installed for a colour and visual pass on the site (not `restaurant`). Remove this folder when done, together with whatever the skill wrote: `.impeccable/`, and decide whether to keep `PRODUCT.md` / `DESIGN.md`.

## Update

Download the new `SKILL.md` and `reference/`, diff them against these, read the diff, then replace them, put the Setup note back and update the commit above.
