# The viteTranslate site

What is published at [sepoina.github.io/viteTranslate](https://sepoina.github.io/viteTranslate/): a landing page
plus one page per demo, each a Vite project of its own.

| Folder | URL |
| :- | :- |
| [`landing/`](landing) | `/viteTranslate/` — one card per page, translated with viteTranslate |
| [`pages/playground/`](pages/playground) | `/viteTranslate/playground/` |
| [`pages/playEdge/`](pages/playEdge) | `/viteTranslate/edge/` |
| [`pages/llmRestaurant/`](pages/llmRestaurant) | `/viteTranslate/llmrestaurant/` |
| [`pages/docs/`](pages/docs) | `/viteTranslate/docs/` — the user manual (no card, no zip) |

## Run

```bash
npm install            # from the repo root: every folder here is a workspace
npm run site:preview   # build everything, then http://localhost:4173/viteTranslate/
npm run site:build     # the same build, without serving: output in site/dist
npm run site           # dev server of the landing only, port 3002
```

A single page in dev: `npm run dev -w site/pages/playground` (3000), `…/playEdge` (3001), `…/llmRestaurant` (3003), `npm run docs` for the manual (3004).

In `npm run site` the cards lead to the pages already built in `site/dist` (served at `/viteTranslate/…` by
[`landing/vite.config.js`](landing/vite.config.js)), so run `npm run site:build` first; without `site/dist` they
lead to the published site.

Each folder stays a project that installs and builds on its own; what changes between the
two situations is the `base` and where the links to the other pages point.

## The manual

The user manual is [`pages/docs/`](pages/docs): pages are `.mdx` files in `content/<section>/<page>.mdx`, in a small dialect that a local compiler ([`scripts/compileDocs.mjs`](pages/docs/scripts/compileDocs.mjs)) turns into JSX under `src/generated/` (ignored by git). Every sentence becomes a `<Trans>`, so the Italian version is made by viteTranslate itself. Anything the dialect does not list is a compile error with `file:line`.

- **Frontmatter:** `title`, `description`, `sources:` (the repo files the page describes; `file.json#key` for part of a JSON), optional `aliases:`.
- **Blocks:** `##` and `###` with a mandatory `{#id}`; paragraphs; lists (one line per item, one nesting level); callouts `> [!NOTE]` with paragraphs only; tables (`\|` for a literal bar); code fences with a language and optional `title="…"`; `![alt](img/x.png)` (PNG or WebP in `public/img`, size read from the file); `<Demo page="slug" anchor="id" />`.
- **Inline:** code, bold, italic, links: `/route#id`, `#id`, `site:slug#id`, `repo:path#id`, `https://…`. A code span cannot contain a backtick.
- **Special characters** in text (`{ } < > &`, `%s`, the marker delimiter) are emitted as values (`{K[n]}`), never as translatable text.

```bash
npm run docs              # dev server, port 3004
npm run docs:status       # pages whose sources changed since they were last read
npm run docs:seal -- llm/price   # after updating the page and reading the diff
npm run testRelease       # the release checks, the manual's among them
```

**Sources and lock.** `docs.lock.json` stores, per page, the hash of each source (line endings do not count) and every anchor ever published. A page is *stale* when a source changed; `seal` records the new state, one page at a time. Each source file carries a `DOCS-PAGE: route` comment pointing back. Anchors never leave the lock: a renamed or moved section needs an `aliases:` line (`route#old -> new`, also across two existing pages: the router follows `generated/aliases.json`). The static copies written at build time (`scripts/staticRoutes.mjs`) give every route its own `index.html` and every old route a redirect; they never overwrite a real page.

**Translation.** `pages/docs/locale/` is written by viteTranslate only. Never edit it by hand; the Italian table is filled with `cd site/pages/docs && npx vitetranslate --llm-translate it-IT` (try `--llm-dry-run` first).

## Release checks

`npm run testRelease` ([`test/testRelease.mjs`](../test/testRelease.mjs)) runs every `test/release/*.check.mjs` in name order and prints one table: `suite` (`npm test`), `theme`, `demos`, `readme` (size rule of AGENTS.md), `runtime-size` (runs `estimateSize`, which rewrites `site/runtimeSize.json`) and `docs`: it compiles the manual and runs eight checks (stale pages, `DOCS-PAGE` pointers, API coverage, published anchors, links into the manual, links to migrated files, `TODO(links)`, translation status). `--only <word>` runs the checks whose name has it. A check is a file exporting `name` and `run()` that returns `{ level: "ok" | "warn" | "ko", lines }`. Exit code 1 on any KO.

## Theme

`site/theme/` is the theme: tokens, CSS, the top bar, language and theme switches, code blocks, the logo.
Each project gets a copy in `src/theme/` (`npm run site:theme`; `site:build` and `estimateSize` do it too).
Never edit a copy.

Why a copy: a page must build on its own (StackBlitz zip, a folder downloaded from GitHub).

`tokens.css` is the only file with colors. The site test fails on a color written elsewhere, on a copy that
differs, or on a text/background pair below 4.5:1 (3:1 for `--dim` and `--mark-n`, kept for large text and symbols)
— so a rebrand is one file and a test run.

Titles use `--display` (Alfa Slab One), which has no Chinese or Japanese glyphs. Give them `font-weight: 700` and
`font-synthesis: none`: Latin stays as drawn, and the system CJK fallback comes out bold.

Working on the theme with a dev server open: `node site/syncTheme.mjs --watch` in a second terminal.

Need something dark on a light page (like the source panel of the edge page)? Put `data-theme="dark"` on it: its whole
subtree keeps the dark tokens.

## The video in the hero

[`landing/src/HeroVideo.jsx`](landing/src/HeroVideo.jsx) closes the hero with a full-width band: a poster ([`landing/public/video/poster.webp`](landing/public/video/poster.webp), ~95 kB) that opens YouTube
in a new tab. No embedded player, on purpose: the embed sometimes answers "Sign in to confirm you're not a bot"
(YouTube's own check on IP and session, nothing a page can work around).

- **New video:** change `VIDEO_ID` in [`landing/src/links.js`](landing/src/links.js), and the same id everywhere its
  LINKED-DATA comment points (root README, extension, launcher, demos).
- **New poster:** 1280 px wide WebP, about 100 kB. The band around it has its own `--video-*` tokens and stays dark
  in both themes (`data-theme="dark"`), like the poster.

## Cards: Source, StackBlitz, Zip

The landing has two rows of cards: the site pages right under the hero (a click opens the page) and, at the
bottom, a sliding gallery of the projects in [`demo/`](../demo) (a click opens StackBlitz; the background tells
the Vite version, the big glyph what the demo is about). Every card ends with the same three buttons:

- **Source** — the folder on GitHub.
- **StackBlitz** — `stackblitz.com/github/sepoina/viteTranslate/tree/main/<folder>`: StackBlitz reads the folder
  straight from GitHub's `main`, so it shows the code as it is now, not as it was at the last site build.
- **Zip** — `site:build` writes one per page to `site/dist/zip/<slug>.zip` and one per demo to
  `site/dist/zip/demo/<slug>.zip`. The folder as it is: it installs from npm, so no `node_modules`, no `dist`,
  no lockfile, and never a `.env` (only `.env.example`). Written by [`zip.mjs`](zip.mjs), no dependency; the same
  content gives the same bytes.

Both StackBlitz and the zip see the folder alone: the test fails on an import that leaves it, and on a project
without `src/App.jsx` (the file StackBlitz opens).

## Add a page

1. Create `site/pages/<folder>/` with a Vite project, and put in its `package.json`
   `"vitetranslateSite": { "slug": "<slug>", "theme": true }` (`slug`: `a-z`, `0-9`, `-`; `theme` only if the page
   uses the site theme; `"card": false` for a page without a landing card and without a zip, like the manual). That field is what makes it a page.
2. Add its card to [`landing/src/pages.js`](landing/src/pages.js) and translate the two new sentences.
3. Copy [`landing/src/siteLinks.js`](landing/src/siteLinks.js) into the page's `src/` if it links back to the site.
4. If it uses the theme: `import "./theme/theme.css"` in `main.jsx`, and `<SiteBar>` for the top bar.

`test/list/site.test.mjs` checks that the slugs and the cards are the same set and that the copies of
`siteLinks.js` are identical. `npm run sync:demos` keeps every `@sepoina/vitetranslate` range aligned.

A new folder in `demo/<Vite_N>/` needs its card too: add it to `DEMOS` in the same file (the test fails without),
with a `slug` for its zip, a `stack` label like `Vite 8 · React 19` and a `glyph`: one Unicode symbol, never an
emoji, that says what the demo is about. The background colour comes from the folder (`Vite_8`, `Vite_7`): a new
Vite version needs its two `--viteN-*` tokens in [`theme/tokens.css`](theme/tokens.css) and its `data-vite` rule in
[`landing.css`](landing/src/landing.css).

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
