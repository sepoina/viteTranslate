# Plugin options

> The [README](../README.md) covers the quick start. This is the full reference for `vitetranslate(options)`.

```js
vitetranslate(options)
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `localeDir` | `string` | **required** | Folder with the language files (`.yml`), relative to `baseDir` |
| `sourceLanguage` | `string` | **required** | [BCP 47](bcp47.md) tag of the source language |
| `preloadedLanguages` | `string[]` | `[]` | Languages bundled eagerly for an instant, non-suspending first paint (see [Preloading](api.md#preloading-suspense-and-the-initial-flash)). `sourceLanguage` is eager too in dev, and in build only when this list is empty |
| `baseDir` | `string` | `process.cwd()` | Project root used to resolve `localeDir` / `srcDir` |
| `srcDir` | `string` | `"src"` | Source folder scanned by the CLI |
| `autoSyncDev` | `boolean` | `true` | Sync the tables at dev server startup, using the fast verify: nothing happens, nothing is printed, if nothing changed since the last sync. Makes `predev` unnecessary |
| `autoSyncBuild` | `boolean` | `true` | Sync the tables before a build, with a full scan instead of the fast verify — a build gets the certainty of freshly rebuilt tables. Makes `prebuild` unnecessary |
| `includeFallback` | `boolean` | `!isProduction` | Embed the original text as a fallback in the compiled marker (dev only by default) |
| `errorSolve` | `object` | see below | On-screen and console diagnostics for strings that didn't arrive where they should — see [Diagnostics](diagnostics.md) |
| `simpleLog` | `boolean` | `false` | Plain, un-boxed console output for the plugin and the CLI: no label column, no rules, same colors — useful in CI or a narrow terminal. Same as the CLI's `--simpleLog` flag, which always wins over this option |

Only `false` turns `autoSyncDev` / `autoSyncBuild` off — any other value counts as on. Setting `VITETRANSLATE_NO_SYNC` (to anything non-empty) turns both off without touching `vite.config.*`, which is the only way to reach this from a read-only checkout. Neither one ever runs under Vitest or `vite preview`: a test run shouldn't rewrite your tables, and a preview has no source changes to catch up on.

## `errorSolve`

🧪 What each of these actually does to the screen: [live edge cases](https://sepoina.github.io/viteTranslate/edge/).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mark.badData` | `string \| false` | `"🚫"` | Shown, followed by the name of what was found (`🚫[func]`), when the text slot holds a value that is not text and nothing can be recovered. Turned off, nothing is rendered |
| `mark.malformed` | `string \| false` | `"‼️"` | Prefix for text nobody marked, and for incompatible props |
| `mark.untranslated` | `string \| false` | `"🔸"` | Prefix when the current language has no translation for that entry |
| `mark.notFullyTranslated` | `string \| false` | `"🔹"` | Prefix when the entry is translated here but missing in some other language |
| `mark.absentDataInArray` | `string` | `"⁇"` | Stands in for a `%s` left without a value. Ordinary rendering, not a diagnostic: applies in dev **and** in a build, and `markOnlyDev` doesn't touch it |
| `markOnlyDev` | `boolean` | `true` | In a build, no diagnostic marks on screen — just the fallback. The data behind them isn't shipped either |
| `warningDev` | `boolean` | `true` | Runtime console output in development |
| `warningBuild` | `boolean` | `false` | Runtime console output in production — **all** of it, failures included |

See [Diagnostics](diagnostics.md) for what each character means on screen and when it fires.
