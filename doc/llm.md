# LLM auto-translation

> The [README](../README.md) covers the quick start. This is the full reference for `npx vitetranslate --llm-translate` and the `llm` plugin option.

Runnable example: [`demo/Vite_8/llmTranslate`](../demo/Vite_8/llmTranslate) — three target languages sitting at `null`, the `llm` block already wired, and one command to fill them.

Today's manual workflow — copy the `----to be translated----` block into an LLM by hand, paste the answer back over the `null`s (see [translation file format](translations.md)) — still works and always will. This page covers doing that automatically.

Every LLM flag starts with `--llm-`; the 4.5 names (`--translate`, `--force`, `--key set`, …) are gone — see the [flags table](#flags) below.

```bash
npx vitetranslate --llm-translate
```

Syncs, then fills every `null` key it finds, for every language, through an LLM you configure. Runs **only from the CLI** — never from the Vite plugin, in any hook, in any project. Wiring an LLM call into `vite dev` would mean a network call (and a bill) on every dev server start and every CI build; see [structure.md](structure.md#fase-5--traduzione-automatica) for why that line is not negotiable.

## Setup

```js
// vite.config.js
vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",
  llm: {
    connection: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.5-flash",
      apiKeyEnv: "VITETRANSLATE_API_KEY", // name of the env var, never the key itself
    },
  },
});
```

The API key itself never goes in `vite.config.*`. `connection.apiKey` is not a recognised option — only `apiKeyEnv`, the **name** of an environment variable. The key is resolved in this order, and never logged or written to disk:

1. `process.env[apiKeyEnv]`
2. `.env.local`, then `.env`, in the project root
3. the system keyring, if `@napi-rs/keyring` is installed (see [below](#the-keyring))

```bash
npx vitetranslate --llm-status
```

Connection, key source, today's counters, `llm.costGuard` (if set), and the context abstract, printed in full at the end — no network call. Add `--llm-ping` (which implies `--llm-status`) to also make one minimal request and confirm the model answers.

## The protocol

`connection.protocol` only accepts `"openai-chat"` — the Chat Completions shape, which Gemini (`/v1beta/openai/`), OpenAI, OpenRouter, Groq, Ollama, LM Studio and vLLM all speak. It's a built-in `fetch` driver: no dependency added.

For anything else, pass your own `connection.driver` — a function, sync or async, taking `{ connection, apiKey, systemPrompt, userPayload, mode }` and returning either `Record<key, string>` or `{ translations, usage }`. This is also the door for the [Vercel AI SDK](https://sdk.vercel.ai) or any other client:

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
    return { translations: JSON.parse(text), usage: { tokensIn: usage.promptTokens, tokensOut: usage.completionTokens } };
  },
},
```

With a `driver`, `connection.baseURL` and `connection.model` are no longer required.

## Costs and budget

Every run prints an estimate before it spends anything:

```text
::: llm                  ║  fr-FR, de-DE: 128 key(s), 6 request(s)
:::                      ║  ~62.1k in + ~9.3k out tokens  ≈  $0.0191  (in $0.0047, out $0.0144)
:::                      ║  estimated from characters · no prompt-caching discount
```

The cost line only appears once `connection.costMillionInput` and `connection.costMillionOutput` are both set (dollars per million tokens) — give both or neither, a half price is a wrong estimate. `connection.costUnity` (default `"$"`) prefixes every cost shown, on screen and in `runs.log`. Without prices, only the token counts print.

The character→token ratio starts from a fixed constant and self-tunes per model from the second run on, using what the provider's own `usage` reported on the first one.

```js
llm: {
  budget: "safe", // "safe" (default) | "normal" | "unlimited" | { ...custom fields }
}
```

| Preset | keys/run | requests/run | keys/day | chars/run |
| :- | -: | -: | -: | -: |
| `"safe"` | 50 | 20 | 200 | 200,000 |
| `"normal"` | 500 | 200 | 2,000 | 2,000,000 |
| `"unlimited"` | ∞ | ∞ | ∞ | ∞ |

Pass an object to override individual fields on top of `"safe"`, and add `maxCostPerRun` (a number, active only once both prices are set) to cap what a single run may spend. Any cap that would be exceeded refuses the run and names which one; `--llm-auto` bypasses the five numeric caps (not the CI guard below). If `maxCostPerRun` is hit mid-run, the run stops but keeps everything already validated — nothing already spent is thrown away.

Two guards aren't numbers:

- **In CI** (`process.env.CI` set), the run refuses outright unless `--llm-noask` or `VITETRANSLATE_LLM_ALLOW_CI` is set — `--llm-auto` does **not** bypass this one, on purpose: nobody is watching a scrolling CI log to catch it.
- **Interactively**, `--llm-translate` always prints the estimate and asks `Proceed? [y/N]` on a TTY, unless `--llm-noask`. Without a TTY and without `--llm-noask`, it refuses instead of hanging. `--llm-dry-run` never asks — it sends nothing.

A third option skips only the question, never the guards above:

```js
llm: {
  costGuard: 0.01, // below this estimated cost, run without asking — even without a TTY
}
```

`cost < costGuard` (strictly below) runs without a prompt; at or above it, the normal TTY/`--llm-noask` rule applies. It requires both `costMillionInput` and `costMillionOutput` — without prices there's no estimate to compare it with. `--llm-dry-run` reports which side of the guard the run would have landed on.

## The context abstract

`<localeDir>/.llm/context.md` — a short brief the model reads before every translation, and the corpus it's abstracted from. Two regions in the file: everything between the `<!-- vitetranslate:generated -->` markers is machine-written and gets replaced on refresh; everything below stays yours forever, notes included, and is read back into every future generation too — a correction you write there ("we call it 'Ordine', not 'Ordinazione'") sticks.

Controlled by `llm.context`:

```js
llm: {
  context: {
    mode: "auto",       // "auto" (default) | "manual" | "off"
    refreshEvery: 40,    // regenerate once this many new keys have appeared
    sample: 300,         // how many strings feed the abstract, stratified by component
  },
},
```

In `"auto"` mode it regenerates when the file is missing, when keys have grown by `refreshEvery` or by 25% since the last generation — never twice in the same run. `"manual"` only regenerates on an explicit `--llm-context`; `"off"` never touches it but still reads it if it exists. A file you wrote by hand (no generated markers) is never touched either way, and you're warned once.

```bash
npx vitetranslate --llm-context   # regenerate now
npx vitetranslate --llm-status    # print it (and everything else) and exit
```

## The keyring

`@napi-rs/keyring` is an **optional** peer dependency, never required — install it only if you want the API key stored in the OS keychain instead of an env var:

```bash
npm i -D @napi-rs/keyring
npx vitetranslate --llm-key-set     # reads the key from stdin, input hidden
npx vitetranslate --llm-key-status
npx vitetranslate --llm-key-clear
```

Without the package, or without a Secret Service (Docker, WSL, a remote SSH session), the keyring step of the resolution chain is skipped silently — it's always the last resort, never a requirement.

## What gets validated

A translated value is only ever written once it passes **all** of these:

- it's a non-empty string, and not the key echoed back;
- the `%s` placeholders are the same count as the source (order can't be checked — see [limitations](limitations.md));
- the inline tags (`<b>`, `<i>`, …) are the same multiset as the source, not crossed;
- it isn't wildly longer than the source (`source.length * 4 + 20`).

Anything that fails stays `null`, is counted by reason in the run's report, and gets **one** repair attempt with the rejection reason fed back to the model — not two. A key that fails twice for the same language is skipped on later runs (`--llm-auto` retries it).

## Debugging a run

`--llm-debug`, combined with `--llm-translate`, `--llm-retranslate`, `--llm-context` or `--llm-ping`, logs every request, reply and error to a run-specific folder, one numbered file each — never the API key, always redacted first:

```bash
npx vitetranslate --llm-translate --llm-debug
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

The folder (`<localeDir>/.llm/<YYMMDDHHmmss>/`) is git-ignored on the spot — nothing to clean up by hand. `--llm-status` lists how many trace folders exist and names the latest one.

## Flags

Every flag lives under `--llm-`; an unrecognised one in that namespace is an error, not a silent sync.

| Flag | Does |
| :- | :- |
| `--llm-translate [tag...]` | Sync, then fill the `null`s. No tags: every language with missing keys |
| `--llm-retranslate <tag>...` | Redo already-translated keys too, tags required, backs up first |
| `--llm-context` | Regenerate the abstract now (alone, or together with the two above) |
| `--llm-dry-run` | With the three above: print the estimate, send nothing |
| `--llm-auto` | Bypass the numeric budget caps and the failed-keys record — not the CI guard |
| `--llm-noask` | Don't ask for confirmation (see also `llm.costGuard`) |
| `--llm-debug` | Log every request, reply and error to `<localeDir>/.llm/<YYMMDDHHmmss>/` |
| `--llm-status` | Connection, key source, today's counters, and the context abstract — no network |
| `--llm-ping` | `--llm-status` plus one minimal call to the model |
| `--llm-key-set` / `--llm-key-status` / `--llm-key-clear` | Manage the keyring entry, if installed |
