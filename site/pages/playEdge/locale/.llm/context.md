<!-- vitetranslate:generated 2026-09-24 · 256 keys · deepseek-flash -->
## Domain
A demo/reference page for viteTranslate, a translation plugin used with Vite/React. It lists edge-case rows showing what you write, what the plugin actually renders, and what is expected (ICU interpolation, HTML/JSX markup, autoWrap markers). The interface language is Italian.

## Register
Technical, neutral and instructional, addressed to the reader informally (Italian "tu": "cosa scrivi", "Passa sopra"). Occasionally light and playful (emoji, "via!").

## Glossary
viteTranslate
`<Translate>` (component)
autoWrap
skipMark
ICU (interpolation format)
`t` (text prop), `a` (args), `o` (object) — project shorthands
children
prop
key
Fragment
RegExp
JSX / template literal
JavaScript values used literally: null, undefined, true, false, Symbol, BigInt
Diagnostic marks: `‼️`, `🚫`, `⁇`, `🔸`, `🔹`
HTML tags in fixtures: `<b>`, `<i>`, `<code>`, `<em>`, `<br>`, `<script>`

## Ambiguities
- Both `%s` and `{0}`/`{name}` placeholders appear; they are syntax, keep verbatim.
- "Ottimale"/"Warning"/"Errore" appear capitalized as legend labels and lowercase ("ottimale", "warning", "errore") as row values — casing may be meaningful.
- Apostrophe variants (`dell’{0}`, `dell'{0}`, `dell''{0}`) are deliberate test data, not typos.
- Many strings are intentionally broken fixtures (`<b>x <i>y</b> z</i>`, `Ciao {nome}`, `{name} ha {1} anni`, `Premi &#123;Invio}`, `Sconto 100%sicuro`): reproduce, do not fix.
- "atteso in origine (IT)" and "← viteTranslate: tutte le demo" mark source-language/expected state, not UI copy to be reworded.
- "Novità" (autoWrapCases) is a standalone heading with no visible context.
- "Sorgente di: %s" is a table column label; %s receives a source-language string.
- Test keys such as `testCases_1015p5c` ("true") and `testCases_136tvg5` ("null") are literal JS values, not translatable words.
<!-- /vitetranslate:generated -->

## Notes from the team
<!-- Everything outside the generated block is yours and is never overwritten. -->
