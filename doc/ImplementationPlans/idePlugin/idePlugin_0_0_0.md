# Piano di implementazione idePlugin 0.0.0: il pannello viteTranslate nell'Explorer

> [!NOTE]
> **Per il revisore umano**
> - **Cosa:** nasce `idePlugin/`, un'estensione per VS Code (e VSCodium / Open VSX), versione 0.0.0. Aggiunge nell'Explorer, sotto "Cartelle", un pannello **viteTranslate** con la sintesi del progetto: le opzioni del plugin come il plugin le ha risolte, le dipendenze *dichiarate → installate*, i plugin e il server di `vite.config`.
> - **Quale progetto:** cascata **file attivo → radice del workspace → elenco di tutti i `vite.config.*`** del workspace.
> - **Come legge vite.config:** come il CLI. Lo importa in un processo figlio (il binario di VS Code con `ELECTRON_RUN_AS_NODE`: Node 24, quindi anche `.ts`), prende `vitetranslateConfig` e risponde via IPC. Niente Vite, nessun hook, nessuna scrittura. In Restricted Mode non esegue niente.
> - **Build a parte:** `npm run ide:build | ide:package | ide:install | ide:dev`. `npm run build` e il pacchetto npm non cambiano. Il `.vsix` lo produce `npx @vscode/vsce@3`.
> - **`lib/` non cambia**, salvo due commenti. `configFiles.js` viene impacchettato nell'estensione, così la lista dei nomi di config resta una sola.
> - **Test:** 4 file nuovi in `test/list/` (91 asserzioni). Uno attiva l'estensione con uno stub di `vscode`. L'aspetto reale del pannello si guarda a mano (Fase 4).
> - Il codice delle appendici è **già verificato** nello scratchpad del piano: test verdi, bundle caricato nel Node di Electron sul playground, `.vsix` impacchettato (7 file, 15 KB).

> [!TIP]
> **logDiary**
> - **Test:** `npm test -- idePlugin` → 4/4 test, 91 asserzioni, come previsto. Appendici copiate con uno script che le estrae dal piano: identiche byte per byte.
> - **Build:** `ide:build` 21,4 kB + 2 kB; `ide:package` → `vitetranslate-ide-0.0.0.vsix` (7 file, 15,26 KB, nessun `src/`/`scripts/`/`.map`); `npm run build` ok; `estimateSize` → `README: OK`, README radice invariato (9869 byte).
> - **Deviazione dall'App. D (deciso con l'utente):** `scripts/code.mjs` lancia il `npx` accanto al `node` in uso. Sotto `npm run`, un `npx` 6 in `/run/media/aldo/4TB_Dati/L/Web/Dev/React/node_modules/.bin` (fuori dal repo) nascondeva quello vero e rispondeva "comando non trovato: package".
> - **Documentazione:** `idePlugin/README.md`, `CONTRIBUTING.md`, `doc/structure.md` (frase + sottosezione), due commenti in `lib/`. Nessun testo ritenuto troppo lungo.

> [!CAUTION]
> - **Fase 4.2/4.3/4.4 non eseguite:** la prova nell'editor (`npm run ide:dev`, `npm run ide:install`, VSCodium) richiede l'editor aperto. L'aspetto del pannello e le installazioni restano da verificare a mano.
> - **`npm test` completo: 76/77.** Fallisce `compileGolden` (9 hash su `locale/*.yml` di `site/pages/playEdge` e `playground`): preesistente, non toccato da questo piano, da rigenerare separatamente.

---

## Istruzioni per chi implementa

Leggi prima `AGENTS.md`, sezione "REGOLE DI IMPLEMENTAZIONE DEL PLAN". Le sette fasi, in quest'ordine e senza saltarne nessuna:

1. **Implementazione**: § "Fase 1". I test che si rendono necessari vanno annotati in `idePlugin_0_0_0.necessarytest.md`, le
   modifiche ai doc in `idePlugin_0_0_0.necessarydoc.md` (entrambi accanto a questo file). Niente build dove si può evitare:
   bastano `node --check <file>` e piccoli script in node.
2. **Test**: § "Fase 2". Implementa quanto annotato più l'elenco della Fase 2, e lancia `npm test`.
3. **Build**: § "Fase 3".
4. **Review**: § "Fase 4", con la prova a mano nell'editor. Se qualcosa di architetturale non regge, scrivi
   `idePlugin_0_0_0.necessaryreview.md` e chiedi all'utente.
5. **Documentazione**: § "Fase 5".
6. **Pulizia**: § "Fase 6".
7. **logDiary**: aggiungi la nota `[!TIP]` subito dopo la `[!NOTE]` qui sopra (massimo una decina di righe).

Ogni ambiguità, o contraddizione fra questo piano e i sorgenti, si risolve con un **ask all'utente**, non con una scelta tua.

**Il codice delle appendici** è stato scritto ed eseguito durante la stesura del piano (§ "Verifiche fatte durante il
piano"). Copialo **così com'è**, byte per byte, e cambia solo ciò che un passo ti dice di cambiare. Se un test della Fase 2 lo
smentisce, riportalo nel diario invece di nasconderlo, e non ritoccare i valori attesi dei test per farli passare.

**Regole di stile** (valgono per ogni file toccato):

- Commenti in italiano. Testi per l'utente (righe del pannello, console, errori, README) in inglese.
- `vscode` si importa **solo** in `idePlugin/src/extension.mjs`. Gli altri moduli devono restare eseguibili in Node puro, che è
  ciò che li rende testabili. Se altrove ti serve qualcosa di VS Code, passalo come argomento.
- Sorgenti in `.mjs`, non `.js`: `idePlugin/package.json` **non** ha `"type": "module"`, di proposito (decisione D6).
- Nessuna dipendenza npm nuova, né in `idePlugin/` né alla radice. `@vscode/vsce` arriva da `npx` solo quando si impacchetta.
- Nessun commit se l'utente non lo chiede.

---

## Decisioni prese con l'utente

| Domanda | Risposta |
| --- | --- |
| "Ramo idePlugin della root": cartella o branch git? | **Cartella `idePlugin/`** nella radice, sviluppata su `main` come `site/`, `demo/`, `launcher/`. Nessun branch. |
| "Anche in formato aperto"? | **Tutte e due le cose**: un `.vsix` senza API proprietarie (vale per VS Code e VSCodium/Open VSX), più la modalità sviluppo (`--extensionDevelopmentPath`) che carica la cartella senza impacchettare. |
| "Compilare nel build"? | **Script separati** `ide:*`. `npm run build` resta com'è: gira anche come `prepare` a ogni `npm install`. |
| Quale progetto mostra il pannello? | **Cascata**: si risale dal file attivo; in assenza, la radice del workspace; in assenza, l'elenco di tutti i progetti raccolti. |
| Versione | **0.0.0**, indipendente da quella della libreria (4.6.4-rc.1). |

## Decisioni tecniche (perché così e non altrimenti)

- **D1. La sonda gira in un processo figlio, non nell'extension host.** Leggere un `vite.config` vuol dire eseguire codice del
  progetto. In un processo a parte, un config che si blocca finisce con un timeout (15 s) e uno che lancia produce un messaggio.
  Ogni lettura parte inoltre da una cache dei moduli vuota, quindi un config modificato si rilegge davvero. Dentro
  l'extension host, invece, un config appeso bloccherebbe tutte le estensioni.
- **D2. `fork` con il binario dell'editor e `ELECTRON_RUN_AS_NODE=1`**, lo stesso trucco dei language server. Non serve un
  `node` nel PATH, spesso assente quando l'editor parte dal menu e Node viene da nvm. Misurato qui: VS Code 1.139.1
  (`visual-studio-code-bin`) porta Node 24.20 con `process.features.typescript === true`, quindi un `vite.config.ts` si importa
  senza niente in più.
- **D3. Stessa lettura del CLI** (`lib/dev/vite/uty/loadConfig.js`): `import()` del file, chiamata con
  `{ command: "build", mode: "production" }` se `defineConfig` ha ricevuto una funzione, `flat`, ricerca per
  `name === "vitetranslate"`, lettura di `vitetranslateConfig`. Il pannello mostra ciò che vede `vtranslate-cli`. Unica
  aggiunta: la sonda aspetta anche le Promise dentro `plugins`, che Vite accetta (il CLI oggi no: vedi "Fuori da questo piano").
- **D4. Restricted Mode**: `capabilities.untrustedWorkspaces.supported = "limited"`. In un workspace non fidato si legge solo
  `package.json` e il config non si esegue.
- **D5. TreeView nativo, non una webview.** Tema, icone, tastiera e accessibilità arrivano gratis, e non c'è HTML da mantenere.
  Le righe sono oggetti semplici (`summarize.mjs`), che `extension.mjs` traduce in `TreeItem`.
- **D6. Bundle CommonJS** (`dist/extension.cjs`) fatto con rolldown, già devDependency della radice. È il formato che ogni VS Code e
  ogni VSCodium caricano sulla via più collaudata. Per lo stesso motivo il manifest non dichiara `"type": "module"`, e i
  sorgenti sono `.mjs`: Node li tratta da ESM senza avvisi, sia nei test sia nel bundle.
- **D7. `lib/dev/vite/uty/configFiles.js` viene impacchettato nell'estensione.** La lista dei sei nomi di `vite.config.*`, e il
  loro ordine, restano quelli del CLI.
- **D8. `@vscode/vsce` via `npx --yes @vscode/vsce@3`**, con `--no-dependencies`: il bundle non ha dipendenze a runtime, e così
  vsce non chiama `npm list`, che in un workspace npm come questo risponderebbe per la radice. Nessuna devDependency pesante.
- **D9. `idePlugin/` non è un workspace npm**, come `launcher/`: non ha niente da installare.
- **D10. Identità:** `publisher: "sepoina"`, `name: "vitetranslate-ide"` (id `sepoina.vitetranslate-ide`),
  `displayName: "viteTranslate"`, `preview: true`, `engines.vscode: "^1.90.0"`. `activationEvents` vuoto: da VS Code 1.74 la
  vista contribuita attiva da sola l'estensione (`onView`).
- **D11. Ridisegni parsimoniosi.** La cascata ha una firma, e se non cambia non si ridisegna niente. Gli eventi (cambio editor,
  watcher) passano da un debounce di 200 ms. A pannello nascosto non si calcola niente: si segna e basta. I dati di un progetto
  stanno in cache per cartella, e il watcher su `package.json`/`vite.config.*` invalida solo quella cartella.
- **D12. Il README.md della radice non si tocca**: 9869 byte su 10 000, e l'estensione è sperimentale. La sua documentazione
  vive in `idePlugin/README.md`, che è anche la pagina dell'estensione nel pannello Estensioni, più `CONTRIBUTING.md` e
  `doc/structure.md`.

## Cosa si vedrà

Stampato durante il piano dal bundle vero (`dist/extension.cjs`), caricato nel Node di Electron con lo stub di `vscode` e con
`site/pages/playground/src/App.jsx` come file attivo. Fra parentesi quadre la codicon della riga:

```text
[root-folder] playground   site/pages/playground · active file
   [globe] vitetranslate   it-IT → locale/
      sourceLanguage   it-IT
      localeDir   locale
      preloadedLanguages   en-US, it-IT, zh-CN
      srcDir   src · default
      baseDir   . · default
      autoSyncDev   on · default
      autoSyncBuild   on · default
      includeFallback   dev only · default
      autoWrap   on
      icu.timeZone   runtime · default
      errorSolve   built-in · default
      simpleLog   off · default
      llm   not configured
   [package] package.json   vitetranslate-site-playground 0.0.0
      [pass] @sepoina/vitetranslate   ^4.6.4-rc.1 → 4.6.4-rc.1
      [pass] vite   ^8.2.2 → 8.2.2
      [pass] react   ^19.2.8 → 19.2.8
      [pass] react-dom   ^19.2.8 → 19.2.8
      [pass] @vitejs/plugin-react   ^6.1.1 → 6.1.1
      [pass] @babel/core   ^7.29.7 → 7.29.7
      [terminal] scripts   dev · build · preview
   [settings-gear] vite.config.js   10 plugins
      [extensions] plugins   playground-local-lib-alias · vitetranslate:compile-locale · vitetranslate · vite:react-babel · …
      [server] server   port 3000
```

Con `lib/index.js` come file attivo (nessun config risalendo, nessuno alla radice) il pannello mostra in testa
*"No vite.config above the active file or at the workspace root: here are all the projects."* e sotto sette righe chiuse:
`minimal` (demo/Vite_7/minimal), `llmTranslate`, `minimal` (demo/Vite_8/minimal), `landing`, `llmRestaurant`, `playEdge`,
`playground`.

## Verifiche fatte durante il piano

Tutto nello scratchpad, su una copia di `idePlugin/` e `test/list/` con `lib/` e `node_modules/` collegati al repo vero:

- **Sonda sui config del repo**, lanciata col binario di VS Code in modalità Node: `site/pages/llmRestaurant`, `playground`,
  `site/landing`, `demo/Vite_8/minimal`, `demo/Vite_7/minimal`, tutti letti in 230–290 ms. Il blocco `llm` di llmRestaurant
  arriva normalizzato: `connection`, `budget.preset`, `context.mode`.
- **Casi limite della sonda**: opzione mancante (esce il messaggio del plugin), pacchetto mancante (`ERR_MODULE_NOT_FOUND`),
  `vite.config.ts` con annotazioni di tipo, config-funzione, plugin dentro una `Promise`, `autoWrap` RegExp, config appeso
  (timeout), config che fa `process.exit` (`NO_ANSWER`), stdout del config tenuto fuori dalla risposta, 20 letture concorrenti
  senza perdere una risposta.
- **Nessuna scrittura**: costruire il plugin non scrive niente nella cartella del progetto (verificato su una cartella vuota).
  `writeSession` sta dentro un hook, che la sonda non chiama.
- **Suite**: `node test/run.mjs idePlugin` → `TUTTI OK 4/4 test · 91 asserzioni` (Extension 20, Pick 13, Probe 17, Summary 41).
- **Bundle**: `rolldown -c idePlugin/rolldown.config.mjs` → `extension.cjs` 21 kB (dentro: runtime di rolldown,
  `configFiles.js`, i sei moduli), `probe.mjs` 2 kB. Caricato con `require` nel Node di Electron, con lo stub di `vscode` e il
  repo come workspace: l'albero di § "Cosa si vedrà".
- **Pacchetto**: `npx --yes @vscode/vsce@3 package --no-dependencies` → 7 file, 15 KB, nessun avviso di vsce. Un secondo
  giro non include il `.vsix` precedente.
- **Non verificato** (richiede l'editor aperto, quindi è la Fase 4): l'aspetto del pannello, `npm run ide:dev`,
  `npm run ide:install`.

## Mappa dei file

```text
idePlugin/                          NUOVO
  package.json                      manifest dell'estensione (App. A)
  .vscodeignore                     cosa resta fuori dal .vsix (App. B)
  LICENSE                           copia di LICENSE della radice, come launcher/LICENSE
  README.md                         provvisorio in Fase 1, definitivo in Fase 5 (App. P)
  rolldown.config.mjs               build (App. C)
  scripts/code.mjs                  package / install / dev (App. D)
  src/pickProject.mjs               la cascata (App. E)
  src/readPackage.mjs               package.json + versioni installate (App. F)
  src/probe.mjs                     la sonda, processo figlio (App. G)
  src/runProbe.mjs                  lancia la sonda (App. H)
  src/summarize.mjs                 dati → righe del pannello (App. I)
  src/extension.mjs                 colla con VS Code (App. J)
  dist/                             generata, già coperta da "dist/" in .gitignore
test/list/idePluginVscodeStub.mjs   NUOVO, stub di `vscode` (App. K)
test/list/idePluginPick.test.mjs    NUOVO (App. L)
test/list/idePluginProbe.test.mjs   NUOVO (App. M)
test/list/idePluginSummary.test.mjs NUOVO (App. N)
test/list/idePluginExtension.test.mjs NUOVO (App. O)
package.json                        + 4 script ide:* (§ 1.14)
.gitignore                          + *.vsix (§ 1.15)
CONTRIBUTING.md                     + sezione (Fase 5)
doc/structure.md                    + una frase e una sottosezione (Fase 5)
lib/dev/vite/vitetranslate.js       solo un commento (Fase 5)
lib/dev/vite/uty/configFiles.js     solo un commento (Fase 5)
```

---

## Fase 1: implementazione

Lavora dalla radice del repo. Dopo ogni file, `node --check <file>` (per i `.mjs` controlla la sintassi).

**1.1 Cartelle.** `mkdir -p idePlugin/src idePlugin/scripts`

**1.2** `idePlugin/package.json` ← **Appendice A**, identico.

**1.3** `idePlugin/.vscodeignore` ← **Appendice B**, identico. Senza questo file vsce mette nel `.vsix` anche `src/`,
`scripts/` e le mappe.

**1.4** `cp LICENSE idePlugin/LICENSE`. vsce senza LICENSE si ferma a chiedere conferma, e lo stesso vale per `launcher/`.

**1.5** `idePlugin/README.md` provvisorio: serve a vsce già in Fase 3, e il testo vero arriva in Fase 5. Contenuto esatto:

```markdown
# viteTranslate for VS Code

Experimental. The real README comes with phase 5 of doc/ImplementationPlans/idePlugin_0_0_0.md.
```

**1.6** `idePlugin/rolldown.config.mjs` ← **Appendice C**.

**1.7** `idePlugin/scripts/code.mjs` ← **Appendice D**.

**1.8–1.13** I sorgenti, **in quest'ordine** (ognuno importa solo quelli prima):

| Passo | File | Appendice |
| --- | --- | --- |
| 1.8 | `idePlugin/src/pickProject.mjs` | E |
| 1.9 | `idePlugin/src/readPackage.mjs` | F |
| 1.10 | `idePlugin/src/probe.mjs` | G |
| 1.11 | `idePlugin/src/runProbe.mjs` | H |
| 1.12 | `idePlugin/src/summarize.mjs` | I |
| 1.13 | `idePlugin/src/extension.mjs` | J |

Attenzione in 1.8: `pickProject.mjs` importa `../../lib/dev/vite/uty/configFiles.js`. Il percorso è relativo a
`idePlugin/src/`, cioè porta alla `lib/` della radice. Non copiare `configFiles.js`: vedi D7.

**1.14 Script nella radice.** In `package.json` (radice), dentro `"scripts"`, subito dopo la riga
`"site:theme": "node site/syncTheme.mjs"`, aggiungi una virgola a quella riga e poi queste quattro:

```json
    "ide:build": "rolldown -c idePlugin/rolldown.config.mjs",
    "ide:package": "npm run ide:build && node idePlugin/scripts/code.mjs package",
    "ide:install": "npm run ide:package && node idePlugin/scripts/code.mjs install",
    "ide:dev": "npm run ide:build && node idePlugin/scripts/code.mjs dev"
```

Non toccare `"build"`, `"prepare"`, `"files"` né `"workspaces"`: `idePlugin/` non deve finire nel pacchetto npm (`"files": ["lib"]`
lo esclude già) e non è un workspace (D9).

**1.15 `.gitignore`.** Sotto il commento `# Pacchetti generati localmente`, dopo `*.tgz`, aggiungi una riga `*.vsix`. La
cartella `idePlugin/dist/` è già esclusa dalla regola `dist/`.

**1.16 Controlli rapidi, senza build.**

```bash
for f in idePlugin/src/*.mjs idePlugin/scripts/code.mjs idePlugin/rolldown.config.mjs; do node --check "$f" || echo "KO $f"; done
node -e "JSON.parse(require('fs').readFileSync('idePlugin/package.json','utf8')); console.log('manifest ok')"
# la sonda a mano, sul playground (senza IPC risponde su stdout):
(cd site/pages/playground && node ../../../idePlugin/src/probe.mjs vite.config.js) | head -c 300; echo
# nessun import di vscode fuori da extension.mjs (deve stampare solo extension.mjs):
grep -l 'from "vscode"' idePlugin/src/*.mjs
```

Atteso: nessun `KO`, `manifest ok`, un JSON che comincia con `{"ok":true,"plugins":["playground-local-lib-alias",…`, e
`idePlugin/src/extension.mjs` come unico file.

**1.17 Sottodocumenti.** Crea `doc/ImplementationPlans/idePlugin_0_0_0.necessarytest.md` con l'elenco della Fase 2 (i cinque
file delle Appendici K–O), e `idePlugin_0_0_0.necessarydoc.md` con l'elenco della Fase 5 (5.1–5.5). Aggiungici ciò che
emerge lavorando.

---

## Fase 2: test

**2.1** Copia i cinque file, identici:

| File | Appendice |
| --- | --- |
| `test/list/idePluginVscodeStub.mjs` | K (non è un test: il nome non finisce in `.test.mjs`, il lanciatore lo salta) |
| `test/list/idePluginPick.test.mjs` | L |
| `test/list/idePluginProbe.test.mjs` | M |
| `test/list/idePluginSummary.test.mjs` | N |
| `test/list/idePluginExtension.test.mjs` | O |

**2.2** Prima uno per uno, poi insieme, poi la suite intera:

```bash
node test/list/idePluginPick.test.mjs
node test/list/idePluginProbe.test.mjs
node test/list/idePluginSummary.test.mjs
node test/list/idePluginExtension.test.mjs
npm test -- idePlugin     # atteso: TUTTI OK 4/4 test · 91 asserzioni
npm test                  # la suite di prima più questi 4, tutti verdi
```

Cosa copre ciascuno: **Pick**, la cascata su un albero di cartelle vero (file attivo, node_modules ignorato, dedupe `.js`
prima di `.ts`, radice, fuori dal workspace). **Probe**, la sonda su progetti veri in una cartella temporanea (tutti i casi
di § "Verifiche"). **Summary**, dati finti → righe (valori, `default`, errori, Restricted Mode). **Extension**, `activate()`
con lo stub di `vscode` via `module.registerHooks` (serve Node 22.15+ o 23.5+, altrimenti il test si dichiara saltato ed esce
con 0).

**2.3** Se un test fallisce non ritoccare l'atteso: capisci chi ha ragione, e se è il piano a sbagliare annotalo per il
diario (Fase 7).

---

## Fase 3: build

**3.1** `npm run ide:build`. Atteso: `idePlugin/dist/extension.cjs` (~21 kB), `extension.cjs.map`, `probe.mjs` (~2 kB).
Controllo: `grep -c 'require("vscode")' idePlugin/dist/extension.cjs` → `1`.

**3.2** `npm run ide:package`. La prima volta `npx` scarica vsce e serve la rete: se manca, **ask all'utente**. Atteso, nel
riepilogo di vsce, esattamente questi file sotto `extension/`: `LICENSE.txt`, `package.json`, `readme.md`,
`dist/extension.cjs`, `dist/probe.mjs`. Se compaiono `src/`, `scripts/` o una `.map`, il `.vscodeignore` è sbagliato. Esce
`idePlugin/vitetranslate-ide-0.0.0.vsix`, ignorato da git (§ 1.15: `git status` non deve mostrarlo).

**3.3** `npm run build`: la build della libreria deve riuscire come prima. Questo piano non la tocca, e il passo serve a
dimostrarlo.

**3.4** `npm run estimateSize` (regola di `AGENTS.md`). Il runtime React non cambia, quindi l'atteso è `README: OK` senza
modifiche al README.

---

## Fase 4: review

**4.1 Revisione del codice.**

- `git status` e `git diff --stat`: cambiano solo i file della § "Mappa dei file". In `lib/`, per ora, niente (i due commenti
  arrivano in Fase 5).
- `grep -l 'from "vscode"' idePlugin/src/*.mjs` → solo `extension.mjs`.
- Nessuna nuova voce in `dependencies`/`devDependencies`, né alla radice né in `idePlugin/package.json`.

**4.2 Prova nell'editor, modalità sviluppo.** `npm run ide:dev` apre una **seconda finestra** ("Extension Development Host")
sul repo, con l'estensione caricata da `idePlugin/`. In quella finestra:

| # | Azione | Atteso |
| --- | --- | --- |
| 1 | Guarda l'Explorer | Una sezione **VITETRANSLATE** sotto Cartelle/Struttura/Sequenza temporale, con il pulsante ↻. Se non c'è: clic destro su un'intestazione di sezione dell'Explorer e spunta "viteTranslate". |
| 2 | Apri `site/pages/playground/src/App.jsx` | Il pannello mostra `playground · site/pages/playground · active file`, aperto, come in § "Cosa si vedrà". |
| 3 | Apri un file di `site/pages/llmRestaurant/src/` | Il progetto diventa `llmRestaurant`. Riga `llm` → `deepseek-flash @ api.deepseek.com`, aprendola: `apiKeyEnv RESTAURANT_API_KEY`, `budget normal`. |
| 4 | Apri `lib/index.js` | Messaggio in testa *"No vite.config above…"* e sette progetti chiusi. Apri `demo/Vite_7/minimal`: si legge (i pacchetti vengono da `node_modules` della radice). |
| 5 | Chiudi tutti gli editor | Resta l'elenco. |
| 6 | Apri `site/pages/playground/vite.config.js`, aggiungi `simpleLog: true,` nelle opzioni di vitetranslate e salva | Entro un secondo `simpleLog` passa a `on`. **Annulla la modifica e risalva**: `simpleLog` torna `off · default`. |
| 7 | Clic sulla riga `package.json` | Si apre il file. |
| 8 | Pulsante ↻ | Il pannello si ricarica. In *Output → viteTranslate* compaiono righe `…/vite.config.js: read in N ms`. |
| 9 | Cambia editor velocemente con Ctrl+Tab | Nessuno sfarfallio sul progetto che non cambia (D11). |

Facoltativo, **Restricted Mode**: in una finestra su una cartella non fidata la riga del config dice
`not executed: Restricted Mode`, e `package.json` si legge lo stesso. Chiudi la finestra di sviluppo a prova finita.

**4.3 Prova installata.** `npm run ide:install` (build, `.vsix`, `code --install-extension … --force`). Nella finestra normale,
se il pannello non compare: *Developer: Reload Window*. Ripeti i punti 1–4 della tabella.

**4.4 Facoltativo, VSCodium.** Se installato: `VT_CODE_CLI=codium npm run ide:install`, poi i punti 1–2.

**4.5** Se qualcosa di **architetturale** non regge (la sonda non parte dentro l'editor, `fork` non trova il binario, il
pannello non si registra), scrivi `idePlugin_0_0_0.necessaryreview.md` con cosa succede e cosa proponi, **chiedi all'utente**
e riparti dalla Fase 1. I difetti minori (una descrizione brutta, un'icona) si correggono qui e si annotano per il diario.

---

## Fase 5: documentazione

Testi in inglese, per l'utente, asciutti (regole di `AGENTS.md`). I testi pronti sono nelle Appendici P e Q.

**5.1** `idePlugin/README.md` ← **Appendice P** (sostituisce il provvisorio di § 1.5).

**5.2** `CONTRIBUTING.md`: nuova sezione ← **Appendice Q.1**, subito **prima** di `## Pull requests`.

**5.3** `doc/structure.md`, due interventi:

- in fondo al paragrafo che comincia con `<a id="no-separate-config-file"></a>**No separate config file.**` (una sola riga
  lunga), aggiungi dopo l'ultima frase, separata da uno spazio, la frase di **Appendice Q.2**;
- nuova sottosezione ← **Appendice Q.3**, subito **dopo** la sottosezione `### The global command: \`launcher/\`` (cioè dopo il
  suo ultimo paragrafo, che finisce con ``Guarded by [`launcher.test.mjs`](../test/list/launcher.test.mjs).``) e **prima** della
  riga `---` che precede `## Testing`.

**5.4** Due commenti in `lib/`, nessun cambio di codice:

- `lib/dev/vite/vitetranslate.js`, il commento sopra `const vitetranslateConfig = {`. Sostituisci queste tre righe:

  ```js
    // La config risolta, in un oggetto solo. Due lettori: la CLI, che la ripesca da qui invece
    // di pretendere un file di config separato da tenere in sync (vedi doc/structure.md, "No
    // separate config file"), e l'auto-sync dell'hook `config` qui sotto.
  ```

  con queste quattro:

  ```js
    // La config risolta, in un oggetto solo. Tre lettori: la CLI, che la ripesca da qui invece
    // di pretendere un file di config separato da tenere in sync (vedi doc/structure.md, "No
    // separate config file"), l'auto-sync dell'hook `config` qui sotto, e l'estensione per
    // l'editor (idePlugin/src/probe.mjs), che la legge come la CLI: stesso `name`, stessa proprietà.
  ```

- `lib/dev/vite/uty/configFiles.js`: dopo la riga `// ciclo (cli.js importa fastVerify.js).` aggiungi:

  ```js
  //
  // La impacchetta anche l'estensione per l'editor (idePlugin/src/pickProject.mjs): che importi
  // solo fs e path è ciò che lo permette.
  ```

**5.5 README.md della radice: nessuna modifica** (D12). Controlla che sia rimasto com'era:

```bash
node -e "const s=require('fs').readFileSync('README.md','utf8').replace(/<!--[\s\S]*?-->/g,'').replace(/<details[\s\S]*?<\/details>/gi,'');console.log(Buffer.byteLength(s),'bytes',s.split('\n').length,'lines')"
```

Atteso: `9869 bytes` o il valore che aveva prima di questo piano, se nel frattempo è cambiato per altre ragioni: l'importante è
che questo piano non lo abbia toccato.

**5.6** Rifai `npm run ide:package`, così il `.vsix` porta il README definitivo, e `npm test -- idePlugin` (dopo i commenti in
`lib/` deve restare tutto verde).

**5.7** Se un testo ti sembra troppo lungo, **avvisa l'utente alla fine**: non tagliare di tua iniziativa.

---

## Fase 6: pulizia

- Rimuovi `doc/ImplementationPlans/idePlugin_0_0_0.necessarytest.md`, `.necessarydoc.md` e, se c'è ed è stata risolta,
  `.necessaryreview.md`.
- **Non** rimuovere `idePlugin/dist/` né il `.vsix`: sono ignorati da git, e l'utente usa l'estensione installata.
- `git status`: nessun file generato fuori posto (niente `vite.config.js.timestamp-*`, niente `.vsix` tracciato).

## Fase 7: logDiary

Subito dopo la `[!NOTE]` in testa a questo file, una nota `[!TIP]` di massimo una decina di righe, a elenco puntato: esito dei
test (numeri), esito della prova in loco (Fase 4.2/4.3, e 4.4 se fatta), dimensione del `.vsix`, deviazioni dal piano. Se ci
sono avvertimenti (una prova saltata, un comportamento strano dell'editor) aggiungi una `[!IMPORTANT]` o una `[!CAUTION]`,
come nel piano 4.6.4.

---

## Fuori da questo piano (idee per la 0.1)

- **Pubblicazione** su Marketplace e Open VSX: icona PNG 128×128, CHANGELOG, token del publisher, job in `publish.yml`.
- **Stato delle traduzioni** nel pannello: chiavi mancanti per lingua, come `vtranslate-cli --status`.
- **Comandi dal pannello**: sync, `--add`, `--llm-translate` in un terminale integrato.
- **CLI**: `loadConfig.js` non aspetta le `Promise` dentro `plugins`, che Vite accetta. La sonda sì (D3). È un allineamento
  piccolo, da fare nella libreria con il suo piano.

---

## Appendici

Ogni appendice è il file **completo**, così come è stato eseguito durante il piano.

### Appendice A: `idePlugin/package.json`

```json
{
  "name": "vitetranslate-ide",
  "displayName": "viteTranslate",
  "description": "Your viteTranslate setup at a glance, right in the Explorer.",
  "version": "0.0.0",
  "preview": true,
  "publisher": "sepoina",
  "author": {
    "name": "Giancarlo Ghigi",
    "email": "giancarlo.ghigi@gmail.com"
  },
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/sepoina/viteTranslate.git",
    "directory": "idePlugin"
  },
  "bugs": {
    "url": "https://github.com/sepoina/viteTranslate/issues"
  },
  "homepage": "https://github.com/sepoina/viteTranslate#readme",
  "keywords": [
    "vitetranslate",
    "vite",
    "i18n",
    "translation"
  ],
  "categories": [
    "Other"
  ],
  "engines": {
    "vscode": "^1.90.0"
  },
  "main": "./dist/extension.cjs",
  "activationEvents": [],
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": "limited",
      "description": "In Restricted Mode vite.config is not executed: only package.json is read."
    }
  },
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "vitetranslate.project",
          "name": "viteTranslate"
        }
      ]
    },
    "viewsWelcome": [
      {
        "view": "vitetranslate.project",
        "contents": "No Vite project in this workspace: no vite.config.* was found.\n[Refresh](command:vitetranslate.refresh)"
      }
    ],
    "commands": [
      {
        "command": "vitetranslate.refresh",
        "title": "Refresh",
        "category": "viteTranslate",
        "icon": "$(refresh)"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "vitetranslate.refresh",
          "when": "view == vitetranslate.project",
          "group": "navigation"
        }
      ]
    }
  }
}
```

### Appendice B: `idePlugin/.vscodeignore`

```text
src/**
scripts/**
rolldown.config.mjs
**/*.map
```

### Appendice C: `idePlugin/rolldown.config.mjs`

```js
// Build dell'estensione: `npm run ide:build` dalla radice del repo.
//
// L'estensione esce in CommonJS (dist/extension.cjs): è il formato che ogni VS Code e ogni
// VSCodium caricano senza chiedere niente. I sorgenti restano ESM come il resto del repo, e
// configFiles.js viene preso da lib/ e impacchettato qui dentro: la lista dei nomi di vite.config
// è una sola, quella del CLI. La sonda esce a parte (dist/probe.mjs) perché gira in un altro
// processo: ESM, così fa `await import()` del config come lo fa il CLI.
import { defineConfig } from "rolldown";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

const qui = (file) => fileURLToPath(new URL(file, import.meta.url));
const nodeBuiltins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig([
  {
    input: qui("./src/extension.mjs"),
    platform: "node",
    // `vscode` non esiste su disco: lo fornisce l'editor a runtime.
    external: ["vscode", ...nodeBuiltins],
    output: { file: qui("./dist/extension.cjs"), format: "cjs", sourcemap: true },
  },
  {
    input: qui("./src/probe.mjs"),
    platform: "node",
    external: nodeBuiltins,
    output: { file: qui("./dist/probe.mjs"), format: "esm" },
  },
]);
```

### Appendice D: `idePlugin/scripts/code.mjs`

```js
// I comandi di contorno dell'estensione, lanciati dagli script `ide:*` della radice:
//
//   node idePlugin/scripts/code.mjs package   # dist/ → idePlugin/vitetranslate-ide-<versione>.vsix
//   node idePlugin/scripts/code.mjs install   # installa quel .vsix nell'editor
//   node idePlugin/scripts/code.mjs dev       # apre il repo in una finestra "Extension Development Host"
//
// L'editor è `code`; per VSCodium: `VT_CODE_CLI=codium npm run ide:install`.
// Presuppongono `npm run ide:build` già fatto: gli script della radice lo concatenano.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IDE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = dirname(IDE_DIR);
const manifest = JSON.parse(readFileSync(join(IDE_DIR, "package.json"), "utf8"));
const VSIX = join(IDE_DIR, `${manifest.name}-${manifest.version}.vsix`);
const CLI = process.env.VT_CODE_CLI || "code";

function esegui(comando, argomenti, cwd = REPO_DIR) {
  // shell su Windows: `code` e `npx` lì sono file .cmd, che spawn da solo non lancia.
  const r = spawnSync(comando, argomenti, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.error) {
    console.error(`[idePlugin] could not run "${comando}": ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const comando = process.argv[2];
if (!existsSync(join(IDE_DIR, "dist", "extension.cjs"))) {
  console.error("[idePlugin] dist/extension.cjs is missing: run `npm run ide:build` first.");
  process.exit(1);
}

if (comando === "package") {
  // --no-dependencies: il bundle non ha dipendenze a runtime, e così vsce non chiama npm (che in
  // un workspace npm come questo repo risponderebbe per la radice, non per idePlugin/).
  esegui("npx", ["--yes", "@vscode/vsce@3", "package", "--no-dependencies", "--out", VSIX], IDE_DIR);
} else if (comando === "install") {
  if (!existsSync(VSIX)) {
    console.error(`[idePlugin] ${VSIX} is missing: run \`npm run ide:package\` first.`);
    process.exit(1);
  }
  esegui(CLI, ["--install-extension", VSIX, "--force"]);
  console.log("[idePlugin] installed. No panel in the Explorer yet? Run \"Developer: Reload Window\".");
} else if (comando === "dev") {
  esegui(CLI, [`--extensionDevelopmentPath=${IDE_DIR}`, REPO_DIR]);
} else {
  console.error("usage: node idePlugin/scripts/code.mjs <package|install|dev>");
  process.exit(1);
}
```

### Appendice E: `idePlugin/src/pickProject.mjs`

```js
// Quale progetto mostra il pannello. Una cascata, fermandosi al primo passo che trova qualcosa:
//
//   1. il file attivo: si risale dalla sua cartella fino alla radice del workspace che lo
//      contiene, e vince il primo vite.config.* trovato;
//   2. la radice del workspace (la prima, in un workspace multi-root, che ha un vite.config.*);
//   3. l'elenco di tutti i vite.config.* del workspace, fuori da node_modules.
//
// Nessun import di `vscode`: il file attivo, le radici e la ricerca di tutti i config arrivano
// da fuori (extension.mjs), così la cascata si prova con un albero di cartelle vero e basta.
import path from "node:path";
import { CONFIG_FILES, findConfigFile } from "../../lib/dev/vite/uty/configFiles.js";

// Per `workspace.findFiles`: gli stessi nomi, nello stesso ordine, che cercano il CLI e Vite.
export const CONFIG_GLOB = `**/{${CONFIG_FILES.join(",")}}`;
// Per il FileSystemWatcher: cambia ciò che il pannello mostra.
export const WATCH_GLOB = `**/{package.json,${CONFIG_FILES.join(",")}}`;

export const inNodeModules = (file) => file.split(/[\\/]/).includes("node_modules");

const contiene = (radice, file) => file === radice || file.startsWith(radice.endsWith(path.sep) ? radice : radice + path.sep);

/**
 * Passo 1. Un file dentro node_modules non conta: è una dipendenza aperta per curiosità, non il
 * progetto su cui si lavora.
 *
 * @param {string | null} activeFile - percorso assoluto, o null senza editor attivo su un file
 * @param {string[]} roots - percorsi assoluti delle cartelle del workspace
 * @returns {{ dir: string, configFile: string } | null}
 */
export function projectFromActiveFile(activeFile, roots) {
  if (!activeFile || inNodeModules(activeFile)) return null;
  const radice = roots.find((r) => contiene(r, activeFile)) ?? null;
  for (let dir = path.dirname(activeFile); ; dir = path.dirname(dir)) {
    const configFile = findConfigFile(dir);
    if (configFile) return { dir, configFile };
    // Fuori da ogni radice si risale fino alla radice del disco.
    if (dir === radice || path.dirname(dir) === dir) return null;
  }
}

/**
 * Passo 3. Un progetto per cartella: se in una cartella convivono più config vince il primo
 * nell'ordine di CONFIG_FILES, lo stesso che sceglierebbe il CLI. Ordinati per percorso.
 *
 * @param {string[]} files - percorsi assoluti di vite.config.*
 */
export function dedupeConfigs(files) {
  const perCartella = new Map();
  for (const file of files) {
    if (inNodeModules(file)) continue;
    const dir = path.dirname(file);
    const nome = path.basename(file);
    if (!CONFIG_FILES.includes(nome)) continue;
    const prima = perCartella.get(dir);
    if (!prima || CONFIG_FILES.indexOf(nome) < CONFIG_FILES.indexOf(prima)) perCartella.set(dir, nome);
  }
  return [...perCartella]
    .map(([dir, configFile]) => ({ dir, configFile }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/**
 * @param {object} p
 * @param {string | null} p.activeFile
 * @param {string[]} p.roots
 * @param {() => Promise<string[]>} p.listAllConfigs - chiamata solo al passo 3
 * @returns {Promise<{ mode: "active" | "root" | "list", projects: { dir: string, configFile: string }[] }>}
 */
export default async function pickProject({ activeFile, roots, listAllConfigs }) {
  const attivo = projectFromActiveFile(activeFile, roots);
  if (attivo) return { mode: "active", projects: [attivo] };
  for (const dir of roots) {
    const configFile = findConfigFile(dir);
    if (configFile) return { mode: "root", projects: [{ dir, configFile }] };
  }
  return { mode: "list", projects: dedupeConfigs(await listAllConfigs()) };
}
```

### Appendice F: `idePlugin/src/readPackage.mjs`

```js
// Il package.json accanto al vite.config, e le versioni davvero installate delle dipendenze che
// contano per viteTranslate. Solo lettura di file: nessun codice del progetto viene eseguito,
// quindi vale anche in Restricted Mode.
import fs from "node:fs";
import path from "node:path";

// Le dipendenze che il pannello nomina, in quest'ordine. Le altre non dicono niente su
// viteTranslate e allungherebbero la lista.
export const WATCHED = ["@sepoina/vitetranslate", "vite", "react", "react-dom", "@vitejs/plugin-react", "@babel/core"];

/**
 * La versione installata di `name` vista da `dir`: risale le cartelle cercando
 * node_modules/<name>/package.json, come fa la risoluzione di Node. Letta dal file e non con
 * `require.resolve`, perché un pacchetto può non esportare "./package.json".
 *
 * @returns {string | null}
 */
export function installedVersion(dir, name) {
  for (let cartella = dir; ; cartella = path.dirname(cartella)) {
    const file = path.join(cartella, "node_modules", name, "package.json");
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8")).version ?? null;
      } catch {
        return null;
      }
    }
    if (path.dirname(cartella) === cartella) return null;
  }
}

/**
 * @param {string} dir - la cartella del progetto
 * @returns {{ ok: true, name, version, scripts, deps: {name, wanted, installed}[] } | { ok: false, missing?: true, error: string }}
 */
export default function readPackage(dir) {
  const file = path.join(dir, "package.json");
  if (!fs.existsSync(file)) return { ok: false, missing: true, error: "no package.json next to vite.config" };
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { ok: false, error: `package.json is not valid JSON: ${error.message}` };
  }
  const dichiarate = { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies };
  const deps = [];
  for (const name of WATCHED) {
    const wanted = dichiarate[name] ?? null;
    const installed = installedVersion(dir, name);
    // Né dichiarata né installata: non c'entra con questo progetto.
    if (wanted === null && installed === null) continue;
    deps.push({ name, wanted, installed });
  }
  return { ok: true, name: pkg.name ?? null, version: pkg.version ?? null, scripts: pkg.scripts ?? {}, deps };
}
```

### Appendice G: `idePlugin/src/probe.mjs`

```js
// La sonda: legge UN vite.config e risponde con un oggetto JSON, poi esce.
//
// Gira in un processo figlio (vedi runProbe.mjs), mai dentro l'extension host: caricare un
// vite.config vuol dire eseguire codice del progetto, con i suoi import e i suoi effetti
// collaterali. In un processo a parte un config che si blocca si uccide con un timeout, uno
// che sporca lo stato globale di Node sporca un processo che muore subito dopo, e ogni lettura
// parte da una cache dei moduli vuota — un config modificato si rilegge davvero.
//
// Stesso percorso di lib/dev/vite/uty/loadConfig.js (il CLI): import del file, chiamata della
// funzione se `defineConfig` ha ricevuto una funzione, ricerca del plugin per nome e lettura di
// `vitetranslateConfig`. Non si passa da Vite: nessun hook del plugin viene eseguito, quindi
// nessuna sincronizzazione parte (VITETRANSLATE_NO_SYNC, messo da runProbe, è una cintura in più).
//
//   argv[2] = nome del file di config, relativo alla cwd (la cartella del progetto)
import path from "node:path";
import { pathToFileURL } from "node:url";

// Risponde e poi esce. Con `process.send` (processo figlio con canale IPC) si esce solo nella
// callback, cioè a messaggio consegnato; senza canale (sonda lanciata a mano, per provarla)
// la risposta va su stdout.
function rispondi(messaggio) {
  if (process.send) process.send(messaggio, () => process.exit(0));
  else {
    process.stdout.write(JSON.stringify(messaggio) + "\n");
    process.exit(0);
  }
}

// Il canale IPC porta JSON: una RegExp diventerebbe `{}`, una funzione sparirebbe. Le si
// descrive invece di perderle (autoWrap può essere una RegExp).
function serializza(valore, visti = new WeakSet()) {
  if (valore instanceof RegExp) return { $regexp: String(valore) };
  if (typeof valore === "function") return { $function: valore.name || "anonymous" };
  if (typeof valore === "bigint" || typeof valore === "symbol") return String(valore);
  if (valore === null || typeof valore !== "object") return valore;
  if (visti.has(valore)) return "[circular]";
  visti.add(valore);
  if (Array.isArray(valore)) return valore.map((x) => serializza(x, visti));
  const fuori = {};
  for (const [chiave, x] of Object.entries(valore)) if (x !== undefined) fuori[chiave] = serializza(x, visti);
  return fuori;
}

// `plugins` di Vite accetta array annidati, `false`/`null` e anche Promise: si appiattisce
// tutto, aspettando le Promise, come fa Vite stesso.
async function appiattisci(lista) {
  const fuori = [];
  for (const voce of await Promise.all(lista ?? [])) {
    if (Array.isArray(voce)) fuori.push(...(await appiattisci(voce)));
    else if (voce) fuori.push(voce);
  }
  return fuori;
}

try {
  const file = process.argv[2];
  let { default: config } = await import(pathToFileURL(path.resolve(file)).href);
  // Stessi argomenti del CLI (loadConfig.js): il pannello mostra ciò che vede `vtranslate-cli`.
  if (typeof config === "function") {
    config = await config({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });
  }
  const plugins = await appiattisci(config?.plugins);
  const plugin = plugins.find((p) => p?.name === "vitetranslate");
  rispondi({
    ok: true,
    plugins: plugins.map((p) => p?.name ?? "(unnamed)"),
    vite: serializza({
      base: config?.base,
      root: config?.root,
      outDir: config?.build?.outDir,
      port: config?.server?.port,
      host: config?.server?.host,
    }),
    vitetranslate: plugin?.vitetranslateConfig ? serializza(plugin.vitetranslateConfig) : null,
  });
} catch (error) {
  rispondi({ ok: false, code: error?.code ?? null, error: String(error?.message ?? error) });
}
```

### Appendice H: `idePlugin/src/runProbe.mjs`

```js
// Lancia la sonda (probe.mjs) su un progetto e ne aspetta la risposta.
//
// `fork` usa `process.execPath`: dentro VS Code è il binario dell'editor, che con
// ELECTRON_RUN_AS_NODE=1 si comporta da Node (lo stesso trucco dei language server). Così non
// serve un `node` nel PATH — spesso assente quando l'editor parte dal menu e Node viene da nvm —
// e la versione è quella di Electron, oggi Node 24: toglie da sola i tipi di un vite.config.ts.
// Nei test `process.execPath` è il Node della suite, e la variabile non ha effetto.
import { fork } from "node:child_process";

// Quanto output del config si tiene, per il tooltip e per il canale di log.
const MAX_OUTPUT = 4000;

/**
 * @param {object} p
 * @param {string} p.dir - cartella del progetto (diventa la cwd della sonda)
 * @param {string} p.configFile - nome del vite.config, relativo a `dir`
 * @param {string} p.probePath - percorso assoluto di probe.mjs
 * @param {number} [p.timeoutMs]
 * @returns {Promise<object>} la risposta della sonda, più `ms` e `output`; mai un rifiuto
 */
export default function runProbe({ dir, configFile, probePath, timeoutMs = 15000 }) {
  return new Promise((resolve) => {
    const inizio = Date.now();
    let output = "";
    let chiuso = false;
    let child;
    let timer;
    const fine = (risposta) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(timer);
      child?.kill();
      resolve({ ...risposta, ms: Date.now() - inizio, output: output.trim() });
    };
    try {
      child = fork(probePath, [configFile], {
        cwd: dir,
        // Vuoto di proposito: l'extension host può avere --inspect fra i suoi argomenti, e un
        // figlio che li eredita litiga per la stessa porta.
        execArgv: [],
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", VITETRANSLATE_NO_SYNC: "1" },
      });
    } catch (error) {
      fine({ ok: false, code: null, error: String(error?.message ?? error) });
      return;
    }
    const raccogli = (pezzo) => {
      if (output.length < MAX_OUTPUT) output += pezzo;
    };
    child.stdout.on("data", raccogli);
    child.stderr.on("data", raccogli);
    timer = setTimeout(
      () => fine({ ok: false, code: "TIMEOUT", error: `vite.config did not answer within ${timeoutMs / 1000} s` }),
      timeoutMs
    );
    child.on("message", fine);
    child.on("error", (error) => fine({ ok: false, code: null, error: String(error?.message ?? error) }));
    // 'close' e non 'exit': arriva dopo che anche i canali del figlio si sono chiusi, quindi dopo
    // l'ultimo 'message'. Con 'exit' una risposta in volo può arrivare tardi e perdersi.
    child.on("close", (code) =>
      fine({ ok: false, code: "NO_ANSWER", error: `the probe exited with code ${code} without answering` })
    );
  });
}
```

### Appendice I: `idePlugin/src/summarize.mjs`

```js
// Dai dati letti (package.json, risposta della sonda) alle righe del pannello.
//
// Una riga è un oggetto semplice: { label, description?, tooltip?, icon?, open?, children?,
// expanded?, project? }. `icon` è il nome di una codicon, `open` il percorso assoluto di un file
// da aprire al clic, `project` marca le righe di primo livello (i figli si caricano quando la
// riga si apre). Nessun import di `vscode`: extension.mjs traduce le righe in TreeItem, e qui
// si prova tutto con dati finti.
import path from "node:path";

const onOff = (acceso) => (acceso ? "on" : "off");

// Perché il pannello mostra proprio quel progetto (vedi la cascata in pickProject.mjs).
const MOTIVO = { active: "active file", root: "workspace root", list: null };

/** Il percorso di `dir` relativo alla radice del workspace che lo contiene ("." per la radice). */
export function relativeLabel(dir, roots) {
  const radice = roots.find((r) => dir === r || dir.startsWith(r + path.sep));
  return radice === undefined ? dir : path.relative(radice, dir) || ".";
}

/** La riga di primo livello di un progetto. */
export function projectRow(project, mode, roots) {
  const rel = relativeLabel(project.dir, roots);
  return {
    label: path.basename(project.dir),
    description: [rel === "." ? null : rel, MOTIVO[mode]].filter(Boolean).join(" · ") || undefined,
    tooltip: path.join(project.dir, project.configFile),
    icon: "root-folder",
    expanded: mode !== "list",
    project,
  };
}

/** Le righe dentro un progetto: la sintesi di vitetranslate, package.json, vite.config. */
export function projectChildren({ project, pkg, probe }) {
  return [vitetranslateRow(probe, project.dir), packageRow(pkg, project.dir), configRow(probe, project)];
}

// ------------------------------------------------------------------------------ vitetranslate

// I default documentati in lib/index.d.ts (VitetranslateOptions), usati solo per scrivere
// "default" accanto al valore. Se la libreria cambia un default, va cambiato anche qui.
function vitetranslateRow(probe, dir) {
  const label = "vitetranslate";
  if (probe.untrusted || !probe.ok) return { label, description: "unknown: vite.config not read", icon: "circle-slash" };
  const c = probe.vitetranslate;
  if (!c) return { label, description: "not registered in vite.config", icon: "warning" };

  const opt = (nome, valore, predefinito, extra = {}) => ({
    label: nome,
    description: predefinito ? `${valore} · default` : String(valore),
    ...extra,
  });
  const lingue = Array.isArray(c.preloadedLanguages) && c.preloadedLanguages.length ? c.preloadedLanguages.join(", ") : null;
  // Il default di baseDir è la cwd di chi legge la config, e la sonda gira nella cartella del progetto.
  const baseDir = c.baseDir ? path.relative(dir, c.baseDir) || "." : ".";
  const srcDir = c.srcDir ?? "src";
  const children = [
    opt("sourceLanguage", c.sourceLanguage ?? "—", false),
    opt("localeDir", c.localeDir ?? "—", false),
    opt("preloadedLanguages", lingue ?? "none", lingue === null),
    opt("srcDir", srcDir, srcDir === "src"),
    opt("baseDir", baseDir, baseDir === "."),
    opt("autoSyncDev", onOff(c.autoSyncDev !== false), c.autoSyncDev !== false),
    opt("autoSyncBuild", onOff(c.autoSyncBuild !== false), c.autoSyncBuild !== false),
    opt("includeFallback", c.includeFallback === undefined ? "dev only" : onOff(c.includeFallback), c.includeFallback === undefined),
    opt("autoWrap", c.autoWrap?.$regexp ?? onOff(c.autoWrap === true), !c.autoWrap),
    opt("icu.timeZone", c.icu?.timeZone ?? "runtime", !c.icu?.timeZone),
    opt("errorSolve", c.errorSolve ? "custom" : "built-in", !c.errorSolve, c.errorSolve ? { tooltip: JSON.stringify(c.errorSolve, null, 2) } : {}),
    opt("simpleLog", onOff(c.simpleLog === true), c.simpleLog !== true),
    llmRow(c.llm),
  ];
  return { label, description: `${c.sourceLanguage} → ${c.localeDir}/`, icon: "globe", expanded: true, children };
}

// Il blocco llm arriva già normalizzato dal plugin (lib/dev/llm/llmOptions.js). Si legge con
// cautela: una versione più vecchia della libreria può non avere tutti i campi.
function llmRow(llm) {
  if (!llm) return { label: "llm", description: "not configured" };
  const conn = llm.connection ?? {};
  let host = conn.baseURL;
  try {
    host = new URL(conn.baseURL).host;
  } catch {
    // baseURL assente o non un URL: resta com'è
  }
  const u = conn.costUnity ?? "$";
  const children = [
    { label: "model", description: conn.model ?? "—" },
    { label: "endpoint", description: conn.baseURL ?? "—" },
    { label: "apiKeyEnv", description: conn.apiKeyEnv ?? "—", tooltip: "Only the variable name: the key itself is never read." },
  ];
  if (conn.costMillionInput !== undefined) {
    children.push({ label: "price", description: `${u}${conn.costMillionInput} in · ${u}${conn.costMillionOutput} out, per 1M tokens` });
  }
  if (conn.modelClass?.name) children.push({ label: "modelClass", description: conn.modelClass.name });
  if (llm.budget) children.push({ label: "budget", description: llm.budget.preset ?? "custom", tooltip: JSON.stringify(llm.budget, null, 2) });
  if (llm.context?.mode) children.push({ label: "context", description: llm.context.mode });
  return { label: "llm", description: [conn.model, host].filter(Boolean).join(" @ ") || "configured", children };
}

// ------------------------------------------------------------------------------ package.json

function packageRow(pkg, dir) {
  const label = "package.json";
  const open = path.join(dir, "package.json");
  if (!pkg.ok) return { label, description: pkg.error, icon: "warning", ...(pkg.missing ? {} : { open }) };
  const deps = pkg.deps.map((d) => ({
    label: d.name,
    description: `${d.wanted ?? "not declared"} → ${d.installed ?? "not installed"}`,
    icon: d.installed ? "pass" : "warning",
  }));
  const nomi = Object.keys(pkg.scripts);
  const scripts = {
    label: "scripts",
    description: nomi.length ? nomi.join(" · ") : "none",
    tooltip: nomi.map((n) => `${n}: ${pkg.scripts[n]}`).join("\n") || undefined,
    icon: "terminal",
  };
  return {
    label,
    description: [pkg.name, pkg.version].filter(Boolean).join(" ") || undefined,
    icon: "package",
    open,
    expanded: true,
    children: [...deps, scripts],
  };
}

// ------------------------------------------------------------------------------ vite.config

// La prima riga dell'errore, o una frase più utile quando manca un pacchetto: caricare il config
// tira dentro i suoi import, e quasi sempre è un `npm install` non fatto.
export function errorLine(probe) {
  const pacchetto = probe.code === "ERR_MODULE_NOT_FOUND" ? /Cannot find package '([^']+)'/.exec(probe.error)?.[1] : null;
  if (pacchetto) return `needs "${pacchetto}": not installed`;
  return String(probe.error).split("\n")[0];
}

function configRow(probe, project) {
  const base = { label: project.configFile, open: path.join(project.dir, project.configFile) };
  if (probe.untrusted) {
    return {
      ...base,
      description: "not executed: Restricted Mode",
      tooltip: "Trust this workspace to let the panel run vite.config and read the plugin options.",
      icon: "shield",
    };
  }
  if (!probe.ok) {
    return { ...base, description: errorLine(probe), tooltip: [probe.error, probe.output].filter(Boolean).join("\n\n"), icon: "error" };
  }
  const v = probe.vite ?? {};
  const children = [
    { label: "plugins", description: probe.plugins.join(" · ") || "none", tooltip: probe.plugins.join("\n") || undefined, icon: "extensions" },
  ];
  const server = [v.port !== undefined ? `port ${v.port}` : null, v.host !== undefined ? `host ${v.host}` : null].filter(Boolean);
  if (server.length) children.push({ label: "server", description: server.join(" · "), icon: "server" });
  if (v.base !== undefined) children.push({ label: "base", description: String(v.base), icon: "link" });
  if (v.root !== undefined) children.push({ label: "root", description: String(v.root), icon: "folder" });
  if (v.outDir !== undefined) children.push({ label: "build.outDir", description: String(v.outDir), icon: "folder" });
  return {
    ...base,
    description: `${probe.plugins.length} plugins`,
    tooltip: `Run in a separate process in ${probe.ms} ms, the way vtranslate-cli reads it.`,
    icon: "settings-gear",
    children,
  };
}
```

### Appendice J: `idePlugin/src/extension.mjs`

```js
// L'unico file che parla con VS Code. Tutto il resto (quale progetto, cosa leggere, quali righe)
// sta nei moduli accanto, che non importano `vscode` e si provano in Node puro.
//
// Il pannello è un TreeView nell'Explorer (contributes.views.explorer in package.json). Si
// ricalcola quando cambia l'editor attivo, quando cambia un package.json o un vite.config.*,
// quando il workspace diventa fidato, e a comando (il pulsante ↻ del pannello).
import * as vscode from "vscode";
import path from "node:path";
import pickProject, { CONFIG_GLOB, WATCH_GLOB, inNodeModules } from "./pickProject.mjs";
import readPackage from "./readPackage.mjs";
import runProbe from "./runProbe.mjs";
import { projectRow, projectChildren } from "./summarize.mjs";

const VIEW_ID = "vitetranslate.project";
const LIST_MESSAGE = "No vite.config above the active file or at the workspace root: here are all the projects.";

// Il file dell'editor attivo, se è un file su disco (non un "Untitled", non un diff di git).
function activeFile() {
  const doc = vscode.window.activeTextEditor?.document;
  return doc?.uri.scheme === "file" ? doc.uri.fsPath : null;
}

function workspaceRoots() {
  return (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === "file").map((f) => f.uri.fsPath);
}

async function listAllConfigs() {
  const uris = await vscode.workspace.findFiles(CONFIG_GLOB, "**/node_modules/**", 500);
  return uris.map((u) => u.fsPath);
}

// La firma di una cascata: se non cambia, il pannello non si ridisegna.
const firma = ({ mode, projects }) => [mode, ...projects.map((p) => path.join(p.dir, p.configFile))].join("\n");

// L'id di ogni TreeItem è il percorso delle etichette dal progetto in giù: VS Code lo usa per
// ricordare cosa l'utente ha aperto e chiuso fra un ridisegno e l'altro.
const conId = (righe, padre) => righe.map((r) => ({ ...r, id: `${padre}/${r.label}` }));

export class ProjectTree {
  /**
   * @param {object} p
   * @param {string} p.probePath - percorso assoluto della sonda compilata (dist/probe.mjs)
   * @param {(riga: string) => void} p.log
   */
  constructor({ probePath, log }) {
    this.probePath = probePath;
    this.log = log;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
    /** @type {vscode.TreeView | null} impostato da activate(), per il messaggio in testa */
    this.view = null;
    this.pick = null; // Promise della cascata mostrata
    this.pickKey = null; // la sua firma
    this.seq = 0; // numera i ricalcoli: vince l'ultimo partito, non l'ultimo arrivato
    this.cache = new Map(); // dir -> Promise<{ pkg, probe }>
  }

  computePick() {
    return pickProject({ activeFile: activeFile(), roots: workspaceRoots(), listAllConfigs });
  }

  /** Ricalcola la cascata; ridisegna solo se il risultato cambia, o sempre con `force`. */
  async repick(force = false) {
    const seq = ++this.seq;
    const pick = this.computePick();
    let risultato;
    try {
      risultato = await pick;
    } catch (error) {
      this.log(`could not pick the project: ${error?.message ?? error}`);
      return;
    }
    if (seq !== this.seq) return;
    const chiave = firma(risultato);
    if (!force && chiave === this.pickKey) return;
    this.pick = pick;
    this.pickKey = chiave;
    this.emitter.fire(undefined);
  }

  /** Dimentica quanto letto per `dir`, o tutto senza argomenti. */
  forget(dir) {
    if (dir === undefined) this.cache.clear();
    else this.cache.delete(dir);
  }

  getTreeItem(row) {
    const State = vscode.TreeItemCollapsibleState;
    const apribile = row.project || row.children?.length;
    const item = new vscode.TreeItem(row.label, !apribile ? State.None : row.expanded ? State.Expanded : State.Collapsed);
    item.id = row.id;
    if (row.description) item.description = row.description;
    if (row.tooltip) item.tooltip = row.tooltip;
    if (row.icon) item.iconPath = new vscode.ThemeIcon(row.icon);
    if (row.open) item.command = { command: "vscode.open", title: "Open", arguments: [vscode.Uri.file(row.open)] };
    return item;
  }

  getChildren(row) {
    if (!row) return this.rootRows();
    if (row.project) return this.projectRows(row);
    return conId(row.children ?? [], row.id);
  }

  async rootRows() {
    if (!this.pick) this.pick = this.computePick(); // prima apertura del pannello
    let risultato;
    try {
      risultato = await this.pick;
    } catch (error) {
      this.log(`could not pick the project: ${error?.message ?? error}`);
      return [];
    }
    this.pickKey ??= firma(risultato);
    const { mode, projects } = risultato;
    if (this.view) this.view.message = mode === "list" && projects.length ? LIST_MESSAGE : undefined;
    const roots = workspaceRoots();
    return projects.map((p) => ({ ...projectRow(p, mode, roots), id: `project:${p.dir}` }));
  }

  async projectRows(row) {
    const { project } = row;
    let dati = this.cache.get(project.dir);
    if (!dati) {
      dati = this.load(project);
      this.cache.set(project.dir, dati);
    }
    return conId(projectChildren({ project, ...(await dati) }), row.id);
  }

  async load(project) {
    const pkg = readPackage(project.dir);
    // Eseguire vite.config vuol dire eseguire codice del progetto: in Restricted Mode no.
    if (!vscode.workspace.isTrusted) return { pkg, probe: { ok: false, untrusted: true } };
    const probe = await runProbe({ dir: project.dir, configFile: project.configFile, probePath: this.probePath });
    const file = path.join(project.dir, project.configFile);
    this.log(
      `${file}: ${probe.ok ? "read" : "FAILED"} in ${probe.ms} ms` +
        (probe.ok ? "" : `\n  ${probe.error}`) +
        (probe.output ? `\n  output of vite.config:\n${probe.output}` : "")
    );
    return { pkg, probe };
  }
}

export function activate(context) {
  const canale = vscode.window.createOutputChannel("viteTranslate");
  const log = (riga) => canale.appendLine(`[${new Date().toLocaleTimeString()}] ${riga}`);
  const tree = new ProjectTree({ probePath: context.asAbsolutePath(path.join("dist", "probe.mjs")), log });
  const view = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: tree, showCollapseAll: true });
  tree.view = view;

  // Le notifiche arrivano a raffica (un salvataggio tocca più file, la tastiera scorre gli
  // editor): si aspetta che si calmino. A pannello nascosto non si ricalcola niente, lo si
  // segna e basta: ci pensa il prossimo onDidChangeVisibility.
  let timer;
  let forza = false;
  let sporco = false;
  const presto = (force) => {
    forza ||= force;
    if (!view.visible) {
      sporco = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const f = forza;
      forza = false;
      tree.repick(f);
    }, 200);
  };

  const watcher = vscode.workspace.createFileSystemWatcher(WATCH_GLOB);
  const cambiato = (uri) => {
    if (inNodeModules(uri.fsPath)) return;
    tree.forget(path.dirname(uri.fsPath));
    presto(true);
  };

  context.subscriptions.push(
    canale,
    view,
    watcher,
    watcher.onDidChange(cambiato),
    watcher.onDidCreate(cambiato),
    watcher.onDidDelete(cambiato),
    view.onDidChangeVisibility(() => {
      if (view.visible && sporco) {
        sporco = false;
        presto(false);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => presto(false)),
    vscode.workspace.onDidChangeWorkspaceFolders(() => presto(true)),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      tree.forget();
      presto(true);
    }),
    vscode.commands.registerCommand("vitetranslate.refresh", () => {
      tree.forget();
      return tree.repick(true);
    }),
    { dispose: () => clearTimeout(timer) }
  );
  return tree;
}

export function deactivate() {}
```

### Appendice K: `test/list/idePluginVscodeStub.mjs`

```js
// Uno stub del modulo `vscode`, per idePluginExtension.test.mjs: solo le API che
// idePlugin/src/extension.mjs usa, e uno stato (`__stato`) che il test imposta e legge.
// Non è un test (il nome non finisce in .test.mjs): il lanciatore non lo esegue.
import path from "node:path";

export const __stato = {
  workspaceFolders: [],
  isTrusted: true,
  activeTextEditor: undefined,
  treeView: null,
  comandi: new Map(),
  log: [],
  findFiles: async () => [],
};

export class EventEmitter {
  constructor() {
    this.ascoltatori = [];
    this.event = (f) => (this.ascoltatori.push(f), { dispose() {} });
  }
  fire(valore) {
    for (const f of this.ascoltatori) f(valore);
  }
}

export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };

export class TreeItem {
  constructor(label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  constructor(id) {
    this.id = id;
  }
}

export const Uri = { file: (fsPath) => ({ scheme: "file", fsPath: path.resolve(fsPath) }) };

const evento = () => () => ({ dispose() {} });

export const window = {
  get activeTextEditor() {
    return __stato.activeTextEditor;
  },
  createOutputChannel: () => ({ appendLine: (riga) => __stato.log.push(riga), dispose() {} }),
  createTreeView: (id, opzioni) => {
    __stato.treeView = { id, ...opzioni, visible: true, message: undefined, onDidChangeVisibility: evento(), dispose() {} };
    return __stato.treeView;
  },
  onDidChangeActiveTextEditor: evento(),
};

export const workspace = {
  get workspaceFolders() {
    return __stato.workspaceFolders;
  },
  get isTrusted() {
    return __stato.isTrusted;
  },
  findFiles: (...argomenti) => __stato.findFiles(...argomenti),
  createFileSystemWatcher: () => ({ onDidChange: evento(), onDidCreate: evento(), onDidDelete: evento(), dispose() {} }),
  onDidChangeWorkspaceFolders: evento(),
  onDidGrantWorkspaceTrust: evento(),
};

export const commands = {
  registerCommand: (id, f) => (__stato.comandi.set(id, f), { dispose() {} }),
};
```

### Appendice L: `test/list/idePluginPick.test.mjs`

```js
// Estensione per l'editor (idePlugin): quale progetto mostra il pannello. La cascata di
// pickProject.mjs — file attivo, poi radice del workspace, poi l'elenco di tutti — su un albero
// di cartelle vero, creato in una cartella temporanea.
//
//   node test/list/idePluginPick.test.mjs
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pickProject, { projectFromActiveFile, dedupeConfigs, CONFIG_GLOB } from "../../idePlugin/src/pickProject.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const radice = mkdtempSync(join(tmpdir(), "vt-idepick-"));
const tocca = (rel) => {
  const file = join(radice, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "", "utf8");
  return file;
};
//   radice/
//     lib/y.js                      nessun config risalendo: si ricade oltre il passo 1
//     a/vite.config.js, a/src/deep/x.jsx
//     b/vite.config.ts, b/vite.config.js      due config: vince .js (ordine di CONFIG_FILES)
//     node_modules/pkg/vite.config.js, node_modules/pkg/i.js
tocca("lib/y.js");
tocca("a/vite.config.js");
const x = tocca("a/src/deep/x.jsx");
tocca("b/vite.config.ts");
tocca("b/vite.config.js");
tocca("node_modules/pkg/vite.config.js");
const nm = tocca("node_modules/pkg/i.js");
const tutti = [
  join(radice, "b/vite.config.ts"),
  join(radice, "b/vite.config.js"),
  join(radice, "a/vite.config.js"),
  join(radice, "node_modules/pkg/vite.config.js"),
];
let chiamate = 0;
const listAllConfigs = async () => (chiamate++, tutti);

console.log("\n== passo 1: si risale dal file attivo ==");
eq("x.jsx → a/vite.config.js", { dir: join(radice, "a"), configFile: "vite.config.js" }, projectFromActiveFile(x, [radice]));
eq("lib/y.js → niente fino alla radice", null, projectFromActiveFile(join(radice, "lib/y.js"), [radice]));
eq("file in node_modules → non conta", null, projectFromActiveFile(nm, [radice]));
eq("nessun file attivo", null, projectFromActiveFile(null, [radice]));

console.log("\n== passo 3: dedupe e ordine ==");
eq(
  "un progetto per cartella, .js prima di .ts, niente node_modules",
  [
    { dir: join(radice, "a"), configFile: "vite.config.js" },
    { dir: join(radice, "b"), configFile: "vite.config.js" },
  ],
  dedupeConfigs(tutti)
);
eq("glob per findFiles", "**/{vite.config.js,vite.config.mjs,vite.config.ts,vite.config.cjs,vite.config.mts,vite.config.cts}", CONFIG_GLOB);

console.log("\n== la cascata intera ==");
{
  const r = await pickProject({ activeFile: x, roots: [radice], listAllConfigs });
  eq("file in a/ → mode active", ["active", join(radice, "a")], [r.mode, r.projects[0].dir]);
  eq("  e nessuna ricerca di tutti i config", 0, chiamate);
}
{
  const r = await pickProject({ activeFile: join(radice, "lib/y.js"), roots: [radice], listAllConfigs });
  eq("file senza config, radice senza config → list", ["list", 2], [r.mode, r.projects.length]);
}
{
  const r = await pickProject({ activeFile: null, roots: [radice], listAllConfigs });
  eq("nessun file attivo → list", "list", r.mode);
}
{
  tocca("vite.config.mjs");
  const r = await pickProject({ activeFile: join(radice, "lib/y.js"), roots: [radice], listAllConfigs });
  eq("config alla radice: il file attivo lo trova risalendo → active", ["active", radice], [r.mode, r.projects[0].dir]);
  const r2 = await pickProject({ activeFile: null, roots: [radice], listAllConfigs });
  eq("config alla radice, nessun file attivo → root", ["root", radice, "vite.config.mjs"], [r2.mode, r2.projects[0].dir, r2.projects[0].configFile]);
}
{
  const fuori = mkdtempSync(join(tmpdir(), "vt-idepick-fuori-"));
  writeFileSync(join(fuori, "z.js"), "", "utf8");
  const r = await pickProject({ activeFile: join(fuori, "z.js"), roots: [radice], listAllConfigs });
  eq("file fuori dal workspace, senza config → root", "root", r.mode);
  rmSync(fuori, { recursive: true, force: true });
}

rmSync(radice, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
```

### Appendice M: `test/list/idePluginProbe.test.mjs`

```js
// Estensione per l'editor (idePlugin): la sonda che legge un vite.config in un processo a parte
// (probe.mjs, lanciata da runProbe.mjs). Progetti veri in una cartella temporanea, con il plugin
// importato dai sorgenti di questo repo: la risposta è quella che vedrebbe il CLI.
//
//   node test/list/idePluginProbe.test.mjs
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import runProbe from "../../idePlugin/src/runProbe.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const PROBE = fileURLToPath(new URL("../../idePlugin/src/probe.mjs", import.meta.url));
const PLUGIN = pathToFileURL(fileURLToPath(new URL("../../lib/dev/vite/vitetranslate.js", import.meta.url))).href;
const radice = mkdtempSync(join(tmpdir(), "vt-ideprobe-"));
const progetto = (nome, file, testo) => {
  const dir = join(radice, nome);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), testo, "utf8");
  return dir;
};
const sonda = (dir, configFile, timeoutMs) => runProbe({ dir, configFile, probePath: PROBE, timeoutMs });

console.log("\n== config valido ==");
{
  const dir = progetto("ok", "vite.config.js", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
console.log("rumore del config");
export default { server: { port: 4000, host: true }, plugins: [false, [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT", preloadedLanguages: ["en-US"] })]] };
`);
  const r = await sonda(dir, "vite.config.js");
  eq("ok", true, r.ok);
  eq("plugin appiattiti, false scartato", ["vitetranslate:compile-locale", "vitetranslate"], r.plugins);
  eq("vite.port / host", [4000, true], [r.vite.port, r.vite.host]);
  eq("sourceLanguage / localeDir", ["it-IT", "locale"], [r.vitetranslate.sourceLanguage, r.vitetranslate.localeDir]);
  eq("preloadedLanguages", ["en-US"], r.vitetranslate.preloadedLanguages);
  eq("default risolti dal plugin", ["src", true, true, false], [r.vitetranslate.srcDir, r.vitetranslate.autoSyncDev, r.vitetranslate.autoSyncBuild, r.vitetranslate.autoWrap]);
  eq("baseDir = cartella del progetto", dir, r.vitetranslate.baseDir);
  eq("stdout del config raccolto, non mescolato alla risposta", "rumore del config", r.output);
}

console.log("\n== config-funzione, plugin in una Promise, autoWrap RegExp ==");
{
  const dir = progetto("fn", "vite.config.mjs", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
export default ({ command }) => ({ plugins: [Promise.resolve(vitetranslate({ localeDir: "l", sourceLanguage: command === "build" ? "it-IT" : "en-US", autoWrap: /^(p|li)$/ }))] });
`);
  const r = await sonda(dir, "vite.config.mjs");
  eq("chiamata come il CLI: command build", "it-IT", r.vitetranslate?.sourceLanguage);
  eq("RegExp descritta, non persa", { $regexp: "/^(p|li)$/" }, r.vitetranslate?.autoWrap);
}

console.log("\n== plugin non registrato ==");
{
  const dir = progetto("senza", "vite.config.js", `export default { plugins: [{ name: "altro" }] };`);
  const r = await sonda(dir, "vite.config.js");
  eq("ok, vitetranslate null", [true, null, ["altro"]], [r.ok, r.vitetranslate, r.plugins]);
}

console.log("\n== errori ==");
{
  const dir = progetto("lancia", "vite.config.js", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
export default { plugins: [vitetranslate({ localeDir: "locale" })] };
`);
  const r = await sonda(dir, "vite.config.js");
  eq("opzione mancante: il messaggio del plugin", [false, true], [r.ok, /sourceLanguage/.test(r.error)]);
}
{
  const dir = progetto("manca", "vite.config.js", `import x from "pacchetto-che-non-esiste"; export default {};`);
  const r = await sonda(dir, "vite.config.js");
  eq("pacchetto mancante: code", "ERR_MODULE_NOT_FOUND", r.code);
}
{
  const dir = progetto("appeso", "vite.config.js", `setInterval(() => {}, 1000); await new Promise(() => {}); export default {};`);
  const r = await sonda(dir, "vite.config.js", 800);
  eq("config che non risponde: timeout", [false, "TIMEOUT"], [r.ok, r.code]);
}
{
  const dir = progetto("esce", "vite.config.js", `process.exit(3); export default {};`);
  const r = await sonda(dir, "vite.config.js");
  eq("config che esce da solo: NO_ANSWER", [false, "NO_ANSWER"], [r.ok, r.code]);
}

console.log("\n== vite.config.ts (solo su un Node che toglie i tipi) ==");
if (process.features.typescript) {
  const dir = progetto("ts", "vite.config.ts", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
const port: number = 5000;
export default { server: { port }, plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "en-US" })] };
`);
  const r = await sonda(dir, "vite.config.ts");
  eq("letto", [true, 5000, "en-US"], [r.ok, r.vite?.port, r.vitetranslate?.sourceLanguage]);
} else {
  console.log("  --  saltato: questo Node non toglie i tipi");
}

console.log("\n== 20 letture di fila: la risposta non si perde mai ==");
{
  const dir = join(radice, "ok");
  const esiti = await Promise.all(Array.from({ length: 20 }, () => sonda(dir, "vite.config.js")));
  eq("20 ok su 20", 20, esiti.filter((r) => r.ok).length);
}

rmSync(radice, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
```

### Appendice N: `test/list/idePluginSummary.test.mjs`

```js
// Estensione per l'editor (idePlugin): dalle letture alle righe del pannello (summarize.mjs).
// Dati scritti a mano nella forma che producono readPackage.mjs e la sonda: qui si guarda solo
// cosa diventa ogni caso — valori, "default", errori, Restricted Mode.
//
//   node test/list/idePluginSummary.test.mjs
import { join } from "node:path";
import { projectRow, projectChildren, relativeLabel, errorLine } from "../../idePlugin/src/summarize.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
// La descrizione della riga `label` fra `righe`.
const desc = (righe, label) => righe.find((r) => r.label === label)?.description;

const ROOT = join("/", "ws");
const project = { dir: join(ROOT, "site", "app"), configFile: "vite.config.js" };
const pkg = {
  ok: true,
  name: "app",
  version: "1.0.0",
  scripts: { dev: "vite", build: "vite build" },
  deps: [
    { name: "@sepoina/vitetranslate", wanted: "^4.6.4", installed: "4.6.4" },
    { name: "vite", wanted: "^8.1.0", installed: null },
    { name: "@babel/core", wanted: null, installed: "7.29.7" },
  ],
};
const probe = {
  ok: true,
  ms: 250,
  plugins: ["vite:react-babel", "vitetranslate:compile-locale", "vitetranslate"],
  vite: { port: 3003, host: true },
  vitetranslate: {
    localeDir: "locale",
    sourceLanguage: "it-IT",
    autoWrap: { $regexp: "/^p$/" },
    baseDir: project.dir,
    srcDir: "src",
    simpleLog: false,
    autoSyncDev: true,
    autoSyncBuild: false,
    llm: {
      connection: { baseURL: "https://api.deepseek.com", model: "deepseek-flash", apiKeyEnv: "KEY", costMillionInput: 0.6, costMillionOutput: 1.2, costUnity: "$", modelClass: { name: "standard" } },
      budget: { maxCostPerRun: 1, maxCostPerDay: 5, preset: "normal" },
      context: { mode: "auto" },
    },
  },
};

console.log("\n== riga del progetto ==");
eq("relativeLabel", join("site", "app"), relativeLabel(project.dir, [ROOT]));
eq("relativeLabel della radice", ".", relativeLabel(ROOT, [ROOT]));
eq("relativeLabel fuori dal workspace", "/altrove", relativeLabel("/altrove", [ROOT]));
{
  const r = projectRow(project, "active", [ROOT]);
  eq("label = nome della cartella", "app", r.label);
  eq("description = percorso · motivo", `${join("site", "app")} · active file`, r.description);
  eq("aperta se scelta dalla cascata", true, r.expanded);
  eq("chiusa in modalità list", false, projectRow(project, "list", [ROOT]).expanded);
  eq("radice: niente '.'", "workspace root", projectRow({ dir: ROOT, configFile: "vite.config.js" }, "root", [ROOT]).description);
}

console.log("\n== figli: ordine ==");
const figli = projectChildren({ project, pkg, probe });
eq("vitetranslate, package.json, vite.config.js", ["vitetranslate", "package.json", "vite.config.js"], figli.map((r) => r.label));

console.log("\n== vitetranslate ==");
{
  const vt = figli[0];
  eq("description", "it-IT → locale/", vt.description);
  eq("sourceLanguage", "it-IT", desc(vt.children, "sourceLanguage"));
  eq("preloadedLanguages assente → default", "none · default", desc(vt.children, "preloadedLanguages"));
  eq("srcDir src → default", "src · default", desc(vt.children, "srcDir"));
  eq("baseDir = progetto → default", ". · default", desc(vt.children, "baseDir"));
  eq("autoSyncDev acceso → default", "on · default", desc(vt.children, "autoSyncDev"));
  eq("autoSyncBuild spento", "off", desc(vt.children, "autoSyncBuild"));
  eq("includeFallback assente", "dev only · default", desc(vt.children, "includeFallback"));
  eq("autoWrap RegExp", "/^p$/", desc(vt.children, "autoWrap"));
  eq("icu.timeZone assente", "runtime · default", desc(vt.children, "icu.timeZone"));
  eq("errorSolve assente", "built-in · default", desc(vt.children, "errorSolve"));
  const llm = vt.children.find((r) => r.label === "llm");
  eq("llm: modello @ host", "deepseek-flash @ api.deepseek.com", llm.description);
  eq("llm: solo il nome della variabile", "KEY", desc(llm.children, "apiKeyEnv"));
  eq("llm: prezzo", "$0.6 in · $1.2 out, per 1M tokens", desc(llm.children, "price"));
  eq("llm: budget", "normal", desc(llm.children, "budget"));
}
{
  const senzaLlm = projectChildren({ project, pkg, probe: { ...probe, vitetranslate: { ...probe.vitetranslate, llm: null } } })[0];
  eq("llm null", "not configured", desc(senzaLlm.children, "llm"));
  const nonRegistrato = projectChildren({ project, pkg, probe: { ...probe, vitetranslate: null } })[0];
  eq("plugin non registrato", ["not registered in vite.config", "warning"], [nonRegistrato.description, nonRegistrato.icon]);
}

console.log("\n== package.json ==");
{
  const p = figli[1];
  eq("description", "app 1.0.0", p.description);
  eq("dichiarata e installata", "^4.6.4 → 4.6.4", desc(p.children, "@sepoina/vitetranslate"));
  eq("dichiarata, non installata: avviso", ["^8.1.0 → not installed", "warning"], [desc(p.children, "vite"), p.children.find((r) => r.label === "vite").icon]);
  eq("installata, non dichiarata", "not declared → 7.29.7", desc(p.children, "@babel/core"));
  eq("scripts", "dev · build", desc(p.children, "scripts"));
  eq("clic apre il file", join(project.dir, "package.json"), p.open);
  const manca = projectChildren({ project, pkg: { ok: false, missing: true, error: "no package.json next to vite.config" }, probe })[1];
  eq("package.json assente: niente da aprire", [undefined, "warning"], [manca.open, manca.icon]);
}

console.log("\n== vite.config ==");
{
  const c = figli[2];
  eq("description", "3 plugins", c.description);
  eq("server", "port 3003 · host true", desc(c.children, "server"));
  eq("clic apre il config", join(project.dir, "vite.config.js"), c.open);
}
{
  const [vt, , c] = projectChildren({ project, pkg, probe: { ok: false, untrusted: true } });
  eq("Restricted Mode: config non eseguito", ["not executed: Restricted Mode", "shield"], [c.description, c.icon]);
  eq("Restricted Mode: vitetranslate sconosciuto", "unknown: vite.config not read", vt.description);
}
{
  const errore = { ok: false, code: "ERR_MODULE_NOT_FOUND", error: "Cannot find package 'vite' imported from /ws/site/app/vite.config.js", output: "" };
  eq("pacchetto mancante: frase utile", 'needs "vite": not installed', errorLine(errore));
  eq("altro errore: prima riga", "boom", errorLine({ ok: false, code: null, error: "boom\nstack" }));
  const c = projectChildren({ project, pkg, probe: errore })[2];
  eq("icona di errore", "error", c.icon);
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
```

### Appendice O: `test/list/idePluginExtension.test.mjs`

```js
// Estensione per l'editor (idePlugin): extension.mjs attivata davvero, con il modulo `vscode`
// sostituito da uno stub (idePluginVscodeStub.mjs) tramite `module.registerHooks`. Si prova la
// colla: cascata → righe → TreeItem, id unici, comando di refresh, Restricted Mode.
// L'aspetto nel pannello vero resta una verifica a mano (piano idePlugin_0_0_0, Fase 4).
//
//   node test/list/idePluginExtension.test.mjs
import module from "node:module";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

if (typeof module.registerHooks !== "function") {
  console.log("  --  saltato: questo Node non ha module.registerHooks (serve 22.15+ o 23.5+)");
  process.exit(0);
}
const STUB = new URL("./idePluginVscodeStub.mjs", import.meta.url).href;
module.registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: STUB, shortCircuit: true } : next(specifier, context)),
});
const vscode = await import("vscode");
const { activate } = await import("../../idePlugin/src/extension.mjs");
const stato = vscode.__stato;

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Workspace temporaneo: app/ usa vitetranslate, other/ no, la radice non ha config.
const PLUGIN = pathToFileURL(fileURLToPath(new URL("../../lib/dev/vite/vitetranslate.js", import.meta.url))).href;
const ws = mkdtempSync(join(tmpdir(), "vt-ideext-"));
const scrivi = (rel, testo) => {
  mkdirSync(dirname(join(ws, rel)), { recursive: true });
  writeFileSync(join(ws, rel), testo, "utf8");
};
scrivi("app/vite.config.js", `import vitetranslate from ${JSON.stringify(PLUGIN)};\nexport default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };\n`);
scrivi("app/package.json", JSON.stringify({ name: "app", version: "0.1.0", scripts: { dev: "vite" } }));
scrivi("app/src/App.jsx", "");
scrivi("other/vite.config.js", "export default {};\n");
scrivi("README.md", "");

stato.workspaceFolders = [{ uri: vscode.Uri.file(ws) }];
stato.findFiles = async () => [vscode.Uri.file(join(ws, "other/vite.config.js")), vscode.Uri.file(join(ws, "app/vite.config.js"))];
const editorSu = (rel) => ({ document: { uri: vscode.Uri.file(join(ws, rel)) } });

// La sonda dai sorgenti: nei test non c'è bisogno di `npm run ide:build`.
const PROBE_SRC = fileURLToPath(new URL("../../idePlugin/src/probe.mjs", import.meta.url));
const context = { subscriptions: [], asAbsolutePath: (rel) => (rel === join("dist", "probe.mjs") ? PROBE_SRC : rel) };
const tree = activate(context);
const provider = stato.treeView.treeDataProvider;
let ridisegni = 0;
provider.onDidChangeTreeData(() => ridisegni++);

// Tutto l'albero, aperto fino in fondo.
async function tutto(riga, fuori = []) {
  for (const figlia of await provider.getChildren(riga)) {
    fuori.push(figlia);
    await tutto(figlia, fuori);
  }
  return fuori;
}

console.log("\n== attivazione ==");
eq("pannello registrato nell'Explorer", "vitetranslate.project", stato.treeView.id);
eq("comando di refresh registrato", true, stato.comandi.has("vitetranslate.refresh"));
eq("tutto sotto context.subscriptions", true, context.subscriptions.length >= 5);

console.log("\n== file attivo in app/src ==");
stato.activeTextEditor = editorSu("app/src/App.jsx");
{
  const radici = await provider.getChildren();
  eq("un progetto: app", ["app"], radici.map((r) => r.label));
  eq("description", "app · active file", radici[0].description);
  const item = provider.getTreeItem(radici[0]);
  eq("TreeItem aperto, icona root-folder", [vscode.TreeItemCollapsibleState.Expanded, "root-folder"], [item.collapsibleState, item.iconPath.id]);
  eq("nessun messaggio in testa", undefined, stato.treeView.message);

  const figli = await provider.getChildren(radici[0]);
  eq("figli", ["vitetranslate", "package.json", "vite.config.js"], figli.map((r) => r.label));
  eq("vitetranslate", "it-IT → locale/", figli[0].description);
  const pkgItem = provider.getTreeItem(figli[1]);
  eq("clic su package.json lo apre", ["vscode.open", join(ws, "app/package.json")], [pkgItem.command.command, pkgItem.command.arguments[0].fsPath]);

  const righe = [radici[0], ...(await tutto(radici[0]))];
  const ids = righe.map((r) => provider.getTreeItem(r).id);
  eq("id tutti presenti e unici", righe.length, new Set(ids.filter(Boolean)).size);
  eq("sonda annotata nel canale", true, stato.log.some((r) => /vite\.config\.js: read in \d+ ms/.test(r)));
}

console.log("\n== ricalcolo senza cambiamenti: nessun ridisegno ==");
{
  const prima = ridisegni;
  await provider.repick(false);
  eq("stessa cascata, stesso albero", prima, ridisegni);
}

console.log("\n== nessun file attivo, radice senza config: l'elenco ==");
stato.activeTextEditor = undefined;
{
  await stato.comandi.get("vitetranslate.refresh")();
  const radici = await provider.getChildren();
  eq("due progetti, in ordine di percorso", ["app", "other"], radici.map((r) => r.label));
  eq("chiusi", [vscode.TreeItemCollapsibleState.Collapsed, vscode.TreeItemCollapsibleState.Collapsed], radici.map((r) => provider.getTreeItem(r).collapsibleState));
  eq("messaggio in testa", true, /here are all the projects/.test(stato.treeView.message));
  const figliOther = await provider.getChildren(radici[1]);
  eq("other: vitetranslate non registrato", "not registered in vite.config", figliOther[0].description);
  eq("other: package.json assente", "no package.json next to vite.config", figliOther[1].description);
}

console.log("\n== Restricted Mode ==");
stato.isTrusted = false;
stato.activeTextEditor = editorSu("app/src/App.jsx");
{
  await stato.comandi.get("vitetranslate.refresh")();
  const [app] = await provider.getChildren();
  const figli = await provider.getChildren(app);
  eq("config non eseguito", "not executed: Restricted Mode", figli[2].description);
  eq("package.json letto lo stesso", "app 0.1.0", figli[1].description);
}

for (const d of context.subscriptions) d.dispose?.();
rmSync(ws, { recursive: true, force: true });
void tree;
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
```

### Appendice P: `idePlugin/README.md` (Fase 5)

~~~~markdown
# viteTranslate for VS Code

> **Experimental, 0.0.0.** It reads your setup. It never touches it.

Your [viteTranslate](https://github.com/sepoina/viteTranslate) setup at a glance, in a panel of the
Explorer, right under your folders. No more opening `vite.config` to remember whether `autoWrap`
was on.

## What you see

- **vitetranslate**: the plugin options, as the plugin itself resolved them. Source language,
  locale folder, preloaded languages, auto-sync, `autoWrap`, ICU time zone, the `llm` block (model,
  endpoint, budget, and the *name* of the key variable, never the key). Whatever you did not set is
  marked `default`.
- **package.json**: the dependencies that matter (`@sepoina/vitetranslate`, `vite`, `react`,
  `@babel/core`, …) as *declared → installed*, plus the scripts.
- **vite.config**: the plugins in load order, the server port and host.

Click `package.json` or `vite.config.*` to open it.

## Which project

The panel follows you:

1. the project of the file you are editing (the first `vite.config.*` found climbing up from it);
2. otherwise, the workspace root;
3. otherwise, every Vite project in the workspace, one per row.

It refreshes by itself when you switch files or save a `package.json` or `vite.config.*`. The ↻
button refreshes it on demand.

## How it reads vite.config

It runs it, the way `vtranslate-cli` does: in a separate process and never through Vite. No plugin
hook runs, nothing gets synced, nothing gets written. A config that hangs is dropped after 15
seconds, and whatever it prints ends up in the **viteTranslate** output channel.

In **Restricted Mode** nothing runs and you get `package.json` only. Trust the workspace to see the
rest.

## Try it from the repository

```bash
npm run ide:dev       # a new window with the extension loaded from idePlugin/
npm run ide:install   # build, package (idePlugin/vitetranslate-ide-0.0.0.vsix), install
```

After `ide:install`, run **Developer: Reload Window**. On VSCodium:
`VT_CODE_CLI=codium npm run ide:install`.
~~~~

### Appendice Q: testi di documentazione (Fase 5)

**Q.1**, sezione per `CONTRIBUTING.md`, prima di `## Pull requests`:

~~~~markdown
## Editor extension (experimental)

`idePlugin/` is a VS Code extension (VSCodium too): a panel in the Explorer that sums up the viteTranslate
setup of the project you are working on. It is not part of the npm package, and `npm run build` ignores it.

```bash
npm run ide:dev       # opens this repo in an Extension Development Host window
npm run ide:package   # builds idePlugin/vitetranslate-ide-<version>.vsix
npm run ide:install   # …and installs it (VT_CODE_CLI=codium for VSCodium)
```

Its tests are `test/list/idePlugin*.test.mjs`, part of `npm test`.

~~~~

**Q.2**, frase da aggiungere in fondo al paragrafo "No separate config file" di `doc/structure.md`:

~~~~markdown
The editor extension reads it the same way: see [The editor extension](#the-editor-extension-ideplugin-experimental).
~~~~

**Q.3**, sottosezione per `doc/structure.md`, dopo quella di `launcher/`:

~~~~markdown
### The editor extension: `idePlugin/` (experimental)

`idePlugin/` is a VS Code extension (it runs on VSCodium too): a panel in the Explorer that sums up the project's viteTranslate setup. It is not published yet, it is not in the npm package (`"files": ["lib"]`), it has its own scripts (`npm run ide:*`) and its own version (0.0.0).

It is the third reader of `vitetranslateConfig`, after the CLI and auto-sync, and it reads it the CLI's way. [`probe.mjs`](../idePlugin/src/probe.mjs) imports `vite.config.*` in a child process, finds the plugin by `name: "vitetranslate"` and sends the config back over IPC. No Vite, no hooks, no writes. Renaming the plugin or that property breaks the panel as well as the CLI.

Decisions that are not accidents:

- **A child process, not an import inside the editor.** A config is project code. In its own process a hang becomes a timeout (15 s), a crash becomes a message, and every read starts from an empty module cache. The child is the editor's own binary with `ELECTRON_RUN_AS_NODE=1`, so there is no need for a `node` on `PATH`, and its Node strips the types of a `vite.config.ts`.
- **Restricted Mode runs nothing.** Until the workspace is trusted, only `package.json` is read.
- **The config file names come from [`configFiles.js`](../lib/dev/vite/uty/configFiles.js)**, bundled into the extension at build time, so the panel and the CLI always agree on which file is the config.
- **Which project** is a cascade: the first `vite.config.*` above the active file, else the workspace root, else all of them ([`pickProject.mjs`](../idePlugin/src/pickProject.mjs)).

Guarded by `test/list/idePlugin*.test.mjs`.
~~~~
