# Piano di implementazione idePlugin: cartelle in `src/`

> [!NOTE]
> **Per il revisore umano**
> - **Solo spostamento:** i 23 moduli accanto a `extension.mjs` vanno in `core/`, `probes/`, `views/results/`, `webViews/{selector,project,optional}`. Optional si divide ancora in `help/` e `llm/`.
> - **Nessun cambio di logica**, nessun nome di file cambiato (`webview.mjs` compreso), `extension.mjs` resta dov'è e resta l'unico che importa `vscode`.
> - **`dist/` invariata:** stessi nomi in uscita, quindi `package.json`, `.vscodeignore` ed `extension.mjs` (che punta a `dist/`) non si toccano.
> - **Si toccano:** gli import relativi (compresi i `../../lib/` che diventano `../../../lib/`), gli input di `rolldown.config.mjs`, gli import dei test `test/list/idePlugin*`, i link di `doc/structure.md`.
> - **Prova:** tutti gli import si risolvono (script in Node), `npm test -- idePlugin` verde, i bundle browser di `dist/` identici byte per byte a quelli di prima.
> - **Rinviato:** l'estrazione di `MarkedTree`, `PageView`, `OptionalView` da `extension.mjs` (1344 righe), da fare in un piano a parte.

---

## Istruzioni per chi implementa

Segui le sette fasi di `AGENTS.md` **nell'ordine**: implementazione, test, build, review, documentazione,
pulizia, logDiary. Non saltarne nessuna, e non anticipare la documentazione: gli appunti vanno in
`idePlugin_srcLayout.necessarydoc.md` e si eseguono alla fase 5.

Regole di questo piano:

- **Non modificare il contenuto dei moduli** oltre alle righe `import … from "…"` e ai commenti indicati qui.
  Se ti sembra che serva altro, fermati e chiedi (ask).
- **Non rinominare nessun file.** Cambia solo la cartella.
- **Non toccare** `idePlugin/package.json`, `idePlugin/.vscodeignore`, i percorsi `dist/…` dentro `extension.mjs`.
- Lavora dalla radice del repo: `/run/media/aldo/4TB_Dati/L/Web/Dev/React/viteTranslate4`.

## Decisioni (prese con l'utente)

| Punto | Scelta |
| --- | --- |
| Portata | solo spostamento; le classi di `extension.mjs` restano lì |
| Nomi dei file | invariati (es. `webViews/selector/selectorPage.mjs`, non `page.mjs`) |
| `webview.mjs` | resta `webview.mjs` (in `webViews/selector/`), `dist/webview.js` invariato |
| `views/` | le view native di VS Code (oggi solo Results, una TreeView) |
| `webViews/` | una cartella per webview; una webview con più usi (Optional: Help, LLM) ha una sottocartella per uso |
| `pageCommon.mjs` | in `webViews/`, perché lo usano tutte le pagine |
| `llmCheck.mjs` | in `webViews/optional/llm/`: serve solo il pannello LLM |

## La struttura di arrivo

```
idePlugin/src/
  extension.mjs                       (resta qui)
  core/
    pickProject.mjs
    readPackage.mjs
    summarize.mjs
    syncCommand.mjs
  probes/
    probe.mjs
    markedProbe.mjs
    markedScan.mjs
    runProbe.mjs
    scanWorker.mjs
  views/
    results/
      markedRows.mjs
      markerSpan.mjs
  webViews/
    pageCommon.mjs
    selector/
      selectorPage.mjs
      selectorState.mjs
      webview.mjs
    project/
      projectPage.mjs
      projectState.mjs
      projectWebview.mjs
    optional/
      optionalWebview.mjs
      help/
        helpPage.mjs
      llm/
        llmCheck.mjs
        llmPage.mjs
        llmPanel.mjs
```

---

## Fase 0 — prima di cominciare (ask)

Il working tree ha molte modifiche non committate e file non tracciati. Chiedi all'utente se vuole
committare prima dello spostamento (consigliato: così il commit dello spostamento contiene solo rinomine
e git le riconosce). Non committare di tua iniziativa.

Poi salva i bundle browser di oggi, servono per il confronto della fase 3:

```bash
npm run ide:build
mkdir -p /tmp/claude-1000/srcLayout-before
cp idePlugin/dist/*.js idePlugin/dist/*.mjs idePlugin/dist/extension.cjs /tmp/claude-1000/srcLayout-before/
```

(Se esiste una scratchpad di sessione usa quella al posto di `/tmp/claude-1000`.)

## Fase 1 — implementazione

### 1.1 Spostare i file

Usa `mv` semplice (alcuni file non sono tracciati, `git mv` fallirebbe su quelli):

```bash
cd idePlugin/src
mkdir -p core probes views/results webViews/selector webViews/project webViews/optional/help webViews/optional/llm
mv pickProject.mjs readPackage.mjs summarize.mjs syncCommand.mjs core/
mv probe.mjs markedProbe.mjs markedScan.mjs runProbe.mjs scanWorker.mjs probes/
mv markedRows.mjs markerSpan.mjs views/results/
mv pageCommon.mjs webViews/
mv selectorPage.mjs selectorState.mjs webview.mjs webViews/selector/
mv projectPage.mjs projectState.mjs projectWebview.mjs webViews/project/
mv optionalWebview.mjs webViews/optional/
mv helpPage.mjs webViews/optional/help/
mv llmCheck.mjs llmPage.mjs llmPanel.mjs webViews/optional/llm/
ls   # deve restare solo: extension.mjs core probes views webViews
cd ../..
```

### 1.2 Riscrivere gli import dentro `idePlugin/src`

Tabella completa. Cambia **solo** la stringa tra virgolette; il resto della riga resta identico.
Gli import di pacchetti (`node:…`, `vscode`, `@vscode-elements/…`) non cambiano.

| File (nuovo percorso) | Vecchio specificatore | Nuovo specificatore |
| --- | --- | --- |
| `extension.mjs` | `./pickProject.mjs` | `./core/pickProject.mjs` |
| `extension.mjs` | `./readPackage.mjs` | `./core/readPackage.mjs` |
| `extension.mjs` | `./runProbe.mjs` | `./probes/runProbe.mjs` |
| `extension.mjs` | `./markedRows.mjs` | `./views/results/markedRows.mjs` |
| `extension.mjs` | `./scanWorker.mjs` | `./probes/scanWorker.mjs` |
| `extension.mjs` | `./markerSpan.mjs` | `./views/results/markerSpan.mjs` |
| `extension.mjs` | `./selectorPage.mjs` | `./webViews/selector/selectorPage.mjs` |
| `extension.mjs` | `./projectPage.mjs` | `./webViews/project/projectPage.mjs` |
| `extension.mjs` | `./helpPage.mjs` | `./webViews/optional/help/helpPage.mjs` |
| `extension.mjs` | `./llmPage.mjs` | `./webViews/optional/llm/llmPage.mjs` |
| `extension.mjs` | `./llmPanel.mjs` | `./webViews/optional/llm/llmPanel.mjs` |
| `extension.mjs` | `./llmCheck.mjs` | `./webViews/optional/llm/llmCheck.mjs` |
| `extension.mjs` | `./selectorState.mjs` | `./webViews/selector/selectorState.mjs` |
| `extension.mjs` | `./projectState.mjs` | `./webViews/project/projectState.mjs` |
| `extension.mjs` | `./syncCommand.mjs` | `./core/syncCommand.mjs` |
| `core/pickProject.mjs` | `../../lib/dev/vite/uty/configFiles.js` | `../../../lib/dev/vite/uty/configFiles.js` |
| `core/summarize.mjs` | `../../lib/dev/vite/uty/listLanguageFiles.js` | `../../../lib/dev/vite/uty/listLanguageFiles.js` |
| `core/summarize.mjs` | `../../lib/dev/vite/uty/languageFileFormat.js` | `../../../lib/dev/vite/uty/languageFileFormat.js` |
| `core/summarize.mjs` | `../../lib/dev/vite/uty/languageAutonym.js` | `../../../lib/dev/vite/uty/languageAutonym.js` |
| `views/results/markedRows.mjs` | `./summarize.mjs` | `../../core/summarize.mjs` |
| `views/results/markedRows.mjs` | `./pickProject.mjs` | `../../core/pickProject.mjs` |
| `webViews/selector/selectorPage.mjs` | `./pageCommon.mjs` | `../pageCommon.mjs` |
| `webViews/selector/selectorState.mjs` | `./summarize.mjs` | `../../core/summarize.mjs` |
| `webViews/selector/selectorState.mjs` | `./markedRows.mjs` | `../../views/results/markedRows.mjs` |
| `webViews/project/projectPage.mjs` | `./pageCommon.mjs` | `../pageCommon.mjs` |
| `webViews/project/projectState.mjs` | `./summarize.mjs` | `../../core/summarize.mjs` |
| `webViews/optional/llm/llmPage.mjs` | `./pageCommon.mjs` | `../../pageCommon.mjs` |
| `webViews/optional/llm/llmPanel.mjs` | `./syncCommand.mjs` | `../../../core/syncCommand.mjs` |

Restano **invariati** (stessa cartella di prima e di dopo):
`probes/markedProbe.mjs` → `./markedScan.mjs`, `probes/scanWorker.mjs` → `./runProbe.mjs`,
`webViews/project/projectState.mjs` → `./projectPage.mjs`.

Gli `import()` dinamici in `probes/probe.mjs` e `probes/markedScan.mjs` costruiscono il percorso a runtime
(dal progetto dell'utente, non da `src/`): **non toccarli**.

### 1.3 `idePlugin/rolldown.config.mjs`

Cambia solo i sei `input`; gli `output` restano identici (stessi nomi in `dist/`):

| Vecchio `input` | Nuovo `input` |
| --- | --- |
| `./src/extension.mjs` | invariato |
| `./src/probe.mjs` | `./src/probes/probe.mjs` |
| `./src/markedProbe.mjs` | `./src/probes/markedProbe.mjs` |
| `./src/webview.mjs` | `./src/webViews/selector/webview.mjs` |
| `./src/projectWebview.mjs` | `./src/webViews/project/projectWebview.mjs` |
| `./src/optionalWebview.mjs` | `./src/webViews/optional/optionalWebview.mjs` |

### 1.4 Commenti

Solo due ritocchi, niente altro:

- `extension.mjs`, riga 2: "sta nei moduli accanto" → "sta nei moduli delle cartelle accanto (core/, probes/,
  views/, webViews/)".
- `webViews/selector/webview.mjs`, riga 2: il riferimento a `rolldown.config.mjs` resta valido, non toccarlo.

I commenti che citano altri moduli per nome (es. "vedi runProbe.mjs") restano validi: i nomi non cambiano.

### 1.5 Appunti per le fasi dopo

Crea `doc/ImplementationPlans/idePlugin_srcLayout.necessarytest.md` con l'elenco della fase 2 e
`doc/ImplementationPlans/idePlugin_srcLayout.necessarydoc.md` con l'elenco della fase 5 (copiali da qui).

## Fase 2 — test

### 2.1 Import dei test

In `test/list/` cambia i percorsi `../../idePlugin/src/<nome>` secondo la struttura di arrivo. Elenco:

| Test | Da aggiornare |
| --- | --- |
| `idePluginExtension.test.mjs` | `projectState.mjs` (riga 25), `syncCommand.mjs` (righe 496, 714), helper `SRC` (riga 65, vedi sotto) |
| `idePluginStartup.test.mjs` | helper `SRC` (riga 48, vedi sotto) |
| `idePluginLlm.test.mjs` | `llmCheck`, `llmPanel`, `llmPage` → `webViews/optional/llm/`; `syncCommand` → `core/` |
| `idePluginMarked.test.mjs` | `runProbe`, `scanWorker`, `markedProbe` → `probes/`; `markedRows` → `views/results/` |
| `idePluginProbe.test.mjs` | `runProbe`, `probe` → `probes/` |
| `idePluginMarkerSpan.test.mjs` | `markerSpan` → `views/results/` |
| `idePluginPick.test.mjs` | `pickProject` → `core/` |
| `idePluginProject.test.mjs` | `projectState`, `projectPage` → `webViews/project/`; `helpPage` → `webViews/optional/help/` |
| `idePluginSelector.test.mjs` | `selectorState`, `selectorPage` → `webViews/selector/` |
| `idePluginSummary.test.mjs` | `summarize` → `core/` |
| `idePluginWorker.test.mjs` | `scanWorker`, `runProbe` → `probes/` |

`extension.mjs` (righe 24 dei due test di estensione) resta `../../idePlugin/src/extension.mjs`.

**Helper `SRC`** (in `idePluginExtension.test.mjs` e `idePluginStartup.test.mjs`): serve solo a puntare le
due sonde. Cambia la riga `SONDE` così, lasciando `SRC` com'è:

```js
const SONDE = { [join("dist", "probe.mjs")]: SRC("probes/probe.mjs"), [join("dist", "markedProbe.mjs")]: SRC("probes/markedProbe.mjs") };
```

Le stringhe `dist/webview.js`, `dist/projectWebview.js` nei test **non** cambiano.

### 2.2 Verifica rapida degli import (Node, niente build)

Salva questo script nella scratchpad (non nel repo) ed eseguilo dalla radice. Deve stampare `0 rotti`:

```js
// checkImports.mjs — ogni import relativo di idePlugin/src e dei test idePlugin punta a un file esistente
import fs from "node:fs";
import path from "node:path";
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (p.endsWith(".mjs")) files.push(p);
} };
walk("idePlugin/src");
for (const f of fs.readdirSync("test/list")) if (f.startsWith("idePlugin")) files.push(path.join("test/list", f));
let rotti = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|new URL\(\s*`?)["'`](\.{1,2}\/[^"'`$]+)["'`]/g)) {
    const target = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(target)) { rotti++; console.log(`${f}: ${m[1]}`); }
  }
}
console.log(rotti, "rotti");
```

Poi: `grep -rn "idePlugin/src/[a-zA-Z]*\.mjs" test/list | grep -v "src/extension.mjs"` non deve trovare niente.

### 2.3 Suite

```bash
npm test -- idePlugin
```

Tutti i test `idePlugin*` devono passare, con lo stesso numero di asserzioni di prima dello spostamento
(se non lo sai, lancialo anche in fase 0 e annota i numeri).

## Fase 3 — build

```bash
npm run ide:build
ls idePlugin/dist
```

`dist/` deve contenere gli stessi file di prima. Confronto con la fase 0:

```bash
B=/tmp/claude-1000/srcLayout-before
for f in webview.js projectWebview.js optionalWebview.js; do cmp "$B/$f" "idePlugin/dist/$f" && echo "$f identico"; done
diff <(grep -v '^//#\(end\)\?region' "$B/extension.cjs") <(grep -v '^//#\(end\)\?region' idePlugin/dist/extension.cjs)
diff <(grep -v '^//#\(end\)\?region' "$B/probe.mjs") <(grep -v '^//#\(end\)\?region' idePlugin/dist/probe.mjs)
diff <(grep -v '^//#\(end\)\?region' "$B/markedProbe.mjs") <(grep -v '^//#\(end\)\?region' idePlugin/dist/markedProbe.mjs)
```

Atteso: i tre `.js` identici; i `diff` vuoti o con differenze solo nei commenti di percorso (`src/core/…`
al posto di `src/…`). Qualunque differenza di codice è un errore: torna alla fase 1.

Facoltativo: `npm run ide:package` e confronto del peso del `.vsix` (deve restare uguale entro pochi byte).

## Fase 4 — review

- Rileggi `git status`: devono comparire solo i file spostati, gli import, `rolldown.config.mjs`, i test.
- Se un passo di questo piano si è rivelato sbagliato (un import mancante nella tabella, una differenza di
  codice nel bundle), scrivi `idePlugin_srcLayout.necessaryreview.md` con la correzione, chiedi (ask)
  all'utente e riparti dalla fase 1.
- Se possibile, prova nell'editor (`npm run ide:install`): le quattro sezioni si aprono, Results scansiona,
  Help e LLM si aprono dal bottone LLM.

## Fase 5 — documentazione

Da `idePlugin_srcLayout.necessarydoc.md`:

- `doc/structure.md`, sezione *The editor extension: `idePlugin/`*: aggiorna i link `../idePlugin/src/<nome>`
  ai nuovi percorsi (circa 12, righe ~1112–1130: `probe`, `markedProbe`, `markedScan` ×2, `scanWorker`,
  `pickProject`, `markerSpan`, `selectorState`, `webview`, `projectState`, `projectWebview`, `syncCommand`,
  `helpPage`, `llmPage`, `llmPanel`, `llmCheck`). Controlla con
  `grep -n "idePlugin/src/" doc/structure.md` che ogni link esista su disco.
- Sempre lì, dopo il paragrafo d'apertura, aggiungi due righe in inglese sulla disposizione, per esempio:
  "Sources live in `idePlugin/src/`: `extension.mjs` (the only file that imports `vscode`), `core/` (pure
  Node helpers), `probes/` (child processes), `views/` (native views: Results), `webViews/` (one folder per
  webview; Optional splits into `help/` and `llm/`)."
- I piani vecchi in `doc/ImplementationPlans/` citano i percorsi di allora: **non toccarli**, sono storia.
- `idePlugin/README.md` non cita percorsi di `src/`: niente da fare.

## Fase 6 — pulizia

Cancella `idePlugin_srcLayout.necessarytest.md`, `idePlugin_srcLayout.necessarydoc.md` e (se c'è)
`idePlugin_srcLayout.necessaryreview.md`. Cancella la cartella di confronto della fase 0 e lo script
`checkImports.mjs` dalla scratchpad.

## Fase 7 — logDiary

Aggiungi in testa a questo file, subito dopo la `[!NOTE]`, una `[!TIP]` (massimo una decina di righe, elenco
puntato) con: cosa è stato spostato, l'esito di `npm test -- idePlugin`, l'esito del confronto dei bundle,
le eventuali deviazioni dal piano. Se qualcosa è rimasto non verificato (es. la prova nell'editor), una
`[!CAUTION]` a parte.
