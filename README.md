<div align="center">

<img src="doc/logo.svg" alt="viteTranslate" width="380" height="68" />

**Extract translatable strings straight from your source.**<br>
No keys to invent. No separate extraction step. No runtime dependencies.

[![Vite](https://img.shields.io/badge/Vite-5%20|%206%20|%207%20|%208-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![publish](https://img.shields.io/github/actions/workflow/status/sepoina/viteTranslate/publish.yml?logo=githubactions&logoColor=white&label=publish)](https://github.com/sepoina/viteTranslate/actions/workflows/publish.yml)
[![runtime size](https://img.shields.io/badge/runtime-%3C%205%20kB%20gzip-4c1)](#-why-vitetranslate)
<br />
[![npm version](https://img.shields.io/npm/v/@sepoina/vitetranslate?logo=npm&logoColor=white&label=npm&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![npm downloads](https://img.shields.io/npm/dm/@sepoina/vitetranslate?logo=npm&logoColor=white&label=downloads&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![provenance](https://img.shields.io/badge/npm-provenance-2b7489?logo=npm&logoColor=white)](https://www.npmjs.com/package/@sepoina/vitetranslate#provenance)
<br />
[![Donate](https://img.shields.io/badge/support-PayPal-00457C?logo=paypal&logoColor=white)](https://www.paypal.com/paypalme/giancarloghigi)
[![Buy Me a Coffee](https://img.shields.io/badge/buy%20me%20a-coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/giancarlogy)

[**Live playground**](https://sepoina.github.io/viteTranslate/) · [Quick start](#-quick-start) · [API](#-api) · [How it works](#-how-it-works)

</div>

---

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

That is the whole authoring workflow. Wrap a string in `_%_..._%_`, render it through
`<Translate>`, and the JS translation tables are generated and kept in sync for you.

---

## Contents

- [Contents](#contents)
- [⚡ Why viteTranslate](#-why-vitetranslate)
- [📋 Requirements](#-requirements)
- [📦 Installation](#-installation)
- [🚀 Quick start](#-quick-start)
  - [1. Register the plugin](#1-register-the-plugin)
  - [2. Wrap your app in `TranslateContainer`](#2-wrap-your-app-in-translatecontainer)
  - [3. Mark your strings](#3-mark-your-strings)
  - [4. Sync the tables before every build](#4-sync-the-tables-before-every-build)
- [🧩 API](#-api)
  - [`<Translate>`](#translate)
  - [`useTranslateToString()`](#usetranslatetostring)
  - [`useTranslateLanguage()`](#usetranslatelanguage)
  - [`TranslateContainer` props](#translatecontainer-props)
  - [`proposeNewLanguage()`](#proposenewlanguage)
  - [`basicHtmlToNodes()`](#basichtmltonodes)
  - [`version`](#version)
- [🎯 Preloading, Suspense and the initial flash](#-preloading-suspense-and-the-initial-flash)
- [🗂️ Translation file format](#️-translation-file-format)
  - [Adding a language](#adding-a-language)
- [🖥️ CLI](#️-cli)
- [⚙️ Plugin options](#️-plugin-options)
- [🔬 How it works](#-how-it-works)
- [⚠️ Known limitations](#️-known-limitations)
- [🎮 Playground](#-playground)
- [💬 Support](#-support)
- [🔐 Provenance](#-provenance)
- [📄 License](#-license)

---

## ⚡ Why viteTranslate

| | |
| --- | --- |
| ⚖️ **Under 5 kB gzip in your bundle** | The runtime that reaches the browser (`<Translate>`, `TranslateContainer`, `useTranslateLanguage`) adds under 5 kB gzip — measured by diffing a production build with and without the library. Translation payloads scale with your content, not with the library. |
| 🪶 **Zero runtime dependencies** | The shipped code imports nothing: it looks up an id already computed at build time. `@babel/core`, Vite and React are *peer* dependencies — they run the plugin and the CLI on your machine, never enter the bundle, and are already in your `node_modules`. |
| 📍 **Mark text in place** | No keys to invent or maintain. The marker is extracted at build time; the component resolves it against the current language table at runtime. |
| 📄 **Language files are auto-generated** | The JS tables in `localeDir` are created and updated by the sync command from the markers found in your source. |
| 📦 **Lazy language loading** | Each language is a separate chunk, dynamically `import()`-ed only when selected. The initial bundle never carries languages you don't use. |
| 🔀 **Vite 7 and Vite 8 alike** | Same codebase, no config switch. Rollup + esbuild on Vite 7, Rolldown + Oxc on Vite 8 — virtual-module `moduleType` hints, `\0`-prefixed ids and declarative hook filters are handled under the hood. |
| 👁️ **Dev fallback, always visible** | Until a translation exists the original text is shown — never a blank string, never a crash. |
| 🔄 **One command syncs every language** | Adds missing keys, removes stale ones, reports what's left to translate. |
| 🆕 **New languages auto-detected** | Drop a `.js` file in the locale folder. No registration anywhere else. |
| 🏷️ **Renamed keys keep their translation** | If a string's id changes but the text doesn't, the existing translation is carried over instead of resetting to `null`. |
| 🔒 **Small, safe HTML subset** | `<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<small>`, `<code>`, `<br>`, `<hr>`, `<wbr>` are allowed inside translated strings. Everything else is unwrapped to plain text and no attribute is ever forwarded. |

---

## 📋 Requirements

| Peer dependency | Supported range |
| --- | --- |
| Vite | `^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| React | `^18 \|\| ^19` *(for the `/react` entry point)* |
| `@babel/core` | `^7` |

These are peer dependencies — install them if your project doesn't already have them.

---

## 📦 Installation

```bash
npm install @sepoina/vitetranslate
```

<details>
<summary>pnpm · yarn · bun</summary>

```bash
pnpm add @sepoina/vitetranslate
yarn add @sepoina/vitetranslate
bun add @sepoina/vitetranslate
```

</details>

---

## 🚀 Quick start

### 1. Register the plugin

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    vitetranslate({
      localeDir: "src/locale",  // folder with the language JS files
      sourceLanguage: "it-IT",  // source language tag (BCP 47)
    }),
    react(),
  ],
});
```

### 2. Wrap your app in `TranslateContainer`

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

### 3. Mark your strings

```jsx
import { Translate } from "@sepoina/vitetranslate/react";

export default function Welcome() {
  return <h1><Translate>_%_Welcome to viteTranslate_%_</Translate></h1>;
}
```

### 4. Sync the tables before every build

```json
{
  "scripts": {
    "prebuild": "vitetranslate-prepare-translation-table",
    "build": "vite build"
  }
}
```

> [!IMPORTANT]
> The source language file must already exist before the first `vite dev` / `vite build` —
> `TranslateContainer` reads it immediately on load. Run the sync command once to generate it
> (the `localeDir` folder itself doesn't need to exist beforehand, the plugin creates it).

---

## 🧩 API

### `<Translate>`

```jsx
// plain text
<Translate>_%_Welcome_%_</Translate>

// with placeholders: t=[text, ...args]
<Translate t={["_%_Hello %s, how are you?_%_", username]} />

// classic form: t="..." a=[...]
<Translate t="_%_Hello %s, how are you?_%_" a={[username]} />

// small inline HTML subset
<Translate t={"_%_<strong>Bold</strong> and <i>italic</i> text_%_"} />
```

### `useTranslateToString()`

For places that need a plain string instead of JSX — `placeholder`, `aria-label`, `title`:

```jsx
import { useTranslateToString } from "@sepoina/vitetranslate/react";

function SearchInput() {
  const ts = useTranslateToString();
  return <input placeholder={ts("_%_Enter your name_%_")} />;
}
```

### `useTranslateLanguage()`

Everything a language switcher needs, in one hook: the current language, the list of
available ones and the function to change it.

```jsx
import { useTranslateLanguage } from "@sepoina/vitetranslate/react";

function LanguageSwitcher() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();

  return languages.map(({ tag, languageName }) => (
    <button key={tag} disabled={id === tag} onClick={() => proposeNewLanguage({ lang: tag })}>
      {languageName}
    </button>
  ));
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string \| undefined` | Current language tag ([BCP 47](doc/bcp47.md)); `undefined` outside `TranslateContainer` |
| `languages` | `{ tag: string, languageName: string }[]` | Languages found in `localeDir`, source language first. `languageName` is the autonym, computed once at sync time |
| `sourceLanguage` | `string` | Source language tag, the one the strings are written in |
| `debug` | `boolean` | The `debug` prop passed to `TranslateContainer` |
| `proposeNewLanguage` | `function` | Runtime language switch, see below |

The returned object is referentially stable, so it is safe in dependency arrays.

`languages` and `sourceLanguage` come from the language manifest, known at build time: no
table is ever loaded just to list them, and they stay valid even outside
`TranslateContainer` — handy to build a list of languages above the translated tree. There
`id` is `undefined` and `proposeNewLanguage` is inert; calling it is reported once in the
console during development, since that is the only thing that cannot work without a
container.

### `TranslateContainer` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialLanguage` | `string` | `sourceLanguage` from the plugin | Initial language tag to load ([BCP 47](doc/bcp47.md)). Preloaded languages render synchronously; otherwise the container suspends until the chunk is ready — never the wrong language |
| `fallback` | `node` | `null` | Shown via `Suspense` while a non-preloaded initial language loads. Chunks are local, so the default `null` is a near-imperceptible empty frame |
| `debug` | `boolean` | `false` | Exposed by `useTranslateLanguage()` |
| `children` | `node` | — | App tree that receives the translation context |

### `proposeNewLanguage()`

Available from `useTranslateLanguage()`:

```js
const { proposeNewLanguage } = useTranslateLanguage();
proposeNewLanguage({ lang, onStart, onDone, onError });
```

Triggers a runtime language switch, lazily loading the requested chunk. The switch runs
inside a React transition, so the current language stays on screen until the new one is
ready — no blank frame mid-switch.

### `basicHtmlToNodes()`

Turns a string containing basic HTML into React nodes, without `dangerouslySetInnerHTML`.
It is the function `<Translate>` uses internally, exported because it is useful on its own:

```jsx
import { basicHtmlToNodes } from "@sepoina/vitetranslate/react";

basicHtmlToNodes("Hello <b>%s</b>", "Mario");   // ["Hello ", <b>Mario</b>]
basicHtmlToNodes("no markup here");             // "no markup here" (same string back)
```

| | |
| --- | --- |
| `text` | Text, optionally with markup and `%s` placeholders |
| `args` | Value or array of values replacing the `%s`, in order — optional |
| *returns* | A string, a single element, or a fragment |

Only the formatting tags `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>` and
HTML entities are recognised. Any other tag is dropped while keeping its content
(`<div>hi</div>` → `hi`), and **no attribute is ever forwarded** — the elements it builds
carry nothing but a `key`. A string without markup is returned untouched, allocating
nothing. Parsed results are cached, so the same string is converted once per app.

> [!IMPORTANT]
> Three things to know before using it outside the library:
>
> - It is meant for **strings you control** — typically your own translation tables — not
>   as a sanitiser for hostile input.
> - `args` are interpolated **before** parsing, so an argument that contains markup is
>   itself interpreted as HTML.
> - It needs the DOM (it uses a `<template>` element). Where `document` does not exist,
>   such as server-side rendering, it returns the original string unconverted.

### `version`

The installed package version, as a plain string — read from `package.json` at build time,
so it costs nothing at runtime:

```jsx
import { version } from "@sepoina/vitetranslate/react";

<p>viteTranslate v{version}</p>
```

Handy to surface the running version in a footer, an about page, or a playground/demo —
without hand-syncing it against `package.json`.

---

## 🎯 Preloading, Suspense and the initial flash

Languages are code-split: each one is a separate chunk loaded on demand, so a language
isn't ready on the **first** render. `TranslateContainer` handles this with a built-in
`Suspense` boundary and resolves it in one of three ways, none of which ever renders the
wrong language:

| `initialLanguage` is… | Behaviour |
| --- | --- |
| the **source language** | Always bundled eagerly (it doubles as the per-key fallback) → renders **synchronously** |
| in **`preloadedLanguages`** | Also bundled eagerly → renders **synchronously** |
| **any other language** | The container **suspends** (showing `fallback`, `null` by default) until the chunk loads, then renders the right language directly. No source-language flash, no double render |

> [!NOTE]
> The source language is always eager because it is the universal fallback for any key a
> language hasn't translated yet. In production the fallback is no longer embedded in the
> compiled marker, so without it an untranslated key would surface as its raw id.

`preloadedLanguages` is therefore an **optimization**, not a requirement to avoid the flash
— Suspense already avoids it. It turns the brief loading frame into an instant paint for
the languages you know you'll show first, at the cost of shipping them in the initial bundle.

```js
vitetranslate({
  localeDir: "src/locale",
  sourceLanguage: "it-IT",        // source language, always preloaded (fallback)
  preloadedLanguages: ["en-US"],  // instant first paint instead of a loading frame
})
```

```jsx
<TranslateContainer initialLanguage="en-US">  {/* preloaded → synchronous first paint */}
  <App />
</TranslateContainer>
```

Keep the preloaded list to the few languages you actually show first; every other language
stays a lazy chunk loaded only when switched to.

---

## 🗂️ Translation file format

Each language is one JS module in `localeDir`, named after its BCP 47 tag ([full list](doc/bcp47.md))
(`it-IT.js`, `en-US.js`, …), exporting the translation table as its default export. The **source
language** file is fully autogenerated from the markers found in your source — you never
hand-write it. Every **other language** starts as an empty `export default {}`: the sync
command populates it with the same keys set to `null`, and all you do is fill in the
translations.

A header comment (language name, tag, count of keys still missing, last-sync timestamp) is
regenerated on every sync — don't hand-edit it, it's overwritten each time. The first key,
`__builder__`, is the same kind of bookkeeping in data form (schema version, whether the
file still has untranslated keys, and the autonym exposed as `languageName` by
`useTranslateLanguage()`) — also regenerated on every sync, never edit it by hand.
`incomplete` is only written when `true`: a complete file omits it (it's the implicit
default when the key is absent):

```js
//  -------------------------------------------------
//      italiano (Italia) (sourceLanguage)
//       |    code: it-IT
//       |    missing key: 0
//       |    processed: 2026-07-27 12:37
//  -------------------------------------------------
export default {
  "__builder__": { "v": 260727, "languageName": "italiano (Italia)" },
  "BasicExample_1nke42v": "Welcome to viteTranslate",
  "DynamicExample_1wltsn1": "Hello %s, how are you?",
};
```

### Adding a language

Create an empty file named after the new tag, then re-run the sync command:

```bash
touch src/locale/fr-FR.js
npx vitetranslate-prepare-translation-table
```

Right after the command, the file already has every key found in source, just not translated
yet (`null`) — the separator line marks exactly what's missing:

```js
//  -------------------------------------------------
//      français
//       |    code: fr-FR
//       |    missing key: 2
//       |    processed: 2026-07-27 12:37
//  -------------------------------------------------
export default {
  "__builder__": { "v": 260727, "incomplete": true, "languageName": "français" },

  //  ----to be translated------------------------------------------
  "BasicExample_1nke42v": null,
  "DynamicExample_1wltsn1": null,
};
```

The same keys show up, at the same time, in the source language file too — never as `null`
there, but grouped under that same separator line for as long as they're missing in at least
one other language. That's a handy shortcut: copy that block (real text, not `null`) into an
LLM to get it translated, then paste the answer over the `null`s in the new file:

```js
//  -------------------------------------------------
//      italiano (Italia) (sourceLanguage)
//       |    code: it-IT
//       |    missing key: 2
//       |    processed: 2026-07-27 12:37
//  -------------------------------------------------
export default {
  "__builder__": { "v": 260727, "incomplete": true, "languageName": "italiano (Italia)" },

  //  ----to be translated------------------------------------------
  "BasicExample_1nke42v": "Welcome to viteTranslate",
  "DynamicExample_1wltsn1": "Hello %s, how are you?",
};
```

Replace each `null` with the translated text, keeping any `%s` placeholders intact. The
header, the `incomplete` flag and the separator line are bookkeeping the sync command
maintains, not something recomputed on the fly — hand-editing the values doesn't refresh
them. Run the sync command once more so the file realigns itself into its final, complete
shape:

```bash
npx vitetranslate-prepare-translation-table
```

```js
//  -------------------------------------------------
//      français
//       |    code: fr-FR
//       |    missing key: 0
//       |    processed: 2026-07-27 12:41
//  -------------------------------------------------
export default {
  "__builder__": { "v": 260727, "languageName": "français" },
  "BasicExample_1nke42v": "Welcome to viteTranslate",
  "DynamicExample_1wltsn1": "Hello %s, how are you?",
};
```

No further registration needed: every `.js` file found in `localeDir` becomes automatically
available — `useTranslateLanguage()` lists it and `TranslateContainer` loads it lazily on
request.

---

## 🖥️ CLI

```bash
vitetranslate-prepare-translation-table
```

Reads the `vitetranslate` config from `vite.config.js` in the current working directory,
scans `srcDir` for `_%_..._%_` markers, and syncs every JS file in `localeDir`: adds new
keys, removes stale ones (carrying over translations when a key was only renamed), and
reports what's left untranslated. Intended to run as a `prebuild` step.

---

## ⚙️ Plugin options

```js
vitetranslate(options)
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `localeDir` | `string` | **required** | Folder with the language JS files, relative to `baseDir` |
| `sourceLanguage` | `string` | **required** | [BCP 47](doc/bcp47.md) tag of the source language |
| `preloadedLanguages` | `string[]` | `[]` | Extra languages bundled eagerly for an instant, non-suspending first paint (see [Preloading](#-preloading-suspense-and-the-initial-flash)). `sourceLanguage` is always preloaded regardless |
| `baseDir` | `string` | `process.cwd()` | Project root used to resolve `localeDir` / `srcDir` |
| `srcDir` | `string` | `"src"` | Source folder scanned by the CLI |
| `includeFallback` | `boolean` | `!isProduction` | Embed the original text as a fallback in the compiled marker (dev only by default) |

---

## 🔬 How it works

<details>
<summary><b>The three-stage pipeline</b></summary>

<br>

**1. Extraction (Babel).** A Babel plugin — used both by the Vite transform and the CLI —
finds strings wrapped in `_%_..._%_`, computes a stable id (`<filename>_<hash>`), and
rewrites them to a compiled marker: `_<_id_/_fallback_>_` in dev, `_<_id_>_` in build.

**2. Resolution (runtime).** `<Translate>` and `useTranslateToString()` look up that id in the
current language table, then fall back through the source-language table, the embedded
fallback (dev only), and finally the raw key.

**3. Delivery (virtual module).** `virtual:vitetranslate/languages` lists every
`localeDir/*.js` file as a lazily-imported chunk and eagerly imports the preloaded ones
(`sourceLanguage` plus `preloadedLanguages`). `TranslateContainer` reads the current table
through a `Suspense` resource: preloaded languages resolve synchronously, others suspend
until their chunk loads, and runtime switches go through a React transition. The table is
exposed via React context.

</details>

<details>
<summary><b>Project structure</b></summary>

<br>

```
lib/
├── react/          # React runtime: TranslateContainer, Translate, hooks
├── dev/
│   ├── babel/      # Babel plugin: marker extraction and compilation
│   └── vite/       # Vite plugin, CLI, language-file sync logic
├── dist/           # Built output (generated, do not edit)
└── index.js        # Plugin entry point
```

</details>

---

## ⚠️ Known limitations

> [!WARNING]
> - **Ids are derived from the file's basename only**, not its full path — two files sharing
>   a basename (e.g. two `index.jsx` in different folders) share the same id namespace.
> - **The CLI expects a plain-object default export** in `vite.config.js` (not a
>   function-based config) and only looks for `vite.config.js`, not `.ts` / `.mjs`.
> - **No SSR support out of the box** — `<Translate>`'s HTML subset relies on a `<template>`
>   element, so it requires a browser-like environment.

---

## 🎮 Playground

A runnable example lives in [`playground/`](playground) and is deployed at
**[sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/)**.

```bash
npm run playground         # vite dev
npm run playground:build   # vite build
```

---

## 💬 Support

Questions, ideas, or feedback? Use
[GitHub Discussions](https://github.com/sepoina/viteTranslate/discussions).

Found an actual bug? Open an
[Issue](https://github.com/sepoina/viteTranslate/issues) instead, so it stays tracked
separately from open-ended conversation.

If viteTranslate saved you some time, you can
[buy me a coffee](https://www.paypal.com/paypalme/giancarloghigi) — entirely optional, never
expected.

---

## 🔐 Provenance

Every release is published from GitHub Actions through
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) with OIDC, so each
version on npm carries a cryptographic provenance attestation linking the published tarball
to the exact commit and workflow run that produced it. No long-lived tokens are involved.

---

## 📄 License

Apache License 2.0 — see [`LICENSE`](LICENSE).
