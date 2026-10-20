# Sotto-piano 4.6.0 — layout del log LLM

> [!NOTE]
> **Per il revisore umano**
> - Il blocco LLM diventa: `LLM` │ `"<model>"`, `⌘ <provider>` │ riga di sintesi, poi una riga
>   `- token (…) ≈ … < costGuard (…)`, righe delle richieste, `real token: N (≈ …)`, e la trace con
>   etichetta `--llm-debug`. Il blocco si chiude con una traversa.
> - Spariscono: il suggerimento `$ npx … --llm-translate` (sei già in quel comando), il report
>   per-lingua, `estimated from characters`, `measured from provider usage`, `under costGuard: not
>   asking`. Il dettaglio resta in `--llm-debug` (`summary.json`).
> - Provider ricostruito da `baseURL` (host senza `api.`, senza porta), modello da `model`.
> - Etichette del blocco in maiuscolo (`LLM`) per coerenza con lo sketch; la riga trace diventa
>   `--llm-debug`.
> - Nessun impatto sul bundle React (`lib/dev/llm/` è dev-only).

> [!TIP]
> **Log delle sette fasi**
> - Nessun ask sul layout (la bozza era la specifica); unico ask chiuso: provider da `baseURL`
>   come host senza `api.` né porta, e informazioni omesse dalla bozza rimosse davvero.
> - Implementazione: `providerFrom` + `printEstimate`/`printRunResult` riscritti;
>   `printCostGuard` e `printTranslateHint` rimossi; `runSync({ showTranslateHint: false })`;
>   etichette `LLM` e `--llm-debug`; traversa di chiusura in `llmCommands`.
> - Test: **56/56 · 1909 → 56/56 · 1925 asserzioni** (nuovo `T85` in `llmTranslatePass`, `logFormat`
>   col nuovo formato e `providerFrom`). Verifica visiva end-to-end: il layout combacia con la bozza.
> - Bundle invariato (dev-only), `estimateSize` non toccato; README 9448 B (< 10 kB).
> - Non coperto da test: l'etichetta `--llm-debug` e la traversa di chiusura (verificate a mano).

---

## La richiesta (2026-09-18)

> «Il log è disordinato»: bozza di nuovo layout fornita dall'utente, con quattro note — togliere
> l'helper `$ npx vitetranslate --llm-translate`, migliore sintesi, spaziatura, ricostruzione del
> fornitore da `baseURL` e del modello da `model`. Scelta dell'utente: **bozza fedele**, le
> informazioni che la bozza non mostra spariscono (restano solo in `--llm-debug`). Provider:
> host senza prefisso `api.` e senza porta.

## Formato obiettivo

```
:::                      ╟──────────────────────────────────────────────────────────────────────
::: viteTranslate        ║  sources: "src" (2 files, 8 sentences)
::: ⌘ v4.6.0-rc.2        ║  translations: "locale" (4 languages)
:::                      ║  italiano - source language, no changes detected
:::                      ║  American English, 日本語 - all ok!
:::                      ║  Deutsch (de-DE.yml) - 8 key(s) missing
:::                      ║  8 string(s) still untranslated
:::                      ╟──────────────────────────────────────────────────────────────────────
::: LLM                  ║  "deepseek-flash"
::: ⌘ deepseek.com       ║  - (1/3) incomplete table - 8 missing keys - 1 api request
:::                      ║  - token (in ~1.2k - out ~1.3k) ≈ $0.0022 < costGuard ($0.2000)
:::                      ║
:::                      ║  ✔ < 8 new keys Deutsch. Full translate!
:::                      ║
:::                      ║  real token: 2051 (≈ $0.0017)
::: --llm-debug          ║  locale/.llm/260918213048 (7 files)
:::                      ╟──────────────────────────────────────────────────────────────────────
```

## Decisioni

| Tema | Decisione |
| :- | :- |
| Helper `$ npx --llm-translate` | rimosso **solo** quando la sync gira dentro un run LLM (`runSync({ showTranslateHint: false })`); la sync normale lo tiene |
| `(1/3)` | lingue-destinazione con lavoro / lingue-destinazione totali (`perLanguage` con `entries` non vuote / `targetTags.length`) |
| `missing keys` | `totalKeys`; `api request` = `totalRequests` |
| Token stimati | `formatTokens` con `~`; costo con `formatCost` e `≈` |
| costGuard | nella riga dei token: `< costGuard ($…)` sotto il tetto, `≥ costGuard ($…)` sopra; se `costGuard` non è configurato, solo `≈ $…` |
| `real token` | numero **intero** (2051, non `2.1k`), somma in+out misurata; se non c'è `usage`, la riga non esce |
| Riga `under costGuard: not asking` | rimossa (assorbita nella riga dei token) |
| `printCostGuard` | rimossa (la sua informazione è nella riga dei token) |
| `printTranslateHint` | rimossa (codice morto: nessun chiamante) |
| Etichette | `LLM` in maiuscolo nel blocco; trace con etichetta `--llm-debug`; `⌘ <provider>` per la riga di sintesi (come `⌘ v4.6.0-rc.2`) |
| Righe di richiesta | prima riga senza etichetta (il blocco è già nominato da `LLM`): `firstLabel: ""` |
| Traverse | quella dopo la sync c'è già (`syncCore.js`); se ne aggiunge una di chiusura dopo la trace |
| Per-lingua, `estimated from characters`, `measured from provider usage` | rimossi dal log; il dettaglio resta in `--llm-debug` |

## File

- `lib/dev/llm/llmReport.js` — `providerFrom`, `printEstimate` e `printRunResult` riscritti,
  `printCostGuard`/`printTranslateHint` rimossi, etichetta `LLM`.
- `lib/dev/llm/translatePass.js` — passa `connection`/`incomplete`/`total`/`costGuard` a
  `printEstimate`; rimuove la riga `under costGuard`; `runSync({ showTranslateHint: false })`;
  `firstLabel: ""` sul pannello del run; `printRunResult` col totale sconosciute.
- `lib/dev/vite/syncCore.js` + `uty/syncReport.js` — `showTranslateHint`.
- `lib/dev/llm/llmCommands.js` — riga trace con etichetta `--llm-debug`, traversa di chiusura,
  etichette `LLM`.
- `lib/dev/llm/requestPanel.js` — `firstLabel`, etichetta live `LLM`.
- `lib/dev/llm/debugTrace.js` — etichetta `--llm-debug` sull'avviso.
- Test: `logFormat`, `llmPanel`; `llmTranslatePass` se serve.
- Doc: `doc/structure.md` § Phase 5 (+ Phase 1 per l'hint), `doc/llm.md` § "While it runs".

---

## Istruzioni per chi implementa

Sette fasi, in ordine. Ogni ambiguità è un **ask**, non una scelta.

### Fase 1 — Implementazione

**1.1 `lib/dev/llm/llmReport.js`**
- `export function providerFrom(baseURL)`: `null` se manca; accetta `baseURL` senza schema
  (`https://` implicito); `new URL(...).hostname`; togli un `api.` iniziale; `null` se invalido.
- `printEstimate({ connection, incomplete, total, keys, requests, tokensIn, tokensOut, cost, costGuard, costUnity })`:
  1. `logEchoColored("LLM", `"${connection?.model ?? "custom-driver"}"`)`
  2. `logEchoColored(provider ? `⌘ ${provider}` : "", `- (${incomplete}/${total}) incomplete table${...} - ${keys} missing key${...} - ${requests} api request${...}`)`
  3. `logEchoColored("", `- token (in ~${formatTokens(tokensIn)} - out ~${formatTokens(tokensOut)})${cost ? ` ≈ ${formatCost(cost.cost, costUnity)}` : ""}${costGuardLine}`)`
     dove `costGuardLine` = `" < costGuard (…)` se `cost.cost < costGuard`, `` ` ≥ costGuard (…)` `` se `>=`; `""` se `costGuard` assente.
  4. `logEchoColored("", "")` — riga vuota di chiusura del blocco stima.
- `printRunResult({ tokensIn, tokensOut, cost, costUnity, unknownKeys = 0 })`:
  - `total = Math.round((tokensIn ?? 0) + (tokensOut ?? 0))`; se `total > 0`:
    `logEchoColored("", "")` poi `logEchoColored("", `real token: ${total}${cost ? ` (≈ ${formatCost(cost.cost, costUnity)})` : ""}`)`.
  - `if (unknownKeys > 0) logEchoColored("", `${unknownKeys} unknown key(s) in the reply, ignored`, "warning")`.
- `printRefusal`: etichetta `LLM`.
- Rimuovere `printCostGuard` e `printTranslateHint`; togliere gli import `logCommand`, `CLI_NAME`.

**1.2 `lib/dev/llm/translatePass.js`**
- `await runSync({ config, showTranslateHint: false })`.
- `const incomplete = perLanguage.filter((l) => l.entries.length > 0).length;`
- `printEstimate({ connection: llm.connection, incomplete, total: targetTags.length, keys: totalKeys, requests: totalRequests, tokensIn: estimate.tokensIn, tokensOut: estimate.tokensOut, cost, costGuard: llm.costGuard, costUnity: llm.connection.costUnity })`.
- `dryRun`: togliere la chiamata `printCostGuard(...)` (l'informazione è già nella riga dei token).
- Togliere il blocco `if (confirm.how === "costGuard") logEchoColored(...)`.
- Togliere l'import `logEchoColored` (dopo la rimozione non serve più) e `printCostGuard`.
- `printRunResult` finale: togliere `perLanguage`, aggiungere `unknownKeys: perLanguageReport.reduce((s, l) => s + l.unknownKeys, 0)`.
- Pannello del run: `createRequestPanel({ …, firstLabel: "" })`.

**1.3 `lib/dev/vite/syncCore.js`** — `runSync({ …, showTranslateHint = true })` e passarlo a
`printSyncSummary(esito, config.sourceLanguage, config.llm ?? null, { showTranslateHint })`.

**1.4 `lib/dev/vite/uty/syncReport.js`** — `printSyncSummary(esito, sourceLanguage, llm = null,
{ showTranslateHint = true } = {})`: la riga `still untranslated` resta; `logCommand` solo se
`showTranslateHint`.

**1.5 `lib/dev/llm/llmCommands.js`**
- riga trace: `logEchoColored("--llm-debug", `${shortPath(debug.dir)} (${debug.count} file(s))`)`.
- `let ranPass = false;` prima del `try`; `ranPass` messo a `true` quando si chiama `translatePass`;
  nel `finally`, dopo la riga trace, `if (ranPass) logRule()`.
- Etichette `LLM` in `reportOutcome`.

**1.6 `lib/dev/llm/requestPanel.js`** — `createRequestPanel({ …, firstLabel = "LLM" })`;
`finish()` usa `i === 0 ? firstLabel : ""`; etichetta della regione viva `LLM`.

**1.7 `lib/dev/llm/debugTrace.js`** — avviso con etichetta `--llm-debug` e testo senza il prefisso
`debug trace: `.

### Fase 2 — Test

`llm_log_layout.necessarytest.md`. Verifica rapida:
`node test/list/logFormat.test.mjs && node test/list/llmPanel.test.mjs` poi `node test/run.mjs llm`.

### Fase 3 — Build

Niente build (`lib/dev/llm/` dev-only): `node --check` sui file toccati.

### Fase 4 — Review

Se il nuovo formato perde un'informazione che i test davano per certa → ask.

### Fase 5 — Documentazione

`llm_log_layout.necessarydoc.md`.

### Fase 6 — Pulizia

Rimuovere i `llm_log_layout.necessary*.md`.

### Fase 7 — logDiary

Compilare la `[!TIP]` in testa.
