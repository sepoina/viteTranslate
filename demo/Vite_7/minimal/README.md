# Vite 7 + React 18 (JS/JSX only)

Minimal setup, no TypeScript, ESLint 10 in flat config. It's the same app as the `Vite_8`
folder, ported to Vite's row 7 and to React 18 — the most likely combination in an existing
project, and also the minimum the library declares support for (`react: ^18.0.0 || ^19.0.0`).
The app's source is identical to the React 19 copy: nothing in the library's runtime requires
19.

## Usage

```bash
npm install
npm run dev      # dev server
npm run build    # production build (Rollup)
npm run preview  # preview the build
npm run lint     # ESLint
```

## What differs from the Vite 8 version

| | Vite 8 | Vite 7 |
| --- | --- | --- |
| build bundler | Rolldown | Rollup |
| dev pre-bundling | goes through the project's plugins | separate esbuild process |
| `react` / `react-dom` | `^19` | `^18` |
| `@vitejs/plugin-react` | `^6` | `^5` — 6 requires `vite ^8.0.0` |
| Rolldown packages | `rolldown`, `@rolldown/binding-wasm32-wasi` | not needed |

Nothing changes in the app code or in `vite.config.js` — the differences are all in
`package.json`.

Worth knowing why, though. On Vite 7, dependency pre-bundling runs in a separate esbuild
process that doesn't see the project's plugins, so it can't resolve
`virtual:vitetranslate/languages` — the id the plugin generates. Up to **2.2.1** the dev
server died on startup and needed a hand-written
`optimizeDeps: { exclude: ['@sepoina/vitetranslate'] }` here; from **2.2.2** the plugin
declares the exclusion itself, so the config is identical to the Vite 8 copy. On Vite 8 the
issue doesn't come up: there, the optimizer goes through the plugin container.

## StackBlitz

Import the zip from https://stackblitz.com (New project > Import).
Vite 7 uses Rollup and esbuild, both already available in WebContainer: no WASM binding to
install.
