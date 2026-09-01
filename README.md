<div align="center">

<img src="doc/logo.svg" alt="viteTranslate" width="380" height="68" />

**Extract translatable strings straight from your JSX with Vite.** <br/>
No translation keys to maintain. No separate extraction workflow. No runtime dependencies.

[!\[Vite](https://img.shields.io/badge/Vite-5%20%7C%206%20%7C%207%20%7C%208-646CFF?logo=vite\&logoColor=white)](https://vite.dev)
[!\[publish](https://img.shields.io/github/actions/workflow/status/sepoina/viteTranslate/publish.yml?logo=githubactions\&logoColor=white\&label=publish)](https://github.com/sepoina/viteTranslate/actions/workflows/publish.yml)
[!\[runtime size](https://img.shields.io/badge/runtime-%3C%205%20kB%20gzip-4c1)](#-why-vitetranslate)

[!\[npm version](https://img.shields.io/npm/v/@sepoina/vitetranslate?logo=npm\&logoColor=white\&label=npm\&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[!\[npm downloads](https://img.shields.io/npm/dm/@sepoina/vitetranslate?logo=npm\&logoColor=white\&label=downloads\&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[!\[provenance](https://img.shields.io/badge/npm-provenance-2b7489?logo=npm\&logoColor=white)](https://www.npmjs.com/package/@sepoina/vitetranslate#provenance)

[!\[Donate](https://img.shields.io/badge/support-PayPal-00457C?logo=paypal\&logoColor=white)](https://www.paypal.com/paypalme/giancarloghigi)
[!\[Buy Me a Coffee](https://img.shields.io/badge/buy%20me%20a-coffee-FFDD00?logo=buymeacoffee\&logoColor=black)](https://www.buymeacoffee.com/giancarlogy)

[**Live playground**](https://sepoina.github.io/viteTranslate/) · [Edge cases](https://sepoina.github.io/viteTranslate/edge/) · [**StackBlitz**](https://stackblitz.com/edit/vitejs-vite-aa9rcqtt?file=md%21README.md) · [Quick start](#-quick-start) · [API](doc/api.md) · [Architecture](doc/structure.md)

<br />
<br />
<br />

<a href="https://youtu.be/K\_fefd3VLKQ">
  <img src="doc/youplay.png" alt="Watch viteTranslate in action" width="60%" />
</a>

</div>

<br />
<br />

\---

Install the latest version with [npm](https://www.npmjs.com/package/@sepoina/vitetranslate):

```sh
npm install @sepoina/vitetranslate
```

And go!

```jsx
import { Translate } from "@sepoina/vitetranslate/react";

function Welcome({ name }) {
  return (
    <>
      <Translate>\_%\_Welcome to our site\_%\_</Translate>
      <Translate t={\["\_%\_Nice to meet you, %s\_%\_", name]} />
    </>
  );
}
```

That is the whole authoring workflow. Mark a string with `\_%\_...\_%\_`, render it through `<Translate>`, and viteTranslate extracts it and keeps your YAML translation tables in sync automatically.

## Contents

* [Contents](#contents)
* [⚡ Why viteTranslate](#-why-vitetranslate)
* [🚀 Quick start](#-quick-start)
* [📚 Guides](#-guides)
* [🔬 How it works](#-how-it-works)
* [⚠️ Known limitations](#️-known-limitations)
* [📋 Requirements](#-requirements)
* [🎮 Playground](#-playground)
* [💬 Support](#-support)
* [🔐 Provenance](#-provenance)
* [📄 License](#-license)

\---

## ⚡ Why viteTranslate

|Feature|viteTranslate|i18next|Lingui|FormatJS|
|-|:-:|:-:|:-:|:-:|
|**Keyless / Natural text syntax** ¹|✅|❌|✅|🟡|
|**Auto-synced YAML tables**|✅|❌|❌|❌|
|**Integrated extraction workflow** ²|✅|❌|❌|❌|
|**Zero runtime dependencies**|✅|❌|❌|❌|
|**Tiny runtime (≤ 5 kB gzip)** ³|✅|❌|🟡|❌|
|**Build-time message compilation** ⁴|✅|❌|✅|✅|
|**No runtime message parsing** ⁴|✅|❌|🟡|🟡|
|**Lazy-loaded locales**|✅|✅|✅|✅|
|**Native Vite integration**|✅|❌|🟡|❌|
|**License**|Apache-2.0|MIT|MIT|Apache-2.0|

> 🟡 Available with additional tooling or configuration, but not part of the core default workflow.

<details>
<summary><b>🔍 View detailed notes \& clarifications</b></summary>

* **¹ Keyless syntax:** Lingui and viteTranslate can use source strings directly instead of manually maintained translation keys. FormatJS can also omit manual IDs by generating message identifiers through Babel or SWC tooling.
* **² Integrated extraction workflow:** viteTranslate performs extraction and table synchronization as part of the Vite development and build lifecycle. Other solutions generally rely on separate extraction and compilation commands or watcher processes.
* **³ Runtime size:** viteTranslate adds less than 5 kB gzip for its browser runtime. Other solutions vary depending on imported packages, tree-shaking, plugins and optional polyfills, so exact bundle sizes are not directly comparable.
* **⁴ Compilation \& parsing:** Lingui and FormatJS can move message parsing and compilation to build time when their compilation tooling is enabled.
* ⚖️ **Under 5 kB gzip in your bundle** — The runtime that reaches the browser (`<Translate>`, `TranslateContainer`, `useTranslateLanguage`) adds under 5 kB gzip. Translation payloads scale with your content, not with the library.
* 🪶 **Zero dependencies** — The package declares no `dependencies` at all. `@babel/core`, Vite and React are *peer* dependencies — they run the plugin and the CLI on your machine, never enter the bundle.
* 📍 **Mark text in place** — No keys to invent or maintain. The marker is extracted at build time; the component resolves it against the current language table at runtime.
* 📦 **Lazy-loaded locales** — Each locale is a separate chunk and is dynamically `import()`-ed only when selected.
* ⚙️ **Tables compiled at build time** — Ready-made values — plain strings, React elements built once, functions where there are placeholders. No HTML parser at runtime, so `<Translate>` renders server-side too.
* 🔀 **Vite 7 and Vite 8 alike** — Same codebase, no config switch.
* 👁️ **Dev fallback, always visible** — Until a translation exists the original text is shown — never a blank string, never a crash.
* 🔄 **One command syncs every language** — Adds missing keys, removes stale ones, reports what's left to translate.
* 🏷️ **Renamed keys keep their translation** — If a string's id changes but the text doesn't, the existing translation is carried over.
* 🔒 **Small, safe HTML subset** — `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>` are allowed inside translated strings; everything else is unwrapped to plain text, no attribute ever forwarded.

</details>

\---

## 🚀 Quick start

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: \[
    vitetranslate({
      localeDir: "src/locale",  // folder with the language files (.yml)
      sourceLanguage: "it-IT",  // source language tag (BCP 47)
    }),
    react(),
  ],
});
```

```jsx
// main.jsx
import ReactDOM from "react-dom/client";
import { TranslateContainer } from "@sepoina/vitetranslate/react";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <TranslateContainer initialLanguage="it-IT">
    <App />
  </TranslateContainer>
);
```

Then mark your strings — `<Translate>\_%\_Welcome\_%\_</Translate>`. During development, viteTranslate extracts marked strings and keeps the translation tables synchronized as part of the Vite lifecycle.

For a production build, add the sync command before `vite build` to make sure the source-language table is up to date:

```json
{ "scripts": { "prebuild": "vtranslate-cli", "build": "vite build" } }
```

> \[!IMPORTANT]
> The source-language file must exist before the first `vite dev` or `vite build`, because `TranslateContainer` reads it immediately when the application starts. Run `vtranslate-cli` once to generate the initial table. The `localeDir` directory itself does not need to exist beforehand — viteTranslate creates it automatically.

\---

## 📚 Guides

Everything past "hello world" lives in `doc/`, one topic per page:

|Guide|Covers|
|-|-|
|[**API reference**](doc/api.md)|`<Translate>`, `useTranslateToString`, `useTranslateLanguage`, `TranslateContainer`, preloading \& Suspense|
|[**Translation file format**](doc/translations.md)|The `.yml` layout, adding a new language|
|[**Diagnostics**](doc/diagnostics.md)|`errorSolve` — what each on-screen mark means and when it fires|
|[**CLI**](doc/cli.md)|`vtranslate-cli` flags, `--status`, migrating from 3.x|
|[**Plugin options**](doc/plugin-options.md)|Full `vitetranslate(options)` reference|
|[**BCP 47 codes**](doc/bcp47.md)|Supported language/region tags|
|[**Architecture**](doc/structure.md)|How a marked string travels from source to browser, with diagrams|

🧪 [**Edge cases, live**](https://sepoina.github.io/viteTranslate/edge/) — every call form and diagnostic, side by side with what it renders.

\---

## 🔬 How it works

Strings move through four stages: **extraction**, **compilation**, **resolution**, and **delivery**.

During extraction, Babel finds `\_%\_...\_%\_` markers and assigns each string an id. During compilation, translation tables become ready-made values for the browser. At runtime, components resolve those ids against the current locale. Finally, locales are delivered as lazy-loaded chunks, while eager locales can be included in the initial bundle.

Every compiled table is **self-contained**: untranslated entries already contain the source text, so the application does not need to ship a separate fallback table alongside each locale.

> \[!TIP]
> 📖 \*\*Want the full picture?\*\* \[`doc/structure.md`](doc/structure.md) walks through the architecture with diagrams and links to every source file involved.

\---

## ⚠️ Known limitations

> \[!WARNING]
> - \*\*Ids are a 32-bit hash\*\* over the file's path and the text. A collision between two strings is unlikely but possible, and reported as a build warning naming both.
> - \*\*Markers must be whole strings.\*\* One embedded in a longer string, or a template literal with `${...}` inside, is not extracted — use a `%s` placeholder instead.
> - \*\*The CLI loads your Vite config with Node itself\*\*, not Vite — a TypeScript config needs a Node that strips types (23.6+).
> - \*\*`basicHtmlToNodes()` still needs the DOM\*\* if called directly. `<Translate>` no longer does.

\---

## 📋 Requirements

|Peer dependency|Supported range|
|-|-|
|Vite|`^5 \|\| ^6 \|\| ^7 \|\| ^8`|
|React|`^18 \|\| ^19` *(for the `/react` entry point)*|
|`@babel/core`|`^7`|

These are peer dependencies — install them if your project doesn't already have them. `.js`/`.jsx`/`.ts`/`.tsx` sources are all scanned. TypeScript declarations ship with the package.

\---

## 🎮 Playground

A runnable example lives in [`playground/`](playground), deployed at [**sepoina.github.io/viteTranslate**](https://sepoina.github.io/viteTranslate/).

```bash
npm run playground         # vite dev
npm run playground:build   # vite build
```

Alongside it, [**/edge/**](https://sepoina.github.io/viteTranslate/edge/) is a table of edge cases — malformed markers, `%s` without an argument, mis-nested markup, values that aren't text — in its own app, [`playEdge/`](playEdge), which needs every diagnostic mark on, in production too.

\---

## 💬 Support

Questions, ideas, or feedback? Use [GitHub Discussions](https://github.com/sepoina/viteTranslate/discussions).

Found an actual bug? Open an [Issue](https://github.com/sepoina/viteTranslate/issues) instead, so it stays tracked separately from open-ended conversation.

If viteTranslate saved you some time, you can [buy me a coffee](https://www.paypal.com/paypalme/giancarloghigi) — entirely optional, never expected.

\---

## 🔐 Provenance

Every release is published from GitHub Actions through [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with OIDC, so each version on npm carries a cryptographic provenance attestation linking the published tarball to the exact commit and workflow run that produced it. No long-lived tokens are involved.

\---

## 📄 License

Apache License 2.0 — see [`LICENSE`](LICENSE).

