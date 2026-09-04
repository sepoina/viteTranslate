<div align="center">

<img src="doc/logo.svg" alt="viteTranslate" width="380" height="68" />

**Extract translatable strings straight from your JSX with Vite.** <br/>
No translation keys to maintain. No separate extraction workflow. No runtime dependencies.

[![Vite](https://img.shields.io/badge/Vite-5%20%7C%206%20%7C%207%20%7C%208-646CFF?logo=vite&logoColor=white)](https://vite.dev)
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

<a href="https://youtu.be/GmCxrAU9CYM">
  <img src="doc/youplay.png" alt="Watch viteTranslate in action" width="60%" />
</a>

</div>

<br />
<br />

---

Mark a string where you write it:

```jsx
<Translate>_%_Welcome to our site_%_</Translate>
```

Get a table to hand to a translator, kept in sync for you:

```yaml
# locale/fr-FR.yml
App_1q8xz4: "Bienvenue sur notre site"
```

The key is generated for you, the sync is a single command, and the runtime that ships to your users stays under 5 kB gzip.

## Contents

- [⚡ Why viteTranslate](#-why-vitetranslate)
- [🚀 Quick start](#-quick-start)
- [📚 Guides](#-guides)
- [🎮 Playground](#-playground)
- [💬 Support](#-support)
- [🔐 Provenance](#-provenance)
- [📄 License](#-license)

---

## ⚡ Why viteTranslate

Every library in this table solves the same problem. They differ in how much machinery you have to run, and how much of it ships to your users.

| Feature | viteTranslate | i18next | Lingui | FormatJS |
| :--- | :---: | :---: | :---: | :---: |
| **Keyless / Natural text syntax** ¹ | ✅ | ❌ | ✅ | 🟡 |
| **Auto-synced YAML tables** | ✅ | ❌ | ❌ | ❌ |
| **Integrated extraction workflow** ² | ✅ | ❌ | ❌ | ❌ |
| **Zero runtime dependencies** | ✅ | ❌ | ❌ | ❌ |
| **Tiny runtime (≤ 5 kB gzip)** ³ | ✅ | ❌ | 🟡 | ❌ |
| **Build-time message compilation** ⁴ | ✅ | ❌ | ✅ | ✅ |
| **No runtime message parsing** ⁴ | ✅ | ❌ | 🟡 | 🟡 |
| **Lazy-loaded locales** | ✅ | ✅ | ✅ | ✅ |
| **Native Vite integration** | ✅ | ❌ | 🟡 | ❌ |
| **License** | Apache-2.0 | MIT | MIT | Apache-2.0 |

> 🟡 Available with additional tooling or configuration, but not part of the core default workflow.

<details>
<summary><b>🔍 Notes on the comparison</b></summary>

<br />

- **¹ Keyless syntax:** Lingui and viteTranslate can use source strings directly instead of manually maintained translation keys. FormatJS can also omit manual IDs by generating message identifiers through Babel or SWC tooling.
- **² Integrated extraction workflow:** viteTranslate performs extraction and table synchronization as part of the Vite development and build lifecycle. Other solutions generally rely on separate extraction and compilation commands or watcher processes.
- **³ Runtime size:** viteTranslate adds less than 5 kB gzip for its browser runtime. Other solutions vary depending on imported packages, tree-shaking, plugins and optional polyfills, so exact bundle sizes are not directly comparable.
- **⁴ Compilation & parsing:** Lingui and FormatJS can move message parsing and compilation to build time when their compilation tooling is enabled.

</details>

### What that buys you

- ⚖️ **Under 5 kB gzip** — That is the whole browser runtime. Payloads scale with your content, not with the library.

- 🪶 **Zero dependencies** — None declared. `@babel/core`, Vite and React are _peer_ dependencies: they run the plugin on your machine and never enter the bundle.

- 📍 **Mark text in place** — No keys to invent. The marker is extracted at build time and resolved against the current table at runtime.

- ⚙️ **Tables compiled at build time** — Ready-made values, no HTML parser at runtime, so `<Translate>` renders server-side too.

- 📦 **Lazy-loaded locales** — Each one is its own chunk, `import()`-ed only when selected.

- 🔄 **One command syncs every language** — Missing keys added, stale ones removed, the rest reported. A string that moved keeps the translation it already had.

- 👁️ **Dev fallback, always visible** — Until a translation exists you get the original text. Never a blank, never a crash.

- 🔒 **Small, safe HTML subset** — `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>` and nothing else. Everything outside it is unwrapped to plain text, and no attribute is ever forwarded.

- 🔀 **Vite 5 through 8** — One codebase for all of them, no config switch.

---

## 🚀 Quick start

Install the package with [npm](https://www.npmjs.com/package/@sepoina/vitetranslate):

```sh
npm install @sepoina/vitetranslate
```

Register the plugin. Two options are required: where the tables live, and the language you write your sources in.

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    vitetranslate({
      // directory holding the .yml tables
      localeDir: "locale",
      // the language you write your source strings in
      sourceLanguage: "it-IT",
    }),
    react(),
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
  <TranslateContainer initialLanguage="it-IT">
    <App />
  </TranslateContainer>,
);
```

Then mark your strings, one at a time, with `_%_..._%_`, and render them through `<Translate>`:

```jsx
// App.jsx
import { Translate } from "@sepoina/vitetranslate/react";

function App({ name }) {
  return (
    <>
      <Translate>_%_Welcome to our site_%_</Translate>
      <Translate t={["_%_Nice to meet you, %s_%_", name]} />
    </>
  );
}
```

That is the whole authoring workflow. Now build the tables from what you just wrote:

```sh
npx vtranslate-cli
```

It scans your sources, creates `locale/it-IT.yml`, and fills it with every marked string. Run it again whenever the text changes: new keys in, deleted ones out, the untranslated ones reported.

Adding a language is the same command with a flag:

```sh
npx vtranslate-cli --add fr-FR
```

The new file arrives with every key listed and `null` where each translation goes. See [the file format](doc/translations.md) for how to fill it in, and [the CLI guide](doc/cli.md) for the other flags.

### Running the sync automatically

The plugin compiles markers, but it never writes to your tables. Only `vtranslate-cli` does, and only when you run it: a build should not rewrite your translations while you are not looking. You still don't have to remember it, because npm runs a `pre<script>` before `<script>`:

```json
{
  "scripts": {
    "dev": "vite",
    "predev": "vtranslate-cli",
    "prebuild": "vtranslate-cli",
    "build": "vite build"
  }
}
```

`predev` resyncs at every dev server start, `prebuild` only before a production build. Pick one, or both.

---

## 📚 Guides

Everything past "hello world" lives in `doc/`, one topic per page:

| Guide | Covers |
| :--- | :--- |
| [**CLI**](doc/cli.md) | `vtranslate-cli` flags, `--status`, migrating from 3.x |
| [**API reference**](doc/api.md) | `<Translate>`, `useTranslateToString`, `useTranslateLanguage`, `TranslateContainer`, preloading & Suspense |
| [**Plugin options**](doc/plugin-options.md) | Full `vitetranslate(options)` reference |
| [**Translation file format**](doc/translations.md) | The `.yml` layout, adding a new language |
| [**Diagnostics**](doc/diagnostics.md) | `errorSolve` — what each on-screen mark means and when it fires |
| [**BCP 47 codes**](doc/bcp47.md) | Supported language/region tags |
| [**Architecture**](doc/structure.md) | How a marked string travels from source to browser, with diagrams |
| [**Known limitations**](doc/limitations.md) | Edge cases and constraints to be aware of |
| [**Requirements**](doc/requirements.md) | Supported peer dependency versions |

🧪 **[Edge cases, live](https://sepoina.github.io/viteTranslate/edge/)** — every call form and diagnostic, side by side with what it renders.

---

## 🎮 Playground

A runnable example lives in [`playground/`](playground), deployed at **[sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/)**.

```bash
npm run playground
npm run playground:build
```

Alongside it, **[/edge/](https://sepoina.github.io/viteTranslate/edge/)** tables the edge cases — malformed markers, `%s` without an argument, mis-nested markup, values that aren't text — from its own app, [`playEdge/`](playEdge), which keeps every diagnostic mark on even in production.

---

## 💬 Support

Questions, ideas, or feedback? [GitHub Discussions](https://github.com/sepoina/viteTranslate/discussions). An actual bug? Open an [Issue](https://github.com/sepoina/viteTranslate/issues) instead, so it stays tracked on its own.

If viteTranslate saved you some time, you can [buy me a coffee](https://www.paypal.com/paypalme/giancarloghigi). Entirely optional, never expected.

---

## 🔐 Provenance

Every release is published from GitHub Actions through [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with OIDC. Each version carries a provenance attestation linking the tarball to the exact commit and workflow run that produced it. No long-lived tokens involved.

---

## 📄 License

Apache License 2.0 — see [`LICENSE`](LICENSE).
