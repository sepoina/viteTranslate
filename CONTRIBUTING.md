# Contributing

Questions, ideas, or feedback before opening a PR? Start a
[GitHub Discussion](https://github.com/sepoina/viteTranslate/discussions) — it's the best
place to align on an approach before investing time in code.

Found an actual bug? Open an [Issue](https://github.com/sepoina/viteTranslate/issues) instead.

## Development setup

```bash
npm install
npm test             # the whole suite
npm run playground   # runnable example in playground/, with a dev server
```

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

## Pull requests

Keep PRs focused on a single change, and describe the *why* behind it — the diff already
shows the *what*. If the change is non-trivial, open a Discussion first so the design is
agreed on before the implementation.
