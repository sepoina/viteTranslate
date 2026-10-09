# Plugin options

> The [README](../README.md) covers the quick start. This is the full reference for `vitetranslate(options)`.

🎮 **[The setup, live](https://sepoina.github.io/viteTranslate/playground/#install-config)** — install, `vite.config.js`, folder layout; then the [first dev run](https://sepoina.github.io/viteTranslate/playground/#install-dev) and the [automatic sync](https://sepoina.github.io/viteTranslate/playground/#install-sync).

```js
vitetranslate(options)
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `localeDir` | `string` | **required** | Folder with the language files (`.yml`), relative to `baseDir` |
| `sourceLanguage` | `string` | **required** | [BCP 47](bcp47.md) tag of the source language |
| `preloadedLanguages` | `string[]` | `[]` | Languages bundled eagerly for an instant, non-suspending first paint (see [Preloading](react-api.md#preloading-suspense-and-the-initial-flash)). `sourceLanguage` is eager too in dev, and in build only when this list is empty |
| `baseDir` | `string` | `process.cwd()` | Project root used to resolve `localeDir` / `srcDir` |
| `srcDir` | `string` | `"src"` | Source folder scanned by the CLI |
| `autoSyncDev` | `boolean` | `true` | Sync the tables at dev server startup, using the fast verify: nothing happens, nothing is printed, if nothing changed since the last sync. Makes `predev` unnecessary |
| `autoSyncBuild` | `boolean` | `true` | Sync the tables before a build, with a full scan instead of the fast verify — a build gets the certainty of freshly rebuilt tables. Makes `prebuild` unnecessary |
| `includeFallback` | `boolean` | `!isProduction` | Embed the original text as a fallback in the compiled marker (dev only by default) |
| `autoWrap` | `boolean \| RegExp` | `false` | Makes marked JSX text and attributes render for real instead of showing the compiled marker, by rewriting them into a `<Trans>`/hook call. Also turns on the two preprocessor forms that need somewhere to render into: a `"_%_…_%_"` sentence split across JSX siblings (`<p>_%_hi <b>x</b>_%_</p>`), and the hook form `<Trans>` itself compiles to inside a recognised component. `true` covers every host tag except `script`, `style`, `title` and `textarea` (text-only, handled differently); a `RegExp` narrows further to the tags it matches. See [limitations](limitations.md) for what it doesn't cover |
| `marker` | `string` | `"_%_"` | The delimiter of a marked string, the same at both ends (`"§"` → `"§ciao§"`). See [Markers](#markers) |
| `markerStart` | `string` | `marker`, or `"_%_"` | The opening delimiter. Wins over `marker` for its end |
| `markerEnd` | `string` | `marker`, or `"_%_"` | The closing delimiter. Wins over `marker` for its end |
| `errorSolve` | `object` | see below | On-screen and console diagnostics for strings that didn't arrive where they should — see [Diagnostics](diagnostics.md) |
| `simpleLog` | `boolean` | `false` | Plain, un-boxed console output for the plugin and the CLI: no label column, no rules, same colors — useful in CI or a narrow terminal. Same as the CLI's `--simpleLog` flag, which always wins over this option |
| `llm` | `object` | off | Configuration for `npx vitetranslate --llm-translate` — see below. Validated at plugin construction, like `localeDir`; absent means the feature stays off, byte for byte like before this option existed |
| `icu` | `object` | off | Build-time default time zone for ICU `date`/`time` messages — see below and [ICU messages](icu.md) |

Only `false` turns `autoSyncDev` / `autoSyncBuild` off — any other value counts as on. Setting `VITETRANSLATE_NO_SYNC` (to anything non-empty) turns both off without touching `vite.config.*`, which is the only way to reach this from a read-only checkout. Neither one ever runs under Vitest or `vite preview`: a test run shouldn't rewrite your tables, and a preview has no source changes to catch up on.

`autoWrap` is the mirror case: only `true` or a `RegExp` turn it on, any other value (including a typo'd truthy one) leaves it off — a mistake here should fall back to today's behavior, not switch it on by accident. A `RegExp` with the `g` or `y` flag is accepted too — those flags are stripped internally, since a stateful `.test()` would otherwise answer differently for the second tag it checks in the same file. 🎮 Live: [playground/#autowrap](https://sepoina.github.io/viteTranslate/playground/#autowrap); 🧪 ten edge cases: [edge/#autowrap](https://sepoina.github.io/viteTranslate/edge/#autowrap).

## Markers

`_%_` is the default delimiter of a marked string. Pick your own with `marker` (one delimiter, both ends) or `markerStart` / `markerEnd`; the specific one wins:

```js
vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",
  markerStart: "≼", // U+227C
  markerEnd: "≽",   // U+227D
});
```

```jsx
const steps = ["≼Choose≽", "≼Pay≽"]; // same key as "_%_Choose_%_" had
<input title={trans("≼Filter≽")} />
```

- **The key never changes.** It comes from the text inside, not from the delimiters (nor from the component name): switching delimiters, or rewriting `_%_x_%_` to `≼x≽`, keeps every translation. [`--rewriteMarker`](cli.md#rewriting-the-markers) does the rewriting for you, and refuses to write if a single key would change.
- **Not allowed:** spaces, control characters, `<` `>` `{` `}` `"` `'` a backtick, a backslash and `&` (each already means something in JSX, strings or messages), `%s`, and two different delimiters where one contains the other. A bad value stops the plugin at startup, naming the option.
- **Advice:** at least two characters, or a Unicode symbol that never shows up in real text (`≼ ≽`, `§`). Any string that contains a delimiter without being wrapped by it raises a [warning](diagnostics.md), so a common single character will raise many.
- **Old markers:** with custom delimiters, a leftover `_%_` in the source raises the `old-marker` warning and extracts nothing. A [macro](react-api.md#short-names) (`<Trans>…</Trans>`) needs no delimiters at all.
- The demo [`customMarkers`](../demo/Vite_8/customMarkers) shows it working, and the [VS Code extension](ide-panel.md) highlights your delimiters (it reads them from `vite.config`).

## `errorSolve`

🧪 What each of these actually does to the screen: [live edge cases](https://sepoina.github.io/viteTranslate/edge/).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mark.badData` | `string \| false` | `"🚫"` | Shown, followed by the name of what was found (`🚫[func]`), when the text slot holds a value that is not text and nothing can be recovered. Turned off, nothing is rendered |
| `mark.malformed` | `string \| false` | `"‼️"` | Prefix for text nobody marked, and for incompatible props |
| `mark.untranslated` | `string \| false` | `"🔸"` | Prefix when the current language has no translation for that entry |
| `mark.notFullyTranslated` | `string \| false` | `"🔹"` | Prefix when the entry is translated here but missing in some other language |
| `mark.absentDataInArray` | `string` | `"⁇"` | Stands in for an argument with no value — a `%s`, a `{0}` or a `{name}` missing from the object. A plain object used as the *value* itself counts as missing too (it's the arguments container, never something to render). Ordinary rendering, not a diagnostic: applies in dev **and** in a build, and `markOnlyDev` doesn't touch it |
| `markOnlyDev` | `boolean` | `true` | In a build, no diagnostic marks on screen — just the fallback. The data behind them isn't shipped either |
| `warningDev` | `boolean` | `true` | Runtime console output in development |
| `warningBuild` | `boolean` | `false` | Runtime console output in production — **all** of it, failures included |

See [Diagnostics](diagnostics.md) for what each character means on screen and when it fires.

## `llm`

Never used by the plugin itself — the LLM only ever runs from `vitetranslate`, never inside a Vite hook. The plugin only validates the block at construction time, so a mistake here shows up when the dev server starts, not on the first paid call, and passes the normalized result to the CLI through `vitetranslateConfig` (the same mechanism `localeDir`/`sourceLanguage` use, see [structure.md](structure.md#no-separate-config-file)). 🎮 [The `llm` block and one run, live](https://sepoina.github.io/viteTranslate/playground/#install-llm).

```js
vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",
  llm: {
    connection: { baseURL: "...", model: "...", apiKeyEnv: "VITETRANSLATE_API_KEY" },
    budget: "safe",
    context: { mode: "auto" },
    costGuard: 0.01, // below this estimated cost, run without asking
  },
});
```

Full reference — every field, the budget presets, the context abstract, the keyring, the validator, the flags: **[doc/llm.md](llm.md)**.

## `icu`

The build-time default time zone for ICU `{n, date}` / `{n, time}` messages — a restaurant's hours, shown in the restaurant's zone no matter who's looking:

```js
vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",
  icu: { timeZone: "Europe/Rome" },
});
```

| Field | Type | Description |
| :- | :- | :- |
| `timeZone` | `string` | An IANA zone name (`"Europe/Rome"`, `"UTC"`, …). Validated at plugin construction — an unknown zone is a build-time error, not a silent fallback |

Lowest of three precedences: a calendar date (`"YYYY-MM-DD"`) is always UTC regardless of this option; the `timeZone` prop of `<TransContainer>` (`TranslateContainer`) wins over it; with neither, the message uses whatever zone the runtime itself is in. See [ICU messages](icu.md#dates-and-time-zones), 🎮 [live](https://sepoina.github.io/viteTranslate/playground/#icu-format).
