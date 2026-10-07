<div align="center">

<img src="doc/logo.svg" alt="viteTranslate" width="380" height="68" />

**Extract translatable strings straight from your JSX with Vite.** <br/>
No translation keys to maintain. No separate extraction workflow. No runtime dependencies.

[![Vite](https://img.shields.io/badge/Vite-5%20%7C%206%20%7C%207%20%7C%208-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![publish](https://img.shields.io/github/actions/workflow/status/sepoina/viteTranslate/publish.yml?logo=githubactions&logoColor=white&label=publish&job=publish)](https://github.com/sepoina/viteTranslate/actions/workflows/publish.yml)
[![runtime size](https://img.shields.io/badge/runtime-5%20kB%20gzip-4c1)](#-why-vitetranslate)

[![npm version](https://img.shields.io/npm/v/@sepoina/vitetranslate?logo=npm&logoColor=white&label=npm&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![npm downloads](https://img.shields.io/npm/dm/@sepoina/vitetranslate?logo=npm&logoColor=white&label=downloads&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![VS Code](https://img.shields.io/badge/VS%20Code-extension-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=sepoina.vitetranslate-ide)
[![provenance](https://img.shields.io/badge/npm-provenance-2b7489?logo=npm&logoColor=white)](https://www.npmjs.com/package/@sepoina/vitetranslate#provenance)

[![Donate](https://img.shields.io/badge/support-PayPal-00457C?logo=paypal&logoColor=white)](https://www.paypal.com/paypalme/giancarloghigi)
[![Buy Me a Coffee](https://img.shields.io/badge/buy%20me%20a-coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/giancarlogy)

[**Site**](https://sepoina.github.io/viteTranslate/) · [**StackBlitz**](https://stackblitz.com/edit/vitejs-vite-aa9rcqtt?file=locale%2Fit-IT.yml) · 
[**Playground**](https://sepoina.github.io/viteTranslate/playground/) · 
[**Showcase**](https://sepoina.github.io/viteTranslate/llmrestaurant/)  <br/>
[Quick start](#-quick-start) · [CLI](#-cli) · [LLM](#-llm-auto-translation) · [VS Code](#-vs-code-extension) · [Guides](#-guides) · [React](doc/react-api.md) · [Notes](#-notes)

<a href="https://youtu.be/pNM9ybG0uO4">
  <img src="doc/youplay.png" alt="Watch viteTranslate in action" width="60%" />
</a>

</div>

---

## ⏱️ 30-second intro

Write the sentence where it belongs — values and tags included:

```jsx
<Translate>Welcome back, <b>{name}</b>!</Translate>
```

Get a table to hand to a translator, kept in sync for you:

```yaml
# locale/fr-FR.yml
App_pxxhl0: "Bon retour, <b>{name}</b> !"
```

The key is generated for you, the sync runs itself inside Vite, and the runtime that ships to your users weighs 5 kB gzip.

---

## ⚡ Why viteTranslate

Every library in this table solves the same problem. They differ in how much machinery you have to run, and how much of it ships to your users.

| Feature | viteTranslate | i18next | Lingui | FormatJS |
| :- | :-: | :-: | :-: | :-: |
| **LLM auto-translation** ¹ | ✅ | 🟡 | ❌ | ❌ |
| **Extraction inside the Vite lifecycle** ² | ✅ | ❌ | ❌ | ❌ |
| **Zero runtime dependencies** | ✅ | ❌ | ❌ | ❌ |
| **Official Vite plugin** | ✅ | ❌ | ✅ | ✅ |
| **Keyless / Natural text syntax** ³ | ✅ | 🟡 | ✅ | 🟡 |
| **Tiny runtime (<6 kB gzip)** ⁴ | ✅ | ❌ | ✅ | ❌ |
| **ICU MessageFormat (plural, select, dates)** | ✅ | 🟡 | ✅ | ✅ |
| **No message parsing at runtime** ⁵ | ✅ | ❌ | 🟡 | 🟡 |
| **Lazy-loaded locales** | ✅ | ✅ | ✅ | ✅ |
| **License** | Apache-2.0 | MIT | MIT | BSD-3-Clause |

 <small>✅ out of the box · 🟡 official add-on or extra setup · ❌ not offered. <br />As of September 2026: i18next 26 + react-i18next 17, Lingui 6, FormatJS (react-intl 12).</small>

<details>
<summary><b>🔍 Notes on the comparison, and what each feature buys you</b></summary>

<br />

- **How to read it:** a ❌ means the project's own tooling doesn't offer it — a third-party tool may still fill the gap. Every mark below says where it comes from.
- **¹ LLM auto-translation:** `npx vitetranslate --llm-translate` fills the untranslated keys through the model you configure — any OpenAI-compatible API, or your own driver. It prints the cost first, asks before spending, and a validator refuses anything that would break at runtime (lost `%s`, mangled tags). See [the LLM guide](doc/llm.md), 🎮 [the walkthrough](https://sepoina.github.io/viteTranslate/playground/#install-llm), or [the restaurant](https://sepoina.github.io/viteTranslate/llmrestaurant/) it translated. The i18next team offers AI translation through Locize, its paid hosted service, wired into `i18next-cli`. Lingui has an [open RFC](https://github.com/lingui/js-lingui/discussions/2392) and community tools; FormatJS leaves translation to your TMS.
- **² Extraction inside the Vite lifecycle:** the plugin extracts the markers and syncs one YAML table per language by itself — a quick check when `vite dev` starts, a full scan before every build. Missing keys added, stale ones removed, the rest reported; a string that moved keeps its translation. 🎮 [Live](https://sepoina.github.io/viteTranslate/playground/#install-sync). The others extract with a separate command: `i18next-cli extract` and `lingui extract` (both with a `--watch` mode) sync every language file; `formatjs extract` writes the source language only, the rest comes from your TMS.
- **Zero runtime dependencies:** none declared, and not on trust: the test suite asserts that the browser runtime imports nothing beyond React and the virtual module. `@babel/core` and Vite are _peer_ dependencies: they run the plugin on your machine and never enter the bundle. React is the one your app already ships. For comparison, `react-i18next` depends on three packages (i18next core on none), `@lingui/react` on `use-sync-external-store` plus Lingui's own packages, `react-intl` on three FormatJS packages.
- **Official Vite plugin:** viteTranslate's does the whole job — extraction, sync, compilation, one chunk per language — with the same code from Vite 5 to 8. Lingui's `@lingui/vite-plugin` compiles catalogs (its macros still need a Babel or SWC plugin); FormatJS's `@formatjs/unplugin` generates IDs and pre-parses messages. i18next has none, and needs none: there is nothing to compile.
- **³ Keyless syntax:** the sentence you write in JSX is the source — values, tags and links included — and its key is generated at build time and resolved against the current table at runtime: no key to invent, nothing to keep in sync by hand. 🎮 [Live](https://sepoina.github.io/viteTranslate/playground/#static-text). Lingui does the same with its macros; FormatJS generates IDs through its Babel/SWC plugins or `@formatjs/unplugin`. i18next can use the sentence as the key (`keySeparator: false`, `nsSeparator: false`): possible, say its docs, but not recommended.
- **ICU MessageFormat:** plurals, `select`, numbers and dates — compiled at build time, same as everything else. One deliberate deviation: an apostrophe is always an apostrophe, never ICU quoting. i18next has its own plural and context syntax built in; ICU needs the official `i18next-icu` plugin. See [the ICU guide](doc/icu.md) — 🎮 [plurals](https://sepoina.github.io/viteTranslate/playground/#icu-plural), [select](https://sepoina.github.io/viteTranslate/playground/#icu-select), [dates](https://sepoina.github.io/viteTranslate/playground/#icu-format), 🧪 [edge cases](https://sepoina.github.io/viteTranslate/edge/#icu).
- **⁴ Runtime size:** viteTranslate's browser runtime weighs 5 kB gzip — `5814 bytes` exactly: 4727 B for the React runtime plus 1087 B for the ICU helpers, which ship only when a table uses ICU. Measured by `npm run estimateSize`, the source of truth for this number, on the whole API. The others, with the same tools (rolldown, minified, gzip, React left out) on what a basic app imports — provider, component, hook — in September 2026: Lingui 3 kB (smaller, yes), react-intl 13 kB (6 kB with its `no-parser` alias), i18next + react-i18next 19 kB. Imports, plugins and polyfills move every figure: read them as orders of magnitude.
- **⁵ No message parsing at runtime:** tables are compiled at build time into ready-made values. In a production build `<Translate>` parses nothing, neither ICU nor HTML — which is also why it renders server-side. Lingui precompiles ICU, but splits the `<0>…</0>` component tags of the translated string with a regular expression at every render (`formatElements`). FormatJS pre-parses with `formatjs compile --ast`, and drops the parser only if you alias it to its `no-parser` build. i18next interpolates at runtime, and `i18next-icu` parses there too.
- **Lazy-loaded locales:** each language is its own chunk, `import()`-ed only when selected — no loader to write. 🎮 [Live](https://sepoina.github.io/viteTranslate/playground/#language-switch). The others load catalogs through their API, from an `import()` you write, or a backend plugin for i18next.
- **Dev fallback, always visible:** until a translation exists you get the original text. Never a blank, never a crash — and a [mark](doc/diagnostics.md) says so, in development only.
- **Small, safe HTML subset:** `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>` and nothing else. Everything outside it is unwrapped to plain text, and no attribute is ever forwarded. 🎮 [Live](https://sepoina.github.io/viteTranslate/playground/#markup), 🧪 [broken markup included](https://sepoina.github.io/viteTranslate/edge/#html).

</details>

---

## 🚀 Quick start

Install the package with [npm](https://www.npmjs.com/package/@sepoina/vitetranslate) (React 18/19, Node 18+):

```sh
npm install @sepoina/vitetranslate
```

Register the plugin, with its two required options:

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: "locale", // where holding .yml tables
      sourceLanguage: "en-US", // the language of source strings
    }),
  ],
});
```

Wrap your app in `TranslateContainer`, once, at the root:

```jsx
// main.jsx
import ReactDOM from "react-dom/client";
import { TranslateContainer } from "@sepoina/vitetranslate/react";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <TranslateContainer initialLanguage="en-US">
    <App />
  </TranslateContainer>,
);
```

Write sentences inside `<Translate>` — values, tags and links included — and plain strings with `` ts`…` ``. Live in the [playground](https://sepoina.github.io/viteTranslate/playground/):

```jsx
// App.jsx
import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";

function App({ name }) {
  const ts = useTranslateToString();
  return (
    <>
      <Translate>Welcome to our site</Translate>
      <Translate>Nice to meet you, <b>{name}</b></Translate>
      <input placeholder={ts`Write to ${name}`} />
    </>
  );
}
```

Plurals, dates and other ICU arguments aren't JSX, so they go in a string marked `_%_…_%_`: `ts("_%_{0, plural, one {# file} other {# files}}_%_", count)`. Details: **[doc/icu.md](doc/icu.md)**, live in the [playground](https://sepoina.github.io/viteTranslate/playground/#icu-plural).

That is the whole authoring workflow. Now build the tables and add a language:

```sh
npx vitetranslate              # creates locale/en-US.yml with every marked string
npx vitetranslate --add fr-FR  # a new table: every key, null where each translation goes
```

From then on the tables sync themselves when `vite dev` starts and before every build ([plugin options](doc/plugin-options.md)). Fill in the `null`s ([file format](doc/translations.md)) or let an [LLM](#-llm-auto-translation) do it; more in the [CLI](#-cli).

Let users switch; each language loads as its own chunk ([React API](doc/react-api.md#usetranslatelanguage)):

```jsx
const { proposeNewLanguage } = useTranslateLanguage();
<button onClick={() => proposeNewLanguage({ lang: "fr-FR" })}>Français</button>
```

---

## 💻 CLI

Run it from the project root as `npx vitetranslate`, or install the tiny [launcher](launcher#readme) once, which runs each project's own version, and drop the `npx`:

```sh
npm i -g vitetranslate
```

Full reference: **[doc/cli.md](doc/cli.md)**.

| Command | Does |
| :- | :- |
| `vitetranslate` | Full sync: new keys in, stale ones out, renamed strings keep their translation |
| `vitetranslate --add fr-FR de-DE` | Adds languages, each file listing every key with `null` to fill |
| `vitetranslate --status` | Reports every table and writes nothing. Exits `1` on errors only, so it works as a CI check |
| `vitetranslate --llm-translate` | Fills the `null` keys through an LLM — see [below](#-llm-auto-translation) |

---

## 🤖 LLM auto-translation

Same workflow as above, minus the copy-pasting: point `llm` at a model and `vitetranslate` fills the `null` keys for you, printing a cost estimate first and asking before it spends anything.

```sh
npx vitetranslate --llm-translate
```

```text
::: LLM            ║  "deepseek-flash" · standard
::: ⌘ deepseek.com ║  - (2/2) incomplete tables - 128 missing keys - 2 api requests
:::                ║  - token (in ~13.1k - out ~9.3k) ≈ $0.0190 < costGuard ($0.2000)
:::                ║  ✔ < 64 new keys français. Full translate!    3s
:::                ║  ⠹ > ask 64 keys Deutsch                      4s
```

No dependency added — any OpenAI-compatible API key is enough (Gemini, OpenAI, OpenRouter, Groq, Ollama, …), or bring your own driver. Nothing gets written without passing a validator that refuses a lost `%s` or a mangled tag, and it runs only from the CLI, never from `vite dev`. Costs, budget guards, the context abstract, and the full flag reference: **[doc/llm.md](doc/llm.md)**.

## 🧩 VS Code extension

The other half, in your editor: every marked string with its translation status, language files opened right on the key, Sync and LLM actions one click away, marked strings highlighted as you type. It reads your project, never writes to it.

<a href="https://marketplace.visualstudio.com/items?itemName=sepoina.vitetranslate-ide"><img src="doc/ide/panel.png" alt="The viteTranslate panel in VS Code" width="80%" /></a>

[**Install from the Marketplace**](https://marketplace.visualstudio.com/items?itemName=sepoina.vitetranslate-ide) · [what's in the panel](doc/ide-panel.md)

---

## 📚 Guides

Everything past "hello world" lives in `doc/`, one topic per page:

| Guide | Covers |
| :- | :- |
| [**CLI**](doc/cli.md) | `vitetranslate` flags, `--status`, migrating from 3.x |
| [**React API**](doc/react-api.md) | `<Translate>`, `useTranslateToString`, `useTranslateLanguage`, `TranslateContainer`, preloading & Suspense |
| [**Plugin options**](doc/plugin-options.md) | Full `vitetranslate(options)` reference |
| [**Translation file format**](doc/translations.md) | The `.yml` layout, adding a new language |
| [**ICU messages**](doc/icu.md) | Plurals, `select`, numbers, dates — the syntax and what checks it |
| [**LLM auto-translation**](doc/llm.md) | Filling `null` keys through an LLM, costs, guardrails |
| [**Diagnostics**](doc/diagnostics.md) | `errorSolve` — what each on-screen mark means and when it fires |
| [**BCP 47 codes**](doc/bcp47.md) | Supported language/region tags |
| [**Architecture**](doc/structure.md) | How a marked string travels from source to browser, with diagrams |
| [**Known limitations**](doc/limitations.md) | Edge cases and constraints to be aware of |
| [**Requirements**](doc/requirements.md) | Supported peer dependency versions |
| [**VS Code panel**](doc/ide-panel.md) | Every section, glyph and button of the editor extension |
| [**Live examples**](doc/live-examples.md) | Each live demo and edge case, next to its guide |

---

## 📝 Notes

- 🎮 **[Live site](https://sepoina.github.io/viteTranslate/)** — playground, edge cases and an LLM-translated restaurant; source in [`site/`](site).
- 💬 **[Discussions](https://github.com/sepoina/viteTranslate/discussions)** — questions, ideas, feedback. An actual bug goes to [Issues](https://github.com/sepoina/viteTranslate/issues) instead.
- 🔐 **[Provenance](https://docs.npmjs.com/trusted-publishers/)** — every release ships via npm trusted publishing (OIDC).
- 📄 **[License](LICENSE)** — Apache License 2.0.
