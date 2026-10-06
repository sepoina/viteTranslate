# Piano di implementazione idePlugin: il contratto di Results con la libreria

> [!NOTE]
> **Per il revisore umano**
> - **Un export nuovo nella libreria**, `@sepoina/vitetranslate/ide/scan` (`lib/ide/scan.js`, sorgente): le dieci funzioni
>   che Results oggi importa per percorso da `lib/dev/` della libreria installata, più `IDE_API = 1`.
> - **Results lo usa** (`markedScan.mjs`) e chiede `IDE_API >= IDE_API_MIN` (oggi 1). Sotto: errore `TOO_OLD` con
>   `npm install @sepoina/vitetranslate@latest`. Le librerie **senza** l'export si leggono come oggi (per percorso).
> - **Contratto additivo**: gli export si aggiungono, mai tolti. `IDE_API` sale solo quando l'estensione comincia a usare un
>   export nuovo; solo allora la libreria si pubblica prima della .vsix (AGENTS.md, "REGOLE DI RILASCIO", già aggiornato).
> - **Non cambia**: evidenziazione, elenco dei progetti, Translations e Settings restano sulla copia impacchettata alla build
>   (funzionano in Restricted Mode e senza `node_modules`). Nessun vincolo sulla versione del pacchetto.
> - Scartati dal piano precedente: caricamento della libreria nell'extension host, versione minima = versione della build,
>   glob largo dei `vite.config.*` (con il glob di oggi, a nomi esatti, i file `*.timestamp-*` non vengono mai trovati).

> [!TIP]
> **logDiary (2026-10-06)**
> - Piano eseguito senza deviazioni. Unico intoppo: nel test di Marked il nome `vecchia` era già usato nello stesso blocco,
>   il caso nuovo usa `tooOld`.
> - Test: baseline 14/14 · 708 → **15/15 · 720** (`ideScanEntry` nuovo, 7 asserzioni; `idePluginMarked` 82 → 87).
> - Build: `markedProbe.mjs` impacchettato conosce `ide/scan`; `lib/ide/scan.js` è nel pacchetto npm (1,5 kB);
>   `estimateSize` → `README: OK`.
> - Fase 4, punto 1: provato lanciando la sonda vera su `demo/Vite_8/minimal` (ok, `api 1`, righe presenti), non nell'editor.
>   Punto 2: nessuna demo ha una libreria vecchia installata per conto suo; il caso lo copre il test.
> - Doc: `doc/structure.md` (paragrafo di Results), `CONTRIBUTING.md` (una riga). README invariati (9869 B e 9771 B).

> [!CAUTION]
> - `npm test`: **`compileGolden` rosso (9 KO), già prima di questo piano** (provato mettendo da parte le modifiche): i file
>   di lingua di `site/pages/playEdge` e `playground` sono cambiati nel commit v.0.0.6. Va rigenerato a parte.
> - Verifica a mano nell'editor (`npm run ide:install`) non fatta.

---

## Istruzioni per chi implementa

Leggi prima `AGENTS.md`, sezioni "REGOLE DI IMPLEMENTAZIONE DEL PLAN" e "REGOLE DI RILASCIO". Le sette fasi, **in quest'ordine e
senza saltarne nessuna**: implementazione, test, build, review, documentazione, pulizia, logDiary. Ogni fase ha passi numerati
e una verifica finale: non si passa alla fase dopo finché la verifica non dà quello che è scritto.

- **Appunti di fase.** `idePlugin_libSource.necessarytest.md` e `idePlugin_libSource.necessarydoc.md`, accanto a questo file.
  Gli elenchi sono già qui (Fase 2, Fase 5): all'inizio della Fase 1 crea i due file copiandoli, aggiungi quello che emerge
  strada facendo, cancellali in Fase 6.
- **Il codice di questo piano si copia così com'è.** Se un pezzo non combacia perché il file nel frattempo è cambiato, applica
  il *senso* a mano; se il senso non è chiaro, **ask**. Nessuna "miglioria" non richiesta: in particolare **non** toccare
  highlighter, pickProject, summarize, Settings, markerSpan (restano sulla copia impacchettata, è una scelta).
- **Stile del codice**: quello dei file vicini. Nomi e commenti in italiano, testi per l'utente in inglese.
- Lavora dalla radice del repo: `/run/media/aldo/4TB_Dati/L/Web/Dev/React/viteTranslate4`.
- **Niente commit** se l'utente non lo chiede.

### Baseline, prima di toccare niente

```bash
npm run build
node test/run.mjs idePlugin markerSyntax
```

Al 2026-10-06: **14/14 verdi, 708 asserzioni**. Se ora qualcosa è rosso, annotalo in testa al file `.necessarytest.md`: a
fine piano deve essere rosso per lo stesso motivo, non per uno nuovo.

---

## Le decisioni (2026-10-06)

| Domanda | Scelta |
| --- | --- |
| Cosa legge l'estensione dalla libreria installata | Solo Results, come oggi. Il resto resta impacchettato alla build. |
| Come | Un export dichiarato, `./ide/scan`, al posto degli import per percorso dentro `lib/dev/`. |
| Versionamento | `IDE_API` (intero) esportato dalla libreria; l'estensione chiede `IDE_API_MIN`. Non la versione del pacchetto. |
| Libreria senza l'export | Si legge come oggi, per percorso, con quello che ha (niente righe ≤ 4.6.3, niente indice ≤ 4.6.4-rc.1). |
| Libreria con `IDE_API` troppo basso | `TOO_OLD`: Results dice `npm install @sepoina/vitetranslate@latest`. Con `IDE_API_MIN = 1` oggi non succede mai. |
| Ordine di rilascio | Solo se sale `IDE_API_MIN`: la libreria che lo porta va su npm (tag `latest`) prima della .vsix. |

**Perché `./ide/scan` è sorgente e non un bundle.** Lo carica solo il processo figlio della sonda, che parte ogni volta da una
cache vuota (e chiude con `STALE_WORKER` se la libreria cambia sotto di lui). Nessun ricaricamento a caldo, quindi nessun motivo
per un file unico.

**Perché `TOO_OLD` non lascia un processo con il modulo vecchio.** Il processo della sonda resta vivo solo se ha caricato Babel
(`scanWorker.mjs`, "senza Babel: si chiude subito"): una risposta `TOO_OLD` arriva prima di Babel, quindi il processo si
chiude e la scansione dopo un `npm install` parte da zero. Niente da cambiare in `scanWorker.mjs`.

---

## Fase 1 — Implementazione

0. Crea `doc/ImplementationPlans/idePlugin_libSource.necessarytest.md` (copia l'elenco della Fase 2) e
   `idePlugin_libSource.necessarydoc.md` (copia l'elenco della Fase 5).

### 1.1 La libreria

1. Crea `lib/ide/scan.js` con questo testo, completo:

   ```js
   // L'ingresso `@sepoina/vitetranslate/ide/scan`: quello che legge Results, nell'estensione per
   // l'editor (idePlugin/src/probes/markedScan.mjs), dalla libreria installata nel progetto, in un
   // processo figlio. Gli stessi passi di dev/vite/uty/scanSource.js e le stesse letture di
   // `--status`: le voci del pannello sono quelle del CLI. Sorgente e non bundle: il processo figlio
   // parte ogni volta da una cache vuota.
   //
   // È un contratto. Gli export si aggiungono, non si tolgono e non cambiano significato. IDE_API
   // sale quando se ne aggiunge uno che l'estensione comincia a usare: lei chiede un minimo
   // (IDE_API_MIN in markedScan.mjs) e sotto quello dice all'utente di aggiornare. L'ordine di
   // rilascio che ne segue è in AGENTS.md, "REGOLE DI RILASCIO".

   /** La versione del contratto. */
   export const IDE_API = 1;

   export { default as walkSource } from "../dev/vite/uty/walkSource.js";
   export { mayHaveMarkers } from "../markerSyntax.js";
   export { listFiles } from "../dev/vite/uty/listLanguageFiles.js";
   export { isLanguageFileName, tagFromFileName } from "../dev/vite/uty/languageFileFormat.js";
   export { default as readLanguageFile } from "../dev/vite/uty/readLanguageFile.js";
   export { readMarkerIndex, autoWrapKey } from "../dev/vite/uty/markerIndex.js";
   export { hash } from "../dev/babel/markerCore.js";

   /** extractMarkers, caricato solo alla prima voce da leggere con Babel: è lì che si scopre se manca. */
   export const loadExtractMarkers = async () => (await import("../dev/babel/extractMarkers.js")).default;
   ```

   (Verificato durante il piano: ognuno dei nomi riesportati esiste, con quel tipo di export, nei file citati.)

2. `package.json` della radice, campo `exports`: fra `"./react": { … },` e `"./package.json": "./package.json"` aggiungi

   ```json
   "./ide/scan": "./lib/ide/scan.js",
   ```

   Una stringa, non un oggetto con `import`/`require`: vale per ogni condizione, così la trova anche
   `createRequire(...).resolve()` (verificato). `"files": ["lib"]` la pubblica già: niente da aggiungere.
3. Commenti che citano il consumatore (solo il commento, il codice non si tocca):
   - `lib/dev/vite/uty/markerIndex.js`, righe 7–8: `(idePlugin/src/markedScan.mjs)` →
     `(idePlugin/src/probes/markedScan.mjs, attraverso lib/ide/scan.js)`;
   - `lib/dev/babel/extractMarkers.js`, riga ~295: `(idePlugin/src/markedProbe.mjs)` →
     `(idePlugin/src/probes/markedScan.mjs, attraverso lib/ide/scan.js)`.

**Verifica 1.1**

```bash
node -e "import('@sepoina/vitetranslate/ide/scan').then(m=>console.log(m.IDE_API, Object.keys(m).length))"   # 1 11 (self-reference dalla radice)
```

### 1.2 La sonda di Results: `idePlugin/src/probes/markedScan.mjs`

1. **Commento in testa.** Dopo il primo paragrafo (quello che finisce con "…non dove stanno.") aggiungi:

   ```js
   //
   // Della libreria si usa l'export dichiarato `@sepoina/vitetranslate/ide/scan` (lib/ide/scan.js),
   // versionato da IDE_API: è il contratto, e questa estensione ne chiede almeno IDE_API_MIN. Le
   // librerie pubblicate prima dell'export si leggono per percorso dentro lib/ (perPercorso), con
   // quello che hanno.
   ```

   Le due frasi su "Una libreria senza markerIndex.js…" e "Le posizioni arrivano da `onMarker`…" **restano**: valgono ancora
   per le librerie lette per percorso.

2. **Costante.** Subito dopo `const stessoStat = …;` aggiungi:

   ```js
   // La versione del contratto `./ide/scan` che questa estensione richiede (IDE_API in
   // lib/ide/scan.js). Si alza solo quando la sonda comincia a usare un export nuovo: allora la
   // libreria che lo porta si pubblica prima della .vsix (AGENTS.md, "REGOLE DI RILASCIO").
   export const IDE_API_MIN = 1;

   // Una libreria senza `./ide/scan`, pubblicata prima dell'export: i suoi file letti per percorso
   // dentro lib/, come prima del contratto. Quello che non ha resta senza: niente indice né hash prima
   // di markerIndex.js (4.6.4-rc.1 e prima), niente righe prima di onMarker (4.6.3 e prima).
   async function perPercorso(pkgDir) {
     const lib = (rel) => import(pathToFileURL(path.join(pkgDir, "lib", rel)).href);
     const { default: walkSource } = await lib("dev/vite/uty/walkSource.js");
     const { mayHaveMarkers } = await lib("markerSyntax.js");
     const { listFiles } = await lib("dev/vite/uty/listLanguageFiles.js");
     const { isLanguageFileName, tagFromFileName } = await lib("dev/vite/uty/languageFileFormat.js");
     const { default: readLanguageFile } = await lib("dev/vite/uty/readLanguageFile.js");
     // L'indice e il suo hash: solo dalle librerie che lo scrivono.
     let indice = null;
     let hash = null;
     try {
       indice = await lib("dev/vite/uty/markerIndex.js");
       ({ hash } = await lib("dev/babel/markerCore.js"));
     } catch {
       indice = null;
     }
     const loadExtractMarkers = async () => (await lib("dev/babel/extractMarkers.js")).default;
     return { walkSource, mayHaveMarkers, listFiles, isLanguageFileName, tagFromFileName, readLanguageFile, indice, hash, loadExtractMarkers };
   }
   ```

   (Sono le righe 88–103 di oggi, spostate in una funzione; `L.lib` sparisce, al suo posto `loadExtractMarkers`.)

3. **`createScanner`**, il commento di `libreria`:
   `let libreria = null; // { pkgDir, version, walkSource, mayHaveMarkers, …, indice, hash }` →
   `let libreria = null; // { pkgDir, version, ideApi, walkSource, mayHaveMarkers, …, indice, hash, loadExtractMarkers }`

4. **`carica(cwd)`**: tutto da `const lib = (rel) => import(…` fino a `return { ok: true };` compreso (righe 88–104 di oggi)
   diventa:

   ```js
       // L'ingresso dichiarato per l'estensione. Una libreria che non lo ha si legge per percorso.
       let ingresso = null;
       try {
         ingresso = createRequire(path.join(cwd, "package.json")).resolve("@sepoina/vitetranslate/ide/scan");
       } catch {
         // ERR_PACKAGE_PATH_NOT_EXPORTED: pubblicata prima dell'export
       }
       if (!ingresso) {
         libreria = { pkgDir, version, ideApi: null, ...(await perPercorso(pkgDir)) };
         return { ok: true };
       }
       const api = await import(pathToFileURL(ingresso).href);
       // Un IDE_API assente o più basso del minimo: manca qualcosa che la sonda usa.
       if (!(api.IDE_API >= IDE_API_MIN)) {
         return { ok: false, code: "TOO_OLD", error: `@sepoina/vitetranslate ${version} is too old for this extension`, version };
       }
       libreria = {
         pkgDir, version, ideApi: api.IDE_API,
         walkSource: api.walkSource, mayHaveMarkers: api.mayHaveMarkers, listFiles: api.listFiles,
         isLanguageFileName: api.isLanguageFileName, tagFromFileName: api.tagFromFileName, readLanguageFile: api.readLanguageFile,
         indice: { readMarkerIndex: api.readMarkerIndex, autoWrapKey: api.autoWrapKey },
         hash: api.hash,
         loadExtractMarkers: api.loadExtractMarkers,
       };
       return { ok: true };
   ```

   Un `import` che fallisce lancia: lo raccoglie il `try` di `scan()`, come oggi per gli import per percorso. Non aggiungere
   altri `try`.

5. **`scan()`**:
   - `extractMarkers ??= (await L.lib("dev/babel/extractMarkers.js")).default;` → `extractMarkers ??= await L.loadExtractMarkers();`
   - nella risposta, dopo `ok: true, version,` aggiungi `ideApi: L.ideApi,` (null per una libreria letta per percorso);
   - JSDoc di `scan`: `` `{ ok, version, scanned, …` `` → `` `{ ok, version, ideApi, scanned, …` ``.

   Nient'altro in `scan()`: i rami `L.indice ? …`, `L.hash ? …` e "Libreria senza onMarker" **restano** (servono alle
   librerie lette per percorso; con l'export sono sempre veri).

### 1.3 Results: le righe e il log

1. `idePlugin/src/views/results/markedRows.mjs`, in `markedChildren`, nell'oggetto `perché` aggiungi dopo `NO_LIBRARY`:

   ```js
         TOO_OLD: "update it: npm install @sepoina/vitetranslate@latest",
   ```

2. `idePlugin/src/views/results/markedTree.mjs`, riga ~405, la stringa del log:
   `` ` [index ${marked.index}: ${o.index} from the index, …` `` → `` ` [api ${marked.ideApi ?? "by path"}, index ${marked.index}: ${o.index} from the index, …` ``
   (il resto della riga uguale).

**Verifica Fase 1**

```bash
node --check idePlugin/src/probes/markedScan.mjs
grep -n 'L\.lib' idePlugin/src/probes/markedScan.mjs        # niente
node test/run.mjs idePluginMarked                            # verde: il comportamento visibile non cambia
```

---

## Fase 2 — Test

Elenco da copiare in `idePlugin_libSource.necessarytest.md`.

1. **Nuovo `test/list/ideScanEntry.test.mjs`** (il contratto, lato libreria). Stile e `eq` come gli altri test,
   `process.exit(fail ? 1 : 0)` in fondo, commento in testa che dice cosa protegge e come si lancia.
   - `import * as S from "../../lib/ide/scan.js"`: i nomi esportati, ordinati, sono esattamente
     `IDE_API, autoWrapKey, hash, isLanguageFileName, listFiles, loadExtractMarkers, mayHaveMarkers, readLanguageFile,
     readMarkerIndex, tagFromFileName, walkSource` (11). Un nome in più fa fallire il test **di proposito**: chi aggiunge
     un export aggiorna l'elenco (e il commento in `lib/ide/scan.js` gli ricorda le regole).
   - `Number.isInteger(S.IDE_API) && S.IDE_API >= 1`;
   - `S.IDE_API >= IDE_API_MIN`, con `IDE_API_MIN` importato da `../../idePlugin/src/probes/markedScan.mjs`: l'estensione
     del repo non chiede più di quello che la libreria del repo dà;
   - `typeof (await S.loadExtractMarkers()) === "function"`;
   - `package.json` della radice (letto con `readFileSync` + `JSON.parse`): `exports["./ide/scan"] === "./lib/ide/scan.js"`;
   - nessun file `.mjs` di `idePlugin/src/probes/` (solo quella cartella: fuori, gli import impacchettati di `configFiles.js`
     e di summarize sono voluti) ha un import statico da `lib/`: regex `/from\s+["'][^"']*\/lib\//`, zero corrispondenze.
     `perPercorso` costruisce i percorsi con `path.join`: la regex non lo vede, ed è giusto.

2. **`test/list/idePluginMarked.test.mjs`**, casi nuovi (usa `radice`, `scrivi`, `sonda`, `REPO`, `eq` già presenti). Per la
   libreria finta servono `symlinkSync` (già importato) e `join`.
   - **Con l'export** (sezione "sonda: macro…", progetto `app`, già linkato a `REPO`): `eq("letta dall'export",
     <IDE_API di lib/ide/scan.js>, r.ideApi)`.
   - **Senza l'export** (nuova sezione "sonda: libreria senza ./ide/scan, letta per percorso"): progetto `vecchia`:

     ```js
     const pkg = join(radice, "vecchia/node_modules/@sepoina/vitetranslate");
     mkdirSync(pkg, { recursive: true });
     writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@sepoina/vitetranslate", version: "4.6.4-rc.2", type: "module", exports: { "./package.json": "./package.json" } }));
     symlinkSync(join(REPO, "lib"), join(pkg, "lib"), "junction");
     scrivi("vecchia/src/A.jsx", "export const A = () => <p>_%_Ciao_%_</p>;\n");
     ```

     input `{ baseDir: ".", srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT", autoWrap: false }`. Attesi:
     `ok` true, `ideApi` null, `version` `"4.6.4-rc.2"`, una voce `"Ciao"` con `line` 1. (Verificato durante il piano con la
     sonda di oggi: stessa risposta.)
   - **`TOO_OLD`**: progetto `troppoVecchia`, package finto con
     `exports: { "./ide/scan": "./ide/scan.js", "./package.json": "./package.json" }`, `version: "9.0.0"`, e
     `ide/scan.js` = `export const IDE_API = 0;`. Più `troppoVecchia/src/A.jsx` come sopra. Attesi: `ok` false,
     `code` `"TOO_OLD"`, `error` contiene `9.0.0`.
   - **`markedChildren`** con `{ ok: false, code: "TOO_OLD", error: "@sepoina/vitetranslate 9.0.0 is too old for this extension" }`:
     una riga, `description` contiene `npm install @sepoina/vitetranslate@latest`, `icon` `"error"`.

3. **`test/list/idePluginWorker.test.mjs`**: niente da aggiungere (la chiusura dopo una risposta senza Babel è già provata,
   "senza Babel: si chiude subito").

**Verifica Fase 2**

```bash
node test/run.mjs idePlugin markerSyntax ideScanEntry
```

Tutti verdi (15 test con il nuovo). Le asserzioni sono più di 708.

---

## Fase 3 — Build

1. `npm run build` (radice): `lib/ide/scan.js` è sorgente, la build non lo tocca; deve passare come prima.
2. `npm run ide:build`.
3. `grep -c 'ide/scan' idePlugin/dist/markedProbe.mjs` → almeno 1 (la sonda impacchettata conosce l'export).
4. `npm pack --dry-run 2>&1 | grep 'lib/ide/scan.js'` → c'è (finisce nel pacchetto npm).
5. `npm run estimateSize`: il runtime React non cambia, deve stampare `README: OK` (AGENTS.md).
6. `npm test` completo: nessun test rosso nuovo rispetto alla baseline.

---

## Fase 4 — Review

**Verifica a mano nell'editor** (`npm run ide:install`, poi **Developer: Reload Window**). Annota l'esito nel logDiary.

1. `demo/Vite_8/minimal` in Selector: Results elenca le voci con le righe. Nel canale **viteTranslate** la riga della
   scansione dice `[api 1, index …]`.
2. Una demo con una libreria pubblicata senza l'export, se ce n'è una con `node_modules` installato (es. `demo/Vite_7/…`,
   **solo se** `node_modules` c'è già: non lanciare `npm install` nelle demo per questo): Results funziona, il canale dice
   `[api by path, …]`. Se non ce n'è, scrivilo nel logDiary: il caso lo copre il test della Fase 2.

**Review del codice** (`git diff`):

- `markedScan.mjs`: nessun `L.lib`; `perPercorso` è identica alle righe che sostituisce, a parte `loadExtractMarkers`;
- il contratto in `lib/ide/scan.js` esporta solo ciò che la sonda usa (11 nomi);
- nessun file fuori da quelli elencati nella Fase 1 è cambiato (`git status`).

Un fallimento architetturale → crea `idePlugin_libSource.necessaryreview.md` con le note e **ask**; si riparte dalla Fase 1.

---

## Fase 5 — Documentazione

Elenco da copiare in `idePlugin_libSource.necessarydoc.md`. Testi in inglese, frasi brevi (AGENTS.md).

1. **`doc/structure.md`**, paragrafo di **Results** (riga ~1116, quello che comincia con "**Results** has a second child
   process"). L'ultima frase, "Deep imports into `lib/dev/` are the extension's contract with the library: moving any of
   those six files breaks **Results**, and `markerIndex.js` and `markerCore.js` (for `hash`) turn it back into a full
   scan.", diventa:

   > The contract with the library is one declared export, `@sepoina/vitetranslate/ide/scan`
   > ([`lib/ide/scan.js`](../lib/ide/scan.js)), versioned by `IDE_API`: exports are only ever added, never removed. The
   > extension asks for `IDE_API_MIN` and, below it, shows the `npm install` that fixes it. Libraries published before the
   > export are still read the old way, by path inside `lib/dev/`, with what they have: no lines before `onMarker`, a full
   > scan without `markerIndex.js`.

   Il resto del paragrafo non cambia. Il punto sui `configFiles.js` impacchettati (riga ~1130) **non** cambia: è ancora vero.
2. **`CONTRIBUTING.md`**, sezione "Editor extension (experimental)", dopo il blocco di comandi, una riga:

   > **Results** reads the project's library through `@sepoina/vitetranslate/ide/scan` (`lib/ide/scan.js`): add exports,
   > never remove them. Raising `IDE_API_MIN` in `markedScan.mjs` means publishing the library first (AGENTS.md).

3. **`idePlugin/README.md`**: niente da cambiare ("Under the hood" resta vero). Controlla comunque il limite col comando di
   AGENTS.md: deve restare sotto 10 000 B.
4. `README.md` della radice: non cita l'estensione, niente da fare.

**Verifica Fase 5**: i link relativi aggiunti esistono (`ls lib/ide/scan.js` da `doc/`, cioè `ls doc/../lib/ide/scan.js`).

---

## Fase 6 — Pulizia

1. Cancella `idePlugin_libSource.necessarytest.md`, `idePlugin_libSource.necessarydoc.md` e, se c'è e non serve più,
   `idePlugin_libSource.necessaryreview.md`.
2. `git status`: solo i file di questo piano. Nessun file temporaneo nel repo.

---

## Fase 7 — logDiary

Sotto la nota per il revisore, in testa a questo file, una nota `> [!TIP]` (massimo una decina di righe, elenco puntato):
deviazioni dal piano, numeri dei test, esito dei punti 1–2 della Fase 4. Avvertimenti (es. verifica a mano non fatta) in
`> [!CAUTION]`.

---

## Verifiche fatte durante il piano (2026-10-06, Node 24.18.0)

Nello scratchpad della sessione: il repo non è stato toccato, tranne `AGENTS.md` (la regola di rilascio, riscritta su
`IDE_API`).

1. **Nomi dell'export**: i dieci nomi riesportati da `lib/ide/scan.js` esistono nei file citati, col tipo di export giusto
   (default o nominato); `extractMarkers.js` ha un default funzione.
2. **Risoluzione**: un package con `"./ide/scan": "./ide/scan.js"` (stringa) si risolve con `createRequire(...).resolve`;
   uno senza dà `ERR_PACKAGE_PATH_NOT_EXPORTED` (il ramo `perPercorso`).
3. **Libreria finta senza export** (`package.json` proprio + `lib` → symlink a `lib/` del repo): la sonda di oggi risponde
   `ok`, versione `4.6.4-rc.2`, voce `Ciao` a riga 1. È la base del test della Fase 2.
4. **Glob dei config**: `CONFIG_GLOB` e `WATCH_GLOB` (`pickProject.mjs`) usano i nomi esatti di `CONFIG_FILES`, quindi
   `vite.config.ts.timestamp-*.mjs` non viene mai trovato: nessun filtro in più serve.
5. **Processo della sonda dopo `TOO_OLD`**: resta vivo solo con Babel caricato (`scanWorker.mjs`), quindi si chiude.
