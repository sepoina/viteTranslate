# Sotto-piano 4.6.0 — il pannello tty delle richieste LLM

> [!NOTE]
> **Per il revisore umano**
> - Ogni chiamata al modello (contesto, lotti del primo giro, riparazioni) ha **una riga**: `⠋ > ask 7 keys italiano - Deutsch`
>   mentre aspetta, `✔ < 7 new keys Deutsch. Full translate!` a risposta validata, `✖ - error Deutsch (HTTP 401). see trace in debug mode!`.
> - Su un terminale le righe si **riscrivono sul posto**, una volta al secondo e a ogni evento; alla fine la regione è
>   **cancellata e sostituita** dallo stesso elenco come log vero, con **costo e secondi** per riga.
> - Senza TTY (pipe, CI, `TERM=dumb`) si stampa solo il log finale: nessuna sequenza di escape.
> - Nuovi `lib/dev/llm/liveRegion.js` (meccanica) e `lib/dev/llm/requestPanel.js` (testi, log finale); in `lib/utility.js`
>   `logLineRows`/`clipToWidth`/`logTextWidth`; in `callModel` un `onRetry`.
> - `translatePass` valida ogni risposta **appena arriva** (prima: a fine giro). Due cose che prima passavano in silenzio
>   ora si vedono: una richiesta fallita dopo i retry, e lo stop a metà run per `maxCostPerRun`.

> [!TIP]
> **Log delle sette fasi**
> - Nessun ask: la specifica copriva le scelte di fondo; i dettagli (autonimi, secondi, retry visibile, contesto e
>   riparazione nello stesso sistema) sono decisioni di questo piano, elencate sotto.
> - Test: 54/54 · 1788 asserzioni → **55/55 · 1890** (nuovo `llmPanel.test.mjs`; casi nuovi in `logFormat`, `llmDriver`,
>   `llmTranslatePass`).
> - Bundle: runtime React **identico byte per byte** a HEAD (build in un worktree); plugin +210 B, solo il refactor dei
>   prefissi di `utility.js`; nessun file del pannello nei bundle (grep).
> - Provato in un pty vero (`script`) con driver finto lento: rich, `--simpleLog`, 60 colonne, 8 righe con 12 lingue,
>   retry 429, contesto. Non provato: una chiamata vera (costa), Windows.

> [!IMPORTANT]
> - **Fuori perimetro**, visto nella trace della demo `260918193523`: DeepSeek ha risposto `{"items":[…]}` — ha ricopiato
>   la forma del payload — e il run ha riempito 0 chiavi in silenzio. Ora il pannello lo dice
>   (`0 new keys Deutsch. 6 not returned, 1 unknown key ignored`), ma prompt e parsing non sono stati toccati.
> - Un run in cui **tutte** le richieste falliscono esce ancora con codice 0.
> - README: `4254 bytes` è già sbagliato su HEAD (misura 4258 B): da aggiornare alla chiusura della release.

---

## La richiesta (2026-09-18)

> il modello è quello del tty che si aggiorna stando sulla stessa riga; il numero di righe equivale il numero di
> connessioni, quindi gli aggiornamenti (1/secondo) le rimostrano tutte. Ogni connessione ha un indicatore di query e di
> soggetto: `[braille] > ask 10 keys italian - doitch` · `[conferma] < 10 new keys doitch. Full translate!` ·
> `[errore] - error doitch. see trace in debug mode!`. Alla fine delle query tutta la sezione tty viene sovrascritta da un
> log equivalente con aggiunta dei costi.

## Decisioni

| Tema | Decisione |
| :- | :- |
| "Connessione" | una **richiesta** (un lotto, una riparazione, il contesto), non uno slot di concorrenza: il log finale deve essere "equivalente", e degli slot non si farebbe un log |
| Quando nasce la riga | quando la connessione **parte**: con 12 lotti e `maxConcurrency` 4 le righe crescono fino a 12 |
| Nomi delle lingue | autonimi corti e disambiguati, `nomeLingua` di `syncReport.js` — gli stessi del riepilogo di sync ("Deutsch", "日本語", "中文 (zh-CN.yml)") |
| Aggiornamenti | ogni secondo (spinner e contasecondi) **e** a ogni evento, così un esito non aspetta il giro dopo |
| Indicatori | spinner braille · `✔` verde (tutte valide) / arancione (qualcosa manca) · `✖` rosso |
| Parte destra | dal vivo i secondi (e `retry 1/3 after HTTP 429`, che cede il posto in un terminale stretto); nel log finale costo e secondi. Ancorata al bordo della colonna: non salta quando cambia la riga più lunga |
| Costo per riga | in valuta coi prezzi configurati, altrimenti i token; niente se il provider non dà `usage`. Il totale resta quello di `printRunResult` |
| Contesto e riparazione | righe anche loro: la riparazione nello stesso pannello del primo giro, il contesto in un pannello suo (arriva prima della stima) |
| Più connessioni che righe di schermo | restano visibili quelle in corso, le più vecchie chiuse diventano `… N more: …`; il log finale le ha tutte |
| Cursore | **mai nascosto**: andrebbe ripristinato su ogni uscita, Ctrl+C compreso |
| Stampe altrui durante il pannello | `console.log/info/warn/error` avvolti: finiscono sopra la regione |
| Senza TTY | solo il log finale |
| `printRunResult` | invariato: il riepilogo per lingua (netto, dopo la riparazione) e il totale misurato restano sotto il pannello |

## File

- `lib/utility.js` — `clipToWidth` (tronca per colonne, ANSI e CJK compresi), `logTextWidth`, `logLineRows` (la riga di
  `logEchoColored` restituita e senza a capo); i prefissi di riga estratti in tre helper usati anche da `riga()`,
  `rigaSemplice()`, `logRule()` — output invariato.
- `lib/dev/llm/liveRegion.js` — nuovo: la regione che si riscrive (risalita, cancella riga, cancella sotto; un `write` per
  fotogramma; mai `\x1b[0A`; altezza ≤ `rows - 1`; larghezza ≤ `columns - 1`; timer `unref`).
- `lib/dev/llm/requestPanel.js` — nuovo: righe, testi, finestra, log finale con costi, `shortReason`.
- `lib/dev/llm/callModel.js` — `onRetry({ retry, maxRetries, error })` prima di ogni nuovo tentativo.
- `lib/dev/llm/translatePass.js` — pannello per il contesto e per primo giro + riparazione; `sendBatch` unico per i due
  giri; `applyResult`/`applyRepair` per risposta, con i conteggi della riga; `try/finally` che chiude sempre il pannello;
  nota se `maxCostPerRun` ferma il run.
- Test: `test/list/llmPanel.test.mjs` (nuovo), `logFormat`, `llmDriver`, `llmTranslatePass`.
- Doc: `doc/llm.md` § "While it runs", `doc/structure.md` § Phase 5 (+ l'eccezione in Phase 1, mappa dei file,
  diagramma), `README.md` (due righe d'esempio), `package.json` `versionDescription`.
