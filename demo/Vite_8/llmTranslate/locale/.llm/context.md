<!-- vitetranslate:generated 2026-09-18 · 8 keys · deepseek-flash -->
## Domain
Documentation page for translation management in a Vite project. A CLI (`vitetranslate`) syncs translation tables and, in one run, fills the empty cells using an LLM; placeholders and tags are validated against the source.

## Register
Informal and direct, second-person singular ("ti mostra", "ti chiede"), addressed to a developer. Technical but conversational; no formal register.

## Glossary
- vitetranslate — CLI name, keep as-is
- --llm-translate — command flag, keep as-is
- doc/llm.md — file path, keep as-is
- vite.config.js — file path, keep as-is
- CLI
- API — as in "chiave API"
- null — literal value written into the table
- %s — placeholder, do not translate; order and count matter
- <b>…</b> — markup tags, keep as-is
- &nbsp; — non-breaking space entity, keep as-is

## Ambiguities
- "mette le stringhe nuove a null" — whether the literal `null` is written into the table or the cell is left empty.
- "caselle" / "caselle vuote" — table cells, but the word also suggests form fields or checkboxes; choose per string.
- "il modello" — means the LLM, not a template or a data model.
- "fra due marcatori" — which two markers is never stated in the string.
- "segnaposto e tag" — "tag" may mean markup tags or validation labels.
- "lì vive solo il nome della variabile d'ambiente" — whether the environment variable name is a literal to leave untranslated.
- "%s lingue · versione&nbsp;<b>%s</b>" — two `%s` with different meanings (count, version); preserve order and count.
<!-- /vitetranslate:generated -->

## Notes from the team
<!-- Everything outside the generated block is yours and is never overwritten. -->
