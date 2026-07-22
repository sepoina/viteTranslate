# @sepoina/vitetranslate

Babel + Vite plugin to extract translatable strings directly from your source (a `_%_text_%_` marker and a `<Translate>` component) and generate/sync JSON translation tables automatically — no manual translation keys, no separate extraction step.

## Simplest implement

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

```jsx
import { useContext } from "react";
import { TranslateContext } from "@sepoina/vitetranslate/react";

function SwitchToEnglish() {
  const lang = useContext(TranslateContext);
  return <button onClick={() => lang.proposeNewLanguage({ lang: "it-IT" })}>IT</button>;
}
```

## Features

🔀 **Works on Vite 7 and Vite 8 alike.** Same codebase, no config switch needed: on Vite 7 it runs on Rollup (build) and esbuild (dev); on Vite 8 it runs on Rolldown (the Rust bundler) and Oxc (the compiler that replaces Babel/esbuild internally for Vite's own transforms). The plugin adapts automatically — virtual-module `moduleType` hints, `\0`-prefixed internal ids, and declarative hook filters are all handled under the hood.

📍 **Mark text in place.** Wrap a string with `_%_..._%_` and render it through `<Translate>` (or `useTranslateString()`); no keys to invent or maintain by hand — the marker gets extracted at build time, the component resolves it against the current language table at runtime.

📄 **Language files are auto-generated.** The JSON tables in `localeDir` aren't written by hand — the plugin's sync command creates and updates them from the markers found in your source.

📦 **Lazy language loading.** Each language is a separate chunk, dynamically `import()`-ed only when selected — the initial bundle never carries languages you don't use.

👁️ **Dev fallback, always visible.** Until a translation exists, the original text is shown — never a blank string or a crash.

🔄 **One command syncs every language.** Adds missing keys, removes stale ones, and reports what's left to translate.

🆕 **New languages auto-detected.** Drop a `.json` file in the locale folder — no registration anywhere else.

🏷️ **Renamed keys keep their translation.** If a string's id changes but the text doesn't, the sync step carries the existing translation over instead of starting from `null`.

🔒 **Small, safe HTML subset.** A handful of inline tags (`<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<small>`, `<code>`, `<br>`, `<hr>`, `<wbr>`) can appear inside translated strings; everything else is unwrapped to plain text, and no attribute is ever forwarded.

🪶 **Zero external dependencies.** The `<Translate>`/`useTranslateString()` code that actually reaches the browser imports nothing — it just looks up an id already computed at build time. `@babel/core`, Vite and React are peer dependencies, not bundled ones: they run the Vite plugin and the CLI on your machine (in Node, to transform source and sync JSON files) but never enter the shipped bundle, and since your project is already a Vite/React app, they're already sitting in your `node_modules` — this package adds nothing on top.

## Requirements

- Vite `^5 || ^6 || ^7 || ^8`
- React `^18 || ^19` (for the `/react` entry point)
- `@babel/core ^7`

These are peer dependencies — install them if your project doesn't already have them.

## Installation

```bash
npm install @sepoina/vitetranslate
```

## Quick start

**1. Register the plugin in `vite.config.js`:**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    vitetranslate({
      localeDir: "src/locale",  // folder with the language JSON files
      defaultLanguage: "it-IT", // default language tag (BCP 47)
    }),
    react(),
  ],
});
```

**2. Wrap your app in `TranslateContainer`:**

```jsx
import ReactDOM from "react-dom/client";
import { TranslateContainer } from "@sepoina/vitetranslate/react";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <TranslateContainer predefined="it-IT">
    <App />
  </TranslateContainer>
);
```

**3. Mark strings with `_%_..._%_` and render them through `<Translate>`:**

```jsx
import { Translate } from "@sepoina/vitetranslate/react";

export default function Welcome() {
  return <h1><Translate>_%_Welcome to viteTranslate_%_</Translate></h1>;
}
```

**4. Before building for production, sync the translation tables** so the default language file is always complete:

```json
{
  "scripts": {
    "prebuild": "vitetranslate-prepare-translation-table",
    "build": "vite build"
  }
}
```

> The `localeDir` folder must already exist and contain the default language file before the first `vite dev`/`vite build` — `TranslateContainer` reads it immediately on load. Run the sync command once to generate it.

## Usage

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

### `useTranslateString()`

For places that need a plain string instead of JSX — `placeholder`, `aria-label`, `title`, etc.:

```jsx
import { useTranslateString } from "@sepoina/vitetranslate/react";

function SearchInput() {
  const ts = useTranslateString();
  return <input placeholder={ts("_%_Enter your name_%_")} />;
}
```

### `useAvailableLanguages()`

Lists the languages found in `localeDir`, synchronously, without loading them — useful for a language switcher:

```jsx
import { useContext } from "react";
import { TranslateContext, useAvailableLanguages } from "@sepoina/vitetranslate/react";

function LanguageSwitcher() {
  const lang = useContext(TranslateContext);
  const { tags } = useAvailableLanguages();

  return tags.map((tag) => (
    <button key={tag} onClick={() => lang?.proposeNewLanguage({ lang: tag })}>
      {tag}
    </button>
  ));
}
```

### `TranslateContainer` props

| Prop         | Type      | Default                          | Description                              |
| ------------ | --------- | --------------------------------- | ----------------------------------------- |
| `predefined` | `string`  | `defaultLanguage` from the plugin | Initial language tag to load (BCP 47)     |
| `debug`      | `boolean` | `false`                           | Exposed on the translation context object |
| `children`   | `node`    | —                                  | App tree that gets the translation context |

`proposeNewLanguage({ lang, onStart, onDone, onError })` (available on the context value) triggers a runtime language switch, lazily loading the requested chunk.

## Translation file format

Each language is one JSON file in `localeDir`, named after its BCP 47 tag (e.g. `it-IT.json`, `en-US.json`). The **default language** file is fully autogenerated by the sync command from the markers found in your source — you never hand-write it. Every **other language** starts as just an empty `{}`: the sync command populates it with the same keys (set to `null`), and all you do is fill in the translations.

```json
{
  "__lngVersion__": "260216",
  "BasicExample_1nke42v": "Welcome to viteTranslate",
  "DynamicExample_1wltsn1": "Hello %s, how are you?"
}
```

- To **add a language**, create an empty file and re-run the sync command:

  ```bash
  echo '{}' > src/locale/fr-FR.json
  npx vitetranslate-prepare-translation-table
  ```

  It fills in every key found in source with `null`, and moves untranslated keys below a separator row so it's obvious what's left:

  ```json
  {
    "__lngVersion__": "260216",
    "BasicExample_1nke42v": "Welcome to viteTranslate",
    "____________________________________________________________________________not translated__": "_____",
    "DynamicExample_1wltsn1": null
  }
  ```

  Replace each `null` with the translated text (keep any `%s` placeholders intact) and the file is complete.

## CLI

```
vitetranslate-prepare-translation-table
```

Reads the `vitetranslate` config from `vite.config.js` in the current working directory, scans `srcDir` for `_%_..._%_` markers, and syncs every JSON file in `localeDir`: adds new keys, removes stale ones (carrying over translations when a key was only renamed), and reports what's left untranslated. Intended to run as a `prebuild` step.

## Plugin options (`vitetranslate(options)`)

| Option            | Type      | Default                | Description                                                             |
| ------------------ | --------- | ----------------------- | ------------------------------------------------------------------------- |
| `localeDir`         | `string`  | *required*               | Folder with the language JSON files, relative to `baseDir`               |
| `defaultLanguage`   | `string`  | *required*               | BCP 47 tag of the default/source language                                |
| `baseDir`           | `string`  | `process.cwd()`          | Project root used to resolve `localeDir`/`srcDir`                        |
| `srcDir`            | `string`  | `"src"`                  | Source folder scanned by the CLI                                         |
| `includeFallback`   | `boolean` | `!isProduction` (auto)   | Embed the original text as a fallback in the compiled marker (dev only by default) |

## How it works

1. A Babel plugin (used both by the Vite transform and the CLI) finds strings wrapped in `_%_..._%_`, computes a stable id (`<filename>_<hash>`), and rewrites them to a compiled marker `_<_id_/_fallback_>_` (dev) or `_<_id_>_` (build).
2. At runtime, `<Translate>`/`useTranslateString()` look up that id in the current language table, falling back to the embedded fallback (or the raw key) if missing.
3. A virtual module (`virtual:vitetranslate/languages`) lists every `localeDir/*.json` file as a lazily-imported chunk; `TranslateContainer` loads the requested one on demand and exposes it via React context.

## Known limitations

- Ids are derived from the file's basename only, not its full path — two files sharing a basename (e.g. two `index.jsx` in different folders) share the same id namespace.
- The CLI expects a plain-object default export in `vite.config.js` (not a function-based config) and only looks for `vite.config.js` (not `.ts`/`.mjs`).
- `<Translate>`'s HTML subset relies on `DOMParser`, so it requires a browser-like environment (no SSR support out of the box).

## Project structure

```
lib/
├── react/              # React runtime: TranslateContainer, Translate, hooks
├── dev/
│   ├── babel/           # Babel plugin: marker extraction and compilation
│   └── vite/            # Vite plugin, CLI, JSON sync logic
├── dist/                # Built output (generated, do not edit)
└── index.js             # Plugin entry point
```

## Playground

A runnable example lives in [`playground/`](playground):

```bash
npm run playground         # vite dev
npm run playground:build   # vite build
```

## License

UNLICENSED — see [`package.json`](package.json).
