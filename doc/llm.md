# LLM auto-translation

> The [README](../README.md) covers the quick start. This is the full reference for `vitetranslate --llm-translate` and the `llm` plugin option.

`vitetranslate --llm-translate` syncs the tables, then fills every `null` key through an LLM you configure. The manual workflow — copy the `----to be translated----` block into a chat, paste the answer back (see [translation file format](translations.md)) — still works and always will; this does the same thing for you.

It runs **only from the CLI**, never from the Vite plugin: an LLM call inside `vite dev` would mean a network call, and a bill, on every dev server start and every CI build ([why](structure.md#fase-5--traduzione-automatica)).

Runnable example: [`demo/Vite_8/llmTranslate`](../demo/Vite_8/llmTranslate) — three languages at `null`, the `llm` block already wired, one command to fill them.

## Contents

- [Getting started](#getting-started)
- [Every option](#every-option)
- [The API key](#the-api-key)
- [Costs, budget and confirmation](#costs-budget-and-confirmation)
- [While it runs](#while-it-runs)
- [The context abstract](#the-context-abstract)
- [What gets validated](#what-gets-validated)
- [Debugging a run](#debugging-a-run)
- [Flags](#flags)
- [Optional Vercel Provider](#optional-vercel-provider)

## Getting started

**1. Point `llm` at a model** — any OpenAI-compatible endpoint:

```js
// vite.config.js
vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",
  llm: {
    connection: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.5-flash",
      apiKeyEnv: "VITETRANSLATE_API_KEY", // the NAME of the env var, never the key
    },
  },
});
```

The built-in client speaks the Chat Completions shape (`connection.protocol: "openai-chat"`, the only value accepted) with plain `fetch` — no dependency added. `/chat/completions` is appended to `baseURL`. Gemini (`/v1beta/openai`), OpenAI, OpenRouter, Groq, DeepSeek, Ollama, LM Studio and vLLM all work this way.

Anything else: see [Optional Vercel Provider](#optional-vercel-provider).

**2. Give it the key**, for example in `.env.local` (other options [below](#the-api-key)):

```sh
VITETRANSLATE_API_KEY=your-key-here
```

**3. Check, estimate, run:**

```bash
vitetranslate --llm-ping          # the connection works and the model answers
vitetranslate --llm-dry-run --llm-translate   # what it would cost; sends nothing
vitetranslate --llm-translate     # prints the estimate, asks, then translates
```

Add `costMillionInput`/`costMillionOutput` (your provider's price per million tokens) to see the cost next to the estimate — see [costs](#costs-budget-and-confirmation).

## Every option

All optional except where noted. Each is explained in its section below.

| `llm.` | Default | |
| :- | :- | :- |
| `connection.baseURL` | — | **Required** without a `driver`. OpenAI-compatible endpoint ([getting started](#getting-started)) |
| `connection.model` | — | **Required** without a `driver` |
| `connection.apiKeyEnv` | `"VITETRANSLATE_API_KEY"` | Name of the env var holding the key ([API key](#the-api-key)) |
| `connection.protocol` | `"openai-chat"` | The only value accepted |
| `connection.temperature` | `0.2` | Sent with every request |
| `connection.timeoutMs` | `60000` | Per request |
| `connection.maxRetries` | `3` | Retries on HTTP 429, 5xx and network errors — never on 400/401/403 |
| `connection.maxConcurrency` | `4` | Requests in flight at the same time |
| `connection.providerOptions` | `{}` | Extra fields merged into the request body, for provider-specific settings |
| `connection.costMillionInput` / `costMillionOutput` | — | Price per million tokens. Both or neither ([estimate](#the-estimate)) |
| `connection.costUnity` | `"$"` | Currency symbol printed in front of costs |
| `driver` | — | Your own function instead of the built-in client ([Vercel example](#optional-vercel-provider)) |
| `budget` | `"safe"` | Per-run and per-day caps ([budget](#budget-caps)) |
| `costGuard` | — | Below this estimated cost, no confirmation ([confirmation](#confirmation)) |
| `context` | `{ mode: "auto", refreshEvery: 40, sample: 300 }` | The project brief ([context abstract](#the-context-abstract)) |
| `languages` | every table in `localeDir` | Which languages `--llm-translate` fills; tags on the command line narrow it further. The source language is always excluded |
| `tone` | — | A free-text line added to every translation prompt, e.g. `"informal, second person"` |

## The API key

The key never goes in `vite.config.*`: there is no `connection.apiKey` option, only `apiKeyEnv`, the **name** of an environment variable. It is looked up in this order, and never logged or written to disk:

1. `process.env[apiKeyEnv]`
2. `.env.local`, then `.env`, in the project root
3. the system keyring, if `@napi-rs/keyring` is installed

The keyring is an **optional** peer dependency, for when you'd rather keep the key in the OS keychain than in a file:

```bash
npm i -D @napi-rs/keyring
vitetranslate --llm-key-set       # reads the key from stdin, input hidden
vitetranslate --llm-key-status
vitetranslate --llm-key-clear
```

Without the package, or without a Secret Service (Docker, WSL, a remote SSH session), that step is skipped silently.

`vitetranslate --llm-status` tells you where the key was found, along with the connection, today's counters, `llm.costGuard` and the [context abstract](#the-context-abstract). It makes no network call; `--llm-ping` adds one minimal request to confirm the model answers.

## Costs, budget and confirmation

### The estimate

Every run prints an estimate before it spends anything:

```text
::: LLM                  ║  "deepseek-flash"
::: ⌘ deepseek.com       ║  - (2/2) incomplete tables - 128 missing keys - 6 api requests
:::                      ║  - token (in ~62.1k - out ~9.3k) ≈ $0.0191 < costGuard ($0.2000)
```

- **Line 1** — the model.
- **Line 2** — the provider (the `baseURL` host, without `api.` or a port; absent with your own driver), how many tables have work, how many keys, how many requests.
- **Line 3** — estimated tokens, the cost when prices are set, and the comparison with [`costGuard`](#confirmation) when it is set.

The cost shows only when both `connection.costMillionInput` and `connection.costMillionOutput` are set — both or neither, half a price is a wrong estimate. `connection.costUnity` (default `"$"`) is the symbol printed in front of every cost, on screen and in `runs.log`.

The estimate converts characters to tokens with a fixed ratio on the first run; from the second run on, the ratio is tuned per model on what the provider's `usage` actually reported.

### Budget caps

```js
llm: {
  budget: "safe", // "safe" (default) | "normal" | "unlimited" | { ...fields }
}
```

| Preset | `maxKeysPerRun` | `maxRequestsPerRun` | `maxKeysPerDay` | `maxCharsPerRun` |
| :- | -: | -: | -: | -: |
| `"safe"` | 50 | 20 | 200 | 200,000 |
| `"normal"` | 500 | 200 | 2,000 | 2,000,000 |
| `"unlimited"` | ∞ | ∞ | ∞ | ∞ |

An object overrides single fields on top of `"safe"`, and can add a fifth cap, `maxCostPerRun` (active only once both prices are set).

A run that would exceed a cap is refused, and the message names the cap. `--llm-auto` bypasses all five. If `maxCostPerRun` is reached mid-run, the run stops but keeps everything already validated — nothing already paid for is thrown away.

### Confirmation

Before sending anything, the run needs a go-ahead:

| Situation | What happens |
| :- | :- |
| Estimate below `llm.costGuard` | Runs without asking — even without a TTY |
| `--llm-noask` | Runs without asking |
| Interactive terminal | Asks `Proceed? [y/N]` |
| No TTY (piped, scripted) | Refuses instead of hanging |
| `--llm-dry-run` | Prints the estimate and exits — sends nothing, never asks |

```js
llm: {
  costGuard: 0.01, // strictly below this estimated cost: no question
}
```

`costGuard` needs both prices — without them there is no estimate to compare. `--llm-dry-run` shows which side of it the run would have landed on.

**In CI** (`process.env.CI` set) there is one more guard, checked first: the run is refused unless `--llm-noask` or `VITETRANSLATE_LLM_ALLOW_CI` is set. Neither `costGuard` nor `--llm-auto` gets past it, on purpose: nobody watches a CI log scroll by.

## While it runs

On a terminal, every request gets a line of its own, redrawn in place once a second — no staring at a frozen prompt while a reasoning model thinks:

```text
::: LLM                  ║  ⠹ > ask 7 keys italiano - Deutsch                                     3s
:::                      ║  ✔ < 7 new keys American English. Full translate!                      2s
:::                      ║  ⠹ > ask 7 keys italiano - 日本語            retry 1/3 after HTTP 429  3s
:::                      ║  ✖ - error français (HTTP 401). see trace in debug mode!               1s
```

| Mark | Meaning |
| :- | :- |
| `>` | asked, waiting for the reply |
| `<` | answered — green if every key came back valid, orange if some didn't (the line says how many and why) |
| `-` | failed for good |

The repair round and the [context abstract](#the-context-abstract) get their own lines too. When the last request closes, the block becomes a plain log, each line ending with `<what happened> / <seconds>.`:

```text
::: LLM                  ║  ✔ < 7 new keys Deutsch. completed / 3s.
:::                      ║  ✔ < 7 new keys American English. completed / 2s.
:::                      ║  ✔ < 6 new keys 日本語. 1 rejected / 4s.
:::                      ║  ✖ - error français (HTTP 401) / see trace in debug mode / 1s.
:::                      ║
:::                      ║  real token: 3100 (≈ $0.0106)
```

`completed` means nothing is missing; otherwise the line gives the counts, or for an error the reason. The last line is the real cost of the run, summed from the provider's `usage`. With `--llm-debug`, the trace folder is printed at the end; the per-language breakdown lives there, in `summary.json`.

Piped, redirected or in CI there is no live block, only the final log. A failed request doesn't stop the others: its keys stay `null`, and [`--llm-debug`](#debugging-a-run) has the full reply.

## The context abstract

`<localeDir>/.llm/context.md` is a short brief the model reads before every translation, in four sections: **Domain** (what the app is about), **Register** (its tone), **Glossary** (terms to keep consistent, or untranslated) and **Ambiguities** (strings that need context to translate right). The file has two parts:

- **between the `<!-- vitetranslate:generated -->` markers** — written by the model from a sample of your strings, replaced on every refresh;
- **below them** — yours, never touched, and fed back into every future refresh. A correction written there ("we call it 'Ordine', not 'Ordinazione'") sticks.

```js
llm: {
  context: {
    mode: "auto",      // "auto" (default) | "manual" | "off"
    refreshEvery: 40,  // regenerate after this many new keys
    sample: 300,       // strings that feed the abstract, stratified by component
  },
},
```

| Mode | Regenerates |
| :- | :- |
| `"auto"` | when the file is missing, or keys grew by `refreshEvery` or by 25% since the last generation — at most once per run |
| `"manual"` | only on `--llm-context` |
| `"off"` | never — but still reads the file if it exists |

A file written entirely by hand (no generated markers) is never overwritten in any mode; you get a one-time warning.

```bash
vitetranslate --llm-context   # regenerate now
vitetranslate --llm-status    # print it, with everything else, and exit
```

## What gets validated

A translation is written only if it passes **all** of these:

- it's a non-empty string, and not the key echoed back;
- it has as many `%s` placeholders as the source (their order can't be checked — see [limitations](limitations.md));
- it has the same inline tags (`<b>`, `<i>`, …) as the source, not crossed;
- it isn't wildly longer than the source (at most `source.length * 4 + 20`).

A rejected value stays `null`, is counted by reason in the report, and gets **one** repair attempt with the rejection reason sent back to the model. A key that fails twice for the same language is skipped on later runs; `--llm-auto` retries it.

## Debugging a run

`--llm-debug` logs every request, reply and error to a folder of its own, one numbered file per step. The API key is always redacted first.

```bash
vitetranslate --llm-translate --llm-debug
```

```text
locale/.llm/260918154107/
  001-run.json
  002-api-key.json
  003-estimate.json
  004-confirm.json
  005-translate-fr-FR-b01-request.json
  006-translate-fr-FR-b01-response.json
  007-summary.json
```

It works with `--llm-translate`, `--llm-retranslate`, `--llm-context` and `--llm-ping`. The folder (`<localeDir>/.llm/<YYMMDDHHmmss>/`) is git-ignored automatically; `--llm-status` tells you how many exist and which is the latest.

## Flags

Every LLM flag starts with `--llm-`, and an unrecognised one in that namespace is an error, not a silent sync. (The 4.5 names — `--translate`, `--force`, `--key set`, … — are gone.) Which combinations are rejected: [CLI guide](cli.md#llm-auto-translation).

| Flag | Does |
| :- | :- |
| `--llm-translate [tag...]` | Sync, then fill the `null`s. No tags: every language with missing keys |
| `--llm-retranslate <tag>...` | Redo already-translated keys too. Tags required; backs up first |
| `--llm-context` | Regenerate the context abstract now (alone, or with the two above) |
| `--llm-dry-run` | With the three above: print the estimate, send nothing |
| `--llm-auto` | Bypass the budget caps and the failed-keys record — not the CI guard |
| `--llm-noask` | Don't ask for confirmation (see also [`costGuard`](#confirmation)) |
| `--llm-debug` | Log every request, reply and error to `<localeDir>/.llm/<YYMMDDHHmmss>/` |
| `--llm-status` | Connection, key source, today's counters, the context abstract — no network |
| `--llm-ping` | `--llm-status` plus one minimal call to the model |
| `--llm-key-set` / `--llm-key-status` / `--llm-key-clear` | Manage the keyring entry, if installed |

Examples use the global command; without it, put `npx` in front ([CLI](cli.md)).

## Optional Vercel Provider

For an API that doesn't speak Chat Completions, or to go through a client library, pass your own `llm.driver`: a function, sync or async, receiving `{ connection, apiKey, systemPrompt, userPayload, mode }` and returning either `Record<key, string>` or `{ translations, usage }`. With a driver, `baseURL` and `model` are no longer required. For example, with the [Vercel AI SDK](https://sdk.vercel.ai):

```js
llm: {
  driver: async ({ systemPrompt, userPayload }) => {
    const { generateText } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");
    const { text, usage } = await generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: userPayload,
    });
    return {
      translations: JSON.parse(text),
      usage: { tokensIn: usage.promptTokens, tokensOut: usage.completionTokens },
    };
  },
},
```
