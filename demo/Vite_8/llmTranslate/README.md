# viteTranslate — LLM auto-translation demo · Vite 8 + React 19

[`minimal`](../minimal) shows the tables being **written**. This one shows them being **filled**:
`it-IT` is the language the app was written in, and the other three (`en-US`, `de-DE`, `ja-JP`)
ship with every cell at `null` — nobody typed a single one of them. A model does that, once, when
you say so.

```bash
npm install
cp .env.example .env.local     # paste your key after the `=`
npm i -g vitetranslate         # the command, installed once, for every project
vitetranslate --llm-translate  # estimate first, then it asks before spending anything
npm run dev                    # the 🔸 in front of every sentence is gone
```

`vitetranslate` is a launcher and nothing more: it finds the library installed **in this project**
(`./node_modules`, then every folder above) and runs that copy's command, so the version that runs
is always the project's own. `npx vitetranslate` works too, with nothing installed globally.

This folder is a member of the repo's npm workspaces: `npm install` from here installs the whole
tree, and from the repo root it's `npm run dev -w demo/Vite_8/llmTranslate`. Copied out on its own,
it installs exactly what it declares.

## Commands

Everything here runs from this folder.

| Command | Does |
| :- | :- |
| `vitetranslate --llm-translate` | Sync, estimate, ask, fill the `null`s |
| `vitetranslate --llm-translate --llm-dry-run` | Print the estimate and stop — nothing sent, nothing written |
| `vitetranslate --llm-translate --llm-noask` | Same as `--llm-translate`, no prompt (CI, scripts) |
| `vitetranslate --llm-status` | Connection, key source, today's spend, and the context abstract — no network |
| `npm run dev` · `build` · `lint` · `preview` | The Vite side of the demo, untouched |

`--llm-dry-run` still needs a key to be *findable*: it reads it before deciding it has nothing to send.
`--llm-status` does not, and will happily tell you `API key: not found`. `vitetranslate --version`
says which copy of the library it would run and where it lives; `vitetranslate --help` is the
project's own help. Adding a language is `vitetranslate --add fr-FR`: the file arrives with every
key listed and `null` where the translation goes.

## What the flow looks like

You write text between `_%_..._%_` and the library invents the key; `vite dev`, `vite build` and the
command keep `locale/` in sync, new strings landing as `null`. `vitetranslate --llm-translate` then
prints the estimate, asks `Proceed? [y/N]`, and fills every language in one run — each answer
checked before it touches a file, and whatever would break at runtime stays `null`.

The LLM never runs inside the plugin: no network call, no bill, on `vite dev` or in CI. Wiring it
into the dev server would mean paying per server start — the command is the only door.

## What the model is not allowed to write

A translation is only written if it passes all of this, checked mechanically:

- `%s` count identical to the source (order, unfortunately, can't be checked);
- inline tags (`<b>`, `<i>`, …) the same multiset as the source, not crossed;
- not empty, not the key echoed back, not wildly longer than the source.

It fails once, it gets one repair attempt with the reason attached. It fails twice, it stays `null`
and is skipped on later runs.

## Where things land

- `locale/.llm/context.md` — a short brief on your project the model reads before translating.
  Version it: below the generated markers there is room for your own notes ("we call it *Ordine*,
  not *Ordinazione*"), and those are read back into every future run.
- `locale/.llm/runs.log` — one line per run, made for `tail`. A `.gitignore` written next to it keeps
  it out of commits.
- `node_modules/.viteTranslate/llm.json` — the ledger: tokens, costs, which key failed where.

## Another model, or none at all

The `connection` block in [`vite.config.js`](vite.config.js) points at Gemini's OpenAI-compatible
endpoint. OpenAI, OpenRouter, Groq, LM Studio and Ollama speak the same shape, so it's a `baseURL`,
a `model` and a `apiKeyEnv` away. Ollama ignores the key, but the command still wants one to be
findable — `VITETRANSLATE_API_KEY=ollama` in `.env.local` is enough.

Costs, budget caps, the keyring and every flag: **[doc/llm.md](../../../doc/llm.md)**.

## Where to find the rest

- **Project page** — [github.com/sepoina/viteTranslate](https://github.com/sepoina/viteTranslate): README, API and [architecture](https://github.com/sepoina/viteTranslate/blob/main/doc/structure.md)
- **Live playground** — [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/), source in [`playground/`](https://github.com/sepoina/viteTranslate/tree/main/playground)
- **npm package** — [@sepoina/vitetranslate](https://www.npmjs.com/package/@sepoina/vitetranslate)
- **The launcher** — [vitetranslate](https://www.npmjs.com/package/vitetranslate): installed once, runs the copy your project has
- **Buy me a coffee** ☕ — [buymeacoffee.com/giancarlogy](https://buymeacoffee.com/giancarlogy)

## StackBlitz

Import the zip from [stackblitz.com](https://stackblitz.com) (New project > Import). Vite 8 uses
Rolldown: in WebContainer, the WASM binding is installed automatically. The app boots there too —
the translation command needs your key in the WebContainer environment.

Need Vite's row 7, or React 18? The plain app is in [`demo/Vite_7/minimal`](../../Vite_7/minimal).
