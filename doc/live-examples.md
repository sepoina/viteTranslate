# Live examples

> The [README](../README.md) covers the quick start. This page maps every live example on the [site](https://sepoina.github.io/viteTranslate/) to the guide that explains it.

Two pages, two jobs:

- 🎮 **[Playground](https://sepoina.github.io/viteTranslate/playground/)** — each feature working, next to the code that produces it.
- 🧪 **[Edge cases](https://sepoina.github.io/viteTranslate/edge/)** — where things bend: one row per case, what renders next to what should, the recommended forms first and the mistakes last ([how to read it](https://sepoina.github.io/viteTranslate/edge/#note)).

Both switch language live, and the `#` next to every title is a link to share. Each guide links its own live cases too, right where it explains them.

## 🎮 Playground

| Section | Shows | Explained in |
| :- | :- | :- |
| [Static translation](https://sepoina.github.io/viteTranslate/playground/#static-text) | `<Trans>` around a marked sentence | [`<Translate>`](react-api.md#translate) (`<Trans>`) |
| [Dynamic translation](https://sepoina.github.io/viteTranslate/playground/#dynamic-text) | `%s` filled by `t={[text, ...args]}` | [Props](react-api.md#props) |
| [Markup and React nodes](https://sepoina.github.io/viteTranslate/playground/#markup) | The HTML dialect, a link as an argument | [Markup and placeholders](react-api.md#markup-and-placeholders) |
| [Placeholders and attributes](https://sepoina.github.io/viteTranslate/playground/#attributes) | `placeholder`, `aria-label`, `title` through `trans()` | [`useTranslateToString()`](react-api.md#usetranslatetostring) |
| [Language switch](https://sepoina.github.io/viteTranslate/playground/#language-switch) | The language list, lazy switching, callbacks | [`useTranslateLanguage()`](react-api.md#usetranslatelanguage) |
| [Plurals and ordinals](https://sepoina.github.io/viteTranslate/playground/#icu-plural) | `plural`, `selectordinal`, `#` | [One example per construct](icu.md#one-example-per-construct) |
| [Select and named arguments](https://sepoina.github.io/viteTranslate/playground/#icu-select) | `select`, `{name}` from an object | [Positions or names](icu.md#arguments-positions-or-names) |
| [Numbers, currencies and dates](https://sepoina.github.io/viteTranslate/playground/#icu-format) | Each language's formats, the `timeZone` prop | [Dates and time zones](icu.md#dates-and-time-zones) |
| [autoWrap](https://sepoina.github.io/viteTranslate/playground/#autowrap) | Markers with no `<Trans>` around them | [Plugin options](plugin-options.md), [limitations](limitations.md) |
| [HTML from outside](https://sepoina.github.io/viteTranslate/playground/#html-to-nodes) | `basicHtmlToNodes()` on a server's HTML | [`basicHtmlToNodes()`](react-api.md#basichtmltonodes) |
| [Plugin config](https://sepoina.github.io/viteTranslate/playground/#install-config) | Install, `vite.config.js`, folder layout | [Plugin options](plugin-options.md) |
| [Dev run](https://sepoina.github.io/viteTranslate/playground/#install-dev) | `TransContainer`, the first `npm run dev` | [`TranslateContainer`](react-api.md#translatecontainer) |
| [Language build](https://sepoina.github.io/viteTranslate/playground/#install-sync) | The automatic sync, `--status` in CI | [CLI](cli.md) |
| [Adding a new language](https://sepoina.github.io/viteTranslate/playground/#install-new-language) | `--add`, then the `null`s to fill | [Adding a language](translations.md#adding-a-language) |
| [Translating with an LLM](https://sepoina.github.io/viteTranslate/playground/#install-llm) | The `llm` block, `--llm-translate` | [Getting started](llm.md#getting-started) |

## 🧪 Edge cases

| Category | Covers | Explained in |
| :- | :- | :- |
| [Call forms](https://sepoina.github.io/viteTranslate/edge/#call-forms) | Children, `t`, tuple, `{ t, a }`, `o`, `a` | [`<Translate>`](react-api.md#translate) |
| [The preprocessor: JSX becomes the message](https://sepoina.github.io/viteTranslate/edge/#macro) | Plain text, named values, a dialect tag staying text, a link becoming a slot, `null`/`false`, `` ts`…` `` and `` trans`…` `` in a component | [Write JSX inside `<Translate>`](react-api.md#write-jsx-inside-translate) |
| [Short names](https://sepoina.github.io/viteTranslate/edge/#aliases) | `<Translate>` and `<Trans>`, `ts` and `trans`, a marked text passed to `<Trans>`, and `Trans === Translate` | [Short names](react-api.md#short-names) |
| [What becomes a marker](https://sepoina.github.io/viteTranslate/edge/#markers) | Empty, nested, built at runtime, mid-string, in a template | [Known limitations](limitations.md) |
| [%s interpolation](https://sepoina.github.io/viteTranslate/edge/#percent-s) | Too many, too few, `null`, `0`, `""` | [Markup and placeholders](react-api.md#markup-and-placeholders) |
| [Standard ICU interpolation](https://sepoina.github.io/viteTranslate/edge/#icu) | Positions, names, braces, apostrophes | [ICU messages](icu.md) |
| [Arguments that are React nodes](https://sepoina.github.io/viteTranslate/edge/#react-nodes) | Elements as arguments, and where they don't belong | [What can sit in the text position](react-api.md#what-can-sit-in-the-text-position) |
| [HTML dialect](https://sepoina.github.io/viteTranslate/edge/#html) | Allowed tags, dropped attributes, broken markup, entities | [Markup and placeholders](react-api.md#markup-and-placeholders) |
| [Unmarked text and skipMark](https://sepoina.github.io/viteTranslate/edge/#unmarked) | The `‼️`, and when to silence it | [Unmarked text](diagnostics.md#unmarked-text-is-domain-data-not-an-error) |
| [Values that are not text](https://sepoina.github.io/viteTranslate/edge/#not-text) | Numbers, `true`, functions, symbols — and `🚫[type]` | [When there is no text at all](diagnostics.md#when-there-is-no-text-at-all) |
| [Incompatible props](https://sepoina.github.io/viteTranslate/edge/#conflicting-props) | Two texts for one slot: which one survives | [Case by case](diagnostics.md#case-by-case) |
| [Real texts](https://sepoina.github.io/viteTranslate/edge/#real-text) | Accents, emoji, CJK, quotes, new lines | [File format](translations.md#file-format) |
| [autoWrap](https://sepoina.github.io/viteTranslate/edge/#autowrap) | Ten cases, the ones it can't rewrite included | [Known limitations](limitations.md) |

## 🍽️ Showcase

**[The restaurant](https://sepoina.github.io/viteTranslate/llmrestaurant/)** — a whole landing page, 228 sentences, four languages filled in by `vitetranslate --llm-translate`. Its booking form shows plural guests, a date and a price: see [ICU messages](icu.md) and the [LLM guide](llm.md). Source in [`site/pages/llmRestaurant`](../site/pages/llmRestaurant).
