<!-- vitetranslate:generated 2026-09-25 · 256 keys · deepseek-flash -->
## Domain
A demo/reference page for viteTranslate, a translation plugin/component used with Vite and React.
It shows edge-case rows side by side: what you write, what the plugin actually renders, and what is expected — ICU interpolation, HTML/JSX markup, autoWrap markers.
The interface copy is in Italian.

## Register
Technical, neutral and instructional, addressing the reader informally (Italian "tu": "cosa scrivi", "Passa sopra").
Occasionally light (emoji, "via!").

## Glossary
viteTranslate
`<Translate>` (component)
autoWrap
skipMark
ICU (interpolation)
`t`, `a`, `o` (project props)
children
key, prop
Fragment
RegExp
JSX / template literal
Literal JS values: null, undefined, true, false, Symbol, BigInt
Diagnostic marks: `‼️`, `🚫`, `⁇`, `🔸`, `🔹`
HTML tags: `<b>`, `<i>`, `<code>`, `<em>`, `<br>`, `<script>`

## Ambiguities
- `%s`, `{0}`, `{1}` and `{name}` are placeholder syntax, not words: keep verbatim.
- Legend labels are capitalized ("Ottimale", "Warning", "Errore") while the matching row values are lowercase ("ottimale", "warning", "errore") — the casing may be meaningful.
- Apostrophe variants of the same string (`dell'{0}`, `dell’{0}`, `dell''{0}`) are deliberate test data, not typos.
- Many entries are intentionally broken fixtures (`<b>x <i>y</b> z</i>`, `Premi {Invio}`, `Sconto 100%sicuro`): reproduce, do not fix.
- Rows whose entire text is a JS value ("true", "null", "undefined", "Symbol", "BigInt") are literal data, not translatable words.
- "atteso in origine (IT)" and "← viteTranslate: tutte le demo" describe source-language/expected state, not UI copy to be reworded.
- "Novità" is a standalone heading with no other context.
- "Sorgente di: %s" is a column label; %s receives a source-language string.
<!-- /vitetranslate:generated -->

## Notes from the team
<!-- Everything outside the generated block is yours and is never overwritten. -->
