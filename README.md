<div align="center">

<img src="doc/logo.svg" alt="viteTranslate" width="380" height="68" />

**Extract translatable strings straight from your source.**
No keys to invent. No separate extraction step. No runtime dependencies.

[![Vite](https://img.shields.io/badge/Vite-5%20|%206%20|%207%20|%208-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![publish](https://img.shields.io/github/actions/workflow/status/sepoina/viteTranslate/publish.yml?logo=githubactions&logoColor=white&label=publish)](https://github.com/sepoina/viteTranslate/actions/workflows/publish.yml)
[![runtime size](https://img.shields.io/badge/runtime-%3C%205%20kB%20gzip-4c1)](#-why-vitetranslate)

[![npm version](https://img.shields.io/npm/v/@sepoina/vitetranslate?logo=npm&logoColor=white&label=npm&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![npm downloads](https://img.shields.io/npm/dm/@sepoina/vitetranslate?logo=npm&logoColor=white&label=downloads&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![provenance](https://img.shields.io/badge/npm-provenance-2b7489?logo=npm&logoColor=white)](https://www.npmjs.com/package/@sepoina/vitetranslate#provenance)

[![Donate](https://img.shields.io/badge/support-PayPal-00457C?logo=paypal&logoColor=white)](https://www.paypal.com/paypalme/giancarloghigi)
[![Buy Me a Coffee](https://img.shields.io/badge/buy%20me%20a-coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/giancarlogy)

[**Live playground**](https://sepoina.github.io/viteTranslate/) · [Quick start](#-quick-start) · [API](#-api) · [StackBlitz](https://stackblitz.com/edit/vitejs-vite-aa9rcqtt?file=README.md) · [Architecture](doc/structure.md)

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

That is the whole authoring workflow. Wrap a string in `_%_..._%_`, render it through `<Translate>`, and the JS translation tables are generated and kept in sync for you.

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
| 🪶 **Zero dependencies** | The package declares no `dependencies` at all, and the shipped code imports nothing: it looks up an id already computed at build time. `@babel/core`, Vite and React are *peer* dependencies — they run the plugin and the CLI on your machine, never enter the bundle, and are already in your `node_modules`. |
| 📍 **Mark text in place** | No keys to invent or maintain. The marker is extracted at build time; the component resolves it against the current language table at runtime. |
| 📄 **Language files are auto-generated** | The JS tables in `localeDir` are created and updated by the sync command from the markers found in your source. |
| 📦 **Lazy language loading** | Each language is a separate chunk, dynamically `import()`-ed only when selected. The initial bundle never carries languages you don't use. |
| ⚙️ **Tables compiled at build time** | Each language table reaches the browser as a module of ready-made values — plain strings, React elements built once, functions for the entries with placeholders. No HTML parser at runtime (so `<Translate>` renders server-side too), and entries without placeholders keep a stable identity between renders. |
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

`.js`, `.jsx`, `.ts` and `.tsx` sources are all scanned and extracted from. TypeScript declarations ship with the package: plugin options, component props and hook results are typed, and `virtual:vitetranslate/languages` is declared for you.

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
> The source language file must already exist before the first `vite dev` / `vite build` — `TranslateContainer` reads it immediately on load. Run the sync command once to generate it (the `localeDir` folder itself doesn't need to exist beforehand, the plugin creates it).

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

// a placeholder can be filled with a React element, markup included
<Translate t={["_%_Signed in as <b>%s</b>_%_", <Link to="/me">{username}</Link>]} />
```

Since translation tables are compiled at build time, a `%s` inside markup is a real JSX child, not a piece of string. So an argument can be any React node, and it is **never** interpreted as HTML — React escapes it like any other child. A `%s` left without a value renders as `[?]`.

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

Everything a language switcher needs, in one hook: the current language, the list of available ones and the function to change it.

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

It is also **frozen**, `languages` and its entries included: the very same array is shared by every component in the app for the whole life of the page, so a stray write would corrupt the list for everyone, far away from where it happened. Writing to it throws a `TypeError` on the spot instead. To reorder or filter, work on a copy — `[...languages]`.

`languages` and `sourceLanguage` come from the language manifest, known at build time: no table is ever loaded just to list them, and they stay valid even outside `TranslateContainer` — handy to build a list of languages above the translated tree. There `id` is `undefined` and `proposeNewLanguage` is inert; calling it is reported once in the console during development, since that is the only thing that cannot work without a container.

### `TranslateContainer` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialLanguage` | `string` | first eager language (`preloadedLanguages[0] ?? sourceLanguage`) | Initial language tag to load ([BCP 47](doc/bcp47.md)). Eagerly bundled languages render synchronously; otherwise the container suspends until the chunk is ready — never the wrong language. The default is the same in dev and in build, so an app that omits it starts in the same language everywhere |
| `fallback` | `node` | `null` | Shown via `Suspense` while a non-preloaded initial language loads. Chunks are local, so the default `null` is a near-imperceptible empty frame |
| `debug` | `boolean` | `false` | Exposed by `useTranslateLanguage()` |
| `children` | `node` | — | App tree that receives the translation context |

### `proposeNewLanguage()`

Available from `useTranslateLanguage()`:

```js
const { proposeNewLanguage } = useTranslateLanguage();
proposeNewLanguage({ lang, onStart, onDone, onError });
```

Triggers a runtime language switch, lazily loading the requested chunk. The switch runs inside a React transition, so the current language stays on screen until the new one is ready — no blank frame mid-switch.

### `basicHtmlToNodes()`

Turns a string containing basic HTML into React nodes, without `dangerouslySetInnerHTML`. It used to be what `<Translate>` ran on every render; since translation tables are compiled at build time it is no longer on that path — `<Translate>` only falls back to it in development, for a key not yet synced. It stays exported because it is useful on its own:

```jsx
import { basicHtmlToNodes } from "@sepoina/vitetranslate/react";

basicHtmlToNodes("Hello <b>%s</b>", "Mario");   // ["Hello ", <b>Mario</b>]
basicHtmlToNodes("you have %s messages");       // "you have [?] messages"
basicHtmlToNodes("no markup here");             // "no markup here" (same string back)
```

| | |
| --- | --- |
| `text` | Text, optionally with markup and `%s` placeholders |
| `args` | Value or array of values replacing the `%s`, in order — optional |
| *returns* | A string, a single element, or a fragment |

A `%s` left without a value renders as `[?]` — whether no argument was passed at all, fewer were passed than there are placeholders, or the value in that position is `null`/`undefined`. `0` and the empty string are values like any other and are interpolated normally. The same rule applies to `ts()` from `useTranslateToString`.

Only the formatting tags `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>` and HTML entities are recognised. Any other tag is dropped while keeping its content (`<div>hi</div>` → `hi`), and **no attribute is ever forwarded** — the elements it builds carry nothing but a `key`. A string without markup is returned untouched, allocating nothing. Parsed results are cached, so the same string is converted once per app.

> [!IMPORTANT]
> Three things to know before using it outside the library:
>
> - It is meant for **strings you control** — typically your own translation tables — not as a sanitiser for hostile input.
> - `args` are interpolated **before** parsing, so an argument that contains markup is itself interpreted as HTML.
> - It needs the DOM (it uses a `<template>` element). Where `document` does not exist, such as server-side rendering, it returns the original string unconverted.

### `version`

The installed package version, as a plain string — read from `package.json` at build time, so it costs nothing at runtime:

```jsx
import { version } from "@sepoina/vitetranslate/react";

<p>viteTranslate v{version}</p>
```

Handy to surface the running version in a footer, an about page, or a playground/demo — without hand-syncing it against `package.json`.

---

## 🎯 Preloading, Suspense and the initial flash

Languages are code-split: each one is a separate chunk loaded on demand, so a language isn't ready on the **first** render. `TranslateContainer` handles this with a built-in `Suspense` boundary and resolves it in one of two ways, neither of which ever renders the wrong language:

| `initialLanguage` is… | Behaviour |
| --- | --- |
| **eagerly bundled** | Its table is already in the initial bundle → renders **synchronously** |
| **any other language** | The container **suspends** (showing `fallback`, `null` by default) until the chunk loads, then renders the right language directly. No wrong-language flash, no double render |

Which languages are eager depends on the environment:

| | Eagerly bundled |
| --- | --- |
| **dev** | `preloadedLanguages` **plus** `sourceLanguage` — the source is the language you are writing, keeping it synchronous avoids a suspension on every reload |
| **build** | `preloadedLanguages` if you declared any, otherwise `sourceLanguage` |

> [!NOTE]
> In a production build the source language is not shipped just to act as a fallback: every compiled table is **self-contained** — each key a language hasn't translated yet already carries the source text inside it. So an app that starts in `en-US` with `preloadedLanguages: ["en-US"]` ships one table, not two copies of the same content.

`preloadedLanguages` is therefore an **optimization**, not a requirement to avoid the flash — Suspense already avoids it. It turns the brief loading frame into an instant paint for the languages you know you'll show first, at the cost of shipping them in the initial bundle.

```js
vitetranslate({
  localeDir: "src/locale",
  sourceLanguage: "it-IT",        // source language: eager in dev, and in build if no preload is declared
  preloadedLanguages: ["en-US"],  // instant first paint instead of a loading frame
})
```

```jsx
<TranslateContainer initialLanguage="en-US">  {/* preloaded → synchronous first paint */}
  <App />
</TranslateContainer>
```

Keep the preloaded list to the few languages you actually show first; every other language stays a lazy chunk loaded only when switched to.

The **first** eager language (`preloadedLanguages[0] ?? sourceLanguage`) is also the one `TranslateContainer` starts from when `initialLanguage` is omitted — the same in dev and in build, on purpose. Starting from a language that isn't eager still works, it just costs a round trip before the first paint, and it is reported once in the console — in production too, since in dev the source language is eager anyway and the check would always pass there.

---

## 🗂️ Translation file format

Each language is one JS module in `localeDir`, named after its BCP 47 tag ([full list](doc/bcp47.md)) (`it-IT.js`, `en-US.js`, …), exporting the translation table as its default export. The **source language** file is fully autogenerated from the markers found in your source — you never hand-write it. Every **other language** starts as an empty file (`touch fr-FR.js` is enough): the sync command populates it with the same keys set to `null`, and all you do is fill in the translations.

A header comment (language name, tag, count of keys still missing, last-sync timestamp) is regenerated on every sync — don't hand-edit it, it's overwritten each time. The first key, `__builder__`, is the same kind of bookkeeping in data form (schema version, whether the file still has untranslated keys, and the autonym exposed as `languageName` by `useTranslateLanguage()`) — also regenerated on every sync, never edit it by hand. `incomplete` is only written when `true`: a complete file omits it (it's the implicit default when the key is absent):

```js
//  -------------------------------------------------
//      italiano (Italia) (sourceLanguage)
//       |    code: it-IT
//       |    missing key: 0
//       |    processed: 2026-07-27 12:37
//  -------------------------------------------------
export default {
  "__builder__": {"v":260727,"languageName":"italiano (Italia)"},
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

Right after the command, the file already has every key found in source, just not translated yet (`null`) — the separator line marks exactly what's missing:

```js
//  -------------------------------------------------
//      français
//       |    code: fr-FR
//       |    missing key: 2
//       |    processed: 2026-07-27 12:37
//  -------------------------------------------------
export default {
  "__builder__": {"v":260727,"languageName":"français","incomplete":true},

  //  ----to be translated------------------------------------------
  "BasicExample_1nke42v": null,
  "DynamicExample_1wltsn1": null,
};
```

The same keys show up, at the same time, in the source language file too — never as `null` there, but grouped under that same separator line for as long as they're missing in at least one other language. That's a handy shortcut: copy that block (real text, not `null`) into an LLM to get it translated, then paste the answer over the `null`s in the new file:

```js
//  -------------------------------------------------
//      italiano (Italia) (sourceLanguage)
//       |    code: it-IT
//       |    missing key: 2
//       |    processed: 2026-07-27 12:37
//  -------------------------------------------------
export default {
  "__builder__": {"v":260727,"languageName":"italiano (Italia)","incomplete":true},

  //  ----to be translated------------------------------------------
  "BasicExample_1nke42v": "Welcome to viteTranslate",
  "DynamicExample_1wltsn1": "Hello %s, how are you?",
};
```

Replace each `null` with the translated text, keeping any `%s` placeholders intact. The header, the `incomplete` flag and the separator line are bookkeeping the sync command maintains, not something recomputed on the fly — hand-editing the values doesn't refresh them. Run the sync command once more so the file realigns itself into its final, complete shape:

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
  "__builder__": {"v":260727,"languageName":"français"},
  "BasicExample_1nke42v": "Welcome to viteTranslate",
  "DynamicExample_1wltsn1": "Hello %s, how are you?",
};
```

No further registration needed: every `.js` file found in `localeDir` becomes automatically available — `useTranslateLanguage()` lists it and `TranslateContainer` loads it lazily on request.

---

## 🖥️ CLI

```bash
vitetranslate-prepare-translation-table
```

Reads the `vitetranslate` config from `vite.config.*` in the current working directory, scans `srcDir` for `_%_..._%_` markers, and syncs every JS file in `localeDir`: adds new keys, removes stale ones (carrying over translations when a key was only renamed), and reports what's left untranslated. Intended to run as a `prebuild` step.

---

## ⚙️ Plugin options

```js
vitetranslate(options)
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `localeDir` | `string` | **required** | Folder with the language JS files, relative to `baseDir` |
| `sourceLanguage` | `string` | **required** | [BCP 47](doc/bcp47.md) tag of the source language |
| `preloadedLanguages` | `string[]` | `[]` | Languages bundled eagerly fohttps://stackblitz.com/edit/vitejs-vite-aa9rcqtt?file=README.mdr an instant, non-suspending first paint (see [Preloading](#-preloading-suspense-and-the-initial-flash)). `sourceLanguage` is eager too in dev, and in build only when this list is empty |
| `baseDir` | `string` | `process.cwd()` | Project root used to resolve `localeDir` / `srcDir` |
| `srcDir` | `string` | `"src"` | Source folder scanned by the CLI |
| `includeFallback` | `boolean` | `!isProduction` | Embed the original text as a fallback in the compiled marker (dev only by default) |

---

## 🔬 How it works

Strings flow through four stages: **extraction** (Babel finds `_%_..._%_` and assigns an id), **compilation** (tables become ready-made React values at build time), **resolution** (components look up ids at runtime), and **delivery** (languages load lazily as chunks, eager ones in the initial bundle).

Every compiled table is **self-contained** — keys a language hasn't translated yet already carry the source text inside. So in production, an app that starts in `en-US` doesn't ship the Italian source table as a fallback; it ships one table, not two copies.

> [!TIP]
> 📖 **Want the full picture?** [`doc/structure.md`](doc/structure.md) walks through the architecture with diagrams: what happens to a marked string from the moment you write it to the moment the browser shows it, which file decides what, which intermediate artifacts live on disk and which only in the bundler's module graph — with links to every source file involved.

---

## ⚠️ Known limitations

> [!WARNING]
> - **Ids are derived from the file's basename only**, not its full path — two files sharing a basename (e.g. two `index.jsx` in different folders) share the same id namespace. Within one namespace the id is a 32-bit hash of the text: a collision between two different strings is unlikely but possible, and it is reported as a build warning naming both texts.
> - **Markers must be whole strings.** `"_%_text_%_"`, `` `_%_text_%_` `` and a JSX child on its own line are extracted; a marker embedded in a longer string or mixed with other JSX text is not. A template literal with `${...}` inside the marker is not either — use a `%s` placeholder and pass the value as an argument.
> - **The CLI loads your Vite config with Node itself**, not with Vite. It looks for `vite.config.{js,mjs,ts,cjs,mts,cts}` in the current working directory and accepts both a plain-object and a function-based default export — but a TypeScript config needs a Node that strips types (23.6+, or `--experimental-strip-types`), and syntax beyond plain annotations (`enum`, `namespace`, decorators) won't load at all.
> - **`basicHtmlToNodes()` still needs the DOM** if you call it directly. `<Translate>` no longer does: translation tables are compiled at build time, so its markup renders server-side too.

---

## 🎮 Playground

A runnable example lives in [`playground/`](playground) and is deployed at **[sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/)**.

```bash
npm run playground         # vite dev
npm run playground:build   # vite build
```

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
