# CLI

> The [README](../README.md) covers the quick start. This is the full reference for `vtranslate-cli`.

```bash
npx vtranslate-cli
```

> **Renamed in 4.1.** The command used to be `vitetranslate-prepare-translation-table`. That name is still registered and keeps working, so a `prebuild` script you already wrote does not break — but `vtranslate-cli` is the one to use, and the only one the messages mention.

Reads the `vitetranslate` config from `vite.config.*` in the current working directory, scans `srcDir` for `_%_..._%_` markers, and syncs every language file in `localeDir`: adds new keys, removes stale ones (carrying over translations when a key was only renamed), and reports what's left untranslated. Intended to run as a `prebuild` step.

```text
::: viteTranslate        ║  source: "src" (32 files),  translations: "locale" (59 keys)
:::                      ║
::: status               ║  it-IT.yml - 2 key(s) added, 1 removed
:::                      ║  [en-US.yml, zh-CN.yml] - complete translations!
:::                      ║  pt-BR.yml - 12 key(s) missing
:::                      ║
```

Languages with nothing left to do share one line — it is the same news for all of them — while each language that still needs work gets its own, because the work is different for each. Only the missing count is coloured: in a block that is otherwise uniform, "there is still work here" is the one thing to find without reading.

```bash
vtranslate-cli --add fr-FR de-DE
```

Adds one or more languages, syncs as usual — so the new files come out already filled with every key to translate (`null`) — and closes with the `--status` report, where the languages just added show up with their missing counts. Tags must be in the `<language>-<REGION>` form and name a real language and region ([supported list](bcp47.md)); every tag is validated before anything is written, and a language already present is left untouched.

> [!TIP]
> This is also the fix for `vite dev` refusing to start on a brand new project: without a readable `sourceLanguage` file in `localeDir`, the dev server prints what's missing and stops instead of starting anyway and failing later on the first page load. Running `vtranslate-cli --add <sourceLanguage>` is exactly the command it points you to.

```bash
vtranslate-cli --status
```

Reports every translation table and exits **without writing anything**: keys, missing translations, tables out of sync with the source code, and errors — an unreadable language file, a missing source language, files still in the 3.x format. The reference is the source code as it is now, not the source language file, so it also answers "do I need to re-run the sync?".

```text
::: status               ║  translation tables in "locale"
:::                      ║  source language "it-IT" · 53 key(s) found in 17 scanned source file(s)
:::                      ║
:::                      ║  CODE   LANGUAGE            KEYS  MISSING  STATUS
:::                      ║  en-US  American English      53        0  fully translated
:::                      ║  it-IT  italiano (Italia)     53        0  source language
:::                      ║  fr-FR  français (France)     51       12  out of sync with the source code:
:::                      ║                                           2 key(s) to add, 0 to remove
:::                      ║  de-DE  Deutsch                -        -  line 7: not an entry — expected
:::                      ║                                           'Key_abc: "text"' or 'Key_abc: null'
:::                      ║
::: status               ║  4 language(s): 2 ok, 1 incomplete, 1 error
```

The `CODE` cell is coloured by what the language needs: green when there is nothing to do, orange when there is (missing translations, out of sync), red when the file cannot be read.

The exit code is `1` on errors only, so it works as a CI check. An incomplete table is not an error — it is the normal state of a project still being translated.

```bash
vtranslate-cli --migrate
```

One-off conversion of 3.x language files (`<tag>.js`) to the 4.0 format (`<tag>.yml`) — see [migrating from 3.x](#migrating-from-3x) below. It only converts and exits; nothing else runs.

```bash
vtranslate-cli --simpleLog
```

Plain, un-boxed output: no label column, no rules — same colors, just shorter lines. Useful in a CI log or a narrow terminal. Same as the plugin's `simpleLog` option ([plugin options](plugin-options.md)); when both are set, this flag wins.

```bash
vtranslate-cli --help
```

Usage and the available flags. It works from anywhere: unlike the other forms, it does not need a `vite.config.*` in the current directory.

## Migrating from 3.x

Language files are now data (`.yml`) instead of JS modules. **Nothing changes in your code or in your bundle** — the same lazy chunk per language, the same API — only the files on disk and their extension.

```bash
npx vtranslate-cli --migrate   # <tag>.js  ->  <tag>.yml
npx vtranslate-cli             # re-sync as usual
```

The originals are renamed to `.bak-migrated-*`, never deleted: check the result, then remove them. A file the converter can't read on its own (a language module with imports or computed values) is left where it is and reported, so nothing is converted halfway. If you start Vite with the old files still in place, the plugin stops and says exactly this instead of reporting a missing source language.

Why the change: a language file is *data*, but as a JS module it had to be **executed** to be read — which is where the `vm` sandbox, the `import()` fallback and the Node ESM module cache (never released, ~24 kB retained per translator save) all came from. That whole layer is gone.
