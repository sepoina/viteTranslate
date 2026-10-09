# Translation file format

> The [README](../README.md) covers the quick start. This is the detail on `.yml` language files and how to add a new one.
>
> **Coming from 3.x?** Language files used to be JS modules — see [migrating from 3.x](cli.md#migrating-from-3x).

🎮 **[The same steps, live](https://sepoina.github.io/viteTranslate/playground/#install-new-language)** — `--add`, the `null`s, the finished file.

## Adding a language

```bash
npx vitetranslate --add fr-FR
npx vitetranslate --add fr-FR de-DE pt-BR
```

The tag must be in `<language>-<REGION>` form and name a real language and region ([supported list](bcp47.md)) — `fr-FF` is refused before anything is written to disk. A language already present is left untouched.

The new file comes out with every key found in source, not yet translated (`null`):

```yaml
#  -------------------------------------------------
#      français
#       |    code: fr-FR
#       |    missing key: 2
#       |    processed: 2026-09-05 12:37
#       |    TableVersion: 260905
#  -------------------------------------------------
#

#  ----to be translated------------------------------------------
BasicExample_1nke42v: null
DynamicExample_1wltsn1: null
```

The same keys show up in the source language file too, grouped under that same separator — never as `null` there, but as real text, for as long as they're missing in at least one other language.

> [!TIP]
> `npx vitetranslate --llm-translate` does the next step for you — fills the `null`s through an LLM you configure, with a validator that refuses anything that would break at runtime. See [the LLM guide](llm.md). The manual way still works exactly as before, and always will: copy that block into an LLM by hand, then paste the answer over the `null`s:

```yaml
#  -------------------------------------------------
#      italiano (Italia) (sourceLanguage)
#       |    code: it-IT
#       |    missing key: 2
#       |    processed: 2026-09-05 12:37
#       |    TableVersion: 260905
#  -------------------------------------------------
#

#  ----to be translated------------------------------------------
BasicExample_1nke42v: "Welcome to viteTranslate"
DynamicExample_1wltsn1: "Hello %s, how are you?"
```

Replace each `null` with the translated text, keeping `%s` placeholders and numbered tags (`<0>…</0>`) intact, then sync once more so the file settles into its final shape:

```bash
npx vitetranslate
```

```yaml
#  -------------------------------------------------
#      français
#       |    code: fr-FR
#       |    missing key: 0
#       |    processed: 2026-09-05 12:41
#       |    TableVersion: 260905
#  -------------------------------------------------
#
BasicExample_1nke42v: "Welcome to viteTranslate"
DynamicExample_1wltsn1: "Hello %s, how are you?"
```

No further registration needed: every `.yml` file in `localeDir` is automatically available — `useTranslateLanguage()` lists it and `TranslateContainer` loads it lazily on request.

### Numbered tags in the table

A value like `App_1jztuw0: "Bon retour, <b>{name}</b> !"` came from writing JSX inside `<Translate>` ([React API](react-api.md#write-jsx-inside-translate)): `<b>` here has no attributes, so it's text — move it wherever the sentence needs it, the way any other tag moves. A `<1>…</1>` is different: it's a **slot**, standing in for a link or a component the source code provides — a `<a href>`, a `<Link to>`. Keep every numbered tag, opening and closing, with its number, around the words that belong inside it; you can move a tag together with its words, but never renumber one, drop one, or turn one into a different tag — the number is how the compiled table finds the right element, not a stylistic choice.

## What protects your files

The sync is the only thing that writes your tables, so it is careful:

- **Backups.** Before a table is regenerated because it was corrupted (`.bak-corrupted-*`), or before a suspicious mass deletion (`.bak-erased-*`, one per language), the file is copied byte for byte — whatever its encoding. If a backup cannot be written, nothing is overwritten.
- **Atomic replacement.** A table is written to a temporary file (`.<name>.yml.vt-tmp-…`) and renamed over the old one, so a crash never leaves half a table. If a crash leaves one of these temporary files behind, delete it.
- **No clobbering.** A file you saved while the sync was running is not overwritten: the sync stops with a message and you run it again.
- **All or nothing, before the first write.** Every file is read, planned and backed up before any table is replaced. One unreadable file, including a broken or inaccessible language symlink, stops the whole sync with nothing changed.

It is careful, not magic: the check is made just before each rename attempt, including Windows retries (a tiny window remains), there is no lock between processes, and several tables are replaced one after another, not as one transaction — see [limitations](limitations.md). The messages and what to do are in [the CLI guide](cli.md#when-the-sync-stops).

## File format

Each language is one `.yml` file in `localeDir`, named after its BCP 47 tag (`it-IT.yml`, `en-US.yml`, …), holding the translation table as a flat map. The **source language** file is fully autogenerated from the markers found in your source — you never hand-write it.

A header comment (language name, tag, count of keys still missing, last-sync timestamp, format version) sits at the top, regenerated on every sync — never hand-edit it. Everything below it is text: the rest of the file holds nothing else.

Values are always double-quoted, one entry per line, no indentation. It is a **strict subset of YAML**: whatever this format accepts, a real YAML parser reads the same way, so your editor colours it and any YAML tool can read it. The subset is narrow on purpose — unquoted YAML scalars mangle exactly the text translators write (`%s è pronto` is a syntax error, `price 5 # off` truncates to `price 5`, `1.20` becomes the number `1.2`). Anything outside the subset is an error naming the **line number**, not a plausible wrong value.

🧪 What that text looks like on screen — accents, emoji, CJK, quotes, backslashes, new lines: [real texts, live](https://sepoina.github.io/viteTranslate/edge/#real-text).
