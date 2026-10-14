> [!NOTE]
> **For the human reviewer**
>
> - A new site page `site/pages/docs` (URL `/viteTranslate/docs/`): the user manual, three columns (navigation, content, "On this page"), built on the site theme.
> - Pages are written in `.mdx` with a small in-house dialect (Markdown subset plus a closed list of components). No MDX engine, no new dependency.
> - A local compiler turns each `.mdx` into a JSX file on disk. Every paragraph becomes a `<Trans>`: English is the source, Italian comes only from viteTranslate (`--llm-translate`).
> - The manual becomes the single source of truth for user docs. `doc/*.md` for users become redirect stubs, and every link in the repo moves to the manual. `structure.md` and the other deep-dive files stay in `doc/`.
> - Code ↔ page association: each page declares its `sources:`, a lock file stores their hashes, and code files carry a `DOCS-PAGE:` pointer back. Stale pages, uncovered public API and broken or vanished anchors are all reported.
> - A new `npm run testRelease` collects every release check (suite, theme, demos, README size, runtime size, docs). It does not block `site:build`.
> - Landing: a "Docs" entry in the menu and the call-to-action button of the footer band, no card.
> - Out of scope, moved to the TODO: search, content prerender (SSR), removal of the stubs.

> [!TIP]
> **Decisions along the way**
>
> - In text, `{ } < > &`, `%s` and the marker delimiter are emitted as values of `K` (`{K[n]}`); headings are marked strings with `%s` / `<code>%s</code>` and `a`; the compiler emits a `<Heading>` component.
> - A source may be `file.json#key` (hash of that subtree only). The editorial rule (present tense, a `> [!NOTE]` for upgraders) and the `TODO(links)` WARN are in AGENTS.md; a `doc/x.md` becomes a stub when fully migrated.
> - Anchor aliases work between two existing pages: `aliases.json` and a router redirect with `replaceState`; the static copies never overwrite a real page.
> - Images: PNG or WebP only, width and height read from the header (other formats fail the compile).
> - Landing: "Docs" in the menu, and `Outro` already carried the call to action, so no extra sentence; `DOCS` left `links.js`.
> - `npm run testRelease`: six checks (the docs one runs eight), including `estimateSize`; `npm test` all green: the 3 Windows KOs were test bugs (platform not forced, log wrapped by long temp paths), fixed after the plan.
> - Demos got `DOCS-PAGE:` comments, except `quickApp/src/App.jsx` (the video films it).

> [!IMPORTANT]
> The Italian manual is **not** translated: 1186 keys at 0%, the docs check stays WARN until the user runs `cd site/pages/docs && npx vitetranslate --llm-translate it-IT` (dry-run first). One session reverted `site/landing/src/links.js` with `git checkout` and lost the uncommitted video block; it was rebuilt by hand, hence the new AGENTS.md rule on git.

# Manual v1 — the viteTranslate docs site

## How to read this plan

- This plan is written for an implementer who follows it literally. When the plan and the code disagree, **stop and ask the user** (AGENTS.md: the plan is the source of truth, contradictions become questions).
- The seven phases of AGENTS.md are mandatory and in order: 1 Implementation, 2 Test, 3 Build, 4 Review, 5 Documentation, 6 Cleanup, 7 LogDiary. Phase 1 is split into steps (1.0 … 1.12). Do not skip ahead.
- Side documents live next to this file: `manual_v1.necessarytest.md` (tests to write in phase 2), `manual_v1.necessarydoc.md` (doc edits for phase 5), `manual_v1.necessaryreview.md` (only if phase 4 finds an architectural problem).
- **Never run `git commit`.** At the end of each phase, give the user the list of paths to `git add` and a commit message (memory rule).
- Code comments in Italian, like the surrounding code. UI text, `.mdx` content and documents in English.
- Windows: files may be CRLF. Edit with the Edit tool or CRLF-aware node scripts, never `sed -i` from Git Bash. Every hash in this plan is computed on text **normalised to LF**.
- The suite is green on Windows too (the 3 historical KOs were test bugs, fixed): any KO is yours.

## Decisions already taken (closed, do not reopen)

| # | Decision |
| :- | :- |
| D1 | Plan folder: `doc/ImplementationPlans/docs/`. |
| D2 | In-house MDX dialect, only as much as the manual needs. No `@mdx-js`, no markdown library. |
| D3 | The manual is the source of truth for user documentation. Code informs the pages directly (via `sources:`). `doc/` keeps only deep-dive files (`structure.md` and similar). |
| D4 | Languages: English is the source language (`en-US`), Italian (`it-IT`) is the first translation. Agents write English only. Other languages come only through viteTranslate (`--llm-translate`), run by the user. More languages later. |
| D5 | Untranslated paragraphs show the English source with **no mark** in production (`markOnlyDev` keeps its default `true`). |
| D6 | All links in the repo move to the manual. The migrated `doc/*.md` become provisional stubs that point to the exact new sections. |
| D7 | Landing: "Docs" entry in the menu and a link inside one section's text. **No card.** |
| D8 | Search: not in v1 (TODO). |
| D9 | `npm run testRelease` collects all release checks. It never blocks `site:build`. |
| D10 | Links must reach exact sections: explicit heading ids, published anchors never disappear (aliases for renames). |

## Facts verified on 2026-10-14 (re-check before starting)

- `site/pages/*` are standalone Vite projects. A page is any folder whose `package.json` has `vitetranslateSite.slug` (`site/build.mjs`, `sitePages`). `theme: true` gets a copy of `site/theme/` in `src/theme/` (`site/syncTheme.mjs`).
- `test/list/site.test.mjs` checks: (1) the exact list of slugs, (2) card slugs equal page slugs, (8) the exact list of theme targets, (10) no hand-written color outside `tokens.css`, (12) no relative import leaves a page folder.
- `site/build.mjs` builds each page with `npm run build -- --base=<root><slug>/` and `VITE_SITE_ROOT` set, then copies `dist` into `site/dist/<slug>/`. It also writes one zip per page (`zipPages`).
- Ports: playground 3000, edge 3001, landing 3002, llmRestaurant 3003. **Docs gets 3004.**
- All existing site projects use `sourceLanguage: "it-IT"`. The theme has two marked Italian strings, both aria-labels: `LanguageSwitch.jsx` ("Lingua della pagina") and `ThemeToggle.jsx` ("Cambia tema").
- `<Trans>` accepts JSX children (macro, 4.6.4+): tags **without** attributes (`<b> <strong> <i> <em> <u> <small> <code> <br>`) are formatting the translator sees, tags **with** attributes become `<n>…</n>` (content translatable, attributes stay in code), elements **without content** become a value `{n}` the translator cannot touch. Any expression `{…}` that is not an identifier becomes a positional value.
- A literal `{name}`-like text triggers ICU parsing. A marker delimiter `_%_` written anywhere in a source file (strings included) is extracted as a sentence. `site/theme/Code.jsx` works around it by composing the delimiter at runtime (`M = ["_","%","_"].join("")`).
- Language tables load per language, not per page: the whole Italian manual is one lazy chunk. The English source text ships in the main bundle.
- The vitetranslate sync runs when the Vite config is loaded ("auto-sync at config time"), and the CLI (`npx vitetranslate …`) loads the same `vite.config.js`.
- Links into migrated docs exist today in: `README.md`, `idePlugin/README.md`, `idePlugin/src/webViews/optional/help/helpPage.mjs` (`LLM_DOC_URL`), `idePlugin/src/core/syncCommand.mjs` (comment), `lib/dev/llm/llmOptions.js` (an error message and a comment), `launcher/README.md`, `demo/Vite_8/*/README.md`, `demo/Vite_8/customMarkers/vite.config.js`, `demo/Vite_8/llmTranslate/src/App.jsx`, `site/landing/src/Compare.jsx`. Re-run the grep of step 1.10 to get the current list.

## Target architecture

```text
site/pages/docs/
├── package.json            vitetranslateSite: { slug: "docs", theme: true, card: false }
├── index.html
├── vite.config.js          calls compileDocs() at load time, then react() + vitetranslate()
├── docs.lock.json          sources hashes per page + published anchors (written by docs:seal)
├── content/                THE SOURCE OF TRUTH — one .mdx per page
│   ├── getting-started/overview.mdx …
│   └── …
├── public/img/             images used by pages
├── scripts/
│   └── compileDocs.mjs     the in-house compiler (node only, no dependency)
├── locale/                 en-US.yml (source), it-IT.yml
└── src/
    ├── main.jsx            theme boot, TranslateContainer, <App/>
    ├── App.jsx             router + layout
    ├── nav.js              the left column: groups, order, external links
    ├── ui/                 the closed component list used by generated pages
    │   ├── Callout.jsx  CodeBlock.jsx  InlineCode.jsx  DocLink.jsx  Demo.jsx  Figure.jsx  index.js
    ├── layout/
    │   ├── Sidebar.jsx  Toc.jsx  PageNav.jsx  router.js
    ├── docs.css            var(--…) only
    ├── siteLanguage.js     identical copy (as in other pages)
    ├── siteLinks.js        identical copy
    ├── theme/              copy, written by npm run site:theme — never edit
    └── generated/          written by compileDocs — gitignored, never edit
        ├── pages/<section>/<page>.jsx
        └── routes.js  routes.json
```

Root side (outside the page, so the page stays standalone):

```text
site/docsSources.mjs        status / seal / checks on sources, coverage, anchors, links
test/testRelease.mjs        runs every test/release/*.check.mjs and prints one table
test/release/*.check.mjs    one check per file
```

### URLs

- Page: `https://sepoina.github.io/viteTranslate/docs/<section>/<page>/` — e.g. `/docs/llm/price/`.
- Section: same plus `#<id>` — e.g. `/docs/llm/price/#budget-caps`.
- `<route>` = `<section>/<page>`, the path of the `.mdx` under `content/` without extension. Lowercase `a-z0-9-`, one slash.
- The docs root `/docs/` shows `getting-started/overview`.
- Language is **not** in the URL: as in the rest of the site, it comes from the stored site language (`siteLanguage.js`), falling back to `en-US`.

## The `.mdx` dialect (normative)

Anything not listed here is a **compile error** with `file:line` and a one-line reason. Strict on purpose: the same standard for every page, no injected CSS, no free HTML.

### Frontmatter (required)

```text
---
title: Price
description: What a run costs, and the caps that keep it there.
sources:
  - lib/dev/llm/costModel.js
  - lib/dev/llm/budgetGuard.js
aliases:
  - llm/costs
  - llm/costs#budget -> budget-caps
---
```

- `title` (required, plain text, no markdown). It is the sidebar label, the `<title>`, and the `<h1>`.
- `description` (required, plain text, one sentence). Shown under the `<h1>` and as `<meta name="description">`.
- `sources` (required, at least one): repo-relative paths of files that define what the page describes. They must exist. No globs.
- `aliases` (optional): old addresses that must keep working. `route` = an old page route that redirects here. `route#old -> new` = an old anchor that now lives at `#new` on this page; `route` may be a page that still exists (a section moved between two pages): the router follows `src/generated/aliases.json` (see `site/README.md`, "The manual").
- Parser: line based. `key: value` for scalars, `key:` followed by `  - item` lines for lists. Nothing else is accepted (no nested maps, no quotes needed, no multiline values).

### Blocks

| Source | Output | Notes |
| :- | :- | :- |
| `## Text {#id}` | `<h2 id>` | `{#id}` **mandatory**, `[a-z0-9-]+`, unique in the page. Text: plain + inline code only. |
| `### Text {#id}` | `<h3 id>` | Same. `#`, `####` and deeper are errors (the h1 comes from `title`). |
| paragraph | `<p><Trans>…</Trans></p>` | Consecutive non-blank lines, joined with one space. |
| `- item` / `1. item` | `<ul>`/`<ol>` with `<li><Trans>…</Trans></li>` | One nesting level allowed: two spaces + `- `. A list item is one line (no continuation lines). |
| `> [!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` then `> text` lines | `<Callout kind>` with one `<Trans>` per paragraph | GitHub alert syntax, so the files read well on GitHub too. |
| `> text` (no alert marker) | `<Callout kind="aside">` | For the existing "🧪 / 🎮 live" lines. |
| ```` ```lang title="file.js" ```` … ```` ``` ```` | `<CodeBlock lang title code={K[n]} />` | `lang` ∈ `jsx js ts tsx yaml sh bash json text` or empty (= `text`). `title` optional. Never translated. |
| GFM table | `<table>` with `<th>`/`<td><Trans>…</Trans></td>` | Header row + `:-` separator + rows. Alignment ignored. Empty cell → empty `<td/>`. |
| `![alt](img/name.png)` alone on a line | `<Figure src alt>` | File must exist in `public/img/`, PNG or WebP: the compiler reads width and height from the header and emits them. `alt` translated. |
| `<Demo page="playground" anchor="markup" />` alone on a line | `<Demo>` card to a live page | `page` ∈ site slugs, `anchor` optional. The only JSX tag allowed in v1. |
| `<!-- … -->` | dropped | For notes and LINKED-DATA comments. |
| anything else (raw HTML, `---` rules, h1, h4, nested blockquotes…) | **error** | |

### Inline (inside paragraphs, list items, table cells, callouts, alt text)

| Source | Emitted inside `<Trans>` | Translator sees |
| :- | :- | :- |
| `**bold**` | `<b>bold</b>` | `<b>bold</b>` |
| `*italic*` (asterisk only) | `<i>italic</i>` | `<i>italic</i>` |
| `` `code` `` | `<InlineCode v={K[n]} />` | `{n}`: a value, never translated |
| `[text](/section/page#id)` | `<DocLink to="/section/page#id">text</DocLink>` | `<n>text</n>` |
| `[text](#id)` | `<DocLink to="#id">text</DocLink>` | same |
| `[text](site:playground#markup)` | `<DocLink to="site:playground#markup">text</DocLink>` | same |
| `[text](repo:doc/structure.md#phase-4)` | `<DocLink to="repo:…">text</DocLink>` | same |
| `[text](https://…)` | `<DocLink to="https://…">text</DocLink>` | same |
| `{` `}` `<` `>` `&` `%s` and the marker delimiter in plain text | `{K[n]}`: each occurrence is a slot of `K` | `{n}`: a value, never translated |

- `_underscore_` emphasis is **not** supported (it would collide with identifiers and the delimiter).
- Link targets are validated at compile time: internal routes and `#id` must exist, `site:` slugs must exist, `repo:` paths must exist on disk (anchors inside repo files are not checked).

### What the compiler emits (example)

Input `content/llm/price.mdx` (body excerpt):

```mdx
## Budget caps {#budget-caps}

A run stops when it would pass `maxCostPerRun`. See [the estimate](#the-estimate).
```

Output `src/generated/pages/llm/price.jsx`:

```jsx
// GENERATO da scripts/compileDocs.mjs a partire da content/llm/price.mdx: non modificare.
import { Trans } from "@sepoina/vitetranslate/react";
import { CodeBlock, InlineCode, DocLink, Callout, Demo, Figure } from "../../../ui/index.js";

// Il delimitatore composto a runtime: scritto per intero verrebbe estratto come frase.
const M = ["_", "%", "_"].join("");
// Il codice della pagina (blocchi e codice in linea): mai tradotto.
const K = [`maxCostPerRun`];

export const meta = {
  route: "llm/price",
  title: "_%_Price_%_",
  description: "_%_What a run costs, and the caps that keep it there._%_",
  source: "site/pages/docs/content/llm/price.mdx",
  headings: [{ id: "budget-caps", depth: 2, title: "_%_Budget caps_%_" }],
};

export default function Page() {
  return (
    <>
      <h2 id="budget-caps"><Trans t={meta.headings[0].title} /></h2>
      <p><Trans>A run stops when it would pass <InlineCode v={K[0]} />. See <DocLink to="#the-estimate">the estimate</DocLink>.</Trans></p>
    </>
  );
}
```

Emission rules:

- Every `<Trans>…</Trans>` on **one line** (JSX whitespace rules: a line break between text and a tag is no space).
- Code strings (`K`) are template literals. Before emitting, escape `` ` `` and `\` and `${`, and replace every marker delimiter with `${M}`. So the delimiter never appears literally in the generated file.
- Prose: every special sequence (`{ } < > &`, `%s`, the marker delimiter) is emitted as `{K[n]}`, one `K` slot per occurrence (or reuse the slot of an identical string). **Never** as a `{"…"}` expression: step 1.0 showed that `{"%s"}` makes the macro leave the whole `<Trans>` untranslated, and that `{"{"}`/`{"<"}`/`{"&"}` put HTML entities in the table, which a translation could decode and so break the markup. A `K` value is an opaque `{n}` for the translator. One rule, one branch in the compiler.
- Headings: the title goes in `meta.headings` as a marked string, with an optional `a` array. Every inline code span and every special sequence in a heading becomes `%s` (a code span: `<code>%s</code>`) and its text goes in `a`, as `K` slots: `{ id, depth, title: "_%_Write JSX inside <code>%s</code>_%_", a: [K[3]] }`. Same rule as in the body (opaque values; verified by a spike: `## `<Translate>`` and `## Mixing `%s`` need it). The `<h2>` and the TOC use the same entry, so one key: `<Trans t={h.title} a={h.a} />`.
- `title` and `description` from the frontmatter are marked strings in `meta`, the same way.
- `routes.js`: `import * as p0 from "./pages/llm/price.jsx"` … and `export const ROUTES = { "llm/price": p0, … }`. Eager imports: the text lives in the language table anyway, so lazy pages would save almost nothing.
- `routes.json`: `[{ route, title (plain English), description, ids: [...], aliases: [...] }]`. Used by `vite.config.js` (static HTML per route) and by the root checks.
- Write a file only if its content changed (so Vite and the sync do not see false changes). Delete generated files whose `.mdx` no longer exists.

## Phase 1 — Implementation

### Step 1.0 — Spike: does the macro accept what we will generate? (go/no-go)

Before writing the compiler, prove the emission patterns on a throwaway copy:

1. Copy `site/pages/playEdge` to a scratch folder outside the repo (scratchpad). In its `src/`, add one file with:
   - `<Trans>Text with <InlineCode v={K[0]} /> and <DocLink to="/a#b">a link</DocLink> and <b>bold</b>.</Trans>`, where `InlineCode` and `DocLink` are dummy components;
   - `<Trans>Braces {K[1]}x{K[2]} and {K[3]}tag{K[4]} and {K[5]} stay literal.</Trans>`, with `K = ["{", "}", "<", ">", "%s", …]` (the form decided after the first run: see `manual_v1.necessaryreview.md`);
   - `<Trans t={meta.headings[0].title} />` with `meta` as in the example above, title containing `<code>llm</code>`;
   - a `const K = [\`${M}hi${M}\`]` line (the delimiter composed at runtime).
2. Run `npx vitetranslate --status` in the scratch folder, then `npx vite build`.
3. Expected: in the source table (`locale/it-IT.yml` there), one entry per `<Trans>` with `<1>a link</1>`-style numbered tags and `{0}`-style values. **No entry** for the `K` string. No `malformed`/`collision` warnings. The build renders the literals `{x}`, `<tag>` and `%s` as text.
4. If any expectation fails: **stop**. Write `manual_v1.necessaryreview.md` with what you saw and ask the user. Do not invent another emission scheme.

### Step 1.1 — The page skeleton

1. Create `site/pages/docs/package.json` modelled on `site/pages/playEdge/package.json`: name `site-docs`, `"vitetranslateSite": { "slug": "docs", "theme": true, "card": false }`, scripts `dev`, `build`, `preview`, plus `"compile": "node scripts/compileDocs.mjs"`. Same dependency versions as playEdge (minus eslint). `npm run sync:demos` keeps the `@sepoina/vitetranslate` range aligned.
2. `index.html` like playEdge's (title "viteTranslate docs", `<div id="root">`).
3. `.gitignore` (root): add `site/pages/docs/src/generated/`.
4. `vite.config.js`:
   - at the top, `import { compileDocs, watchDocs } from "./scripts/compileDocs.mjs";` then `compileDocs();`. It runs every time the config is loaded (dev, build and the vitetranslate CLI), so the generated files always exist before the sync scans `src/`.
   - plugins: `react()`, `vitetranslate({ localeDir: "locale", sourceLanguage: "en-US", errorSolve: { warningBuild: false }, llm: <copy the llm block of site/pages/playground/vite.config.js> })`. No `autoWrap`, no `preloadedLanguages`.
   - a local plugin `docsRoutes()`: in `configureServer`, call `watchDocs()` (recompiles on `content/` changes); in `closeBundle` (build only), write the static copies described in step 1.8.
   - `resolve.dedupe: ['react','react-dom']`, `server.port: 3004`, comment listing the five ports.
5. `src/main.jsx` as playEdge's: `applySavedTheme()`, `TranslateContainer initialLanguage={pickLanguage(languages, 'en-US')}`, `<RememberLanguage/>`, `<App/>`, `import './theme/theme.css'` then `import './docs.css'`.
6. Copy `siteLanguage.js` and `siteLinks.js` from `site/landing/src/` (identical copies, the test checks them).
7. `npm run site:theme`, then `npm install` from the root (workspaces).
8. Theme aria-labels (fact above): add two optional props to `site/theme/SiteBar.jsx`, `languageLabel` and `themeLabel`, passed down to `LanguageSwitch` and `ThemeToggle` (prop `label`). When absent, the components keep their current Italian marked strings. Docs passes English marked strings (`"_%_Page language_%_"`, `"_%_Switch theme_%_"`). Edit only `site/theme/`, then `npm run site:theme`.

### Step 1.2 — The compiler `scripts/compileDocs.mjs`

Node only, no dependency, no import outside the page folder. Exports:

- `parseMdx(text, file)` → `{ front, blocks }` or throws `Error("content/x.mdx:12: <reason>")`. Normalise CRLF to LF first.
- `emitPage(parsed, route)` → JSX string (rules above).
- `compileDocs({ root = <page folder> } = {})` → reads `content/**/*.mdx` (and `src/nav.js` routes, see step 1.5), validates everything, writes `src/generated/`, returns `{ routes, errors }`. If there are errors, print all of them and throw once (do not stop at the first one).
- `watchDocs()` → `fs.watch(content, { recursive: true })` with a 100 ms debounce, calling `compileDocs()`. On error, print and keep watching.
- `slugOk(id)`, `escapeCode(s)`, `splitProse(s, slot)`: small helpers, exported for tests. `splitProse` cuts plain text at every special sequence, calls `slot(sequence)` (it puts the text in `K` and returns `"K[n]"`) and returns the JSX string (text and `{K[n]}`). Also exported for the root checks: `collectLinks(blocks)`, `pageIds(blocks)`, `parseInline`.

Validation list (each one a test case in phase 2): missing or extra frontmatter key; empty `sources`; source file missing (path resolved from the repo root, `../../..`); heading without `{#id}`; duplicate id; h1/h4; unknown block; unknown fence lang; unknown component or attribute; internal link to a missing route or id; `site:` unknown slug (read `../*/package.json`); `repo:` path missing; image missing; alias pointing to an id that does not exist on this page; two pages claiming the same alias; a page not in `nav.js` or a nav route without a page.

Size guide: around 400 lines. Keep parsing and emission as separate functions: the root checks reuse `parseMdx`.

### Step 1.3 — The UI components `src/ui/`

The closed list. Each one is small, with no `style` prop and no `className` prop exposed to pages.

- `CodeBlock({ lang, title, code })`: wraps `theme/Code.jsx` (`<Code code lang title />`) and adds a copy button (`navigator.clipboard.writeText`, label via `useTrans` "_%_Copy_%_" / "_%_Copied_%_"). Map `ts`/`tsx` → `jsx` and `json` → `text` before calling `Code`. Do **not** edit `Code.jsx` for this.
- `InlineCode({ v })` → `<code className="ic">{v}</code>`.
- `DocLink({ to, children })`: resolves `to`.
  - `/route#id` → `${BASE_URL}route/#id`, click intercepted by the router (`navigate`).
  - `#id` → same page.
  - `site:slug#a` → `siteUrl(slug) + '#a'`.
  - `repo:path#a` → `https://github.com/sepoina/viteTranslate/blob/main/path#a`.
  - `https://…` → as is, `target="_blank" rel="noopener"`, with a small ↗.
- `Callout({ kind, children })`: `<aside className={"callout callout-" + kind}>` with a visible label ("_%_Note_%_", "_%_Tip_%_", "_%_Important_%_", "_%_Warning_%_", "_%_Caution_%_"). For `aside`, no label.
- `Demo({ page, anchor })`: a link card to `siteUrl(page)#anchor` with the page name and "_%_Open live_%_ ↗".
- `Figure({ src, alt, width, height })`: `<figure><img src={BASE_URL + src} alt={alt} width height loading="lazy" /></figure>`.
- `index.js` re-exports them.

### Step 1.4 — Router `src/layout/router.js`

- `currentRoute()`: `location.pathname` minus `import.meta.env.BASE_URL`, trailing slash removed. `""` → `"getting-started/overview"`.
- `navigate(to)`: `history.pushState`, notify subscribers, then scroll to the `#id` (or to the top when there is none).
- `useRoute()`: a hook on `popstate` + subscribers.
- After every route change and on first load: if `location.hash` exists, `document.getElementById(id)?.scrollIntoView()` after render (the same trick as playEdge's `App.jsx`).
- Headings get `scroll-margin-top` equal to the bar height (CSS), so an anchor never ends up under the sticky bar.

### Step 1.5 — Navigation `src/nav.js`

```js
// La colonna di sinistra del manuale: gruppi, ordine e link esterni. Le etichette delle pagine
// sono i loro `title` (frontmatter); qui stanno solo i nomi dei gruppi e i link fuori dal manuale.
export const NAV = [
  { label: "_%_Getting started_%_", items: ["getting-started/overview", "getting-started/installation", …] },
  …
  { label: "_%_Resources_%_", items: [{ label: "_%_Changelog_%_", href: "https://github.com/sepoina/viteTranslate/releases" }, …] },
];
```

The compiler reads `nav.js` as text (a regex on quoted `"section/page"` strings). Every page must appear exactly once, and every route string must have a page. Contents in the page map below.

### Step 1.6 — Layout `src/App.jsx`, `src/layout/*`, `src/docs.css`

- `App`: `<SiteBar home={siteUrl()} languageLabel=… themeLabel=…>` with a back link "_%_← viteTranslate_%_" and, on small screens, a "☰ _%_Menu_%_" button that opens the sidebar. Below it, a three-column grid:
  - **Left `Sidebar`**: groups from `NAV`, page titles from `ROUTES[route].meta.title` via `<Trans t=…/>`, current page highlighted (`aria-current="page"`). Each group is a collapsible branch (label button with a chevron, pages indented under a guide line): on every page change (arrival, sidebar click or link in the text) only the current page's group stays open (the first one on a 404); other groups can be opened by hand until the next page change. The current page's group cannot be closed (`aria-disabled`, no hover cue). The open group shows its chevron and a thin bottom line only while it is the only open group; the chevron otherwise appears on hover/focus of groups that can be toggled.
  - **Center `<article>`**: eyebrow with the group name, `<h1>` title, description as lead, the page component, then "_%_Edit this page on GitHub_%_" (`repo:` + `meta.source`, shown here only below 1280 px) and `PageNav` (previous/next in `NAV` order).
  - **Right `Toc`**: "_%_On this page_%_" + `meta.headings` (h3 indented). Scroll-spy: the last heading whose top passed 25% of the viewport, measured as in `site/landing/src/Nav.jsx` (`useCurrentSection`). Clicking a heading uses `navigate('#id')`, so the URL always holds the exact section and can be copied. Below the headings: "_%_Edit this page on GitHub_%_" and "_%_Scroll to top_%_".
  - Each `h2`/`h3` shows a "#" link on hover (`<a href="#id" aria-label="_%_Link to this section_%_">`) to copy the address of that section.
- Unknown route: a "_%_Page not found_%_" panel with a link to the overview.
- `document.title = title + " · viteTranslate docs"` on route change (plain English from `routes.json` is fine).
- `docs.css`, only `var(--…)` (test 10):
  - Type: Inter (loaded by `index.html`) for text and columns; Alfa Slab One only on the `h1`. Body 16 px, line height 1.75.
  - The shell (and the bar above it) grows up to 1600 px (`--d-max`), then leaves margins on both sides.
  - ≥ 1280 px: `grid-template-columns: 260px minmax(0, 1fr) 220px` (280 / 240 px from 1600 px), sidebar and TOC sticky under the bar, each scrolling on its own. The sidebar has its own background (`--d-side-bg`), stretched to the window edge.
  - 760–1279 px: no TOC column. The TOC becomes a collapsible "On this page" `<details>` above the content.
  - < 760 px: one column, sidebar as a drawer (`position: fixed`, toggled by the Menu button, closed on navigation and on Esc), 16 px side gutter, no horizontal page scroll (wide tables and code scroll inside their own box).
  - Reading width: the article is centered in its column, max 46rem (`--d-measure`); code, callouts, tables and figures share the same width as the text.
  - Callouts: theme tokens `--callout-bg` (a lime tint) and `--callout-rim` (a 12 px, barely visible border) in `site/theme/tokens.css` (dark and both light blocks, then `npm run site:theme`) set them apart from the white code boxes; the type is told by the label colour.

### Step 1.7 — The source ↔ page association `site/docsSources.mjs` (root)

Commands (add the npm scripts to the root `package.json`):

- `npm run docs:status` → `node site/docsSources.mjs status`
- `npm run docs:seal -- <route> [<route>…]` → `node site/docsSources.mjs seal <routes>`
- `npm run docs` → `npm run dev -w site/pages/docs` (dev server on 3004)

`docs.lock.json` (in `site/pages/docs/`, committed, written only by `seal`):

```json
{
  "pages": {
    "llm/price": {
      "sealedAt": "<git rev-parse --short HEAD at seal time, or null>",
      "sources": { "lib/dev/llm/costModel.js": "<sha256 of LF-normalised text>" }
    }
  },
  "anchors": ["llm/price", "llm/price#budget-caps", "…"]
}
```

- `status`: for each page, compare the current `sources:` and their hashes with the lock. A page is **stale** when a source hash changed, a source was added or removed in the frontmatter, or the page is missing from the lock. For each stale page, print the route, the changed files and a hint `git diff <sealedAt> -- <file>`. Exit 0 always (it is a report). Returns data for the checks.
- `seal <routes>`: recompute the hashes of those pages only, store `sealedAt`, add the current routes and `route#id` entries to `anchors` (never remove any). `seal` without arguments refuses: sealing is page by page, after reading the diff.
- `checks()` exported for `test/release/docs.check.mjs`:
  1. **stale**: list from `status` → KO.
  2. **back-pointers**: every source file of a page contains a line with `DOCS-PAGE:` that names that route; every `DOCS-PAGE:` route found in the repo exists. JSON files are exempt (no comments). → KO.
  3. **coverage** (no exceptions to the code → manual flow): each public surface listed below must be named as inline code in at least one page that lists that file in `sources:`. → KO with the missing names.
     - `lib/react.d.ts`: every `export declare const|function NAME`.
     - `lib/index.d.ts`: every `export function NAME` and every property name of `VitetranslateOptions`, `ErrorSolveOptions`, `ErrorSolveMarks`, `IcuOptions` (regex on `^\s+(\w+)\??:` inside each `interface … {}` block).
     - `lib/dev/vite/cli.js`: every `--flag` at the start of a line in the help text.
     - `idePlugin/package.json`: every `contributes.commands[].command` and every key of `contributes.configuration.properties`.
  4. **anchors**: every entry of `lock.anchors` still exists as a route or `route#id`, or is covered by an `aliases:` line. → KO.
  5. **inbound links**: in the scan scope below, every URL starting with `https://sepoina.github.io/viteTranslate/docs/` must resolve to a route (and an id if it has `#`). → KO.
  6. **no links to migrated files**: no reference to the migrated names (`doc/react-api.md`, `doc/llm.md`, `doc/cli.md`, `doc/icu.md`, `doc/diagnostics.md`, `doc/plugin-options.md`, `doc/translations.md`, `doc/bcp47.md`, `doc/limitations.md`, `doc/requirements.md`, `doc/live-examples.md`, `doc/ide-panel.md`, also as bare `llm.md` relative links inside `doc/`) outside the stubs themselves and `doc/ImplementationPlans/`. → KO.
  7. **translation status**: run the status of `site/pages/docs` (`npx vitetranslate --status` with `cwd` there, or read the tables) and report the share of `it-IT` keys translated. Never KO: **WARN** under 100 %.
- Scan scope for 5 and 6: `README.md`, `CONTRIBUTING.md`, `doc/*.md`, `idePlugin/README.md`, `idePlugin/src/**`, `launcher/**` (no node_modules), `demo/**/README.md`, `demo/**/src/**`, `demo/**/vite.config.js`, `lib/**/*.js` (not `lib/dist/`), `site/landing/src/**`, `site/pages/*/src/**` (not `src/theme/`, not `src/generated/`), `site/pages/docs/content/**`. Always skip `node_modules`, `dist`, `locale/`.

### Step 1.8 — Static HTML per route (deep links on GitHub Pages)

In the `docsRoutes()` plugin, `closeBundle`, read `src/generated/routes.json` and `dist/index.html`:

- For each route, write `dist/<route>/index.html`: a copy of `index.html` with `<title>` set to `title · viteTranslate docs` and `<meta name="description">` set to the description (English). Paths in `index.html` are absolute (Vite `base`), so the copy works at any depth: check it.
- For each page alias `oldRoute`, write `dist/<oldRoute>/index.html`: a minimal redirect page (`<meta http-equiv="refresh" content="0; url=<base><newRoute>/">` plus a script that keeps `location.hash`, and a visible link).
- For anchor aliases (`route#old -> new`): the page renders an empty `<span id="old" aria-hidden="true">` right before the heading `new`. The compiler adds them to the emitted JSX.
- No content prerender in v1 (TODO): the static copies give working deep links, titles and descriptions. The content renders client-side.

### Step 1.9 — Content migration (the bulk)

Rules for every page:

1. Start from the source text listed in the map. Move content, do not rewrite it from scratch. Allowed edits: split into the new pages, fix headings for the dialect (`{#id}` on each), turn relative links into dialect links, turn `> 🎮 / 🧪` lines into `<Demo>` or asides, and shorten where a section is repeated on another page (keep it in one page, link from the others).
2. **Ids**: keep the GitHub slug of the original heading as the `{#id}` (lowercase, drop punctuation except `-` and spaces, spaces → `-`; e.g. "Preloading, Suspense and the initial flash" → `preloading-suspense-and-the-initial-flash`, "`useTranslateLanguage()`" → `usetranslatelanguage`). That way every old `doc/x.md#slug` maps 1:1 to `route#slug` in the stubs.
3. **Sources**: the files listed in the map are a starting point. Before saving, open each one and keep it only if it really defines what the page says. Add the back-pointer comment to each kept source, near its existing header comment:
   `// DOCS-PAGE: llm/price — the user manual describes this behaviour; update it and run npm run docs:seal (AGENTS.md).`
   (Several routes: `// DOCS-PAGE: llm/setup, llm/price`.) In `.d.ts` files use the same `//` line. JSON files get no comment.
4. Images: copy `doc/ide/*.png` and `doc/quickstart-*.png` into `site/pages/docs/public/img/` (the originals stay: the root README uses them).
5. Tone: user-facing, short, as AGENTS.md asks. English only.
6. When a page is done: check it by eye in `npm run docs` at 1280 px and 390 px, then `npm run docs:seal -- <route>`.

Page map (left column, in this order):

| Group | Route | Title | From | Sources (starting point) |
| :- | :- | :- | :- | :- |
| Getting started | `getting-started/overview` | Overview | README intro, "What you get", "Why viteTranslate" (short version, link to the landing comparison) | `package.json`, `lib/react.d.ts` |
| | `getting-started/installation` | Installation | README Quick start step 1, all of `requirements.md` | `package.json`, `lib/dev/babel/babelPeer.js`, `lib/dev/llm/keyringPeer.js` |
| | `getting-started/usage` | Usage | README Quick start steps 2–6 | `lib/react.d.ts`, `lib/dev/vite/cli.js` |
| | `getting-started/live-examples` | Live examples | `live-examples.md` | `site/landing/src/pages.js` |
| | `getting-started/faq` | FAQ | **new**: 8–10 short Q&A, each 2–3 sentences and a link (keys? TypeScript? SSR/Next? untranslated text? runtime size? own delimiters? what the LLM sees? editing YAML by hand? VS Code required?) | `lib/index.d.ts`, `lib/react.d.ts` |
| Concepts | `concepts/markers` | Markers and keys | `plugin-options.md#markers`, `cli.md#rewriting-the-markers` | `lib/markerSyntax.js`, `lib/dev/vite/uty/markerOptions.js`, `lib/dev/vite/uty/rewriteMarkers.js` |
| | `concepts/translation-files` | Translation files | `translations.md` (minus "Adding a language") | `lib/dev/vite/uty/languageFileFormat.js`, `lib/dev/vite/uty/parseLanguageFile.js`, `lib/dev/vite/uty/serializeLanguageFile.js`, `lib/dev/vite/uty/guardMassErase.js` |
| | `concepts/languages` | Adding a language | `translations.md#adding-a-language`, `bcp47.md` | `lib/dev/vite/uty/validateLanguageTag.js`, `lib/dev/vite/uty/languageAutonym.js` |
| | `concepts/icu` | ICU messages | `icu.md` | `lib/icu/parse.js`, `lib/icu/runtime.js`, `lib/dev/compile/icu/compileIcu.js`, `lib/dev/vite/uty/icuOptions.js` |
| | `concepts/diagnostics` | Diagnostics | `diagnostics.md` | `lib/errorSolve.js`, `lib/index.d.ts` |
| | `concepts/preloading` | Preloading and Suspense | `react-api.md#preloading-suspense-and-the-initial-flash` | `lib/react/languageResource.js`, `lib/react/TranslateContext.js` |
| | `concepts/limitations` | Known limitations | `limitations.md` | `lib/dev/babel/extractMarkers.js` |
| Components | `components/translate-container` | TranslateContainer | `react-api.md` "At a glance", "Short names" (shared, short), `TranslateContainer` | `lib/react.d.ts`, `lib/react/TranslateContext.js` |
| | `components/translate` | Translate | `react-api.md` `<Translate>` with its subsections | `lib/react.d.ts`, `lib/react/Translate.js`, `lib/dev/babel/macroForms.js` |
| Hooks & helpers | `hooks/use-translate-to-string` | useTranslateToString | same section | `lib/react.d.ts`, `lib/react/useTranslateToString.js` |
| | `hooks/use-translate-node` | useTranslateNode | same section | `lib/react.d.ts`, `lib/react/useTranslateNode.js` |
| | `hooks/use-translate-language` | useTranslateLanguage | same section + `proposeNewLanguage()` | `lib/react.d.ts`, `lib/react/useTranslateLanguage.js` |
| | `hooks/helpers` | jsxArg, basicHtmlToNodes, version | the three sections | `lib/react.d.ts`, `lib/react/jsxArg.js`, `lib/react/basicHtmlToNodes.js` |
| API reference | `api/plugin-options` | Plugin options | `plugin-options.md` (Markers part links to `concepts/markers`) | `lib/index.d.ts`, `lib/dev/vite/vitetranslate.js` |
| | `api/cli` | CLI | `cli.md` (LLM part becomes a link to the LLM group; "Migrating from 3.x" moves to tutorials) | `lib/dev/vite/cli.js` |
| | `api/types` | TypeScript types | **new**, short: `TranslateArg`, `TranslateArgs`, `TranslateNamedArgs`, `TranslateSource`, `TranslateProps` and the other exported types, one line each with a link to where they are used | `lib/react.d.ts`, `lib/index.d.ts` |
| Tutorials | `tutorials/first-app` | Your first translated app | **new**: follows `demo/Vite_8/quickApp` from `npm create vite` to a French build, with commands and expected output | `demo/Vite_8/quickApp/src/App.jsx`, `demo/Vite_8/quickApp/vite.config.js` |
| | `tutorials/language-switcher` | A language switcher | **new**, based on `demo/Vite_8/minimal` | `demo/Vite_8/minimal/src/App.jsx` |
| | `tutorials/plurals-and-dates` | Plurals and dates | **new**, ICU in practice (link to `concepts/icu` for the reference) | `lib/icu/runtime.js` |
| | `tutorials/migrating-from-3` | Migrating from 3.x | `cli.md#migrating-from-3x` | `lib/dev/vite/uty/migrateLegacyLanguages.js` |
| LLM | `llm/setup` | Setup | `llm.md` Getting started, Every option, The API key | `lib/dev/llm/llmOptions.js`, `lib/dev/llm/apiKey.js` |
| | `llm/price` | Price | `llm.md` "Costs, budget and confirmation" (all subsections) | `lib/dev/llm/costModel.js`, `lib/dev/llm/budgetGuard.js` |
| | `llm/providers` | Providers | `llm.md` "Optional Vercel Provider" + connection examples | `lib/dev/llm/fetchDriver.js`, `lib/dev/llm/callModel.js` |
| | `llm/context` | The context abstract | `llm.md` "The context abstract" | `lib/dev/llm/contextFile.js`, `lib/dev/llm/contextSample.js` |
| | `llm/running` | Running and debugging | `llm.md` While it runs, What gets validated, Debugging a run, Flags | `lib/dev/llm/llmCommands.js`, `lib/dev/llm/validateTranslation.js`, `lib/dev/llm/debugTrace.js` |
| VS Code extension | `vscode/install` | Install | `idePlugin/README.md` "One project, two halves" + "Getting started" | `idePlugin/package.json` |
| | `vscode/panel` | The panel | `ide-panel.md` | `idePlugin/package.json` (+ the view files that draw each part, found by grep) |
| | `vscode/commands-settings` | Commands and settings | `idePlugin/README.md` "Commands", "Settings" | `idePlugin/package.json` |
| Resources | external | Changelog, Contributing, Architecture | links: GitHub releases, `CONTRIBUTING.md`, `doc/structure.md` | — |

### Step 1.10 — Stubs and link migration

1. **Stubs.** Replace each migrated `doc/<name>.md` with:

   ```md
   <!-- Provisional stub: this page moved to the manual. Remove after the TODO item "stubs" (doc/ImplementationPlans/4_x_x-TODO.md). -->
   # <old title> — moved

   This page now lives in the [viteTranslate manual](https://sepoina.github.io/viteTranslate/docs/<main route>/).

   | Section | Now at |
   | :- | :- |
   | <old heading> | [<route>#<id>](https://sepoina.github.io/viteTranslate/docs/<route>/#<id>) |
   ```

   One row per old `##`/`###` heading. An old link with an anchor (`doc/llm.md#budget-caps`) lands at the top of the stub, with the table right there: good enough for a provisional file.
2. **Links.** `grep -rnE "doc/(react-api|llm|cli|icu|diagnostics|plugin-options|translations|bcp47|limitations|requirements|live-examples|ide-panel)\.md" --include=*.md --include=*.js --include=*.mjs --include=*.jsx .` (exclude node_modules, dist, locale) plus relative `(llm.md` style links inside `doc/`. Replace each one with the absolute manual URL of the exact section. Special cases:
   - `lib/dev/llm/llmOptions.js`: the user-facing error message gets the full URL `https://sepoina.github.io/viteTranslate/docs/llm/price/#budget-caps` (check the id). The comment too.
   - `idePlugin/src/webViews/optional/help/helpPage.mjs`: `LLM_DOC_URL` → `…/docs/llm/setup/`. No `IDE_API` change: this is not a library export (AGENTS.md release rules untouched).
   - `site/landing/src/links.js`: `DOCS` → `${SITE_ROOT}docs/`. Check where `DOCS` is used and that the landing still builds. `Compare.jsx` links → manual URLs (the `structure.md` ones stay on GitHub).
   - `demo/Vite_8/llmTranslate/locale/.llm/context.md` is generated: leave it.
   - `README.md` "📚 Guides" becomes a short list of manual links. Keep the README under the AGENTS.md size rule.
3. Run `node site/docsSources.mjs status` and the checks of step 1.7 by hand: checks 5 and 6 must be clean.

### Step 1.11 — Landing

1. `site/landing/src/Nav.jsx`: after the four section buttons, an `<a href={…docs/}>` "_%_Documentazione_%_" (Italian: the landing's source language). Use `siteUrl("docs")` if the landing has `siteLinks.js` in scope, otherwise `import.meta.env.BASE_URL + "docs/"`, as for the other pages.
2. One link in the text: in the "How it works" section (`data-section="how"`) or in `Outro.jsx`, whichever already ends with a call to action, add a sentence such as "_%_Tutto il resto, passo per passo, nel <a>manuale</a>._%_". Ask the user if it is unclear which one fits.
3. Translate the new landing strings in `site/landing/locale/en-US.yml` and `zh-CN.yml` (by hand or with the LLM, as done for the other landing strings).
4. Landing text changed: regenerate the golden (memory "compileGolden and landing tables": only if the KO is limited to the edited folders).
5. Site build plumbing (test 2 and zips):
   - `site/build.mjs` `sitePages`: return `card` too (`vitetranslateSite.card !== false`).
   - `site/zip.mjs` `zipPages`: skip pages with `card: false`.
   - `test/list/site.test.mjs`: test 1 expects `["docs", "edge", "llmrestaurant", "playground"]`; test 2 compares card slugs with **card** pages only; test 8 theme targets include `site/pages/docs`.

### Step 1.12 — `npm run testRelease`

1. `test/testRelease.mjs`: discovers `test/release/*.check.mjs` (sorted). Each exports `name` and `async run()` returning `{ level: "ok" | "warn" | "ko", lines: string[] }`. Run them in order, print one table (name, level, first line), then the `lines` of every non-ok check. Exit 1 if any KO, 0 otherwise. `--only <word>` filters by name. No dependency; colours as in `test/run.mjs`.
2. Checks (one file each):
   - `01-suite.check.mjs`: spawns `node test/run.mjs`. Exit ≠ 0 → KO, with the failing test names.
   - `02-theme.check.mjs`: `checkTheme()` from `site/syncTheme.mjs`. Diffs → KO.
   - `03-demos.check.mjs`: `node test/syncDemoDeps.mjs --check`. ≠ 0 → KO.
   - `04-readme.check.mjs`: the AGENTS.md size formula (same regexes as the snippet in AGENTS.md). ≤ 10 240 B ok, ≤ 11 264 B warn (10 % tolerance), above → KO.
   - `05-runtime-size.check.mjs`: runs `node test/estimateSize.mjs` (it rewrites `site/runtimeSize.json`, by design: AGENTS.md wants it at every release). Output without `README: OK` → KO.
   - `06-docs.check.mjs`: compiles the manual (`compileDocs()`) and runs the eight checks of step 1.7 (the `TODO(links)` WARN is the eighth). Compile errors → KO.
3. Root `package.json`: `"testRelease": "node test/testRelease.mjs"`. Not in `site:build`, not in `prepare`, not in CI (D9).

## Phase 2 — Test

Write the tests listed in `manual_v1.necessarytest.md`. At minimum:

- `test/list/docsCompiler.test.mjs`: the dialect, one case per row of the block and inline tables and per validation error of step 1.2, on in-memory strings. Plus: the delimiter never appears literally in emitted output (the marked strings of `meta` and the figure `alt` excepted), CRLF input gives the same output as LF, unchanged input writes nothing. **Special sequences in prose** (one case each for `{`, `}`, `<`, `>`, `&`, `%s`, the delimiter, and one with several in a paragraph, in a list item, a table cell and a heading): the output contains `{K[n]}` and the matching `K` slot, **never** a `{"…"}` expression and never the bare character in JSX text.
- `test/list/docsSources.test.mjs` on a fake tree in a temp folder (as `site.test.mjs` does): stale detection (hash change, CRLF-only change is **not** stale, source added or removed), seal adds anchors and never removes any, anchor check with and without an alias, coverage on a tiny `.d.ts`, inbound link check, back-pointer check.
- `test/list/site.test.mjs`: the updates of step 1.11.5.
- `test/list/testRelease.test.mjs`: discovery, table, exit code with a fake ok/warn/ko check folder (make the folder a parameter of the runner for this).
- Quick checks in node first. Then `npm test`.

## Phase 3 — Build

1. `npm run site:build`. Check `site/dist/docs/index.html`, `site/dist/docs/llm/price/index.html` (title and description replaced), and one alias redirect if any exist.
2. `npm run site:preview` and check by eye (headless Chrome as in memory "Site visual checks"): `/viteTranslate/docs/llm/price/#budget-caps` opens at that heading; language switch EN/IT; dark/light; 1280 px and 390 px (drawer, no horizontal scroll); the landing menu reaches the docs.
3. In `site/pages/docs`: `npx vitetranslate --status`. Zero warnings is the acceptance bar (no `malformed`, no `collision`, no `marker-split`).
4. **Italian is not produced by the agent.** Tell the user the command (`cd site/pages/docs && npx vitetranslate --llm-translate it-IT`, first run with `--llm-dry-run` to see the estimate). The manual is large: the budget caps of the copied `llm` block may stop it, and the decision to pass `--llm-auto` is the user's.
5. `npm run testRelease`. Expected: `01-suite` OK, `06-docs` WARN on Italian until the user runs the translation.

## Phase 4 — Review

- Run `/code-review` on the diff, or read it again against this plan.
- Architectural problems (the macro does not accept an emission pattern, the static copies break assets, the sync is too slow with the whole manual): write `manual_v1.necessaryreview.md` with notes and amended steps, ask the user, then restart from phase 1 on the affected steps.

## Phase 5 — Documentation

From `manual_v1.necessarydoc.md`, at least:

1. **AGENTS.md**: a new section "REGOLE DI MANUALISTICA" (Italian, like the rest of AGENTS.md), with:
   - the manual (`site/pages/docs/content/`) is the source of truth of user documentation; `doc/` holds only deep-dive files and provisional stubs;
   - a code change to a file with a `DOCS-PAGE:` comment means, in the same change: `npm run docs:status`, update the stale pages (English only), read the diff, `npm run docs:seal -- <route>`. Never seal without updating or confirming the page;
   - a new public API (export, plugin option, CLI flag, extension command or setting) needs its page in the same change: `testRelease` fails on uncovered names;
   - agents write English only; other languages only through viteTranslate (`--llm-translate`, run by the user); never edit `site/pages/docs/locale/*.yml` by hand;
   - published anchors never disappear: renames go through `aliases:`; links from outside the manual use the absolute URL `…/docs/<route>/#<id>`, links inside use `/route#id`;
   - `npm run testRelease` at the close of every release bundle (it includes `estimateSize`); it does not block `site:build`.
   - Update the existing `estimateSize` rule so it says that `testRelease` runs it.
2. `site/README.md`: the table of folders gets the docs row; a short section "The manual": the dialect in five lines, `npm run docs`, the lock and the seal, the link to this plan for the details.
3. `README.md`: the Guides list (step 1.10) and the size check (AGENTS.md formula).
4. `CONTRIBUTING.md`: one line pointing to the manual rules in AGENTS.md.
5. `doc/ImplementationPlans/4_x_x-TODO.md`: new items: **Docs search** (index of titles and headings at build time); **Content prerender** (SSR of each route at build, if the plugin supports an SSR build); **Remove doc/ stubs** (after two minor releases, when the published extension and npm README no longer point to them); **IDE release check** in `testRelease` (`npm view …@latest version` against `IDE_API`, AGENTS.md release rules).
6. If any root document goes over its size limit, tell the user at the end.

## Phase 6 — Cleanup

- Remove the scratch spike folder of step 1.0.
- Remove `manual_v1.necessarytest.md`, `manual_v1.necessarydoc.md` and `manual_v1.necessaryreview.md` once done.
- `git status`: no stray files (generated files are ignored, `docs.lock.json` is tracked).

## Phase 7 — LogDiary

Add a `> [!TIP]` note right after the reviewer note at the top of this file: the decisions taken along the way, one line each, at most ten lines. Use `> [!IMPORTANT]` or `> [!CAUTION]` for risky choices or warnings (for example, if the Italian translation was left to the user, or if a check had to be weakened).
