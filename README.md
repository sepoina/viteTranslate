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

[**Live playground**](https://sepoina.github.io/viteTranslate/) · [**StackBlitz**](https://stackblitz.com/edit/vitejs-vite-aa9rcqtt?file=README.md) · [Quick start](#-quick-start) · [API](#-api) · [Architecture](doc/structure.md)

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
- [🔎 Diagnostics: `errorSolve`](#-diagnostics-errorsolve)
  - [Case by case](#case-by-case)
  - [When there is no text at all](#when-there-is-no-text-at-all)
  - [Unmarked text is domain data, not an error](#unmarked-text-is-domain-data-not-an-error)
  - [Console output](#console-output)
- [🖥️ CLI](#️-cli)
- [⚙️ Plugin options](#️-plugin-options)
  - [`errorSolve`](#errorsolve)
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

// object form: text and arguments in one value
<Translate o={{ t: "_%_Hello %s, how are you?_%_", a: [username] }} />

// small inline HTML subset
<Translate t={"_%_<strong>Bold</strong> and <i>italic</i> text_%_"} />

// a placeholder can be filled with a React element, markup included
<Translate t={["_%_Signed in as <b>%s</b>_%_", <Link to="/me">{username}</Link>]} />

// not marked: domain data, rendered as it is
<Translate>{user.phoneNumber}</Translate>

// a value that will never carry a marker: no ‼️, no console warning
<Translate t={row.label} skipMark />
```

Since translation tables are compiled at build time, a `%s` inside markup is a real JSX child, not a piece of string. So an argument can be any React node, and it is **never** interpreted as HTML — React escapes it like any other child. A `%s` left without a value renders as `⁇` (configurable, see [Diagnostics](#-diagnostics-errorsolve)).

A string **without** the marker is not an error: it is rendered as it is, and in development it carries a `‼️` in front of it so you can see the prop is receiving something nobody will translate. That is what lets one leaf component accept both translatable text and domain data without a wrapper deciding for it.

#### Props

| Prop | Meaning |
| --- | --- |
| `t` | the marked text, the compact form `[text, ...args]`, or the object form `{ t, a }`. A number or a React element are accepted too — see below |
| `a` | values for the `%s`, when `t` doesn't already carry them |
| `o` | the object form, for text that already travels packaged with its arguments. Same as passing them separately; alternative to `t` |
| `children` | the marked text, as a child. Alternative to `t` |
| `skipMark` | declares that here an **un**marked string is legitimate: no `‼️`, no console warning. See [below](#skipmark-when-unmarked-is-the-normal-case) |

#### What can sit in the text position

One leaf component often has to render whatever its caller has — and that isn't always a string a marker could ever be attached to:

```jsx
<Translate t={item.count} />              // a number: rendered as is, no ‼️, no warning
<Translate t={0} />                       // renders "0" — zero is a value, not "nothing"
<Translate t={<WaitingBarSpan />} />      // a React element: returned as is, no diagnostics
```

A number can never come from the source, so it is domain data by construction; a mounted element is not ambiguous either — it can't be a forgotten marker, and it already knows how to render itself. Neither of them goes through the error path.

Two deliberate limits. Inside the tuple form the first slot **is** the text, so an element there stays an error (an element among the *arguments* has always been supported). And `ts()` does not take elements: it has to return a primitive string, so a node is a genuine error there, with a message that says so.

#### `skipMark`: when unmarked is the normal case

A number and an element tell you what they are. A **string** doesn't: unmarked can mean *forgotten marker* or *value that will never have one* — a phone number, a URI, a field name configured in an admin panel, an exception message, a description coming from the server. From inside the component the two look identical; only the call site knows which is which.

```jsx
<Translate t={row.label} skipMark />
```

When `skipMark` is on **and** the text is not marked: no `‼️`, no console warning, everything else unchanged (`%s` interpolation included). When the text **is** marked, the prop does nothing at all — the resolution chain runs as usual and `🔸` / `🔹` stay on. It does not mean "don't translate", it means "unmarked is not an error here", which is exactly what a prop that carries marked text on some rows and domain data on others needs. Incompatible props are still an error, `skipMark` or not.

The alternative that looks equivalent isn't: `errorSolve.mark.malformed = false` turns the diagnostic off **everywhere**, including where a marker really was forgotten.

### `useTranslateToString()`

For places that need a plain string instead of JSX — `placeholder`, `aria-label`, `title`:

```jsx
import { useTranslateToString } from "@sepoina/vitetranslate/react";

function SearchInput() {
  const ts = useTranslateToString();
  return <input placeholder={ts("_%_Enter your name_%_")} />;
}
```

It accepts the same forms as `<Translate>` — `ts("_%_Hello %s_%_", name)`, `ts(["_%_Hello %s_%_", name])`, `ts({ t: "_%_Hello %s_%_", a: [name] })` — and applies the same [diagnostic prefixes](#-diagnostics-errorsolve).

An optional third argument carries what are props on `<Translate>`:

```jsx
<input placeholder={ts(field.label, undefined, { skipMark: true })} />
```

`{ skipMark: true }` says the same thing as the prop: an unmarked string is legitimate here, so no `‼️` and no console warning. A React element is the one form `ts()` does **not** take — it has to return a primitive string, so a mounted node is a real error and gets a message of its own.

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
| `id` | `string \| undefined` | Tag of the language **on screen** ([BCP 47](doc/bcp47.md)); `undefined` outside `TranslateContainer`. If a chunk failed to load the container falls back to the eager table, and `id` reports that language — not the one that was asked for |
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
| `initialLanguage` | `string` | first eager language (`preloadedLanguages[0] ?? sourceLanguage`) | Language tag to **start** from ([BCP 47](doc/bcp47.md)); read once at mount, changing it later has no effect — that is what `proposeNewLanguage()` is for. Eagerly bundled languages render synchronously; otherwise the container suspends until the chunk is ready — never the wrong language. The default is the same in dev and in build, so an app that omits it starts in the same language everywhere |
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

A chunk that fails to load is **not** remembered as failed: proposing the same language again really retries it, and the screen updates when it works. A chunk can fail on a network hiccup, and one bad moment must not make that language unselectable for the life of the page.

Meanwhile the container falls back to the eager table, and `id` reports **that** language — so a retry button has to use the tag it asked for, not `id`:

```jsx
const [wanted, setWanted] = useState(null);
const switchTo = (tag) => {
  setWanted(tag);
  proposeNewLanguage({ lang: tag, onDone: (ok) => ok && setWanted(null) });
};
// wanted !== null -> the last switch failed, and `wanted` is the tag to retry
```

### `basicHtmlToNodes()`

Turns a string containing basic HTML into React nodes, without `dangerouslySetInnerHTML`. It used to be what `<Translate>` ran on every render; since translation tables are compiled at build time it is no longer on that path — `<Translate>` only falls back to it in development, for a key not yet synced. It stays exported because it is useful on its own:

```jsx
import { basicHtmlToNodes } from "@sepoina/vitetranslate/react";

basicHtmlToNodes("Hello <b>%s</b>", "Mario");   // ["Hello ", <b>Mario</b>]
basicHtmlToNodes("you have %s messages");       // "you have ⁇ messages"
basicHtmlToNodes("no markup here");             // "no markup here" (same string back)
```

| | |
| --- | --- |
| `text` | Text, optionally with markup and `%s` placeholders |
| `args` | Value or array of values replacing the `%s`, in order — optional |
| *returns* | A string, a single element, or a fragment |

A `%s` left without a value renders as `⁇` — whether no argument was passed at all, fewer were passed than there are placeholders, or the value in that position is `null`/`undefined`. `0` and the empty string are values like any other and are interpolated normally. The same rule applies to `ts()` from `useTranslateToString`, and the character is the `mark.absentDataInArray` option of [`errorSolve`](#-diagnostics-errorsolve).

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

## 🔎 Diagnostics: `errorSolve`

A string that doesn't reach the screen translated is not always a bug you can see. A key nobody has translated yet still renders — in the source language, indistinguishable from a real translation. A text nobody marked renders too. Both look fine, and that is the problem.

`errorSolve` puts a character in front of them, **in development only**, so you spot them by reading the page instead of by auditing the tables. Every field is optional; these are the defaults:

```js
vitetranslate({
  localeDir: "src/locale",
  sourceLanguage: "it-IT",
  errorSolve: {
    mark: {
      badData: "🚫",            // a value that is not text and never will be
      malformed: "‼️",          // text nobody marked, or incompatible props
      untranslated: "🔸",       // no translation in the current language
      notFullyTranslated: "🔹", // translated here, missing in some other language
      absentDataInArray: "⁇",   // a %s left without a value
    },
    markOnlyDev: true,          // in a build: just the fallback, no characters
    warningDev: true,           // runtime console in development
    warningBuild: false,        // runtime console in production
  },
})
```

Two questions, kept apart: `mark` is **what** you see, everything else is **when** — on screen with `markOnlyDev`, in the console with `warningDev` / `warningBuild`.

One prefix per string, the worst one wins: `‼️` → `🔸` → `🔹`. Set any of them to `""` or `false` to turn that one off. `🚫` never competes with the other three — it fires only where there is no text for a prefix to sit in front of; see [below](#when-there-is-no-text-at-all).

With `markOnlyDev: true` (the default) a production build ships none of this — not the characters, and not the data behind them: the untranslated-key lists never enter the language chunks and the global set stays empty. `mark.absentDataInArray` is the exception: it isn't a diagnostic but ordinary rendering, so it applies in development and in a build alike.

### Case by case

| What happened | Dev | Build (default) |
| --- | --- | --- |
| Text nobody marked — `<Translate>Mira Halvorsen</Translate>` | `‼️Mira Halvorsen` | `Mira Halvorsen` |
| Same, but declared with `skipMark` | `Mira Halvorsen` | `Mira Halvorsen` |
| Incompatible props — `t` and `children` together | `‼️` + the text that was there | the text that was there |
| No translation in this language | `🔸` + source text | source text |
| Translated here, missing elsewhere | `🔹` + translation | translation |
| A value that is not text — `t={() => {}}` | `🚫[func]` | nothing |
| A `%s` with no value | `⁇` (`mark.absentDataInArray`) | `⁇` (`mark.absentDataInArray`) |

Incompatible props never erase the text: the best available one is recovered and rendered — the string in `t`, the children, the first element of the tuple. A mistake in *your* props is not paid for by whoever is reading the screen.

### When there is no text at all

Sometimes there is genuinely nothing to recover: a function, a symbol, a React element in the first slot of the tuple, an empty tuple. "Always show something" cannot apply — there is no something — and the only useful thing left to say is **what** was there instead of the text. That is `mark.badData`, and unlike the other three it is not a prefix in front of a text: it is the whole rendering.

| Value | Dev | Build (default) |
| --- | --- | --- |
| `t={() => {}}` | `🚫[func]` | nothing |
| `t={Symbol("x")}` | `🚫[symbol]` | nothing |
| `t={true}` | `🚫[true]` | nothing |
| `t={[]}` | `🚫[array]` | nothing |
| `t={[null]}` | `🚫[nullArray]` | nothing |
| `t={[<i/>]}`, or `t` and `children` both elements | `🚫[badDom]` | nothing |
| any other unreadable shape | `🚫[badData]` | nothing |

The name comes from the **first slot that mattered** — the first element of the tuple, the `t` field of the object — because that is where the text was supposed to be: about `t={[<i/>]}` the thing worth saying is that a node sits where the text belonged, not that there is an array. `array` and `nullArray` are for the tuples where that slot doesn't exist or is empty, and there the wrapper *is* the information.

`markOnlyDev` covers this one too, and **turned off it renders nothing at all**: the type name on its own is noise for whoever is reading the page, and an empty rendering is already what the component does for its other "nothing to show" case, the object with no `t` field. The console message stays, under `warningDev`/`warningBuild` as always.

### Unmarked text is domain data, not an error

`<Translate>` used to throw in development on a string without `_%_..._%_`. But plenty of text is not translatable and never will be: a phone number, a field name configured in an admin panel, an exception message, a description coming from the server. Deciding between the two meant inspecting the marker *before* calling `<Translate>` — rewriting outside a decision that belongs here.

Now the marker is the discriminator and the component applies it: marked text is translated, unmarked text is rendered as it is. So a leaf component can take whatever its caller has:

```jsx
// all six of these work, and none of them needs a wrapper
<Translate>_%_Welcome_%_</Translate>
<Translate t={["_%_Hello %s_%_", username]} />
<Translate o={{ t: "_%_Hello %s_%_", a: [username] }} />   // object form
<Translate>{user.phoneNumber}</Translate>                  // domain data, rendered as is
<Translate t={item.count} />                               // a number, "0" included
<Translate t={<WaitingBarSpan />} />                       // an element renders itself
```

The `o` prop — and the same `{ t, a }` object passed to `t`, or to `ts()` — is for text that already travels packaged with its arguments, which is how several application cores carry it. It is exactly equivalent to passing them separately.

In development that phone number shows a `‼️`, and that is the point: the prop is receiving something nobody will translate, and you get to decide whether that is right. When the answer is "yes, and it always will be", say so with [`skipMark`](#skipmark-when-unmarked-is-the-normal-case) and the `‼️` goes away for that call site only — unlike `mark: { malformed: false }`, which would turn it off everywhere.

A number and a React element don't need the declaration: neither can ever come from the source marked, so both are rendered directly, with no prefix and no warning.

### Console output

`warningDev` and `warningBuild` are the switch for **everything the library prints in the browser** — the new diagnostics, the missing-key report, the unknown-language and failed-chunk errors, the warning about an `initialLanguage` that isn't preloaded.

> [!IMPORTANT]
> With `warningBuild: false` (the default) a published app is completely silent, including the messages that report a real failure — a language chunk that didn't load, a tag that doesn't exist. Set `warningBuild: true` to keep them.

Plugin messages (build time, prefixed `[vitetranslate]`) are not affected: they are not runtime output.

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
| `errorSolve` | `object` | see below | On-screen and console diagnostics for strings that didn't arrive where they should — see [Diagnostics](#-diagnostics-errorsolve) |

### `errorSolve`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mark.badData` | `string \| false` | `"🚫"` | Shown, followed by the name of what was found (`🚫[func]`), when the text slot holds a value that is not text and nothing can be recovered. Turned off, nothing is rendered |
| `mark.malformed` | `string \| false` | `"‼️"` | Prefix for text nobody marked, and for incompatible props |
| `mark.untranslated` | `string \| false` | `"🔸"` | Prefix when the current language has no translation for that entry |
| `mark.notFullyTranslated` | `string \| false` | `"🔹"` | Prefix when the entry is translated here but missing in some other language |
| `mark.absentDataInArray` | `string` | `"⁇"` | Stands in for a `%s` left without a value. Ordinary rendering, not a diagnostic: applies in dev **and** in a build, and `markOnlyDev` doesn't touch it |
| `markOnlyDev` | `boolean` | `true` | In a build, no diagnostic marks on screen — just the fallback. The data behind them isn't shipped either |
| `warningDev` | `boolean` | `true` | Runtime console output in development |
| `warningBuild` | `boolean` | `false` | Runtime console output in production — **all** of it, failures included |

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
