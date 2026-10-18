# Source

- Skill: `web-design-guidelines` from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) (commit `063bee9`).
- Rules: `guidelines.md` is `command.md` from [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines), commit `434b7f91364665f2f733b310ec54809bf8f37937` (2026-10-05), MIT (`LICENSE`).
- Local change: `SKILL.md` reads `guidelines.md` instead of fetching the rules from GitHub on every run. Same rules, no remote content injected at run time.

## Update

Download the new `command.md`, diff it against `guidelines.md`, read the diff, then replace the file and update the commit above.
