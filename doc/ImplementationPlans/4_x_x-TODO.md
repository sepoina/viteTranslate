> [!NOTE]
> **For the human reviewer**
>
> - Not a plan: the backlog of deferred features and reliability work, each with verified facts and decisions already taken.
> - T1 Observable language switch (React `changeLanguage`, `isLoading`, `error`): specified, ready to plan.
> - T2 Compilation benchmark and caches: specified, ready to plan.
> - T3 fastVerify per-file signature: deferred reliability correction.
> - T4 Marked files the parser cannot read (blocked builds since 4.7.1): idea.
> - T5 Browser test in CI: idea, explicitly not now.
> - T6 Auto-sync completed-Promise cache: deferred by the user on 2026-10-10.

# 4.x.x — TODO: ideas for the next plans

## How to use this file

- This file collects deferred ideas and reliability corrections from plan reviews. A deferral is a scope decision, not evidence that the existing behavior is correct. Each item keeps what was learned (verified facts, decisions, a draft spec), so the next plan starts from facts instead of rediscovering them.
- Facts carry their verification date. Re-check them before planning: files move and numbers change.
- Decisions listed under an item were taken by the user. Carry them into the plan as closed, unless the user reopens them. The `D` numbers are shared with [`4_7_1.md`](4_7_1.md).
- When an item becomes a plan: copy its spec into `doc/ImplementationPlans/<version>.md`, add the reviewer note and the seven phases required by `AGENTS.md`, then replace the item here with a one-line pointer to that plan.
- A new non-safety idea found while working on any plan goes here, not into that plan.

## Cross-cutting facts (verified 2026-10-09)

- **Runtime budget:** 5890 B gzip (4804 B React runtime + 1087 B ICU helpers, `site/runtimeSize.json`). `test/estimateSize.mjs` uses kB = 1024, so the "<6 kB" claim in README (comparison table and note ⁴) and on the site holds up to 6144 B. 4.7.1 adds a few bytes to the ICU helpers: run `npm run estimateSize` again before planning any runtime feature.
- **Test discovery:** `test/run.mjs` only runs `test/list/*.test.mjs`. Any other folder under `test/` is automatically outside `npm test`.
- **CI:** only `publish.yml` runs tests (`npm test` in its `build` job), and that job gates npm publish and GitHub Pages. `publish_extension.yml` is manual. No test-only workflow exists.
- **React:** peer range `^18 || ^19`; the repo's devDependency is React 19.2.8. `setState` after unmount is a silent no-op in both.
- **Container tests** (`translateContainer.test.mjs`) exercise SSR only. `test/browserMarkupParity.mjs` shows how to drive headless Chrome over CDP with Node's own WebSocket, no dependency; it uses a React stub, which a lifecycle test must not.
- **Versioning:** the project has shipped features in patches (4.6.3, 4.6.4). A new public API is still better announced by a minor.

## T1. Observable language switch (React)

**Status:** specified, ready to plan. **Origin:** core review; section E of the 4.7.1 draft, moved out on 2026-10-09.

**Why:** a language switcher cannot tell today whether a switch is pending or has failed. The `proposeNewLanguage` callbacks are the only signal, and an exception thrown inside `onDone` becomes an unhandled rejection.

**Decisions taken:**

- D3: `changeLanguage` with an unknown tag resolves `{ status: "error" }` at once. No request id, no change to `requestedLanguage` / `isLoading` / `error`, no superseding of in-flight requests. Reason: otherwise an older request commits on screen while its Promise says `superseded`.
- D4: the browser test lives in `test/benchmark/`, has an explicit npm script, is not part of `npm test` and is not wired into CI.
- From the analysis: no mounted ref (React ≥18 ignores updates after unmount, and a ref misbehaves under StrictMode); user callbacks run through `callUser` (below); `isLoading` turns on only when the chunk is not ready, so preloaded languages never flash.

**Open questions for the plan:** version (4.8.0 suggested: new public API); outcome of the size checkpoint; whether the README quick start keeps `proposeNewLanguage` or shows `changeLanguage`.

**Verified facts (2026-10-09):**

- `TranslateContainer.jsx` `proposeNewLanguage`: an unknown tag → `onError({ error, inexistID })` or `report`, then `onDone(false)`, no `onStart`. A valid tag → `onStart`, `ensureLanguage(next).then(onDone(true), onError…)`, then `startTransition(() => setLanguageState(nextLanguageState(prev, next, retrying)))`. `retrying = hasFailedLanguage(next)` must be sampled before `ensureLanguage`.
- `TranslateProvider` memoizes `{ id, debug, table, proposeNewLanguage, icu }`: every translated leaf reads it, so adding request state there would re-render the whole tree on every switch.
- `languageResource.js` keeps one module-level cache shared by all containers; a failed entry stays until the next explicit request.
- `useTranslateLanguage` returns a frozen object memoized on the context.

### Contract (additive)

`proposeNewLanguage(options): void` keeps its options and callbacks. New: `changeLanguage(tag): Promise<LanguageChangeResult>` and three read-only hook fields.

```ts
export type LanguageChangeResult =
  | { status: "loaded"; requestedLanguage: string }
  | { status: "superseded"; requestedLanguage: string }
  | { status: "error"; requestedLanguage: string; error: Error }
  | { status: "unavailable"; requestedLanguage: string };
```

- `loaded`: the chunk is ready and the request is still the latest when it settles. It does **not** promise a DOM commit.
- `superseded`: a newer valid request started before this one settled, even if this one's chunk later fails.
- `error`: load failure, or unknown tag (D3). The Promise never rejects.
- `unavailable`: called outside a container (keep the existing one-time DEV diagnostic).
- `requestedLanguage: string | undefined`: the latest valid explicit target; inside a container it starts as the resolved initial language; `undefined` outside.
- `isLoading: boolean`: the latest valid request's chunk is pending. `false` outside.
- `error: Error | null`: failure of the latest valid request, cleared when a new valid request starts. `null` outside.

### Draft implementation

1. `TranslateContext.js`: add `export const LanguageSwitchContext = createContext(null);` (not exported by the package).
2. `languageResource.js`: add `export function isLanguageReady(tag)` returning `isPreloadedLanguage(tag) || cache.get(tag)?.status === "done"`.
3. `TranslateContainer.jsx`:
   - `const requestId = React.useRef(0);`
   - After the language state: `const [request, setRequest] = React.useState(() => ({ requestedLanguage: <the tag chosen by the first useState>, isLoading: false, error: null }));`
   - One internal `startRequest(next, callbacks, legacy)` (`useCallback`, `[]` deps) serves both APIs:
     1. Unknown tag (D3): `` const error = new Error(`Unknown language "${next}"`) ``. Legacy: exactly today's callbacks. New API: today's `report(diag, "error", …)`. Return `Promise.resolve({ status: "error", requestedLanguage: next, error })` without touching `requestId`, `request` or the language state.
     2. `const id = ++requestId.current;` then the legacy `onStart`.
     3. `const retrying = hasFailedLanguage(next); const ready = isLanguageReady(next);` (both before `ensureLanguage`).
     4. `setRequest({ requestedLanguage: next, isLoading: !ready, error: null });` (urgent update).
     5. `const p = ensureLanguage(next);` then the existing `startTransition(...)`.
     6. Return `p.then(onOk, onFail)`. Both handlers first run this invocation's legacy callbacks (per-request meaning), then: `id !== requestId.current` → `superseded`; otherwise `setRequest((r) => ({ ...r, isLoading: false, error: null | error }))` and return `loaded` or `error`.
   - `proposeNewLanguage = React.useCallback((opts = {}) => { startRequest(opts.lang, opts, true); }, [])`, returning `undefined`.
   - `changeLanguage = React.useCallback((tag) => startRequest(tag, undefined, false), [])`.
   - Every user callback goes through:

     ```js
     function callUser(fn, ...args) {
       if (typeof fn !== "function") return;
       try { fn(...args); } catch (error) { queueMicrotask(() => { throw error; }); }
     }
     ```

     The exception surfaces as a global uncaught error (production builds included), never changes the Promise result, never skips the other callback or the state update.
   - Render: wrap the existing `<React.Suspense>` in `<LanguageSwitchContext.Provider value={switchValue}>`, with `switchValue = React.useMemo(() => ({ ...request, changeLanguage }), [request, changeLanguage])`. `TranslateProvider`'s value stays unchanged, so request updates never reach `useTrans` / `useTranslateNode`.
   - `id` stays as today (the committed table; the eager fallback after a failure). `initialLanguage` stays initialization-only, and the initial lazy load still suspends.
4. `useTranslateLanguage.js`: also read `LanguageSwitchContext`; memo deps `[lang, sw]`; add `changeLanguage` (outside a container: DEV diagnostic plus `Promise.resolve({ status: "unavailable", requestedLanguage: tag })`), `requestedLanguage`, `isLoading` (`?? false`), `error` (`?? null`). Keep `Object.freeze`. JSDoc: the object now changes identity when request state changes, so put `changeLanguage` / `proposeNewLanguage` in effect deps, not the whole object.
5. `lib/react.d.ts`: export `LanguageChangeResult` and add the four fields to the hook's return type (`useTranslateLanguage` and `useTransLanguage`). Check `lib/index.d.ts` for re-exports.
6. SSR: the initial `request` has `isLoading: false`, so SSR output stays byte-identical.

### Draft tests

- `test/benchmark/browserLanguageSwitch.mjs` plus the fixture folder `test/benchmark/browserLanguageSwitch/`; script `"test:browser-language"`. Options: `--react=19` (default, the repo's install); `--react=18` (installs `react@18.3.1 react-dom@18.3.1` with `npm install --prefix <os.tmpdir()>/vt-react18 --no-save --no-package-lock`, never touching the repo's tree); `--dist` (bundle against `lib/dist/react.es.js`).
- Reuse the CDP approach of `test/browserMarkupParity.mjs` (`CHROME` env var) with real `react` and `react-dom/client`. Bundle with rolldown (already a devDependency); map only `virtual:vitetranslate/languages` to a fixture module exporting everything `lib/virtual.d.ts` declares, with deferred loaders driven by the page (`window.__resolve(tag)`, `window.__reject(tag)`). Wait on named conditions with bounded timeouts; no fixed sleeps.
- Cases: preloaded mount; initial lazy Suspense; the previous language stays visible while switching; success; failure and fallback; same-tag retry; A then B resolving in both orders; A failing after B succeeded; unknown tag, alone and while B is loading (B still commits and resolves `loaded`, request state untouched); a ready language never sets `isLoading`; unmount during loading; two containers sharing one load; StrictMode; callback exception (global error event, Promise result unchanged, other callback still called); API outside a container. Assert DOM text, committed `id`, request state, Promise results, callback counts, and a render count proving request updates do not reach the translation context.
- Print `ok` / `KO` lines like the suite. If Chrome or the React 18 install is unavailable, print `PENDING: <exact missing check>` and exit 2: SSR is not a substitute.
- In `test/list/`: SSR output unchanged; `useTranslateLanguage` outside a container returns the new fields with their defaults.

### Draft build, review and docs

- Build: `lib/dist/react.es.js` exports and `lib/react.d.ts` agree; browser test with `--dist`; `npm run estimateSize` with the size checkpoint (above 6144 B → stop and ask before touching README and site).
- Review: older requests never overwrite the latest request state; unknown tags never touch it; callbacks keep their per-request meaning; `id` follows the committed UI; translated leaves are not re-rendered by request updates.
- Docs: `doc/react-api.md` (Promise API, state and result semantics, unchanged callbacks, a short accessible switcher using `isLoading` / `error`, the effect-deps note); `doc/structure.md` (the switch-state context); `CONTRIBUTING.md` (`test/benchmark/` and its scripts, why they are outside `npm test` and CI).

## T2. Compilation benchmark and caches

**Status:** specified, ready to plan. **Origin:** core review; section F of the 4.7.1 draft, moved out on 2026-10-09.

**Why:** `compileLocale.js` re-reads and re-parses the source table once per non-source language (`readLanguageFile(sourcePath)` inside the transform). Nobody has measured whether that matters. Do not call it a bottleneck before the numbers exist.

**Decision taken:** D4: `test/benchmark/compile.bench.mjs`, script `"bench:compile"`, outside `npm test` and CI.

**Draft spec:**

1. Fixtures generated in `os.tmpdir()`: 1,000 and 10,000 keys × 1 / 10 / 30 languages × plain text vs mixed ICU/markup. Never sync the demo catalogs.
2. Drive the real path: the `transform.handler` returned by `creaCompileLocale(...)`, called for each language file with a stub `this` (`addWatchFile` no-op) and a stub reporter. Measure separately the source-table read and parse and `compileLanguageModule`. 3 warm-up runs, 10 samples; report median, min–max, Node version, dataset, output bytes plus a hash (for equality), and `process.memoryUsage().heapUsed` before and after.
3. Candidate 1, only after measuring: a source-table cache scoped to the plugin instance, enabled only in a non-watch build. `vitetranslate.js` knows the command in `configResolved` (`resolvedConfig.command === "build" && !resolvedConfig.build.watch`): pass a `cacheSource` flag to `creaCompileLocale`. Key it by source path + exact text (the file is still read; the cache saves the parse). Clear it in `buildStart`. Never process-global.
4. Candidate 2, only if ICU parsing proves significant: a compilation-scoped signature cache (`lib/dev/compile/icu/icuSignature.js`) keyed by exact text + locale. No shared mutable AST; diagnostics still reported per key.
5. Keep a cache only with ≥10% median improvement in the affected stage on the large fixtures, byte-identical output and no material small-fixture regression. Record negative results too. Local criterion, not a product speed claim.

**Docs:** `doc/structure.md` only if a cache is kept; `CONTRIBUTING.md` for the script (shared with T1).

## T3. fastVerify per-file signature

**Status:** idea, deferred by the user (D8). **Origin:** core review.

**Verified problem:** the current maximum-mtime signature can miss a changed table whose mtime stays below another file's timestamp. This is deferred reliability work. The latest proposal was direct per-file name/size/mtime/ctime comparison; hashing those metadata was discussed but not selected. Schema handling belongs to its future plan.

**What 4.7.1 already does:** it clears the scan record after every failed or blocked sync, so fastVerify never trusts a failed run.

**Open:** everything. The plan must restate the problem with an observed case, measure the current fastVerify cost, and design invalidation and schema migration. The existing fastVerify tests (`fastVerify`, `fastVerifyCli`, `autoSyncFastPath`) are the baseline.

## T4. Marked files the parser cannot read

**Status:** idea. **Origin:** 4.7.1 analysis.

**Facts (2026-10-09):** `lib/dev/babel/parserOptionsFor.js` enables only `jsx` and `typescript`. From 4.7.1, a marked file Babel rejects (for example decorators) blocks CLI and build sync; dev only warns (D1). There is no force flag: 4.7.1 rejected it because it would reopen the mass-erase hazard. There is no scan exclude option either: `walkSource.js` skips only `node_modules`, `.git`, `dist` and `build`.

**Ideas, not decided:**

- Enable more Babel parser plugins. Decorators need a choice (`decorators` vs `decorators-legacy`), and a wrong choice turns one parse error into another.
- An exclude option for the scan (glob or folder list).
- Read the parser options from the project's own Babel/TypeScript config.

Each has trade-offs: list them in the plan. **Trigger:** the first report of a build blocked by `VT_SCAN_INCOMPLETE` on a file that is valid for the project.

## T5. Browser test in CI

**Status:** idea, explicitly not now (D4).

**Facts:** see "Cross-cutting facts"; `ubuntu-latest` runners ship Chrome.

**Idea:** a separate workflow (`workflow_dispatch`, or pull requests only) running `test:browser-language` for React 18 and 19, never required by publish or Pages. Depends on T1.


## T6. Auto-sync retains completed Promises

**Status:** deferred by explicit user decision on 2026-10-10; leave the current contract unchanged in 4.7.1.

**Verified facts (2026-10-10):** `autoSync.js` keeps successful Promises in `inCorso`. Two sequential calls in the same process with the same configuration return the earlier result, even if source strings changed between them. A temporary-project reproduction returned `synced` on the second call while its table still contained the old text. `autoSyncReentrancy.test.mjs` deliberately asserts reuse of the completed result.

**Proposal to assess:** retain only in-flight Promises, so overlapping calls share work but a later invocation can run fastVerify/full sync again. Define the boundary between duplicate hooks in one startup and a later restart/programmatic build before changing tests. Verify simultaneous calls, successful completion followed by a source edit, failures, incomplete scans and repeated builds. Do not treat a fulfilled Promise as evidence that disk state is still current.
