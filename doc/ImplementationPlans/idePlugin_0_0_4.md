# Piano di implementazione idePlugin 0.0.4: pannello reattivo e mai incoerente

> [!NOTE]
> **Per il revisore umano**
> - **Problema:** ogni salvataggio rifà in un processo nuovo la scansione Babel di *tutti* i sorgenti (playground: ~0,5 s, di cui 380 ms solo per caricare Babel). Nell'attesa le sezioni mostrano i dati vecchi, anche quelli di un altro progetto.
> - **Libreria:** la sync scrive un indice delle voci, `node_modules/.viteTranslate/markers.json` (posizione, forma e avvisi per file, più `[mtimeMs, size]` e hash). Non si tocca `scan.json`. Nessuna scrittura a ogni HMR.
> - **Sonda di Marked:** legge l'indice, rifà il parse solo dei file cambiati dopo la sync. Le correzioni tornano all'estensione (overlay, in memoria) e le ripassa alla richiesta successiva. Babel solo per i file cambiati davvero.
> - **Processo a tempo:** il figlio resta vivo solo se ha caricato Babel, e si chiude dopo 2 minuti senza richieste. Senza Babel si chiude subito dopo aver risposto.
> - **Mai incoerente:** Marked e Details non aspettano più la sonda per disegnare. Al cambio progetto si svuotano ("Loading…"). Su un salvataggio si blocca subito la riga del file (clic disattivati). Su una modifica non salvata compare "✎ unsaved". Su lingue o config compare un messaggio in testa.
> - **Bug corretto:** una risposta lenta partita prima non sovrascrive più intestazione e disegno di una più recente.
> - **Librerie ≤ 4.6.4-rc.1:** nessun indice, scansione completa come oggi.

> [!TIP]
> **logDiary**
> - **Misure** (copia del playground, 18 file marcati, sonda compilata): apertura 77 ms con l'indice contro 535 senza; primo salvataggio di un file marcato 499 ms (Babel a freddo); i successivi 9 ms; un `.yml` 7 ms. `markers.json` pesa 32,5 kB per 104 chiavi.
> - **Test:** 3 file nuovi (`markerIndex` 20, `idePluginWorker` 17, parte nuova di `idePluginMarked`) e `idePluginExtension` esteso a 106 asserzioni. La guardia di turno è verificata anche togliendola: senza, il test fallisce.
> - **Deviazione dal piano:** il test su un turno superato conta le scritture dell'intestazione invece di leggerla dopo; letta dopo, il disegno più recente l'aveva già riscritta.
> - **Helper `pieno()` nei test:** una lettura veloce può finire prima che si controlli `pending`, quindi l'helper considera anche la riga "Loading". È una corsa del test, non del codice.
> - **Nessun `.necessary*.md`:** nessun ciclo di review, niente da pulire.
> - **Build:** `ide:build`, `build`, `estimateSize` → `README: OK` (9869 byte, invariato).

> [!CAUTION]
> - **Fase 4 non fatta nell'editor.** Mancano le prove a mano in VS Code: messaggio in testa, `✎`/`⏳`, barra di avanzamento, rotella di "Loading". Le ho sostituite con la misura end-to-end qui sopra.
> - **`npm test`: 80/81.** Fallisce `compileGolden` (9 KO), ed è **preesistente**: fallisce uguale con le modifiche messe da parte con `git stash`.
> - **Versione dell'estensione non toccata** (il piano lo diceva). La decide il rilascio.

---

## Istruzioni per chi implementa

Leggi prima `AGENTS.md`, sezione "REGOLE DI IMPLEMENTAZIONE DEL PLAN". Le sette fasi, in ordine:
implementazione → test → build → review → documentazione → pulizia → logDiary. I test che nascono in
corso d'opera vanno in `idePlugin_0_0_4.necessarytest.md`, le modifiche ai doc in
`idePlugin_0_0_4.necessarydoc.md`. Niente build dove basta `node --check` o uno script.

Regole di stile, su ogni file toccato:

- Commenti in italiano, testi per l'utente in inglese.
- `vscode` si importa **solo** in `idePlugin/src/extension.mjs`. I moduli nuovi (`scanWorker.mjs`,
  `markedScan.mjs`) restano Node puro.
- In `lib/`: ogni file toccato rimanda a `doc/structure.md`, e il doc si aggiorna nello stesso giro.
- Nessuna dipendenza nuova. Nessun commit se l'utente non lo chiede. La versione dell'estensione
  (`idePlugin/package.json`) non si tocca: la decide il rilascio.

---

## Decisioni prese con l'utente

| Domanda | Risposta |
| --- | --- |
| Chi scrive la cache? | La libreria, durante la sync. L'estensione la legge e basta. |
| Aggiornare l'indice a ogni HMR? | No, per ora. Solo la sync lo scrive (CLI, auto-sync all'avvio di `vite dev`, passaggio LLM). |
| Babel caldo? | Processo a tempo: resta vivo solo se ha caricato Babel, fino a 2 minuti di inattività. |
| Cambio progetto | Marked e Details si **svuotano** subito ("Loading <nome>…"). |
| Stesso progetto, dati superati | Si **bloccano**: messaggio in testa, righe dei file toccati senza clic. |

## Decisioni tecniche

- **D1: `markers.json`, non `scan.json`.** `scan.json` vuol dire "tabelle allineate a questi
  sorgenti", e su questo `fastVerify` decide di non fare niente: lo scrive solo una sync riuscita.
  L'indice dice solo *dove* sono le voci: nessuno ne trae conclusioni sulle tabelle. Per questo si
  scrive anche con file saltati (`skipped`): quei file mancano dall'indice, e chi legge li
  rileggerà da sé.
- **D2: cosa c'è nell'indice.** `srcDir`, `localeDir` (come scritti in vite.config), `autoWrap`
  come chiave (`false`, `true`, o la RegExp come stringa), `files: { rel: [mtimeMs, size] }` di
  tutti i file letti, `marked: { rel: { hash, entries, warnings } }` dei file con marcatori. Le
  voci sono esattamente quelle di `onMarker` (`id, text, line, column, form`), gli avvisi
  `{ kind, message }` grezzi, colori compresi. Il giudizio sulle traduzioni **non** c'è: dipende
  dai `.yml`, che cambiano per conto loro, e costa poco.
- **D3: stesso `hash` della libreria** (`markerCore.js`, senza Babel) per indice e overlay.
- **D4: validità dell'indice** per la sonda: `version` di schema 1, `pkgVersion` uguale alla
  libreria installata, `srcDir`/`localeDir` risolti uguali all'input, stessa chiave `autoWrap`.
  Altrimenti è come non averlo.
- **D5: overlay.** La sonda restituisce, per ogni file che *non* ha preso dall'indice, `{ stat,
  hash, entries, warnings }` (o `{ stat, none: true }` se non ha marcatori). L'estensione lo tiene
  per progetto e lo ripassa via IPC alla richiesta successiva. Così un file cambiato dopo la sync si
  paga una volta sola, anche se il processo muore. Si butta quando cambia la config (`forget`).
- **D6: il processo.** `ScanWorker` (Node puro, `scanWorker.mjs`) avvia la sonda in modalità IPC,
  una per progetto, e mette le richieste in coda. La risposta dice `babel: true|false`. Con
  `false` e coda vuota il processo si chiude subito; con `true` resta vivo per `IDLE_MS = 120000`.
  Timeout per richiesta 30 s. Se il processo riusato si chiude senza rispondere, si riprova una
  volta con uno nuovo. Se la libreria sul disco è cambiata sotto un processo vivo, la sonda
  risponde `STALE_WORKER` e si riparte da uno nuovo. Si chiude su `forget`, sul refresh e su
  `deactivate`.
- **D7: la sonda resta usabile a mano.** Con `argv[2]` risponde una volta sola come oggi (test,
  prove a mano). Senza argomenti e con IPC fa da worker.
- **D8: disegno che non aspetta.** `MarkedTree.rootRows` non attende più la sonda. Per ogni
  progetto tiene `{ risultato, carico, attesa, toccati, tutto, gen }`. C'è un risultato fresco?
  Lo disegna. È superato? Disegna quello vecchio bloccato e intanto carica. Non c'è niente? Mostra
  la riga "Loading <nome>…" (icona `loading~spin`). A carico finito si ridisegna. La barra di
  avanzamento della vista viene da `window.withProgress({ location: { viewId } })`, visto che
  VS Code la mostra da sé solo mentre `getChildren` è in attesa.
- **D9: cosa blocca cosa.**
  - Un sorgente salvato (watcher): `toccati` += file, subito un ridisegno bloccato; il carico
    parte dopo il debounce di 300 ms (`attesa`).
  - Un `.yml` di `localeDir`: `tutto = "locale"`, messaggio in testa; i clic restano (le righe
    non si spostano).
  - `vite.config`/`package.json`, refresh, trust: `tutto = "config"`; il worker si chiude, l'overlay
    si butta.
  - Una modifica non salvata (`onDidChangeTextDocument`, `isDirty`): `✎ unsaved` sulla riga del
    file e niente clic sulle sue voci; torna normale quando il documento non è più sporco o si
    chiude.
  - La riga bloccata di un file: `description` "⏳ updating" / "✎ unsaved", voci senza `open`,
    tooltip che spiega perché.
- **D10: Details** fa lo stesso con la lettura del vite.config: se non è ancora pronta mostra
  "Reading vite.config…", e si ridisegna quando arriva.
- **D11: guardia di turno** (A4). `rootRows` di Marked e Details numera le chiamate. Una chiamata
  superata non tocca `description`, `message` né `rendered`.

## Mappa dei file

| File | Cosa |
| --- | --- |
| `lib/dev/vite/uty/markerIndex.js` | **nuovo**: percorso, lettura, scrittura, `autoWrapKey` |
| `lib/dev/vite/uty/scanSource.js` | raccoglie voci e avvisi per file, restituisce `index` |
| `lib/dev/vite/syncCore.js` | scrive `markers.json` dopo `scan.json` |
| `idePlugin/src/markedScan.mjs` | **nuovo**: la scansione (indice + overlay + Babel), Node puro |
| `idePlugin/src/markedProbe.mjs` | solo ingresso: una volta (argv) o worker (IPC) |
| `idePlugin/src/scanWorker.mjs` | **nuovo**: vita del processo, coda, tempi |
| `idePlugin/src/runProbe.mjs` | esporta `forkProbe` (stesse opzioni di `fork` per tutti) |
| `idePlugin/src/markedRows.mjs` | `loadingRow`, `frozenRows` |
| `idePlugin/src/extension.mjs` | stati per progetto, disegno che non aspetta, sporchi, worker |
| `test/list/markerIndex.test.mjs` | **nuovo** |
| `test/list/idePluginWorker.test.mjs` | **nuovo** |
| `test/list/idePluginMarked.test.mjs`, `idePluginExtension.test.mjs`, `idePluginVscodeStub.mjs` | estesi |

## Fase 1: implementazione

1. `markerIndex.js` (D1–D3). `scriviJson`/`leggiJson` di `sessionStore.js`, come `scanRecord.js`.
2. `scanSource.js`: dentro il ciclo, per ogni file marcato, `onMarker` e un `warn` che annota anche
   per file; un file saltato non entra in `index`. Restituisce `index: { files, marked }`.
3. `syncCore.js`: `writeMarkerIndex` subito dopo il blocco `writeScan`/`clearScan`, sempre
   (non in `--status`, che esce prima).
4. `markedScan.mjs`: `createScanner()` → `scan(opzioni, overlay)`. Ramo con indice (D4, D5) se la
   libreria ha `markerIndex.js`; altrimenti il percorso di oggi. Risposta di oggi più `overlay`,
   `babel`, `origin: { index, overlay, parsed }`.
5. `markedProbe.mjs`: argv → una risposta; IPC senza argv → worker (`{ id, input, overlay }` →
   `{ id, ...risposta }`), `disconnect` → exit.
6. `runProbe.mjs`: `forkProbe(probePath, args, dir)`.
7. `scanWorker.mjs` (D6).
8. `markedRows.mjs`: `loadingRow(testo)`, `frozenRows(rows, bloccati)` con
   `bloccati: Map<pathKey, "saved"|"unsaved">`.
9. `extension.mjs` (D8–D11).

## Fase 2: test

- `markerIndex.test.mjs`: CLI su un progetto temporaneo → `markers.json` con voci, righe, forma,
  `files`; `--status` non lo scrive; un file che non si parsa manca dall'indice ma l'indice c'è.
- `idePluginMarked.test.mjs`: con indice, `origin.parsed === 0` e `babel === false`; un file
  modificato → `parsed === 1`; ripassando l'overlay → `parsed === 0`; `autoWrap` diverso → indice
  ignorato; stesse `files` della scansione completa.
- `idePluginWorker.test.mjs`: con una sonda finta, chiusura subito con `babel: false`, vita e
  scadenza con `babel: true`, `STALE_WORKER`, chiusura senza risposta e nuovo tentativo, timeout,
  coda.
- `idePluginExtension.test.mjs`: "Loading" al primo disegno, poi dati; salvataggio → riga bloccata
  senza clic; `.yml` → messaggio; sporco → "✎ unsaved"; turno superato che non tocca
  l'intestazione; Details "Reading vite.config…".

## Fase 3: build

`npm run ide:build`, `npm run build`, `npm test`, `npm run estimateSize` (README: OK).

## Fase 4: review

A mano nell'editor (`npm run ide:dev`), se disponibile: salvataggi, cambio progetto, `.yml`,
modifica non salvata, output channel coi tempi. Altrimenti lo si segnala nel diario.

## Fase 5: documentazione

`doc/structure.md` (cache fra sessioni: `markers.json`; sezione dell'estensione: indice, overlay,
processo a tempo, stati bloccati), `idePlugin/README.md` (cosa vede l'utente), `CONTRIBUTING.md`
se cita i file della sonda.

## Fase 6: pulizia

Via i `.necessary*.md` non più necessari.

## Fase 7: logDiary

Nota `[!TIP]` dopo la `[!NOTE]`.

## Fuori da questo piano

- Disegnare Marked dall'indice **prima** che arrivi la lettura del vite.config (servono
  `sourceLanguage` e glifi nell'indice: dati provvisori da confermare).
- Una cache fra sessioni della lettura del vite.config.
- L'indice aggiornato dal dev server a ogni HMR.
