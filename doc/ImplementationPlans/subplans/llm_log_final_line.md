# Sotto-piano 4.6.0 — riga finale del pannello LLM

> [!NOTE]
> **Per il revisore umano**
> - Nel **log finale** la riga di una richiesta non porta più il costo né la colonna allineata a
>   destra: la chiusura diventa una frase in coda.
>   `✔ < 8 new keys français. Full translate!    $0.0017  3s` → `✔ < 8 new keys français. Now completed in 3s.`
> - Il costo per richiesta sparisce: resta solo il totale `real token: … (≈ $…)` a fine blocco.
> - `Full translate!` **non** compare più nel log finale (lo dice "Now completed"); i dettagli di una
>   parziale restano (`✔ < 4 new keys français. 1 rejected, 1 not returned. Now completed in 3s.`).
> - Gli errori chiudono con `Now failed in Ns.` (lì "completed" mentirebbe).
> - **Dal vivo non cambia niente**: spinner, `Full translate!` e secondi a destra restano.

> [!TIP]
> **Log delle sette fasi**
> - _(da compilare)_

---

## La richiesta (2026-09-18)

> «durante l'operazione di llm va bene, ma alla fine è meglio
> `::: … ║  ✔ < 8 new keys français. Now completed in 3s.`». Alla domanda sul costo: **niente costo
> per richiesta**, resta solo il totale.

## Decisioni

| Tema | Decisione |
| :- | :- |
| Riga finale, completata | `✔ < 8 new keys français. completed / 3s.` |
| Riga finale, parziale | `✔ < 4 new keys français. 1 rejected / 1 not returned / 3s.` |
| Riga finale, contesto | `✔ < context abstract, 24 lines. completed / 3s.` |
| Riga finale, errore | `✖ - error français (HTTP 401) / see trace in debug mode / 3s.` |
| Riga finale, mai chiusa | `· > ask 3 keys italiano - Deutsch` — nessuna coda |
| Forma della coda | `<dettagli> / <secondi>.` — con `completed` quando non manca niente; entra nelle 72 colonne anche sui casi lunghi (nessun wrap) |
| Costo per richiesta | rimosso dalla riga; il costo resta nel totale (`printRunResult`) |
| `Full translate!` | solo dal vivo; soppresso nel log finale |
| Colonna destra | solo dal vivo (`alDestra`); nel log finale la riga è testo semplice |
| Dal vivo | invariato |
| `connection` in `createRequestPanel` | rimosso: serviva solo a `costo()`, che sparisce |

> [!TIP]
> **Log delle sette fasi**
> - Tre ask, perché la richiesta era ambigua: (1) niente costo per richiesta, (2) come rendere le
>   righe lunghe (andavano a capo spezzando la frase), (3) le parole esatte. Forma finale:
>   `<dettagli> / <secondi>.`, con `completed` quando non manca niente.
> - Implementazione: `sinistra(v, null)` con la coda compatta; `finish()` senza colonna destra;
>   rimossi `costo`, `allarga`, il parametro `connection` e gli import `costModel`/`logTextWidth`;
>   `translatePass` non passa più `connection` ai due pannelli.
> - Test: `llmPanel` (log finale, forme di riga, regione viva) e `llmTranslatePass` P3 allineati;
>   suite **1925 → 1921 asserzioni**, tutte verdi.
> - Verifica visiva end-to-end: nessun wrap, la coda sta nelle 72 colonne anche sui casi lunghi.
> - Residuo noto: `done(result, usage)` conserva `usage` anche se il pannello non lo mostra più.

## File

- `lib/dev/llm/requestPanel.js` — `sinistra(v, null)` con la coda; `finish()` senza colonna destra;
  rimossi `costo`, `allarga`, il parametro `connection` e gli import `costOf`/`formatCost`/`formatTokens`/`logTextWidth`.
- `lib/dev/llm/translatePass.js` — i due `createRequestPanel({…})` non passano più `connection`.
- Test: `llmPanel`, `llmTranslatePass` (P3).
- Doc: `doc/llm.md` § "While it runs"; `doc/structure.md` § Phase 5. README invariato (mostra il dal vivo).

## Istruzioni per chi implementa

### Fase 1 — Implementazione

**1.1 `requestPanel.js`, `sinistra(v, tick)`.** Introdurre `const finale = tick === null;` e
`const chiusa = finale ? \` Now ${v.state === "error" ? "failed" : "completed"} in ${secondi(v)}.\` : "";`.
Poi, caso per caso:
- `run`: invariato (niente coda);
- `errore`: `base` com'è ora, `return finale ? base + chiusa : base`;
- `context`: `testo` senza punto com'è ora; `return finale ? \`${testo}.${chiusa}\` : testo`;
- `done`: `base = \`… < ${arrivate} ${soggetto}.\``; `return finale ? base + (resto.length ? \` ${resto.join(", ")}.\` : "") + chiusa : base + (completo ? " Full translate!" : "") + (resto.length ? \` ${resto.join(", ")}\` : "")`.

**1.2 `requestPanel.js`, `finish()`.** Senza colonna destra:
```js
voci.forEach((v, i) => logEchoColored(i === 0 ? firstLabel : "", sinistra(v, null)));
```
Rimuovere `costo`, `allarga` e gli import non più usati; togliere `connection` dalla firma e dal
JSDoc. `alDestra`/`destraDalVivo` restano: servono alla regione viva.

**1.3 `translatePass.js`.** Togliere `connection: llm.connection` dalle due chiamate a
`createRequestPanel` (righe ~135 e ~317).

### Fase 2 — Test

`llm_log_final_line.necessarytest.md`. `node test/list/llmPanel.test.mjs`, poi `node test/run.mjs llm logFormat`.

### Fase 3 — Build

Niente build: `node --check lib/dev/llm/requestPanel.js lib/dev/llm/translatePass.js`.

### Fase 4 — Review

Se una asserzione dei test cade su qualcosa che il nuovo formato non può più dire, è un ask.

### Fase 5 — Documentazione

`llm_log_final_line.necessarydoc.md`.

### Fase 6 — Pulizia

Rimuovere i `llm_log_final_line.necessary*.md`.

### Fase 7 — logDiary

Compilare la `[!TIP]` in testa.
