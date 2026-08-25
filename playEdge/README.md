# viteTranslate — edge cases

One table, one case per row: what you write, what `<Translate>` renders, what it should render. It exists to pin down the edge behaviours in writing — malformed markers, `%s` without an argument, crossed markup, values that aren't text — right where prose docs go vague and unit tests don't show themselves.

**Live:** [sepoina.github.io/viteTranslate/edge/](https://sepoina.github.io/viteTranslate/edge/)
(from the playground: the "Edge case" entry in the index, or `?edge=true` on the playground URL)

Every case lives in [`src/testCases.jsx`](src/testCases.jsx), as a four-tuple
`[title, element, expected, source]`. The fourth item — the source shown when hovering the
`</>` icon — is written by hand rather than derived from the element: by the time the element
reaches the table, the transform has already rewritten the markers, and reconstructing it from
there would mean explaining the first mechanism by trusting the second.

## Why this isn't a playground page

The playground and this page are two separate Vite apps, and need to stay that way: the
virtual languages module has a single id, so **two `vitetranslate()` configs in the same build
don't coexist**. This page needs settings the playground doesn't, and vice versa:

| | playground | edge cases |
| --- | --- | --- |
| `errorSolve.mark` | defaults | all five switched on |
| `markOnlyDev` | default (`true`) | `false`: marks stay on in build too |
| initial language | `en-US` | `it-IT`, the source |
| language tables | the playground's own text | the edge cases, broken markers included |

If the edge cases ended up in the playground's `localeDir`, its tables would carry
deliberately malformed markers along with them, plus a sync warning on every build.

At publish time the two builds merge back together: this folder's `dist` gets copied into the
playground's `dist/edge/` (see
[`.github/workflows/deploy-playground.yml`](../.github/workflows/deploy-playground.yml)).

## Usage

From the repo root:

```bash
npm run build          # the library
npm run edge:install   # deps + the library's working tree in place of the npm one
npm run edge           # dev server on port 3001
npm run edge:build     # production build
```

`npm run edge:install` does two things: a normal `npm install`, then
`npm install .. --install-links --no-save`, which puts the library's working tree in
`node_modules` **without touching `package.json`**. The file keeps declaring the npm version,
so the folder stays importable on StackBlitz as-is — the same pair of commands CI runs.

With both dev servers up (`npm run playground` on 3000, `npm run edge` on 3001), the links
between the two pages work.

## Expected warnings

Two of them, and they're not bugs to "fix" — they're exactly the cases the table describes.

```text
[vitetranslate] nested markers in "src/testCases.jsx": "uno_%_ e _%_due" was read as a single text.
[vitetranslate] mis-nested markup: </b> closes across <i> in "<b>x <i>y</b> z</i>".
```

## The rest

- **Library** — [github.com/sepoina/viteTranslate](https://github.com/sepoina/viteTranslate), with the [architecture doc](../doc/structure.md)
- **Playground** — [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/)
- **npm** — [@sepoina/vitetranslate](https://www.npmjs.com/package/@sepoina/vitetranslate)
