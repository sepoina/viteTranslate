# viteTranslate — custom markers demo · Vite 8 + React 19 (JS/JSX only)

The [`minimal`](../minimal) demo, with **your own delimiters**: strings are marked `≼like this≽`
instead of `_%_like this_%_`. Same three languages (`it-IT` source, `en-US`, `zh-CN`), same keys:
the key comes from the text inside, never from the delimiters.

```js
// vite.config.js
vitetranslate({
  localeDir: 'locale',
  sourceLanguage: 'it-IT',
  markerStart: '≼',
  markerEnd: '≽',
  autoWrap: true, // marked text between tags translates itself
});
```

[`src/App.jsx`](src/App.jsx) has **no `<Trans>` around its sentences**: you write `<p>≼like this≽</p>`, even with a
tag or a value in the middle (`≼version <b>{version}</b>≽`), and `autoWrap` does the rest. Same keys as the
`<Trans>` version, so no translation was touched. What is left: a list of texts kept as data
(`<Trans t={note} />`, the only `<Trans>` in the file), an attribute (`title={trans('≼…≽')}`) and, for contrast,
a `` trans`…` `` template, which needs no delimiters.

## Why ≼ and ≽

**≼ (U+227C, PRECEDES OR EQUAL TO)** and **≽ (U+227D, SUCCEEDS OR EQUAL TO)** are rare mathematical
symbols, picked on purpose: they never show up in real text, so a delimiter can't be mistaken for
punctuation. Any string that contains a delimiter without being wrapped by it raises a warning, and a
common character (`#`, `|`) would raise plenty. Two or more characters (`[[` and `]]`, say) work too, within the
[rules](../../../doc/plugin-options.md#markers).

### How do I type them?

Copy and paste, the system character map, or a VS Code user snippet (Command Palette →
*Snippets: Configure Snippets* → `javascriptreact.json`):

```json
{
  "Marker": {
    "prefix": "mk",
    "body": ["≼$1≽"],
    "description": "viteTranslate marker"
  }
}
```

The [VS Code extension](../../../doc/ide-panel.md) highlights your delimiters: it reads them from `vite.config.js`.

## Moving an existing project

Already marked with `_%_`? Change `vite.config.js`, then:

```bash
npx vtranslate-cli --rewriteMarkerDryRun   # what would change, and whether any key would
npx vtranslate-cli --rewriteMarker         # do it: all files or none
```

Only the delimiters are rewritten, never the text inside, and nothing is written unless every key
and every translation status stays the same. Details: [CLI](../../../doc/cli.md#rewriting-the-markers).

## Usage

```bash
npm install
npm run dev      # dev server
npm run build    # production build (Rolldown)
npm run preview  # preview the build
npm run lint     # ESLint
```

This folder is a member of the repo's npm workspaces: from the repo root it's
`npm run dev -w demo/Vite_8/customMarkers`. Copied out on its own, it installs exactly what it declares.

## Where to find the rest

- **Project page** — [github.com/sepoina/viteTranslate](https://github.com/sepoina/viteTranslate): README, API and [architecture](https://github.com/sepoina/viteTranslate/blob/main/doc/structure.md)
- **Live playground** — [sepoina.github.io/viteTranslate/playground](https://sepoina.github.io/viteTranslate/playground/), source in [`site/pages/playground/`](https://github.com/sepoina/viteTranslate/tree/main/site/pages/playground)
- **npm package** — [@sepoina/vitetranslate](https://www.npmjs.com/package/@sepoina/vitetranslate)
- **Buy me a coffee** ☕ — [buymeacoffee.com/giancarlogy](https://buymeacoffee.com/giancarlogy)
