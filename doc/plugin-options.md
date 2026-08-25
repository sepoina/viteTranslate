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
| `includeFallback` | `boolean` | `!isProduction` | Embed the original text as a fallback in the compiled marker (dev only by default) |
| `errorSolve` | `object` | see below | On-screen and console diagnostics for strings that didn't arrive where they should — see [Diagnostics](diagnostics.md) |

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
