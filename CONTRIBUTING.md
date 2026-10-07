# Contributing

Questions, ideas, or feedback before opening a PR? Start a
[GitHub Discussion](https://github.com/sepoina/viteTranslate/discussions) — it's the best
place to align on an approach before investing time in code.

Found an actual bug? Open an [Issue](https://github.com/sepoina/viteTranslate/issues) instead.

## Development setup

```bash
npm install
npm test             # the whole suite
npm run site:preview # build the whole site (landing + pages) and serve it at http://localhost:4173/viteTranslate/
npm run site:build   # the same build, without serving: output in site/dist
npm run site         # dev server of the landing only, port 3002
```

`npm install` from the root covers **every** workspace — the landing and the pages under `site/`
plus the demos under `demo/Vite_8/` — so one install is enough for all of them. A single one runs with
`npm run dev -w site/pages/playground` (or any other workspace path). Like the playground, they all resolve the library from
this checkout, not from npm. How the site is put together is in [site/README.md](site/README.md).

`npm run build` also vendors the ICU parser into `lib/dist/icuParser.js` (gitignored, not versioned) — the tests and
the CLI import it from source, so run `npm run build` once after a fresh checkout before either one, and again if
`lib/dist/` ever goes missing.

## Tests

Tests live in `test/list/`, one file per concern, and run without any test framework:
`npm test` executes each of them in its own process and sums up the result. Every file is
also standalone — `node test/list/syncPipeline.test.mjs` — and `npm test -- markup marker`
runs only the ones whose name matches.

Where a behaviour has a real-world reference, the tests compare against it instead of against
hand-written expectations: [`entities`](https://github.com/fb55/entities) (a dev dependency —
never shipped) for the HTML entity table, a recorded browser run for markup parsing, and a
straightforward Babel-based implementation for marker extraction. An expectation typed by hand
is only ever as right as the day it was typed.

`test/` itself holds just the runner (`run.mjs`) and two tools that are *not* part of the
suite:

- `exampleLangCompile.mjs` (`npm run dump`) writes a compiled language module — what the
  bundler really gets — into `test/exampleCompiled/`, to look at by eye. That folder is
  git-ignored: it is regenerated on demand and follows the playground translations.
- `browserMarkupParity.mjs` re-records the browser behaviour that `markupParity` compares
  against. It needs Chrome, which is why the recording is frozen in `list/markupExpected.mjs`
  instead of being measured on every run.

## Editor extension (experimental)

`idePlugin/` is a VS Code extension (VSCodium too): a panel of its own in the Activity Bar that sums up the viteTranslate
setup of the project you are working on. It is not part of the npm package, and `npm run build` ignores it.

```bash
npm run ide:dev       # opens this repo in an Extension Development Host window
npm run ide:package   # builds idePlugin/vitetranslate-ide-<version>.vsix
npm run ide:install   # builds and installs "viteTranslate DEV" (VT_CODE_CLI=codium for VSCodium)
```

**Release or DEV, one at a time.** The DEV build has its own id (`sepoina.vitetranslate-ide-dev`), name and a dot on the Activity Bar icon, so the Marketplace never mistakes it for the release, nor updates it. It shares commands, views and settings with the release, though: keep only one of the two enabled. `ide:install` warns you if the release is installed too.

It is an npm workspace with its own `devDependencies` and scripts (`npm run build|package|install:editor|dev -w idePlugin`), the same commands as the `ide:*` scripts above: both go through `idePlugin/scripts/code.mjs`. Its tests are `test/list/idePlugin*.test.mjs`, part of `npm test`.

**Results** reads the project's library through `@sepoina/vitetranslate/ide/scan` (`lib/ide/scan.js`): add exports, never remove them. Raising `IDE_API_MIN` in `markedScan.mjs` means publishing the library first (AGENTS.md).

**Publishing**, until the Marketplace accepts trusted publishing (OIDC), from a clean commit:

```bash
npm run ide:release   # checks, tests, packages, then opens the upload page and shows the .vsix
npm run ide:tag       # once Microsoft has verified the upload: tags ide-v<version>
```

The checks stop if that version is already on the Marketplace, or if the library on npm is older than `LIB_MIN` in `markedScan.mjs` (`latest`, plus `next` while the extension is in preview). Once OIDC works, Actions → *Publish extension* runs the same checks and publishes by itself.

## Pull requests

Keep PRs focused on a single change, and describe the *why* behind it — the diff already
shows the *what*. If the change is non-trivial, open a Discussion first so the design is
agreed on before the implementation.
