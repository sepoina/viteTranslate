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
| `connection.modelClass` | `"standard"` | How much the model can take: sizes the batches and `max_tokens` ([model class](#model-class)) |
| `connection.maxTokensField` | `"max_tokens"` | Name of the output-limit field in the request: `"max_tokens"`, `"max_completion_tokens"`, or `false` to send none |
| `connection.providerOptions` | `{}` | Extra fields merged into the request body, for provider-specific settings. Wins over everything else, `max_tokens` included |
| `connection.costMillionInput` / `costMillionOutput` | — | Price per million tokens. Both or neither ([estimate](#the-estimate)) |
| `connection.costUnity` | `"$"` | Currency symbol printed in front of costs |
| `driver` | — | Your own function instead of the built-in client ([Vercel example](#optional-vercel-provider)) |
| `budget` | `"safe"` | Your spending caps, per run and per day, in cost ([budget](#budget-caps)) |
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

`vitetranslate --llm-status` tells you where the key was found, along with the connection, today's spend, the budget and model class in force, `llm.costGuard` and the [context abstract](#the-context-abstract). It makes no network call; `--llm-ping` adds one minimal request to confirm the model answers.

## Costs, budget and confirmation

### The estimate

Every run prints an estimate before it spends anything:

```text
::: LLM                  ║  "deepseek-flash" · standard
::: ⌘ deepseek.com       ║  - (2/2) incomplete tables - 128 missing keys - 2 api requests
:::                      ║  - token (in ~13.1k - out ~9.3k) ≈ $0.0190 < costGuard ($0.2000)
```

- **Line 1** — the model, and its [class](#model-class).
- **Line 2** — the provider (the `baseURL` host, without `api.` or a port; absent with your own driver), how many tables have work, how many keys, how many requests.
- **Line 3** — estimated tokens, the cost when prices are set, and the comparison with [`costGuard`](#confirmation) when it is set.

The cost shows only when both `connection.costMillionInput` and `connection.costMillionOutput` are set — both or neither, half a price is a wrong estimate. `connection.costUnity` (default `"$"`) is the symbol printed in front of every cost, on screen and in `runs.log`.

The estimate converts characters to tokens with a fixed ratio on the first run: 4 characters per token, 1.5 when the **source** language is Chinese, Japanese or Korean. From then on it trusts what the provider's `usage` reported — per model, and for the output per target language, split in two: the reply itself, and the thinking of a [reasoning model](#reasoning-models), per key. Only the last ~300 keys of each language count, so a model that changes its ways shows up within a run.

### Budget caps

Two separate ideas, two units. `budget` is **your** spending, in **cost**. [`connection.modelClass`](#model-class) says how much **the model** can take, in **tokens**, and sizes the batches. Keys, requests and characters are no longer caps.

```js
llm: {
  budget: "safe", // "safe" (default) | "normal" | "unlimited" | { ...fields }
}
```

| Preset | `maxCostPerRun` | `maxCostPerDay` | Without prices: `maxTokensPerRun` | `maxTokensPerDay` |
| :- | -: | -: | -: | -: |
| `"safe"` | 0.10 | 0.50 | 50,000 | 200,000 |
| `"normal"` | 1 | 5 | 500,000 | 2,000,000 |
| `"unlimited"` | ∞ | ∞ | ∞ | ∞ |

Cost needs both prices. Without them the same presets fall back to caps in tokens (input + output) — one unit at a time. An object overrides single fields on top of `"safe"`: `maxCostPerRun`, `maxCostPerDay` (these two need prices), `maxTokensPerRun`, `maxTokensPerDay`. An explicit field always counts, in either unit. Anything else, `maxKeysPerRun` from 4.6.1 included, is a configuration error.

The preset numbers assume a dollar- or euro-sized currency. With `costUnity: "¥"` write your own caps.

A run that would exceed a cap is refused, and the message names the cap. `--llm-auto` bypasses all four. If one is reached mid-run, the run stops but keeps everything already validated — nothing already paid for is thrown away. The day's totals are written after **every** request, so Ctrl+C doesn't reset today's spend.

### Model class

```js
llm: {
  connection: { modelClass: "standard" }, // or { k, maxOutputTokens, maxKeys, maxTokens }
}
```

| Class | Typical models | Batch up to | `max_tokens` sent |
| :- | :- | :- | -: |
| `"basic"` | small local models | 1.5k output tokens / 40 keys | 2,048 |
| `"standard"` (default) | flash and mini models | 3k / 100 | 4,096 |
| `"advanced"` | mid-range models | 4.5k / 150 | 6,144 |
| `"expert"` | high-end models | 6k / 200 | 8,192 |
| `"frontier"` | flagship models | 8k / 250 | 12,288 |

These are starting estimates, not measurements. An object is merged over `"standard"`; `maxTokens` must be at least `maxOutputTokens`, or every full batch would be truncated by construction.

How a batch is cut, in three lines:

- Every request repeats the system prompt and the context: the overhead **O**. A class has a factor **k** (1, 3, 4, 5, 6): a batch closes as soon as its payload reaches `k · O`, so the overhead is at most `1/(1+k)` of the input.
- Two hard ceilings close it sooner: the expected output tokens and the number of keys. Smaller batches mean fewer hallucinations, hence the smallest one that keeps the overhead low.
- A string is never split: a single huge one travels alone.

`max_tokens` is always sent, under the name in `connection.maxTokensField`. OpenAI's reasoning models want `"max_completion_tokens"`.

A reply that comes back **truncated** is never sent again as it was: the same question under the same limit would truncate again, and every attempt is billed. What came back complete is kept; the other keys go back to the model **in the same run**, in batches of at most half the size, for up to three rounds (100 → 50 → 25 → 12). Keys still cut off after that stay `null`, and a note under the panel says so.

### Reasoning models

Some models think before they answer, and bill the thinking as output tokens under the same `max_tokens` as the reply. On the restaurant demo, `deepseek-flash` spent 78% of its output thinking, and every truncation came from there. The run measures it apart — from `usage.completion_tokens_details.reasoning_tokens`, where the provider reports it — per key and per language, sizes the batches for it, and shows its share on the last line:

```text
real token: 41200 (≈ $0.0512) · reasoning 78% of output
```

Translating interface strings rarely needs it. Switching it off is provider-specific, so it goes in `providerOptions`:

```js
connection: {
  providerOptions: { thinking: { type: "disabled" } }, // DeepSeek — other providers have their own field
}
```

Keep it on, and give it room instead: a bigger [`modelClass`](#model-class), or a custom one with a higher `maxTokens`.

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
:::                      ║  ✔ < 50 new keys Deutsch. 178 to do                                    3s
:::                      ║  ✔ < 7 new keys American English. Full translate!                      2s
:::                      ║  ⠹ > ask 7 keys italiano - 日本語            retry 1/3 after HTTP 429  3s
:::                      ║  ✖ - error français (HTTP 401). see trace in debug mode!               1s
```

| Mark | Meaning |
| :- | :- |
| `>` | asked, waiting for the reply |
| `<` | answered — green if every key came back valid, orange if some didn't (the line says how many and why). Then how many keys that language still has at `null`, or `Full translate!` once it has none |
| `-` | failed for good — the reason follows: `HTTP 429`, `timeout`, `reply not JSON`, `network error`, or `truncated` (the reply hit `max_tokens`, see [model class](#model-class)) |

A truncated reply that still brought some keys home is a `<` line ending in `truncated`; its missing keys come back as `> split 19 keys …` lines. The repair round and the [context abstract](#the-context-abstract) get their own lines too. When the last request closes, the block becomes a plain log, each line ending with `<what happened> / <seconds>.`:

```text
::: LLM                  ║  ✔ < 50 new keys Deutsch. 7 to do / 3s.
:::                      ║  ✔ < 7 new keys Deutsch. Full translate! / 3s.
:::                      ║  ✔ < 7 new keys American English. Full translate! / 2s.
:::                      ║  ✔ < 6 new keys 日本語. 1 to do / 1 rejected / 4s.
:::                      ║  ✖ - error français (HTTP 401) / see trace in debug mode / 1s.
:::                      ║
:::                      ║  real token: 3100 (≈ $0.0106)
```

`N to do` counts the keys still `null` in that language after this reply, `Full translate!` means none are left; then any rejected or missing keys, or for an error the reason. The last line is the real cost of the run, summed from the provider's `usage` — plus the share of [reasoning](#reasoning-models), when there was any. With `--llm-debug`, the trace folder is printed at the end; the per-language breakdown lives there, in `summary.json`.

Piped, redirected or in CI there is no live block, only the final log. A failed request doesn't stop the others: its keys stay `null` — a truncated one excepted, see above — and [`--llm-debug`](#debugging-a-run) has the full reply.

Every reply lands in its `.yml` **as soon as it is validated**, not at the end: stop a run with Ctrl+C and you lose only the requests still in flight. The file is re-read before each write, so a key you fill by hand meanwhile, or one a sync removes, is left alone. A `vite dev` running next to it just reloads the page on each write — watching the translations appear is part of the show.

## The context abstract

`<localeDir>/.llm/context.md` is a short brief the model reads before every translation, in four sections: **Domain** (what the app is about), **Register** (its tone), **Glossary** (terms to keep consistent, or untranslated) and **Ambiguities** (strings that need context to translate right). The file has two parts:

- **between the `<!-- vitetranslate:generated -->` markers** — written by the model from a sample of your strings, replaced on every refresh;
- **below them** — yours, never touched, and fed back into every future refresh. A correction written there ("we call it 'Ordine', not 'Ordinazione'") sticks.

A name the brief says to _keep_ stays exactly as written, in its own script, even inside a Japanese or Russian sentence: no transliteration. Want katakana? Say so below the markers.

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

For an [ICU message](icu.md), the last three are replaced by the same check compilation and `--status` use: the reply

- has the same arguments as the source, numbers and names alike — `icu-args`;
- has a valid ICU message where the source does (`icu-missing`) and not where it doesn't (`icu-introduced`);
- covers every plural/ordinal category this target language requires, and every `select` key the source had — `icu-plural-categories` / `icu-select-keys`, rejections here too, not just warnings;
- isn't wildly longer than the source (at most `source.length * 8 + 20` — plural branches grow with the language).

Unlike `%s`, an ICU translation **can** reorder its arguments (`{1} {0}` for a source `{0} {1}`) — the prompt tells the model so only for languages whose batch actually contains an ICU string, keeping the extra rules off every other prompt's token count.

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

A batch sent again after a truncation is traced as `split-<tag>-bNN`, a repair as `repair-<tag>-bNN`. The `elapsedMs` of a response covers the whole reply, body included: some providers send the headers at once and the answer when it's ready.

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
| `--llm-status` | Connection, key source, today's spend, budget, model class, the context abstract — no network |
| `--llm-ping` | `--llm-status` plus one minimal call to the model |
| `--llm-key-set` / `--llm-key-status` / `--llm-key-clear` | Manage the keyring entry, if installed |

Examples use the global command; without it, put `npx` in front ([CLI](cli.md)).

## Optional Vercel Provider

For an API that doesn't speak Chat Completions, or to go through a client library, pass your own `llm.driver`: a function, sync or async, receiving `{ connection, apiKey, systemPrompt, userPayload, mode, maxTokens }` (ignore `maxTokens` if you like) and returning either `Record<key, string>` or `{ translations, usage }`. With a driver, `baseURL` and `model` are no longer required. For example, with the [Vercel AI SDK](https://sdk.vercel.ai):

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
