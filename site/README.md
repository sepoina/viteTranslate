# The viteTranslate site

What is published at [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/): a landing page
plus one page per demo, each a Vite project of its own.

| Folder | URL |
| :- | :- |
| [`landing/`](landing) | `/viteTranslate/` — one card per page, translated with viteTranslate |
| [`pages/playground/`](pages/playground) | `/viteTranslate/playground/` |
| [`pages/playEdge/`](pages/playEdge) | `/viteTranslate/edge/` |
| [`pages/llmRestaurant/`](pages/llmRestaurant) | `/viteTranslate/llmrestaurant/` |

## Run

```bash
npm install            # from the repo root: every folder here is a workspace
npm run site:preview   # build everything, then http://localhost:4173/viteTranslate/
npm run site:build     # the same build, without serving: output in site/dist
npm run site           # dev server of the landing only, port 3002
```

A single page in dev: `npm run dev -w site/pages/playground` (3000), `…/playEdge` (3001), `…/llmRestaurant` (3003).

In `npm run site` the cards lead to the pages already built in `site/dist` (served at `/viteTranslate/…` by
[`landing/vite.config.js`](landing/vite.config.js)), so run `npm run site:build` first; without `site/dist` they
lead to the published site.

Each folder stays a project that installs and builds on its own; what changes between the
two situations is the `base` and where the links to the other pages point.

## Theme

`site/theme/` is the theme: tokens, CSS, the top bar, language and theme switches, code blocks, the logo.
Each project gets a copy in `src/theme/` (`npm run site:theme`; `site:build` and `estimateSize` do it too).
Never edit a copy.

Why a copy: a page must build on its own (StackBlitz zip, a folder downloaded from GitHub).

`tokens.css` is the only file with colors. The site test fails on a color written elsewhere, on a copy that
differs, or on a text/background pair below 4.5:1 — so a rebrand is one file and a test run.

Working on the theme with a dev server open: `node site/syncTheme.mjs --watch` in a second terminal.

Need something dark on a light page (like the source panel of the edge page)? Put `data-theme="dark"` on it: its whole
subtree keeps the dark tokens.

## StackBlitz zips

`site:build` also writes one zip per page to `site/dist/zip/<slug>.zip` (published at `/viteTranslate/zip/<slug>.zip`),
linked from the cards of the landing. Each is the page's folder as it is, ready to import on
[stackblitz.com](https://stackblitz.com): it installs from npm, so no `node_modules`, no `dist`, no lockfile, and never
a `.env` (only `.env.example`). Written by [`zip.mjs`](zip.mjs), with no dependency; the same content gives the same bytes.

## Add a page

1. Create `site/pages/<folder>/` with a Vite project, and put in its `package.json`
   `"vitetranslateSite": { "slug": "<slug>", "theme": true }` (`slug`: `a-z`, `0-9`, `-`; `theme` only if the page
   uses the site theme). That field is what makes it a page.
2. Add its card to [`landing/src/pages.js`](landing/src/pages.js) and translate the two new sentences.
3. Copy [`landing/src/siteLinks.js`](landing/src/siteLinks.js) into the page's `src/` if it links back to the site.
4. If it uses the theme: `import "./theme/theme.css"` in `main.jsx`, and `<SiteBar>` for the top bar.

`test/list/site.test.mjs` checks that the slugs and the cards are the same set and that the copies of
`siteLinks.js` are identical. `npm run sync:demos` keeps every `@sepoina/vitetranslate` range aligned.

## Card previews

The landing's demo cards show a screenshot of each page, dark theme, captured with headless Chrome:

```bash
google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --blink-settings=preferredColorScheme=0 --window-size=1280,800 --virtual-time-budget=4000 \
  --screenshot=playground.png http://localhost:4173/viteTranslate/playground/
magick playground.png -resize 960x600 -quality 82 landing/public/previews/playground.webp
```

## Why `VITE_SITE_ROOT`

A page must work when downloaded alone, so it can't import anything from outside its folder — `test/list/site.test.mjs`
checks it. Its links to the rest of the site go through `src/siteLinks.js`: `site/build.mjs` sets `VITE_SITE_ROOT`
(`/viteTranslate/`, or `--root=/name/` for a fork), and without it the links point at the published site. So in
`npm run dev` they lead to the live site; `npm run site:preview` shows the whole thing locally.

Landing and pages are separate builds because two `vitetranslate()` configurations can't share one build
(the virtual language module has a single id).
