<div align="center">

<img src="doc/logo.svg" alt="viteTranslate" width="380" height="68" />

**Extract translatable strings straight from your source.** <br/>
No keys to invent. No separate extraction step. No runtime dependencies.

[![Vite](https://img.shields.io/badge/Vite-5%20|%206%20|%207%20|%208-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![publish](https://img.shields.io/github/actions/workflow/status/sepoina/viteTranslate/publish.yml?logo=githubactions&logoColor=white&label=publish)](https://github.com/sepoina/viteTranslate/actions/workflows/publish.yml)
[![runtime size](https://img.shields.io/badge/runtime-%3C%205%20kB%20gzip-4c1)](#-why-vitetranslate)

[![npm version](https://img.shields.io/npm/v/@sepoina/vitetranslate?logo=npm&logoColor=white&label=npm&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![npm downloads](https://img.shields.io/npm/dm/@sepoina/vitetranslate?logo=npm&logoColor=white&label=downloads&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![provenance](https://img.shields.io/badge/npm-provenance-2b7489?logo=npm&logoColor=white)](https://www.npmjs.com/package/@sepoina/vitetranslate#provenance)

[![Donate](https://img.shields.io/badge/support-PayPal-00457C?logo=paypal&logoColor=white)](https://www.paypal.com/paypalme/giancarloghigi)
[![Buy Me a Coffee](https://img.shields.io/badge/buy%20me%20a-coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/giancarlogy)

[**Live playground**](https://sepoina.github.io/viteTranslate/) · [Edge cases](https://sepoina.github.io/viteTranslate/edge/) · [**StackBlitz**](https://stackblitz.com/edit/vitejs-vite-aa9rcqtt?file=md!README.md) · [Quick start](#-quick-start) · [API](doc/api.md) · [Architecture](doc/structure.md)

<br />
<br />
<br />

  <a href="https://youtu.be/K_fefd3VLKQ">
    <img src="doc/youplay.png" alt="Watch viteTranslate in action" width="60%" />
  </a>
  
</div>

<br />
<br />

---

Install with [npm](https://www.npmjs.com/package/@sepoina/vitetranslate) the last version 

```sh
npm install @sepoina/vitetranslate
```

And go!

```jsx
import { Translate } from "@sepoina/vitetranslate/react";

function Welcome({ name }) {
  return (
    <>
      <Translate>_%_Welcome to our site_%_</Translate>
      <Translate t={["_%_Nice to meet you, %s_%_", name]} />
    </>
  );
}
```

That is the whole authoring workflow. Wrap a string in `_%_..._%_`, render it through `<Translate>`, and the translation tables are generated and kept in sync for you.

## Contents

- [Contents](#contents)
- [⚡ Why viteTranslate](#-why-vitetranslate)
- [🚀 Quick start](#-quick-start)
- [📚 Guides](#-guides)
- [🔬 How it works](#-how-it-works)
- [⚠️ Known limitations](#️-known-limitations)
- [📋 Requirements](#-requirements)
- [🎮 Playground](#-playground)
- [💬 Support](#-support)
- [🔐 Provenance](#-provenance)
- [📄 License](#-license)

---

## ⚡ Why viteTranslate

| Feature | viteTranslate | i18next | Lingui | FormatJS |
| :--- | :---: | :---: | :---: | :---: |
| **Keyless / Natural text syntax** ¹ | ✅ | ❌ | ✅ | 🟡 |
| **Auto-synced YAML tables** | ✅ | ❌ | ❌ | ❌ |
| **Zero-CLI workflow** *(extract & compile in dev)* ² | ✅ | ❌ | ❌ | ❌ |
| **Zero runtime dependencies** | ✅ | ❌ | ❌ | ❌ |
| **Tiny runtime (≤ 5 kB gzip)** ³ | ✅ | ❌ | ✅ | ❌ |
| **Build-time message compilation** ⁴ | ✅ | ❌ | ✅ | ✅ |
| **No runtime message parsing** ⁴ | ✅ | ❌ | ✅ | ✅ |
| **Lazy-loaded locales** | ✅ | ✅ | ✅ | ✅ |
| **Native Vite integration** | ✅ | ❌ | ✅ | ❌ |
| **License** | Apache-2.0 | MIT | MIT | Apache-2.0 |

<details>
<summary><b>🔍 View detailed notes & clarifications</b></summary>

* **¹ Keyless syntax:** Lingui and viteTranslate natively use source strings as keys. FormatJS can omit manual IDs by auto-generating content hashes using Babel/SWC plugins.
* **² Zero-CLI workflow:** Lingui and FormatJS require separate CLI commands (e.g., `lingui extract`/`compile` or `formatjs extract`) or dedicated watcher processes, whereas viteTranslate handles synchronization directly during Vite dev/build cycles.
* **³ Runtime size:** Lingui (`@lingui/core`) has a tiny footprint (~2 kB gzip). i18next and FormatJS runtimes typically exceed 10 kB min+gzip depending on plugins and polyfills.
* **⁴ Compilation & parsing:** Lingui and FormatJS eliminate runtime parsing when using their optional build-time compilation tools (`lingui compile`, `@formatjs/cli compile`).
* ⚖️ **Under 5 kB gzip in your bundle** — The runtime that reaches the browser (`<Translate>`, `TranslateContainer`, `useTranslateLanguage`) adds under 5 kB gzip. Translation payloads scale with your content, not with the library.
* 🪶 **Zero dependencies** — The package declares no `dependencies` at all. `@babel/core`, Vite and React are *peer* dependencies — they run the plugin and the CLI on your machine, never enter the bundle.
* 📍 **Mark text in place** — No keys to invent or maintain. The marker is extracted at build time; the component resolves it against the current language table at runtime.
* 📦 **Lazy language loading** — Each language is a separate chunk, dynamically `import()`-ed only when selected.
* ⚙️ **Tables compiled at build time** — Ready-made values — plain strings, React elements built once, functions where there are placeholders. No HTML parser at runtime, so `<Translate>` renders server-side too.
* 🔀 **Vite 7 and Vite 8 alike** — Same codebase, no config switch.
* 👁️ **Dev fallback, always visible** — Until a translation exists the original text is shown — never a blank string, never a crash.
* 🔄 **One command syncs every language** — Adds missing keys, removes stale ones, reports what's left to translate.
* 🏷️ **Renamed keys keep their translation** — If a string's id changes but the text doesn't, the existing translation is carried over.
* 🔒 **Small, safe HTML subset** — `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>` are allowed inside translated strings; everything else is unwrapped to plain text, no attribute ever forwarded.

</details>

---

## 🚀 Quick start

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
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

Then mark your strings — `<Translate>_%_Welcome_%_</Translate>` — and sync the tables before every build:

```json
{ "scripts": { "prebuild": "vtranslate-cli", "build": "vite build" } }
```

> [!IMPORTANT]
> The source language file must already exist before the first `vite dev` / `vite build` — `TranslateContainer` reads it immediately on load. Run the sync command once to generate it (the `localeDir` folder itself doesn't need to exist beforehand, the plugin creates it).

---

## 📚 Guides

Everything past "hello world" lives in `doc/`, one topic per page:

| Guide | Covers |
| --- | --- |
| [**API reference**](doc/api.md) | `<Translate>`, `useTranslateToString`, `useTranslateLanguage`, `TranslateContainer`, preloading & Suspense |
| [**Translation file format**](doc/translations.md) | The `.yml` layout, adding a new language |
| [**Diagnostics**](doc/diagnostics.md) | `errorSolve` — what each on-screen mark means and when it fires |
| [**CLI**](doc/cli.md) | `vtranslate-cli` flags, `--status`, migrating from 3.x |
| [**Plugin options**](doc/plugin-options.md) | Full `vitetranslate(options)` reference |
| [**BCP 47 codes**](doc/bcp47.md) | Supported language/region tags |
| [**Architecture**](doc/structure.md) | How a marked string travels from source to browser, with diagrams |

🧪 **[Edge cases, live](https://sepoina.github.io/viteTranslate/edge/)** — every call form and diagnostic, side by side with what it renders.

---

## 🔬 How it works

Strings flow through four stages: **extraction** (Babel finds `_%_..._%_` and assigns an id), **compilation** (tables become ready-made React values at build time), **resolution** (components look up ids at runtime), and **delivery** (languages load lazily as chunks, eager ones in the initial bundle). Every compiled table is **self-contained** — keys a language hasn't translated yet already carry the source text inside, so no app ships a fallback table on top of its own.

> [!TIP]
> 📖 **Want the full picture?** [`doc/structure.md`](doc/structure.md) walks through the architecture with diagrams and links to every source file involved.

---

## ⚠️ Known limitations

> [!WARNING]
> - **Ids are a 32-bit hash** over the file's path and the text. A collision between two strings is unlikely but possible, and reported as a build warning naming both.
> - **Markers must be whole strings.** One embedded in a longer string, or a template literal with `${...}` inside, is not extracted — use a `%s` placeholder instead.
> - **The CLI loads your Vite config with Node itself**, not Vite — a TypeScript config needs a Node that strips types (23.6+).
> - **`basicHtmlToNodes()` still needs the DOM** if called directly. `<Translate>` no longer does.

---

---

## 📋 Requirements

| Peer dependency | Supported range |
| --- | --- |
| Vite | `^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| React | `^18 \|\| ^19` *(for the `/react` entry point)* |
| `@babel/core` | `^7` |

These are peer dependencies — install them if your project doesn't already have them. `.js`/`.jsx`/`.ts`/`.tsx` sources are all scanned. TypeScript declarations ship with the package.

---

## 🎮 Playground

A runnable example lives in [`playground/`](playground), deployed at **[sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/)**.

```bash
npm run playground         # vite dev
npm run playground:build   # vite build
```

Alongside it, **[/edge/](https://sepoina.github.io/viteTranslate/edge/)** is a table of edge cases — malformed markers, `%s` without an argument, mis-nested markup, values that aren't text — in its own app, [`playEdge/`](playEdge), which needs every diagnostic mark on, in production too.

---

## 💬 Support

Questions, ideas, or feedback? Use [GitHub Discussions](https://github.com/sepoina/viteTranslate/discussions).

Found an actual bug? Open an [Issue](https://github.com/sepoina/viteTranslate/issues) instead, so it stays tracked separately from open-ended conversation.

If viteTranslate saved you some time, you can [buy me a coffee](https://www.paypal.com/paypalme/giancarloghigi) — entirely optional, never expected.

---

## 🔐 Provenance

Every release is published from GitHub Actions through [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with OIDC, so each version on npm carries a cryptographic provenance attestation linking the published tarball to the exact commit and workflow run that produced it. No long-lived tokens are involved.

---

## 📄 License

Apache License 2.0 — see [`LICENSE`](LICENSE).
