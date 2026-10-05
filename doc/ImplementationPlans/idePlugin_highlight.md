# Piano di implementazione idePlugin: evidenziazione dei metatag

> [!NOTE]
> **Per il revisore umano**
> - **Evidenziazione dei metatag** nei file js/jsx/ts/tsx, modulo autonomo in `idePlugin/src/highlight/`: 15 stili più `off`, scelti dall'impostazione `vitetranslate.highlightStyle` o dal comando *viteTranslate: Choose highlight style…*, che mostra ogni stile dal vivo mentre si scorre la lista.
> - **Solo decorations, colori del tema**: niente grammatica TextMate, quindi il cambio di stile è immediato e `off` spegne davvero. I tre scope dello schema diventano tre colori del tema: `charts.yellow` (escape), `charts.blue`, `charts.purple`.
> - **Fonte unica**: delimitatori e nomi della macro stanno in `lib/markerSyntax.js` (4 costanti nuove, usate anche da `macroForms.js`); le regex dell'estensione si costruiscono da lì. Sparisce anche il `"_%_"` scritto a mano in `markerSpan.mjs`.
> - **Parità con Babel misurata**: 746 voci su 746 del sito e delle demo evidenziate, 0 evidenze in più; 27 casi difficili identici a `extractMarkers`. Il nuovo test la mantiene.
> - **Attivazione**: l'estensione parte anche all'apertura di un file js/ts; il pannello (vite.config, scansione) parte solo quando una sua sezione si apre.
> - **Bundle runtime invariato** (5818 B, `README: OK`); `extension.cjs` passa da 134 a 164 kB.
> - Il codice nelle appendici è **già verificato** in un mirror del repo nello scratchpad (vedi "Verifiche fatte durante il piano").

> [!TIP]
> **logDiary**
> - Fatto in sette fasi come da piano; nessuna deviazione di codice. Le appendici A–E applicate con uno script che rispetta i CRLF (contesto verificato, nessun hunk saltato); F e G estratte dal piano.
> - Test: `idePluginHighlight` 71, `markerSyntax` 37, `idePluginExtension` 202, `macroForms` 43. Parità con Babel sul sito: verde.
> - Build: `extension.cjs` 163,65 kB; `estimateSize` 4731 + 1087 = 5818 B, `README: OK`.
> - README dell'estensione: 9899 B. Per rientrare ho messo in un `<details>` ("Which runtime Sync uses") il paragrafo sul runtime di Sync su Windows; il testo non è cambiato.
> - `description` in package.json: il testo precedente era "…in its own panel of the Activity Bar."; sostituito con quello del piano.

> [!CAUTION]
> - **Verifica a mano nell'editor non fatta** (Fase 4, punti 1–5): serve `ide:install`, reload e prova dei 16 stili in tema scuro e chiaro.
> - `npm test` ha 7 test rossi, tutti per cause estranee (percorsi Windows, `EPERM`, hash dei yml di playEdge già modificati nel working tree): `compileGolden`, `extractMarkers`, `icuCompile`, `idePluginMarked`, `idePluginWorker`, `languageResource`, `llmDebug`. Il piano ne elencava 3 (baseline parziale); gli altri 4 non toccano file di questo piano.

---

## Istruzioni per chi implementa

Leggi prima `AGENTS.md`, sezione "REGOLE DI IMPLEMENTAZIONE DEL PLAN". Le sette fasi, **in quest'ordine e senza saltarne
nessuna**: implementazione, test, build, review, documentazione, pulizia, logDiary. Ogni fase sotto ha un elenco di passi
numerati e una verifica finale: non si passa alla fase dopo finché la verifica non dà quello che è scritto.

- **Appunti di fase.** `idePlugin_highlight.necessarytest.md` e `idePlugin_highlight.necessarydoc.md`, accanto a questo
  file. Gli elenchi sono già qui (Fase 2, Fase 5): all'inizio della Fase 1 crea i due file copiandoli, aggiungi quello
  che emerge strada facendo, cancellali in Fase 6.
- **Il codice delle appendici si copia così com'è.** È stato eseguito e provato (Verifiche, in fondo). Le appendici F e G
  sono file nuovi, testo completo. Le appendici A–E sono diff contro il working tree del 2026-10-05 (branch
  `4.6.4-rc.2`, con modifiche non committate): se un pezzo non combacia perché il file nel frattempo è cambiato, applica
  il *senso* del diff a mano; se il senso non è chiaro, **ask**. Nessuna "miglioria" non richiesta.
- **CRLF.** Quasi tutti i file del checkout hanno a capo `\r\n`. Modificali con l'editor (Edit), mai con script di
  sostituzione che cercano `\n`: non combaciano (successo durante il piano). I file nuovi si scrivono in LF.
- **`vscode`** si importa solo in `highlighter.mjs` e `stylePicker.mjs`. Gli altri quattro moduli di `highlight/` sono Node
  puro e si provano senza stub.
- **Stile del codice**: quello dei file vicini. Nomi e commenti in italiano, testi per l'utente in inglese.
- Lavora dalla radice del repo: `D:\L\Sviluppo\react\_vite\Translate_04`.
- **Niente commit** se l'utente non lo chiede.

### Baseline, prima di toccare niente

```bash
node test/run.mjs idePlugin markerSyntax macroForms extractMarkers
```

Su questa macchina (Windows) tre test **falliscono già**, per motivi estranei a questo piano. Devono restare come sono,
né peggio né meglio:

| Test | Prima del piano | Perché |
| --- | --- | --- |
| `idePluginMarked` | 3 KO | separatori di percorso Windows (`\p\src\A.jsx`) nelle righe ⏳ / ✎ |
| `idePluginWorker` | uscita 1 | `EPERM` cancellando la cartella temporanea: Windows tiene un file aperto |
| `extractMarkers` | 14 KO | chiavi calcolate su percorsi Windows (`App_1jcml1n` invece di `App_1cyqv8`) |

Tutto il resto è verde: fra gli altri `idePluginExtension` 202 asserzioni, `idePluginStartup` 9, `idePluginMarkerSpan`
18, `markerSyntax` 32, `macroForms` 43. Annota i numeri che vedi tu: sono il metro della Fase 2.

---

## Decisioni

| Punto | Scelta | Da chi |
| --- | --- | --- |
| Colore del contenuto | **solo decorations** (`createTextEditorDecorationType`), niente grammatica TextMate: una grammatica è statica (cambiare scope vuol dire riscriverla e ricaricare la finestra), resta accesa anche con `off` e non vede gli alias | utente |
| Gli scope dello schema | `constant.character.escape` → **`charts.yellow`** (è `editorWarning.foreground`: oro `#CCA700` nel tema scuro, ambra `#BF8803` nel chiaro, contrasto circa 3:1 sul bianco). Scartato `textPreformat.foreground`: nei temi Modern di serie è quasi il colore del testo (`#D0D0D0`, `#3B3B3B`). `constant.other.placeholder` → `charts.blue`; `keyword.control` → `charts.purple` (viola sia chiaro sia scuro). Cambiare idea costa una costante in `highlightStyles.mjs` | utente (escape), piano (gli altri due) |
| Semantic tokens | no: VS Code usa un solo provider per documento, toglierebbe la colorazione semantica di TypeScript | piano |
| Fonte unica | `lib/markerSyntax.js` resta la fonte: in più `MACRO_COMPONENT`, `MACRO_HOOK`, `TRANSLATE_TEXT_PROPS`, `RUNTIME_IMPORT_RE`. Le regex si costruiscono in `highlight/metatagPatterns.mjs`, impacchettato alla build come già `configFiles.js` | utente |
| `MACRO_IMPORT_RE` | resta una regex letterale (niente `new RegExp` a livello di modulo in un file che finisce nel browser: rischio sul tree-shaking); un test controlla che dica gli stessi nomi delle costanti | piano |
| `markerSpan.mjs` | il suo `MARCA = "_%_"` scritto a mano lascia il posto a `SOURCE_OPEN`/`SOURCE_CLOSE` (invariante 14 di `doc/structure.md`) | piano |
| Valore `off` | sì, primo dell'elenco | utente |
| Comando di anteprima | `vitetranslate.highlightStyle`, *Choose highlight style…*, `$(symbol-color)`. Quick Pick: ogni voce attiva si disegna subito, Invio salva, Esc (o clic fuori) rimette lo stile di prima | utente (comando), piano (dettagli) |
| Dove si salva | nelle impostazioni utente (Global); nel workspace se il workspace ha già un suo valore, altrimenti la scelta non avrebbe effetto | piano |
| `weakOn` | resta nel catalogo come dato, **nessuna UI** (né nella descrizione né nella Quick Pick) | utente |
| `weakOn` di `dotted-escape` | aggiunto `"light"`: senza chip, l'ambra sul bianco ha poco contrasto | piano |
| Attivazione | `onLanguage` per javascript, javascriptreact, typescript, typescriptreact. **Pannello pigro**: l'evidenziazione parte subito; elenco progetti, vite.config, scansione e inseguimento del file attivo partono alla prima sezione aperta (`avviaPannello`) | utente |
| `Startup` | il tempo (`startup: ready in N ms`) e il tetto di 30 s partono da `start()`, non dalla costruzione | piano |
| Cosa si colora | il **testo** del messaggio; i buchi (tag, `{…}`, `${…}`) tengono il colore del tema. Il chip è continuo, riga per riga, senza il rientro | piano |
| Forme riconosciute | stringa e attributo (anche su più righe), template con o senza `${…}`, testo JSX, frase con tag e valori, `<Translate>…</Translate>` (alias compresi), `` ts`…` `` (alias e annotazione di tipo compresi) | piano |
| Cosa non si colora | i commenti; i metatag dentro un letterale più grande (esempi di codice in una stringa); le macro che Babel rifiuta (`%s`, un `_%_` in mezzo, tag non bilanciati) | piano |
| Limiti di lavoro | pausa di 150 ms dopo l'ultimo tasto; oltre 1 000 000 di caratteri il file non si colora (1 MB si legge in circa 0,1 s) | piano |
| Versione dell'estensione | nessun cambio (resta 0.0.6) | piano |
| Descrizione nel marketplace | `package.json` → `description` cita anche l'evidenziazione (testo in Fase 5) | piano |

---

## Cosa si costruisce

```text
lib/markerSyntax.js ─┬─► lib/dev/babel/macroForms.js              (i nomi della macro, le prop del testo)
                     ├─► idePlugin/src/views/results/markerSpan.mjs (i delimitatori)
                     └─► idePlugin/src/highlight/
                           metatagPatterns.mjs  le regex, costruite dalle costanti; i letterali e i commenti
                                  │
                           metatagScan.mjs      findMetatags(testo) → i metatag con le loro parti (offset)
                                  │
                           highlightStyles.mjs  il catalogo: 15 stili, OFF, DEFAULT_STYLE      (dati)
                                  │
                           decorationPlan.mjs   stile → opzioni delle 4 decorazioni; metatag → intervalli
                                  │
                           highlighter.mjs      Highlighter: editor visibili, modifiche, impostazione   (vscode)
                                  │
                           stylePicker.mjs      il comando: Quick Pick con anteprima                     (vscode)
```

Un **metatag** (`findMetatags`) è un oggetto di soli offset nel testo:

| Campo | Cosa |
| --- | --- |
| `form` | `"string"`, `"template"`, `"jsxText"`, `"sentence"`, `"translate"`, `"ts"` |
| `start`, `end` | il metatag: delimitatori + contenuto; nella forma componente il solo contenuto, senza spazi ai capi |
| `inner` | `[s, e]` dentro i delimitatori (uguale a `[start, end]` se non ce ne sono) |
| `delimiters` | i due `_%_`, o nessuno |
| `componentTags` | `<Translate …>` e `</Translate>`, o `` ts` `` e il backtick che chiude |
| `holes` | dentro `inner`, quello che non è testo: tag, `{…}`, `${…}` |
| `text` | il testo da colorare: `inner` meno i buchi, riga per riga |
| `span` | tutto quello che occupa, tag compresi: serve alle sovrapposizioni |

Le **quattro decorazioni** di uno stile (`decorationPlan.mjs`), create in quest'ordine:

| Parte | Intervallo | Proprietà |
| --- | --- | --- |
| `match` | `[start, end]` con `cover: "all"`, `inner` con `"content"`, riga per riga | `backgroundColor`, `borderRadius`, `border*`, `overviewRuler*` |
| `text` | `text` | `color` (= `fg`), `fontStyle`, `textDecoration` |
| `delimiters` | `delimiters` | `color` (`delimiters.color`, se no `fg`), `opacity`, `letterSpacing` |
| `componentTags` | `componentTags` | `opacity` |

Il colore sta solo su `text` e `delimiters`, che non si sovrappongono mai: non conta quale decorazione l'editor disegna
sopra l'altra.

---

## Fase 1 — Implementazione

Ogni passo: copia dall'appendice, poi la sua verifica rapida. Niente build in questa fase.

**1.1 `lib/markerSyntax.js`** (Appendice A). Le quattro costanti nuove, subito dopo `mayHaveMarkers`.
Verifica: `node --check lib/markerSyntax.js`.

**1.2 `lib/dev/babel/macroForms.js`** (Appendice A). L'import delle tre costanti, `PROP_DEL_TESTO` da
`TRANSLATE_TEXT_PROPS`, i due confronti con `MACRO_COMPONENT`/`MACRO_HOOK`. Il comportamento non cambia.
Verifica: `node test/list/macroForms.test.mjs` → 43 ok, come in baseline.

**1.3 `idePlugin/src/highlight/`** (Appendice F): sei file nuovi, in quest'ordine: `metatagPatterns.mjs`, `metatagScan.mjs`,
`highlightStyles.mjs`, `decorationPlan.mjs`, `highlighter.mjs`, `stylePicker.mjs`. Verifica:

```bash
node -e "import('./idePlugin/src/highlight/metatagScan.mjs').then(({ findMetatags }) => console.log(findMetatags('const s = \"_%_Ciao_%_\";').map((m) => m.form)))"
# → [ 'string' ]
```

**1.4 `idePlugin/src/views/results/markerSpan.mjs`** (Appendice B). Verifica: `node test/list/idePluginMarkerSpan.test.mjs`
→ 18 ok.

**1.5 Il pannello pigro** (Appendice C), sei file:

- `core/startup.mjs`: `t0` e il timer del tetto partono in `start()` (`??=`: `start()` si richiama da sé quando la
  selezione cambia), non nel costruttore;
- `views/results/resultsView.mjs`: `avviato`, il metodo `start()` (che insegue il file attivo, come faceva il
  costruttore), e la guardia in testa a `seguiEditor`;
- `webViews/pageView.mjs`: l'opzione `onOpen`, chiamata per prima in `resolveWebviewView`;
- `selectorView.mjs`, `projectView.mjs`, `optionalView.mjs`: passano `onOpen` a `super`.

Verifica: `node --check` sui sei file.

**1.6 `idePlugin/src/extension.mjs` e `idePlugin/package.json`** (Appendice D).

- In `extension.mjs`: il commento di testa, i due import, `new Highlighter` per primo, `avviaPannello` con `preparato`
  come promessa (si risolve a pannello pronto: i due test di attivazione la aspettano), `onOpen: avviaPannello` alle tre
  webview, la visibilità di Results che avvia anch'essa il pannello, il comando, `highlighter` fra le sottoscrizioni e
  nel valore restituito. **Non** resta nessuna chiamata a `startup.start()` fuori da `avviaPannello`.
- In `package.json`: `activationEvents` (prima era `[]`), la proprietà `vitetranslate.highlightStyle` (enum, etichette e
  descrizioni nello stesso ordine del catalogo), il comando prima di `vitetranslate.refresh`.

Verifica: `node --check idePlugin/src/extension.mjs` e
`node -e "JSON.parse(require('fs').readFileSync('idePlugin/package.json','utf8'))"`.

**1.7 `idePlugin/rolldown.config.mjs`**: solo il commento di testa. Dopo «configFiles.js viene preso da lib/ e
impacchettato qui dentro: la lista dei nomi di vite.config è una sola, quella del CLI.» aggiungi:
«Allo stesso modo markerSyntax.js: i delimitatori e i nomi della macro che evidenziazione e Results leggono sono quelli
della libreria.»

**A fine fase** `idePluginExtension` e `idePluginStartup` **falliscono**: `Highlighter` chiede allo stub API che ancora non
ha (`onDidChangeVisibleTextEditors`, …). È atteso, lo sistema la Fase 2. Annotalo in `necessarytest`.

---

## Fase 2 — Test

Elenco per `idePlugin_highlight.necessarytest.md`:

1. **`test/list/idePluginVscodeStub.mjs`** (Appendice E): in `__stato` le voci nuove (`configWorkspace`, `aggiornate`,
   `configurazioni`, `visibleTextEditors`, `visibili`, `decorazioni`, `quickPick`); `OverviewRulerLane` e
   `ConfigurationTarget`; in `window` `visibleTextEditors`, `onDidChangeVisibleTextEditors`,
   `createTextEditorDecorationType`, `createQuickPick` (una Quick Pick che il test guida: `attiva`, `accetta`, `chiudi`); in
   `workspace` `getConfiguration` con `inspect` e `update` (che avvisa come VS Code) e `onDidChangeConfiguration`.
2. **`test/list/markerSyntax.test.mjs`** (Appendice E): un blocco di 5 asserzioni sui nomi della macro.
3. **`test/list/idePluginHighlight.test.mjs`** (Appendice G, file nuovo), cinque parti:
   1. le parti di un metatag su sei esempi;
   2. la parità con Babel: 27 casi difficili, poi tutti i sorgenti di `site/` e `demo/` (nessuna voce persa, nessuna
      evidenza in più);
   3. un posto solo: catalogo e `package.json` d'accordo, colori solo come id del tema, regex dalla libreria;
   4. l'editor sullo stub: decorazioni, `off`, id sconosciuto, la pausa dopo una modifica, la Quick Pick (anteprima, Esc,
      Invio, workspace);
   5. l'attivazione da un file js: evidenziazione subito, nessun progetto cercato finché Selector non si apre.

Verifica:

```bash
node test/run.mjs idePlugin markerSyntax macroForms extractMarkers
```

| Test | Atteso |
| --- | --- |
| `idePluginHighlight` | ✓ 71 asserzioni |
| `markerSyntax` | ✓ 37 asserzioni (32 + 5) |
| `idePluginExtension`, `idePluginStartup`, `idePluginMarkerSpan`, `macroForms`, … | ✓ come in baseline |
| `idePluginMarked`, `idePluginWorker`, `extractMarkers` | gli stessi KO della baseline, non uno di più |

Poi tutta la suite, `npm test`: rispetto alla baseline cambia solo il test nuovo e il conteggio di `markerSyntax`.

Se la parte 2b di `idePluginHighlight` fallisce, il test stampa file e riga di ogni voce persa o evidenza in più:
guarda lì prima di toccare le regex. Una differenza vera con Babel si annota in `necessaryreview` (Fase 4), non si
aggira nel test.

---

## Fase 3 — Build

1. `npm run ide:build` → rolldown finisce senza errori; `dist/extension.cjs` circa 164 kB (prima circa 134 kB), gli altri
   bundle invariati.
2. `node --check idePlugin/dist/extension.cjs`.
3. **`npm run estimateSize`**: `lib/markerSyntax.js` è cambiato, e la regola di `AGENTS.md` lo chiede a ogni chiusura.
   Atteso: `React runtime 4731 B`, `ICU helpers 1087 B`, `total 5818 B`, `site/runtimeSize.json: unchanged`,
   `README: OK`. Se un numero cambia, **fermati**: le costanti nuove sono entrate nel bundle del browser, e va scritto
   in `necessaryreview`.

---

## Fase 4 — Review

**Codice** (controlli a comando):

```bash
grep -rn '"_%_"' idePlugin/src            # nessuna riga di codice: solo commenti
grep -n '"Translate"\|"useTranslateToString"' lib/dev/babel/macroForms.js   # nessuna
grep -rln 'from "vscode"' idePlugin/src/highlight   # solo highlighter.mjs e stylePicker.mjs
grep -n 'startup.start()' idePlugin/src/extension.mjs   # una sola, dentro avviaPannello
```

**Nell'editor** (a mano, lo fa l'utente: chiedigli di farlo e di dirti com'è andata):

1. `npm run ide:install`, poi *Developer: Reload Window*.
2. Con il pannello viteTranslate **chiuso**, apri `site/pages/playEdge/src/testCases.jsx`: i metatag sono evidenziati;
   le stringhe che contengono esempi di codice (`'<Translate>_%_…_%_</Translate>'`) no. Nel canale *viteTranslate*
   nessuna riga `startup:`.
3. Apri il pannello: compare `startup: ready in N ms`, con N piccolo (non il tempo da quando la finestra è aperta).
4. *viteTranslate: Choose highlight style…*: scorri le 16 voci in *Dark Modern* e in *Light Modern* (si cambia tema con
   `Ctrl+K Ctrl+T`). Esc rimette lo stile di prima; Invio lo scrive in `settings.json`.
5. Scrivi un `"_%_prova_%_"` nuovo: si colora dopo un attimo.

Uno stile illeggibile in un tema si corregge **solo** nel catalogo (`highlightStyles.mjs`); se cambiano nomi o
descrizioni va aggiornato anche `package.json` (il test lo pretende). Un fallimento architetturale va in
`idePlugin_highlight.necessaryreview.md`, con ask all'utente, e si riparte dalla Fase 1.

---

## Fase 5 — Documentazione

Elenco per `idePlugin_highlight.necessarydoc.md`. Testi in inglese, discorsività minima (regole di `AGENTS.md`).

**5.1 `idePlugin/README.md`.** Oggi 9420 byte col comando di `AGENTS.md` (lanciato dentro `idePlugin/`): il limite è
10 kB, restiamo **sotto i 10 000 byte**. L'elenco degli stili va in un `<details>`, che non conta.

- Una sezione nuova `## Highlighting`, prima di `## Under the hood`:

  ```markdown
  ## Highlighting

  Marked strings stand out as you type, in `.js`, `.jsx`, `.ts` and `.tsx`: `_%_…_%_`, `<Translate>…</Translate>`,
  `` ts`…` ``. Same rules as the extraction: what lights up gets translated. Comments, and code samples inside
  strings, stay plain.

  Fifteen styles, all in your theme's colors. **viteTranslate: Choose highlight style…** tries each one on your code
  as you move through the list: Enter keeps it, Esc changes nothing. Or set `vitetranslate.highlightStyle`, `off`
  included. It works with the panel closed.

  <details><summary>The fifteen styles</summary>

  | Style | Looks like |
  | --- | --- |
  | `escape-chip` (default) | chip and ruler |
  | … una riga per stile: id e `description` del catalogo, nell'ordine del catalogo … |

  </details>
  ```

- Nella tabella di `## Settings`, una riga:
  `` | `vitetranslate.highlightStyle` | `escape-chip` | How marked strings stand out in the editor, or `off`. Try them live with **Choose highlight style…**. | ``
- In `## Under the hood`, un paragrafo: «Opening a JS or TS file wakes the extension for the highlighting only:
  `vite.config` is read, and the project scanned, when you open the panel.»
- Misura col comando di `AGENTS.md`. Oltre i 10 000 byte: prima riorganizza (accorcia, sposta in `<details>`); se non
  basta, **ask** prima di spostare sezioni in un file a parte.

**5.2 `idePlugin/package.json`, `description`**:
«Your viteTranslate setup at a glance, in its own panel, and your marked strings highlighted as you type.»

**5.3 `doc/structure.md`** (in inglese, come il resto del file):

- Nell'albero dei file, la riga di `markerSyntax.js`: aggiungi «the macro's names» all'elenco (`marker delimiters, the
  macro's names, %s, ICU_TRIGGER_RE and __untranslated__ — one source for all sides`).
- Sezione *The editor extension*, paragrafo che elenca le cartelle di `idePlugin/src/`: aggiungi `highlight/` (the
  metatag highlighting and its style picker).
- Stessa sezione, un punto nuovo subito dopo *Startup shows one section until the rest is ready*:

  > - **Highlighting lives in `highlight/` and does not need the panel.** [`highlighter.mjs`](../idePlugin/src/highlight/highlighter.mjs) decorates the visible js/jsx/ts/tsx editors (150 ms after the last keystroke, once per document version, nothing above 1 MB) with four `TextEditorDecorationType`s per style, one per part of a metatag: chip, border and ruler on the match, color and font on the message text, opacity on the `_%_` and on `<Translate>` / `` ts` ``. Colors are theme color ids only ([`highlightStyles.mjs`](../idePlugin/src/highlight/highlightStyles.mjs): 15 styles and `off`) and there is no TextMate grammar, so a new style shows at once. The metatags come from [`metatagScan.mjs`](../idePlugin/src/highlight/metatagScan.mjs): regexes built in [`metatagPatterns.mjs`](../idePlugin/src/highlight/metatagPatterns.mjs) from `markerSyntax.js` (delimiters, `MACRO_COMPONENT`, `MACRO_HOOK`, `TRANSLATE_TEXT_PROPS`, `RUNTIME_IMPORT_RE`), plus one pass over literals and comments, so comments and code samples inside strings stay plain. It approximates `extractMarkers` and the approximation is measured: `idePluginHighlight.test.mjs` requires every entry Babel finds in `site/` and `demo/`, and nothing else. **Choose highlight style…** ([`stylePicker.mjs`](../idePlugin/src/highlight/stylePicker.mjs)) previews each style live and saves it on Enter.
  > - **The extension also activates on js/ts files** (`onLanguage`), for the highlighting; the panel starts only when one of its sections opens (`avviaPannello` in `extension.mjs`: the first `resolveWebviewView`, or Results becoming visible). Until then there is no project list, no `vite.config` run, no scan, no following of the active file; `Startup` counts its time and its 30 s cap from `start()`.

- Invariante 14: dopo «every reader and writer on both sides of the build/runtime boundary imports them from there»
  aggiungi «— the editor extension too (`markerSpan.mjs`, `highlight/`), bundled at build time».

**5.4 `README.md` della radice**: non cita l'estensione, non si tocca.

A fine fase, se una lunghezza supera i limiti, dillo all'utente (regola di `AGENTS.md`).

---

## Fase 6 — Pulizia

1. Cancella `idePlugin_highlight.necessarytest.md`, `idePlugin_highlight.necessarydoc.md` e, se c'è ed è risolto,
   `idePlugin_highlight.necessaryreview.md`.
2. `git status`: oltre alle modifiche che c'erano già prima del piano, solo questi file.
   - Nuovi: `idePlugin/src/highlight/` (6 file), `test/list/idePluginHighlight.test.mjs`.
   - Modificati: `lib/markerSyntax.js`, `lib/dev/babel/macroForms.js`, `idePlugin/src/extension.mjs`,
     `idePlugin/src/core/startup.mjs`, `idePlugin/src/views/results/resultsView.mjs`,
     `idePlugin/src/views/results/markerSpan.mjs`, `idePlugin/src/webViews/pageView.mjs`, i tre `…View.mjs`,
     `idePlugin/package.json`, `idePlugin/rolldown.config.mjs`, `idePlugin/README.md`, `doc/structure.md`,
     `test/list/idePluginVscodeStub.mjs`, `test/list/markerSyntax.test.mjs`, questo piano.
   - Più `idePlugin/dist/` e un eventuale `.vsix` nuovo, se li hanno prodotti la Fase 3 o la Fase 4.
3. Nessun file di prova lasciato in giro (script, copie di file).

---

## Fase 7 — logDiary

Subito dopo la nota `[!NOTE]` in testa a questo file, una nota `[!TIP]` (al massimo una decina di righe, elenco puntato):
cosa è stato fatto, le decisioni prese strada facendo, i numeri (asserzioni, parità col sito, `extension.cjs`,
`estimateSize`), le deviazioni dal piano. Se qualcosa resta aperto, una `[!CAUTION]` o `[!IMPORTANT]`: per esempio la
verifica a mano nell'editor non fatta, o uno stile che si vede poco in un tema.

---

## Limiti noti

Approssimazioni dichiarate: nessuna colpisce il sito o le demo (parità 746/746), ma una regex non è Babel.

- **Una frase in un componente.** `<Foo>_%_Ciao <b/> mondo_%_</Foo>` si colora; Babel accetta la frase spezzata solo
  dentro un tag host minuscolo o un frammento, e qui avvisa senza estrarre.
- **Le espressioni regolari dopo una `}`** non si riconoscono (in JSX sarebbe `{…}/>`): le loro virgolette possono aprire
  una stringa finta e nascondere un metatag sulla stessa riga.
- **Template annidati** dentro un `${…}` oltre i tre livelli di graffe, o con un backtick dentro un `${…}` di un template
  marcato: quel template non si colora.
- **Un backtick o un apostrofo spaiato** in un testo JSX, dopo uno spazio (`'cause`), può aprire un letterale finto fino
  alla fine della riga (o del file, per il backtick).
- **`ts` passato come prop** (`function A({ ts })`) o `Translate` riesportato da un modulo dell'utente non si riconoscono:
  come per Babel, che guarda solo gli import dal runtime e le dichiarazioni nel file.
- **La versione della libreria.** I delimitatori sono quelli del repo impacchettati alla build, non quelli della
  libreria installata nel progetto: se un giorno cambiassero, servirebbe un'estensione nuova. Oggi sono gli stessi da
  sempre.

---

## Verifiche fatte durante il piano

Nello scratchpad della sessione: lo scanner da solo, poi un mirror del repo (copie di `lib/`, `idePlugin/`, `test/`,
`node_modules` collegato) con **tutte** le modifiche delle appendici applicate.

| Verifica | Esito |
| --- | --- |
| Colori: i 17 id dello schema e i 3 sostituti | esistono tutti nel registro dei colori di VS Code (sorgenti `baseColors.ts`, `editorColors.ts`, `editorColorRegistry.ts`, `miscColors.ts`, `chartsColors.ts`) |
| Colori nei temi Modern di serie | `dark_modern.json` e `light_modern.json` ridefiniscono `textPreformat.foreground` (`#D0D0D0`, `#3B3B3B`), non `charts.*`: da qui `charts.yellow` per gli stili "escape" |
| Parità col sito e le demo (77 file con voci) | 746 voci di Babel su 746 evidenziate, 0 evidenze senza voce; per forma: string 496, translate 115, jsxText 100, attribute 23, sentence 6, ts 4, template 2 |
| Prima versione, senza i letterali | stesse 746 voci, ma 135 evidenze in più (133 esempi di codice in stringhe o template, 1 in un commento, 1 macro rifiutata per `%s`): da qui la passata sui letterali e il rifiuto delle macro |
| Casi difficili contro `extractMarkers` | 27/27 identici (con la prima versione 22/26: `${…}` con stringhe dentro, `_%_` spaiati in due `<p>`, regex con le virgolette, hook tipato) |
| Velocità di `findMetatags` | 32 kB in 8 ms, 315 kB in 33 ms, 1,26 MB in 96 ms (prima di togliere un controllo quadratico: 1,1 s) |
| `idePluginHighlight` nel mirror | 71/71 |
| Regressioni nel mirror | `idePlugin*`, `markerSyntax` (37), `macroForms`, `babelTranslate`, `jsxMessage`, `macroEdits`, `autoWrap*`, `markerIndex`, `markerCache`, `fastVerify*` verdi; gli stessi 3 test rossi della baseline, con gli stessi KO |
| Bundle runtime (`measureRuntime`) | 4731 + 1087 = 5818 B, uguale al working tree |
| Build dell'estensione (rolldown) | ok; `extension.cjs` 163,7 kB; i flag `d`, `gmu` e il lookbehind arrivano intatti; il bundle si carica (`activate` è una funzione) |

---

# Appendici

Generate dai file del mirror già verificati (vedi "Verifiche fatte durante il piano"). I diff sono scritti con a capo LF: i file del checkout sono CRLF, applicali con l'editor seguendo righe e contesto, non con `git apply`.

## Appendice A — lib: le costanti della macro

### `lib/markerSyntax.js` (modifica)

```diff
@@ -93,6 +93,21 @@ export function mayHaveMarkers(code) {
   return code.includes(SOURCE_OPEN) || (code.includes(RUNTIME_IMPORT) && MACRO_IMPORT_RE.test(code));
 }
 
+// --- La macro: i nomi che il runtime esporta, le prop che la escludono (4.6.4) ---
+//
+// Due lettori: macroForms.js, che riconosce la macro dagli import, e l'evidenziazione
+// dell'estensione (idePlugin/src/highlight/), che la colora mentre si scrive. MACRO_IMPORT_RE qui
+// sopra resta una regex letterale (niente costruzione a runtime in un file che va nel browser) e
+// dice gli stessi due nomi: markerSyntax.test.mjs controlla che restino d'accordo.
+export const MACRO_COMPONENT = "Translate";
+export const MACRO_HOOK = "useTranslateToString";
+
+/** Le prop di <Translate> che dicono "il testo lo passo io": con una di queste la macro non c'entra. */
+export const TRANSLATE_TEXT_PROPS = ["t", "o", "a", "children", "skipMark"];
+
+/** L'import del runtime, con l'elenco fra graffe nel gruppo 1. Con /g: si usa solo con matchAll. */
+export const RUNTIME_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*["']@sepoina\/vitetranslate\/react["']/g;
+
 // --- Chiave riservata delle tabelle compilate ---
 //
 // L'elenco delle voci che in questa lingua una traduzione non ce l'hanno. La scrive
```

### `lib/dev/babel/macroForms.js` (modifica)

```diff
@@ -13,7 +13,9 @@
 // Da autoWrap dipende solo COME si riscrive.
 
 import { registerMarker, relPathOf, cleanJsxText, markedTextOf } from "./markerCore.js";
-import { compiledMarker, SOURCE_OPEN, SOURCE_CLOSE, RUNTIME_IMPORT } from "../../markerSyntax.js";
+import {
+  compiledMarker, SOURCE_OPEN, SOURCE_CLOSE, RUNTIME_IMPORT, MACRO_COMPONENT, MACRO_HOOK, TRANSLATE_TEXT_PROPS,
+} from "../../markerSyntax.js";
 import { colorize } from "../../utility.js";
 import { jsxTokens, templateTokens, buildMessage, argsPieces, hintsOf, isBlank, MacroError } from "./jsxMessage.js";
 
@@ -26,7 +28,7 @@ const MOTIVI = {
 };
 
 // Le prop di <Translate> che dicono "il testo lo passo io": con una di queste la macro non c'entra.
-const PROP_DEL_TESTO = new Set(["t", "o", "a", "children", "skipMark"]);
+const PROP_DEL_TESTO = new Set(TRANSLATE_TEXT_PROPS);
 
 /**
  * @param {object} ctx - lo stato di extractMarkers per questo file:
@@ -46,8 +48,8 @@ export function creaMacro(ctx) {
     for (const sp of s.specifiers) {
       if (sp.type !== "ImportSpecifier") continue;
       const importato = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
-      if (importato === "Translate") nomiTranslate.add(sp.local.name);
-      if (importato === "useTranslateToString") nomiUseTs.add(sp.local.name);
+      if (importato === MACRO_COMPONENT) nomiTranslate.add(sp.local.name);
+      if (importato === MACRO_HOOK) nomiUseTs.add(sp.local.name);
     }
   }
```

## Appendice B — markerSpan.mjs: il delimitatore dalla libreria

### `idePlugin/src/views/results/markerSpan.mjs` (modifica)

```diff
@@ -3,7 +3,9 @@
 // più righe — un <Translate> che va a capo, un template, un testo JSX lungo — non "possiede" le
 // righe sotto. Qui si risale: la voce più vicina sopra il cursore vale se il cursore sta dentro
 // di lei, e dove finisce lo si legge dal testo del documento, a partire da dove comincia.
-// Nessun import di `vscode`.
+// Nessun import di `vscode`. I delimitatori vengono da lib/markerSyntax.js, impacchettato qui alla
+// build: mai riscritti a mano (invariante 14 in doc/structure.md).
+import { SOURCE_OPEN, SOURCE_CLOSE } from "../../../../lib/markerSyntax.js";
 
 // Da riga e colonna (da 1) all'offset nel testo; null se fuori.
 function offsetDi(testo, line, column) {
@@ -79,17 +81,14 @@ export function markerEnd(testo, inizio) {
   }
   // Un testo marcato (`_%_…_%_`, anche quello che autoWrap avvolge con i suoi tag e valori in
   // mezzo): fino al `_%_` che lo chiude. Un testo JSX qualunque: fino al primo tag o `{`.
-  if (testo.startsWith(MARCA, inizio)) {
-    const chiude = testo.indexOf(MARCA, inizio + MARCA.length);
-    return chiude === -1 ? null : chiude + MARCA.length;
+  if (testo.startsWith(SOURCE_OPEN, inizio)) {
+    const chiude = testo.indexOf(SOURCE_CLOSE, inizio + SOURCE_OPEN.length);
+    return chiude === -1 ? null : chiude + SOURCE_CLOSE.length;
   }
   const fine = testo.slice(inizio).search(/[<{]/);
   return fine === -1 ? testo.length : inizio + fine;
 }
 
-// Il segno che apre e chiude un testo marcato.
-const MARCA = "_%_";
-
 // Quante voci sopra il cursore si provano, al massimo, prima di arrendersi.
 const RISALITA = 10;
```

## Appendice C — il pannello pigro

### `idePlugin/src/core/startup.mjs` (modifica)

```diff
@@ -4,6 +4,7 @@
 // compaiono già piene, invece di passare da "Loading…". La preparazione la fa questo giro, non
 // le sezioni: nascoste, VS Code non chiede loro niente. Da lì la chiave resta vera: i ricalcoli
 // successivi hanno già i loro segni (Loading…, ⏳). Un tetto di tempo, nel caso qualcosa si pianti.
+// Il giro parte con la prima sezione in vista (avviaPannello in extension.mjs), non con l'estensione.
 //
 // I tempi, nel canale: quanto ci mette a essere pronto, e da lì quanto ci mette VS Code a mostrare
 // Results e a creare, caricare e disegnare la pagina di Project (stage). Una volta sola.
@@ -26,12 +27,14 @@ export class Startup {
     Object.assign(this, { projects, marked, log });
     this.cambiato = new vscode.EventEmitter();
     this.onDidChange = this.cambiato.event; // `starting` è cambiato
-    this.t0 = Date.now();
+    // Il tempo e il tetto partono con start(), non con l'estensione: attivata da un file js/ts (per
+    // l'evidenziazione), il pannello può aprirsi molto dopo.
+    this.t0 = null;
+    this.timer = undefined;
     this.tPronto = null;
     this.tappe = new Set();
     this.pronto = false;
     this.testo = "Looking for Vite projects…";
-    this.timer = setTimeout(() => this.accendi(), READY_TIMEOUT_MS);
   }
 
   /** Cosa si sta preparando, o null a preparazione finita. */
@@ -49,6 +52,8 @@ export class Startup {
   /** Prepara la prima immagine; si risolve a pannello pronto. */
   async start() {
     if (this.pronto) return;
+    this.t0 ??= Date.now();
+    this.timer ??= setTimeout(() => this.accendi(), READY_TIMEOUT_MS);
     try {
       await this.projects.currentList();
     } catch {
```

### `idePlugin/src/views/results/resultsView.mjs` (modifica)

```diff
@@ -71,7 +71,14 @@ export class ResultsView {
       vscode.workspace.onDidCloseTextDocument((doc) => this.documento(doc, false)),
     ];
     for (const doc of vscode.workspace.textDocuments ?? []) if (doc.isDirty) this.documento(doc, true);
-    // All'apertura, il file già attivo.
+    // Il file attivo si insegue solo a pannello partito (start): prima vorrebbe dire cercare i
+    // progetti e selezionarne uno con il pannello chiuso.
+    this.avviato = false;
+  }
+
+  /** Il pannello è partito (avviaPannello in extension.mjs): da qui il file attivo, a cominciare da adesso. */
+  start() {
+    this.avviato = true;
     this.seguiEditor(vscode.window.activeTextEditor);
   }
 
@@ -155,6 +162,7 @@ export class ResultsView {
   // conta solo l'ultimo. Un progetto diverso si seleziona come da un clic in Config; lo stesso
   // progetto non tocca niente. Poi Results mostra il file.
   seguiEditor(editor) {
+    if (!this.avviato) return;
     clearTimeout(this.timerEditor);
     this.timerEditor = setTimeout(() => this.segui(editor), 150);
   }
```

### `idePlugin/src/webViews/pageView.mjs` (modifica)

```diff
@@ -17,11 +17,13 @@ export class PageView {
    * @param {(p: object) => string} [p.html] - la pagina: selectorHtml, projectHtml
    * @param {(riga: string) => void} p.log
    * @param {() => void} [p.onVisible] - la sezione è tornata in vista
+   * @param {() => void} [p.onOpen] - VS Code apre la sezione (resolveWebviewView): la prima volta fa
+   *   partire il pannello (avviaPannello in extension.mjs)
    * @param {(fase: "page" | "script" | "drawn") => void} [p.onStage] - le tappe di una pagina nuova:
    *   creata, script caricato (`ready`), primo stato disegnato (`drawn`, se la pagina lo dice)
    */
-  constructor({ extensionUri, name, script, html, log, onVisible, onStage }) {
-    Object.assign(this, { extensionUri, name, script, html, log, onVisible, onStage });
+  constructor({ extensionUri, name, script, html, log, onVisible, onOpen, onStage }) {
+    Object.assign(this, { extensionUri, name, script, html, log, onVisible, onOpen, onStage });
     /** @type {Record<string, (value?: string) => any>} i clic della pagina */
     this.actions = {};
     this.view = null;
@@ -54,6 +56,7 @@ export class PageView {
   }
 
   resolveWebviewView(view) {
+    this.onOpen?.();
     this.view = view;
     // Solo dist/: la pagina non vede nient'altro dell'estensione, né del workspace.
     view.webview.options = { enableScripts: true, localResourceRoots: [this.dist] };
```

### `idePlugin/src/webViews/selector/selectorView.mjs` (modifica)

```diff
@@ -23,9 +23,10 @@ export class SelectorView extends PageView {
    * @param {import("../../core/startup.mjs").Startup} p.startup
    * @param {(riga: string) => void} p.log
    * @param {() => void} [p.onVisible]
+   * @param {() => void} [p.onOpen]
    */
-  constructor({ extensionUri, projects, results, startup, log, onVisible }) {
-    super({ extensionUri, name: "Selector", html: selectorHtml, script: "webview.js", log, onVisible });
+  constructor({ extensionUri, projects, results, startup, log, onVisible, onOpen }) {
+    super({ extensionUri, name: "Selector", html: selectorHtml, script: "webview.js", log, onVisible, onOpen });
     Object.assign(this, { projects, marked: results.tree, startup });
     this.actions = {
       select: (dir) => projects.select(dir),
```

### `idePlugin/src/webViews/project/projectView.mjs` (modifica)

```diff
@@ -29,9 +29,10 @@ export class ProjectView extends PageView {
    * @param {import("../../core/startup.mjs").Startup} p.startup
    * @param {(riga: string) => void} p.log
    * @param {() => void} [p.onVisible]
+   * @param {() => void} [p.onOpen]
    */
-  constructor({ extensionUri, extensionId, projects, results, cli, startup, log, onVisible }) {
-    super({ extensionUri, name: "Project", html: projectHtml, script: "projectWebview.js", log, onVisible, onStage: (fase) => startup.stage(TAPPE[fase]) });
+  constructor({ extensionUri, extensionId, projects, results, cli, startup, log, onVisible, onOpen }) {
+    super({ extensionUri, name: "Project", html: projectHtml, script: "projectWebview.js", log, onVisible, onOpen, onStage: (fase) => startup.stage(TAPPE[fase]) });
     Object.assign(this, { projects, results, cli });
     this.letture = new WeakSet(); // le letture già date alla barra di avanzamento
     this.barra = progressIn(PROJECT_VIEW_ID);
```

### `idePlugin/src/webViews/optional/optionalView.mjs` (modifica)

```diff
@@ -39,9 +39,10 @@ export class OptionalView extends PageView {
    * @param {import("../../views/results/resultsView.mjs").ResultsView} p.results
    * @param {import("../../core/cliTasks.mjs").CliTasks} p.cli
    * @param {(riga: string) => void} p.log
+   * @param {() => void} [p.onOpen]
    */
-  constructor({ extensionUri, projects, results, cli, log }) {
-    super({ extensionUri, name: "Optional", script: "optionalWebview.js", log });
+  constructor({ extensionUri, projects, results, cli, log, onOpen }) {
+    super({ extensionUri, name: "Optional", script: "optionalWebview.js", log, onOpen });
     this.projects = projects;
     this.mode = null; // null: chiusa
     this.letture = new WeakSet(); // le letture già date alla barra di avanzamento (Inspector)
```

## Appendice D — extension.mjs e package.json

### `idePlugin/src/extension.mjs` (modifica)

```diff
@@ -6,7 +6,14 @@
 //   - probes/: i processi figli che leggono vite.config e le voci marcate;
 //   - views/results/: Results, la TreeView delle voci marcate (resultsView.mjs, markedTree.mjs);
 //   - webViews/: Selector, Project e la sezione facoltativa (Help, LLM, Inspector), su una base comune
-//     (pageView.mjs).
+//     (pageView.mjs);
+//   - highlight/: l'evidenziazione dei metatag nell'editor, e il comando che ne sceglie lo stile.
+//     Non dipende dal pannello.
+//
+// Due modi di partire. L'estensione si attiva all'apertura del pannello, o di un file js/jsx/ts/tsx
+// (activationEvents in package.json: serve all'evidenziazione). L'evidenziazione parte subito; il
+// pannello — elenco dei progetti, vite.config, scansione, il file attivo inseguito — solo quando
+// una sua sezione si apre (avviaPannello): con il pannello chiuso non si esegue niente del progetto.
 // I moduli di stato e di pagina (…State.mjs, …Page.mjs, markedRows.mjs, …) non importano `vscode`
 // e si provano in Node puro.
 //
@@ -29,6 +36,8 @@ import { ResultsView } from "./views/results/resultsView.mjs";
 import { SelectorView, SELECTOR_VIEW_ID } from "./webViews/selector/selectorView.mjs";
 import { ProjectView, PROJECT_VIEW_ID } from "./webViews/project/projectView.mjs";
 import { OptionalView, OPTIONAL_VIEW_ID } from "./webViews/optional/optionalView.mjs";
+import { Highlighter } from "./highlight/highlighter.mjs";
+import { pickHighlightStyle } from "./highlight/stylePicker.mjs";
 
 export function activate(context) {
   const canale = vscode.window.createOutputChannel("viteTranslate");
@@ -37,16 +46,28 @@ export function activate(context) {
   const { extensionUri, workspaceState: state } = context;
   const extensionId = context.extension?.id ?? "sepoina.vitetranslate-ide";
 
+  const highlighter = new Highlighter({ log });
   const projects = new Projects({ probePath: sonda("probe.mjs"), log, state });
   const results = new ResultsView({ projects, probePath: sonda("markedProbe.mjs"), log, state });
   const cli = new CliTasks({ runner: sonda("cliRunner.mjs"), runAsNodeCmd: sonda("runAsNode.cmd"), projects, log });
   const startup = new Startup({ projects, marked: results.tree, log });
+
+  // Il pannello parte la prima volta che una sua sezione si apre: una webview risolta, o Results in
+  // vista. `preparato` si risolve a pannello pronto (i test lo aspettano).
+  let avviato = false;
+  let segnalaPronto;
+  const preparato = new Promise((r) => (segnalaPronto = r));
+  const avviaPannello = () => {
+    if (avviato) return;
+    avviato = true;
+    results.start();
+    startup.start().then(segnalaPronto, segnalaPronto);
+  };
   // Una sezione tornata in vista recupera quanto rimandato mentre il pannello era nascosto.
   const allaVista = () => (results.wake(), watch.wake());
-  const selector = new SelectorView({ extensionUri, projects, results, startup, log, onVisible: allaVista });
-  const project = new ProjectView({ extensionUri, extensionId, projects, results, cli, startup, log, onVisible: allaVista });
-  const optional = new OptionalView({ extensionUri, projects, results, cli, log });
-  const preparato = startup.start();
+  const selector = new SelectorView({ extensionUri, projects, results, startup, log, onVisible: allaVista, onOpen: avviaPannello });
+  const project = new ProjectView({ extensionUri, extensionId, projects, results, cli, startup, log, onVisible: allaVista, onOpen: avviaPannello });
+  const optional = new OptionalView({ extensionUri, projects, results, cli, log, onOpen: avviaPannello });
 
   const invalidate = (dir) => {
     projects.forget(dir);
@@ -57,12 +78,14 @@ export function activate(context) {
   const comandi = {
     "vitetranslate.select": (dir) => projects.select(dir),
     "vitetranslate.refresh": () => (invalidate(), projects.relist(true)),
+    "vitetranslate.highlightStyle": () => pickHighlightStyle(highlighter),
     ...project.commands,
     ...optional.commands,
   };
 
   context.subscriptions.push(
     canale,
+    highlighter,
     results,
     cli,
     startup,
@@ -73,10 +96,16 @@ export function activate(context) {
     vscode.window.registerWebviewViewProvider(SELECTOR_VIEW_ID, selector),
     vscode.window.registerWebviewViewProvider(PROJECT_VIEW_ID, project),
     vscode.window.registerWebviewViewProvider(OPTIONAL_VIEW_ID, optional),
-    results.onDidChangeVisibility(() => (results.visible && startup.stage("Results shown"), allaVista())),
+    results.onDidChangeVisibility(() => {
+      if (results.visible) {
+        avviaPannello();
+        startup.stage("Results shown");
+      }
+      allaVista();
+    }),
     ...Object.entries(comandi).map(([id, f]) => vscode.commands.registerCommand(id, f))
   );
-  return { tree: projects, marked: results.tree, project, selector, optional, controlli: optional.llm.checks, preparato };
+  return { tree: projects, marked: results.tree, project, selector, optional, controlli: optional.llm.checks, preparato, highlighter };
 }
 
 export function deactivate() {}
```

### `idePlugin/package.json` (modifica)

```diff
@@ -44,7 +44,12 @@
     "@vscode/codicons": "^0.0.45",
     "rolldown": "^1.2.7"
   },
-  "activationEvents": [],
+  "activationEvents": [
+    "onLanguage:javascript",
+    "onLanguage:javascriptreact",
+    "onLanguage:typescript",
+    "onLanguage:typescriptreact"
+  ],
   "capabilities": {
     "untrustedWorkspaces": {
       "supported": "limited",
@@ -59,6 +64,65 @@
           "type": "boolean",
           "default": false,
           "markdownDescription": "When **Sync** or an LLM action starts, its terminal shows the command you would type, like `npx vitetranslate --llm-translate`. Turn this on to also see how it is really launched: the project folder, the runtime, the runner and the CLI file."
+        },
+        "vitetranslate.highlightStyle": {
+          "type": "string",
+          "default": "escape-chip",
+          "enum": [
+            "off",
+            "escape-chip",
+            "pill",
+            "outlined-chip",
+            "inset",
+            "quote",
+            "placeholder",
+            "badge",
+            "inlay-hint",
+            "link",
+            "neutral-italic",
+            "dotted-escape",
+            "framed-box",
+            "keyword-mark",
+            "selection-veil",
+            "highlighter"
+          ],
+          "enumItemLabels": [
+            "Off",
+            "Escape chip",
+            "Pill",
+            "Outlined chip",
+            "Inset",
+            "Quote",
+            "Placeholder",
+            "Badge",
+            "Inlay hint",
+            "Link",
+            "Neutral italic",
+            "Dotted escape",
+            "Framed box",
+            "Keyword mark",
+            "Selection veil",
+            "Highlighter"
+          ],
+          "enumDescriptions": [
+            "No highlighting",
+            "Chip and ruler",
+            "Chip on content",
+            "Chip with border",
+            "Inset backdrop",
+            "Left accent bar",
+            "Snippet style",
+            "Filled label",
+            "Like inlay hints",
+            "Dotted link",
+            "Italic only",
+            "Fine underline",
+            "Box and frame",
+            "Keyword accent",
+            "Like selection",
+            "Marker effect"
+          ],
+          "markdownDescription": "How marked strings stand out in `.js`, `.jsx`, `.ts` and `.tsx` files: `_%_…_%_`, `<Translate>…</Translate>`, `` ts`…` ``. Colors come from your theme. To try them all live, run **viteTranslate: Choose highlight style…** from the Command Palette."
         }
       }
     },
@@ -153,6 +217,12 @@
         "category": "viteTranslate",
         "icon": "$(arrow-left)"
       },
+      {
+        "command": "vitetranslate.highlightStyle",
+        "title": "Choose highlight style…",
+        "category": "viteTranslate",
+        "icon": "$(symbol-color)"
+      },
       {
         "command": "vitetranslate.refresh",
         "title": "Refresh",
```

## Appendice E — lo stub di `vscode` e markerSyntax.test.mjs

### `test/list/idePluginVscodeStub.mjs` (modifica)

```diff
@@ -27,6 +27,13 @@ export const __stato = {
   comandi: new Map(),
   contesto: {}, // le chiavi date con setContext
   config: {}, // le impostazioni, "sezione.chiave" -> valore (workspace.getConfiguration)
+  configWorkspace: {}, // quelle del workspace, per inspect(): "sezione.chiave" -> valore
+  aggiornate: [], // le impostazioni scritte con update: ["sezione.chiave", valore, target]
+  configurazioni: [], // gli ascoltatori di onDidChangeConfiguration
+  visibleTextEditors: [], // gli editor in vista (window.visibleTextEditors)
+  visibili: [], // gli ascoltatori di onDidChangeVisibleTextEditors
+  decorazioni: [], // i tipi di createTextEditorDecorationType: { options, disposed }
+  quickPick: null, // l'ultima di createQuickPick: il test la guida (attiva, accetta, chiudi)
   log: [],
   findFiles: async () => [],
 };
@@ -42,6 +49,8 @@ export class EventEmitter {
 }
 
 export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
+export const OverviewRulerLane = { Left: 1, Center: 2, Right: 4, Full: 7 };
+export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
 export const TreeItemCheckboxState = { Unchecked: 0, Checked: 1 };
 
 export class TreeItem {
@@ -135,6 +144,41 @@ export const window = {
   showWarningMessage: async (testo) => void __stato.avvisi.push(["warning", testo]),
   setStatusBarMessage: (testo) => (__stato.barra.push(testo), { dispose() {} }),
   showErrorMessage: async (testo) => void __stato.avvisi.push(["error", testo]),
+  get visibleTextEditors() {
+    return __stato.visibleTextEditors;
+  },
+  onDidChangeVisibleTextEditors: (f) => (__stato.visibili.push(f), { dispose() {} }),
+  createTextEditorDecorationType: (options) => {
+    const tipo = { options, disposed: false, dispose: () => void (tipo.disposed = true) };
+    __stato.decorazioni.push(tipo);
+    return tipo;
+  },
+  // Una Quick Pick che il test guida: attiva(voce) come le frecce, accetta() come Invio, chiudi()
+  // come Esc. hide() avvisa una volta sola, come VS Code.
+  createQuickPick: () => {
+    const ascolti = { attiva: [], accetta: [], chiusa: [] };
+    const qp = {
+      items: [], activeItems: [], title: "", placeholder: "", visible: false,
+      onDidChangeActive: (f) => (ascolti.attiva.push(f), { dispose() {} }),
+      onDidAccept: (f) => (ascolti.accetta.push(f), { dispose() {} }),
+      onDidHide: (f) => (ascolti.chiusa.push(f), { dispose() {} }),
+      show: () => void (qp.visible = true),
+      hide: () => {
+        if (!qp.visible) return;
+        qp.visible = false;
+        for (const f of ascolti.chiusa) f();
+      },
+      dispose() {},
+      attiva: (voce) => {
+        qp.activeItems = [voce];
+        for (const f of ascolti.attiva) f([voce]);
+      },
+      accetta: () => ascolti.accetta.forEach((f) => f()),
+      chiudi: () => qp.hide(),
+    };
+    __stato.quickPick = qp;
+    return qp;
+  },
 };
 
 export const workspace = {
@@ -145,8 +189,23 @@ export const workspace = {
     return __stato.isTrusted;
   },
   findFiles: (...argomenti) => __stato.findFiles(...argomenti),
-  // Le impostazioni: quelle in __stato.config ("sezione.chiave"), o il default.
-  getConfiguration: (sezione) => ({ get: (chiave, predefinito) => __stato.config[`${sezione}.${chiave}`] ?? predefinito }),
+  // Le impostazioni: quelle in __stato.config ("sezione.chiave"), o il default. update() scrive e
+  // avvisa come VS Code, con affectsConfiguration.
+  getConfiguration: (sezione) => ({
+    get: (chiave, predefinito) => __stato.config[`${sezione}.${chiave}`] ?? predefinito,
+    inspect: (chiave) => ({
+      key: `${sezione}.${chiave}`,
+      globalValue: __stato.config[`${sezione}.${chiave}`],
+      workspaceValue: __stato.configWorkspace[`${sezione}.${chiave}`],
+    }),
+    update: async (chiave, valore, target) => {
+      const id = `${sezione}.${chiave}`;
+      __stato.config[id] = valore;
+      __stato.aggiornate.push([id, valore, target]);
+      for (const f of __stato.configurazioni) f({ affectsConfiguration: (s) => id === s || id.startsWith(`${s}.`) });
+    },
+  }),
+  onDidChangeConfiguration: (f) => (__stato.configurazioni.push(f), { dispose() {} }),
   getWorkspaceFolder: (uri) => __stato.workspaceFolders.find((f) => uri.fsPath.startsWith(f.uri.fsPath)),
   get textDocuments() {
     return __stato.textDocuments;
```

### `test/list/markerSyntax.test.mjs` (modifica)

```diff
@@ -7,6 +7,7 @@
 import {
   compiledMarker, isCompiledMarker, SOURCE_OPEN, SOURCE_CLOSE, UNTRANSLATED_KEY,
   mayHaveMarkers, SLOT_TAG_RE, RUNTIME_IMPORT,
+  MACRO_COMPONENT, MACRO_HOOK, TRANSLATE_TEXT_PROPS, RUNTIME_IMPORT_RE,
 } from "../../lib/markerSyntax.js";
 import { markerKey, markerFallback, stripSourceMarker } from "../../lib/react/parseCompiledMarker.js";
 import { markedTextOf, registerMarker } from "../../lib/dev/babel/markerCore.js";
@@ -79,6 +80,17 @@ console.log("\n== mayHaveMarkers (4.6.4): pre-filtro dei file, _%_ oppure import
   for (const [nome, code, atteso] of casi) eq(nome, atteso, mayHaveMarkers(code));
 }
 
+console.log("\n== la macro: i nomi in un posto solo (piano idePlugin_highlight) ==");
+{
+  // MACRO_IMPORT_RE è una regex letterale: deve dire gli stessi nomi delle costanti.
+  eq("il pre-filtro riconosce MACRO_COMPONENT", true, mayHaveMarkers(`import { ${MACRO_COMPONENT} } from "${RUNTIME_IMPORT}";`));
+  eq("…e MACRO_HOOK", true, mayHaveMarkers(`import { ${MACRO_HOOK} } from "${RUNTIME_IMPORT}";`));
+  const elenco = [...`import { ${MACRO_COMPONENT} as T, altro } from "${RUNTIME_IMPORT}";`.matchAll(RUNTIME_IMPORT_RE)];
+  eq("RUNTIME_IMPORT_RE: l'elenco fra graffe nel gruppo 1", `${MACRO_COMPONENT} as T, altro`, elenco[0]?.[1].trim());
+  eq("…e dice RUNTIME_IMPORT", true, RUNTIME_IMPORT_RE.source.includes(RUNTIME_IMPORT.replace(/\//g, "\\/")));
+  eq("TRANSLATE_TEXT_PROPS: le prop del testo", "t,o,a,children,skipMark", TRANSLATE_TEXT_PROPS.join(","));
+}
+
 console.log("\n== SLOT_TAG_RE: matchAll su piu' slot ==");
 {
   const matches = [..."<0>a</0> <12>b</12>".matchAll(SLOT_TAG_RE)];
```

## Appendice F — i sei moduli di `idePlugin/src/highlight/` (file nuovi, testo completo)

### `idePlugin/src/highlight/metatagPatterns.mjs` (nuovo)

```js
// Le regex dei metatag per l'evidenziazione. Si costruiscono dalle costanti di lib/markerSyntax.js:
// la sintassi la decide la libreria, qui la si traduce in pattern e basta. Nessun "_%_" e nessun
// "Translate" scritti a mano: se la libreria cambia un delimitatore, l'evidenziazione lo segue alla
// build successiva. Nessun import di `vscode`.
//
// Le regex sono un'approssimazione dichiarata di quello che fa l'estrazione con Babel
// (lib/dev/babel/extractMarkers.js, macroForms.js): servono a colorare mentre si scrive, non a
// decidere le chiavi. Il test idePluginHighlight.test.mjs misura quanto si discostano, sul sito.
import {
  SOURCE_OPEN, SOURCE_CLOSE, MACRO_COMPONENT, MACRO_HOOK, RUNTIME_IMPORT_RE,
} from "../../../lib/markerSyntax.js";

/** Un testo qualunque, letterale dentro una regex. */
export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const O = escapeRe(SOURCE_OPEN);
const C = escapeRe(SOURCE_CLOSE);
const ID = String.raw`[A-Za-z_$][\w$]*`;

// Il corpo di un template literal: escape, `$` sciolti e `${…}` con graffe annidate fino a tre
// livelli, senza backtick dentro. \x60 è il backtick, che in String.raw non si può scrivere.
const INTERP = String.raw`\$\{(?:[^{}\x60]|\{(?:[^{}\x60]|\{[^{}\x60]*\})*\})*\}`;
const TEMPLATE_BODY = String.raw`(?:[^\x60\\$]|\\[\s\S]|\$(?!\{)|${INTERP})*?`;

/**
 * Una stringa fra virgolette avvolta per intero: `"_%_ciao_%_"`, anche un attributo JSX che va a
 * capo. Gruppi: 1 la virgoletta, 2 apre, 3 il contenuto, 4 chiude. Flag `d`: gli offset dei gruppi.
 */
export const STRING_RE = new RegExp(String.raw`(["'])(${O})((?:(?!\1)[^\\]|\\[\s\S])*?)(${C})\1`, "gd");

/** Un template literal avvolto per intero, con o senza `${…}`. Gruppi: 1 apre, 2 contenuto, 3 chiude. */
export const TEMPLATE_RE = new RegExp(String.raw`\x60(${O})(${TEMPLATE_BODY})(${C})\x60`, "gd");

/**
 * Un testo JSX avvolto: comincia dopo un tag o un `{…}`, finisce prima di un tag o di un `{`. Il
 * primo delimitatore dopo quello che apre è quello che chiude, con tag e valori in mezzo (la frase
 * della macro). Gruppi: 1 apre, 2 contenuto, 3 chiude.
 */
export const JSX_TEXT_RE = new RegExp(String.raw`(?<=[>}]\s*)(${O})((?:(?!${O})[\s\S])*?)(${C})(?=\s*[<{])`, "gd");

// Un nome dentro le graffe di un import: `Translate`, `Translate as T`, `type Translate`.
const SPECIFIER_RE = new RegExp(String.raw`^\s*(?:type\s+)?(${ID})(?:\s+as\s+(${ID}))?\s*$`);

/**
 * I nomi locali del componente e dell'hook della macro importati dal runtime, alias compresi: gli
 * stessi che raccoglie macroForms.js dagli ImportDeclaration.
 * @returns {{ component: Set<string>, hook: Set<string> }}
 */
export function macroNames(text) {
  const component = new Set();
  const hook = new Set();
  for (const m of text.matchAll(RUNTIME_IMPORT_RE)) {
    for (const parte of m[1].split(",")) {
      const s = SPECIFIER_RE.exec(parte);
      if (!s) continue;
      if (s[1] === MACRO_COMPONENT) component.add(s[2] ?? s[1]);
      if (s[1] === MACRO_HOOK) hook.add(s[2] ?? s[1]);
    }
  }
  return { component, hook };
}

/** Le variabili che tengono `ts`: `const ts = useTranslateToString()` (anche `let`, `var`, tipata). */
export function tsNames(text, hooks) {
  const nomi = new Set();
  if (!hooks.size) return nomi;
  // Il tipo, se c'è, può contenere `=>`: (s: TemplateStringsArray) => string.
  const re = new RegExp(String.raw`\b(?:const|let|var)\s+(${ID})\s*(?::(?:[^=;]|=>)+)?=\s*(?:${[...hooks].map(escapeRe).join("|")})\s*\(`, "g");
  for (const m of text.matchAll(re)) nomi.add(m[1]);
  return nomi;
}

/** Dove comincia un tag con uno di questi nomi; il resto del tag lo legge fineTag. Gruppo 1: il nome. */
export const tagOpenRe = (nomi) => new RegExp(String.raw`<(${[...nomi].map(escapeRe).join("|")})(?=[\s/>])`, "g");

/** Un template con uno di questi tag, `ts\`…\``. Gruppi: 1 il tag, 2 il contenuto. */
export const taggedTemplateRe = (nomi) =>
  new RegExp(String.raw`(?<![\w$.])(${[...nomi].map(escapeRe).join("|")})\s*\x60(${TEMPLATE_BODY})\x60`, "gd");

// I letterali e i commenti del file, in un giro solo da sinistra: una stringa consumata prima non
// apre un commento ("http://…"), un commento consumato prima non apre una stringa. Le accortezze
// per il testo JSX e per le espressioni regolari, che una regex non distingue dal codice:
//   - un apostrofo dopo una lettera non apre una stringa: L'utente, dell'app, don't;
//   - dopo un `=` una stringa può andare a capo: un attributo JSX lo può fare, una stringa JS no;
//   - un `//` è un commento solo a inizio riga o dopo spazio o punteggiatura di codice: in un testo
//     JSX un URL ha `:` davanti;
//   - una `/` dopo `(`, `=`, `,`, `return`… apre un'espressione regolare: le sue virgolette
//     (/["']/) non aprono stringhe. Dopo una `}` no: in JSX è `{…}/>`.
// Un template si chiude con fineTemplate, non con la regex: dentro i suoi `${…}` c'è codice, con le
// sue stringhe, che si rilegge.
const LITERAL_SRC = [
  String.raw`(?<=^|[\s;{}(),=])\/\/[^\n]*`,
  String.raw`\/\*[\s\S]*?\*\/`,
  String.raw`(?<=(?:^|[(,=:[!&|?;{]|\breturn|\btypeof|\bcase)\s*)\/(?![*/])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[a-z]*`,
  String.raw`(?<==\s*)"(?:[^"\\]|\\[\s\S])*"`,
  String.raw`(?<==\s*)'(?:[^'\\]|\\[\s\S])*'`,
  String.raw`"(?:[^"\\\n]|\\.)*"`,
  String.raw`(?<![\p{L}\p{N}_$])'(?:[^'\\\n]|\\.)*'`,
  String.raw`\x60`,
].join("|");

/** Dove finisce (dopo il backtick) il template che si apre a `i`, `${…}` compresi; null se non si chiude. */
export function fineTemplate(text, i) {
  let graffe = 0;
  for (let j = i + 1; j < text.length; j++) {
    const c = text[j];
    if (c === "\\") j++;
    else if (graffe === 0 && c === "`") return j + 1;
    else if (c === "$" && text[j + 1] === "{") {
      graffe++;
      j++;
    } else if (graffe > 0 && c === "{") graffe++;
    else if (graffe > 0 && c === "}") graffe--;
  }
  return null;
}

// Il codice dentro i `${…}` di un template fra `s` e `e`: [inizio, fine] dentro le graffe.
function interpolazioni(text, s, e) {
  const fuori = [];
  let graffe = 0;
  let da = -1;
  for (let j = s + 1; j < e - 1; j++) {
    const c = text[j];
    if (c === "\\") j++;
    else if (c === "$" && text[j + 1] === "{" && graffe === 0) {
      graffe = 1;
      da = j + 2;
      j++;
    } else if (graffe > 0 && c === "{") graffe++;
    else if (graffe > 0 && c === "}" && --graffe === 0) fuori.push([da, j]);
  }
  return fuori;
}

/**
 * Il testo coi commenti sostituiti da spazi (a capo compresi: stessa lunghezza, stessi offset), e
 * le stringhe e i template del codice, anche quelli dentro un `${…}`.
 * @returns {{ masked: string, literals: Array<[number, number]> }} literals in ordine di inizio
 */
export function scanLiterals(text) {
  const commenti = [];
  const literals = [];
  (function giro(da, a) {
    const re = new RegExp(LITERAL_SRC, "gmu");
    re.lastIndex = da;
    for (let m; (m = re.exec(text)) && m.index < a; ) {
      const c = m[0][0];
      if (c === "`") {
        const fine = fineTemplate(text, m.index) ?? a;
        literals.push([m.index, fine]);
        for (const [s, e] of interpolazioni(text, m.index, fine)) giro(s, e);
        re.lastIndex = fine;
      } else if (c === '"' || c === "'") literals.push([m.index, m.index + m[0].length]);
      else if (m[0][1] === "/" || m[0][1] === "*") commenti.push([m.index, m.index + m[0].length]);
    }
  })(0, text.length);
  literals.sort((x, y) => x[0] - y[0]);
  if (!commenti.length) return { masked: text, literals };
  let masked = "";
  let da = 0;
  for (const [s, e] of commenti) {
    masked += text.slice(da, s) + text.slice(s, e).replace(/[^\r\n]/g, " ");
    da = e;
  }
  return { masked: masked + text.slice(da), literals };
}
```

### `idePlugin/src/highlight/metatagScan.mjs` (nuovo)

```js
// I metatag di un testo, con le loro parti: dove colorare, dove attenuare, cosa lasciare stare.
// Le regex vengono da metatagPatterns.mjs; qui si mettono insieme e si risolvono i casi che una
// regex da sola non chiude (tag con attributi, graffe annidate, elementi omonimi annidati).
// Nessun import di `vscode`: offset nel testo, non posizioni dell'editor.
//
// Un metatag:
//   form           "string" | "template" | "jsxText" | "sentence" | "translate" | "ts"
//   start, end     il metatag: delimitatori + contenuto, o il solo contenuto nella forma
//                  componente (<Translate>…</Translate>, ts`…`), senza spazi ai capi
//   inner          [s, e] il contenuto dentro i delimitatori (= [start, end] se non ce ne sono)
//   delimiters     [[s, e], …] i `_%_`, zero o due
//   componentTags  [[s, e], …] `<Translate …>` e `</Translate>`, o `ts\`` e il backtick che chiude
//   holes          [[s, e], …] dentro `inner`, quello che non è testo: tag, `{…}`, `${…}`
//   text           [[s, e], …] il testo da colorare: `inner` meno i buchi, riga per riga
//   span           [s, e] tutto quello che occupa, tag compresi: per le sovrapposizioni
import {
  SOURCE_OPEN, SOURCE_CLOSE, MIN_SOURCE_MARKED, PLACEHOLDER, TRANSLATE_TEXT_PROPS, mayHaveMarkers,
} from "../../../lib/markerSyntax.js";
import {
  STRING_RE, TEMPLATE_RE, JSX_TEXT_RE, macroNames, tsNames, tagOpenRe, taggedTemplateRe, scanLiterals, escapeRe,
} from "./metatagPatterns.mjs";

const PROP_DEL_TESTO = new Set(TRANSLATE_TEXT_PROPS);
// Oltre questa lunghezza un tag d'apertura non si legge: nel dubbio non si colora.
const TAG_MAX = 4000;
const SPAZIO = /\s/;

/**
 * Dove finisce il tag che comincia a `i` (su `<`): dopo il suo `>`, saltando stringhe e `{…}`.
 * @returns {{ end: number, selfClosing: boolean } | null}
 */
export function fineTag(text, i) {
  let graffe = 0;
  let q = null;
  const limite = Math.min(text.length, i + TAG_MAX);
  for (let j = i + 1; j < limite; j++) {
    const c = text[j];
    if (q) {
      if (c === "\\" && graffe > 0) j++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "{") graffe++;
    else if (c === "}") graffe--;
    else if (graffe === 0 && c === ">") return { end: j + 1, selfClosing: text[j - 1] === "/" };
    else if (graffe === 0 && c === "<") return null;
  }
  return null;
}

/** Dove finisce (dopo la `}`) la graffa che si apre a `i`, saltando le stringhe; null se non si chiude. */
export function fineGraffa(text, i) {
  let graffe = 0;
  let q = null;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (q) {
      if (c === "\\") j++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "{") graffe++;
    else if (c === "}" && --graffe === 0) return j + 1;
  }
  return null;
}

/** Un intervallo spezzato riga per riga, ogni pezzo senza spazi ai capi; i pezzi vuoti spariscono. */
export function lineRanges(text, [s, e]) {
  const fuori = [];
  for (let i = s; i < e; ) {
    let a = text.indexOf("\n", i);
    if (a === -1 || a > e) a = e;
    let ps = i;
    let pe = a;
    while (ps < pe && SPAZIO.test(text[ps])) ps++;
    while (pe > ps && SPAZIO.test(text[pe - 1])) pe--;
    if (pe > ps) fuori.push([ps, pe]);
    i = a + 1;
  }
  return fuori;
}

function senzaSpazi(text, [s, e]) {
  while (s < e && SPAZIO.test(text[s])) s++;
  while (e > s && SPAZIO.test(text[e - 1])) e--;
  return [s, e];
}

// I buchi di un contenuto JSX: i tag (aperti, chiusi, autochiusi) e i `{…}`.
function buchiJsx(text, s, e) {
  const buchi = [];
  for (let i = s; i < e; i++) {
    const c = text[i];
    if (c !== "<" && c !== "{") continue;
    const fine = Math.min((c === "<" ? fineTag(text, i)?.end : fineGraffa(text, i)) ?? e, e);
    buchi.push([i, fine]);
    i = fine - 1;
  }
  return buchi;
}

// I buchi di un contenuto template: i `${…}`.
function buchiTemplate(text, s, e) {
  const buchi = [];
  for (let i = s; i < e; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] !== "$" || text[i + 1] !== "{") continue;
    const fine = Math.min(fineGraffa(text, i + 1) ?? e, e);
    buchi.push([i, fine]);
    i = fine - 1;
  }
  return buchi;
}

// Il testo da colorare: `inner` meno i buchi, riga per riga.
function testoDi(text, [s, e], buchi) {
  const pezzi = [];
  let i = s;
  for (const [bs, be] of buchi) {
    if (bs > i) pezzi.push([i, bs]);
    i = Math.max(i, be);
  }
  if (i < e) pezzi.push([i, e]);
  return pezzi.flatMap((p) => lineRanges(text, p));
}

// I delimitatori dentro un contenuto già senza spazi ai capi: la forma componente li accetta
// facoltativi (`<Translate>_%_Ciao_%_</Translate>`, ts`_%_Ciao_%_`).
function delimitatoriDentro(text, s, e) {
  if (e - s < MIN_SOURCE_MARKED || !text.startsWith(SOURCE_OPEN, s) || !text.startsWith(SOURCE_CLOSE, e - SOURCE_CLOSE.length)) return [];
  return [[s, s + SOURCE_OPEN.length], [e - SOURCE_CLOSE.length, e]];
}

// Il contenuto dentro i delimitatori (o tutto, se non ce ne sono), coi suoi buchi e il suo testo.
function parti(text, s, e, delimiters, buchiDi) {
  const inner = delimiters.length ? [delimiters[0][1], delimiters[1][0]] : [s, e];
  const holes = buchiDi ? buchiDi(text, inner[0], inner[1]) : [];
  return { inner, holes, text: testoDi(text, inner, holes) };
}

// I nomi degli attributi fra `da` e `a` (dentro un tag d'apertura), con "..." per uno spread; null
// se il tag non si legge.
function nomiAttributi(text, da, a) {
  const nomi = [];
  for (let i = da; i < a; ) {
    const c = text[i];
    if (c === "{") {
      const fine = fineGraffa(text, i);
      if (fine === null) return null;
      if (/^\{\s*\.\.\./.test(text.slice(i, fine))) nomi.push("...");
      i = fine;
    } else if (c === '"' || c === "'") {
      const fine = text.indexOf(c, i + 1);
      if (fine === -1) return null;
      i = fine + 1;
    } else {
      const m = /^[A-Za-z_$][\w$:.-]*/.exec(text.slice(i, Math.min(a, i + 200)));
      if (m) nomi.push(m[0]);
      i += m ? m[0].length : 1;
    }
  }
  return nomi;
}

// Il tag che chiude l'elemento `nome` aperto prima di `da`, contando gli omonimi annidati.
function chiusura(text, nome, da) {
  const re = new RegExp(String.raw`<(\/?)${escapeRe(nome)}(?=[\s/>])`, "g");
  re.lastIndex = da;
  let profondità = 1;
  for (let m; (m = re.exec(text)); ) {
    const tag = fineTag(text, m.index);
    if (!tag) return null;
    if (m[1]) {
      if (--profondità === 0) return { start: m.index, end: tag.end };
    } else if (!tag.selfClosing) profondità++;
    re.lastIndex = tag.end;
  }
  return null;
}

// <Translate>…</Translate>: le stesse esclusioni di macroTranslate in macroForms.js (autochiuso,
// spread, una prop del testo, contenuto vuoto o un'espressione sola, nessun testo).
function translate(text, i, nome) {
  const apre = fineTag(text, i);
  if (!apre || apre.selfClosing) return null;
  const attributi = nomiAttributi(text, i + 1 + nome.length, apre.end - 1);
  if (!attributi || attributi.some((n) => n === "..." || PROP_DEL_TESTO.has(n))) return null;
  const chiude = chiusura(text, nome, apre.end);
  if (!chiude) return null;
  const [s, e] = senzaSpazi(text, [apre.end, chiude.start]);
  if (s >= e || (text[s] === "{" && fineGraffa(text, s) === e)) return null;
  const delimiters = delimitatoriDentro(text, s, e);
  const p = parti(text, s, e, delimiters, buchiJsx);
  if (!p.text.length) return null;
  return {
    form: "translate", start: s, end: e, ...p, delimiters,
    componentTags: [[i, apre.end], [chiude.start, chiude.end]], span: [i, chiude.end],
  };
}

// ts`…`: il tag e i backtick sono la parte "componente", il contenuto è il messaggio.
function tagged(text, m) {
  const [ns] = m.indices[1];
  const [cs, ce] = m.indices[2];
  const [s, e] = senzaSpazi(text, [cs, ce]);
  if (s >= e) return null;
  const delimiters = delimitatoriDentro(text, s, e);
  const p = parti(text, s, e, delimiters, buchiTemplate);
  if (!p.text.length && !delimiters.length) return null;
  return {
    form: "ts", start: s, end: e, ...p, delimiters,
    componentTags: [[ns, cs], [ce, ce + 1]], span: [ns, ce + 1],
  };
}

// Le forme in linea: i delimitatori sono i gruppi `a` e `z` della regex.
function inLinea(form, text, m, a, z, buchiDi) {
  const apre = m.indices[a];
  const chiude = m.indices[z];
  const p = parti(text, apre[0], chiude[1], [apre, chiude], buchiDi);
  return {
    form: form === "jsxText" && p.holes.length ? "sentence" : form,
    start: apre[0], end: chiude[1], ...p, delimiters: [apre, chiude], componentTags: [],
    span: m.indices[0],
  };
}

const sovrapposti = (a, b) => a.span[0] < b.span[1] && b.span[0] < a.span[1];
const inUnBuco = (dentro, fuori) => fuori.holes.some(([s, e]) => dentro.span[0] >= s && dentro.span[1] <= e);

// I tag fra i buchi si chiudono tutti dentro il contenuto, e nessuno chiude un tag aperto fuori:
// macroForms.js vuole il delimitatore che apre e quello che chiude fra fratelli dello stesso
// genitore. Due `_%_` spaiati in due <p> vicini non sono una frase.
function bilanciati(text, holes) {
  let profondità = 0;
  for (const [s, e] of holes) {
    if (text[s] !== "<") continue;
    if (text[s + 1] === "/") {
      if (--profondità < 0) return false;
    } else if (text[e - 2] !== "/") profondità++;
  }
  return profondità === 0;
}

// Le forme della macro rifiutano due cose che una frase non può contenere (MOTIVI in macroForms.js):
// un "%s" e un "_%_" in mezzo. Rifiutata, la macro non estrae niente: non la si colora.
const MACRO = new Set(["translate", "sentence", "ts"]);
const èMacro = (c) => MACRO.has(c.form) || (c.form === "template" && c.holes.length > 0);
const rifiutata = (text, c) =>
  ((c.form === "translate" || c.form === "sentence") && !bilanciati(text, c.holes)) ||
  (èMacro(c) && c.text.some(([s, e]) => {
    const pezzo = text.slice(s, e);
    return pezzo.includes(PLACEHOLDER) || pezzo.includes(SOURCE_OPEN);
  }));

/**
 * I metatag di un file sorgente, nell'ordine del testo.
 *
 * Dove può stare un candidato: una stringa o un template marcati devono essere un letterale del
 * codice, non un pezzo di un letterale più grande; un testo JSX o un <Translate> non devono
 * cominciare dentro un letterale. Così un esempio di codice scritto in una stringa
 * ('<Translate>_%_…_%_</Translate>') resta una stringa. I commenti non contano.
 *
 * Chi vince: le forme componente su quelle in linea, i template sulle stringhe, le stringhe sul
 * testo JSX. Un candidato che si sovrappone a uno già preso si scarta, a meno che non stia tutto
 * dentro un suo buco (`{"_%_…_%_"}` in un <Translate>).
 *
 * @param {string} text
 * @returns {Array<object>}
 */
export function findMetatags(text) {
  if (!mayHaveMarkers(text)) return [];
  const { masked: t, literals } = scanLiterals(text);
  const inizi = new Map(literals.map(([s, e]) => [s, e]));
  const èLetterale = (s, e) => inizi.get(s) === e;
  // Ricerca binaria: `pos` sta dentro un letterale (non sul suo primo carattere)?
  const inLetterale = (pos) => {
    let lo = 0;
    let hi = literals.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [s, e] = literals[mid];
      if (pos <= s) hi = mid - 1;
      else if (pos >= e) lo = mid + 1;
      else return true;
    }
    return false;
  };
  const { component, hook } = macroNames(t);
  const ts = tsNames(t, hook);
  const candidati = [];
  if (component.size) {
    for (const m of t.matchAll(tagOpenRe(component))) if (!inLetterale(m.index)) candidati.push(translate(t, m.index, m[1]));
  }
  if (ts.size) {
    for (const m of t.matchAll(taggedTemplateRe(ts))) {
      const backtick = m.indices[2][0] - 1;
      if (èLetterale(backtick, m.indices[0][1])) candidati.push(tagged(t, m));
    }
  }
  for (const m of t.matchAll(TEMPLATE_RE)) if (èLetterale(...m.indices[0])) candidati.push(inLinea("template", t, m, 1, 3, buchiTemplate));
  for (const m of t.matchAll(STRING_RE)) if (èLetterale(...m.indices[0])) candidati.push(inLinea("string", t, m, 2, 4, null));
  for (const m of t.matchAll(JSX_TEXT_RE)) if (!inLetterale(m.index)) candidati.push(inLinea("jsxText", t, m, 1, 3, buchiJsx));
  // I presi, in ordine di inizio. Un candidato si confronta solo con quelli che possono toccarlo:
  // da dove si inserirebbe, all'indietro finché un preso comincia prima di (suo inizio − il preso
  // più lungo), e in avanti finché cominciano prima della sua fine.
  const presi = [];
  let lunghezzaMax = 0;
  for (const c of candidati) {
    if (!c || rifiutata(t, c)) continue;
    let lo = 0;
    let hi = presi.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (presi[mid].span[0] < c.span[0]) lo = mid + 1;
      else hi = mid;
    }
    let libero = true;
    for (let j = lo - 1; libero && j >= 0 && presi[j].span[0] > c.span[0] - lunghezzaMax; j--) {
      if (sovrapposti(presi[j], c) && !inUnBuco(c, presi[j])) libero = false;
    }
    for (let j = lo; libero && j < presi.length && presi[j].span[0] < c.span[1]; j++) {
      if (sovrapposti(presi[j], c) && !inUnBuco(c, presi[j])) libero = false;
    }
    if (!libero) continue;
    presi.splice(lo, 0, c);
    lunghezzaMax = Math.max(lunghezzaMax, c.span[1] - c.span[0]);
  }
  return presi;
}
```

### `idePlugin/src/highlight/highlightStyles.mjs` (nuovo)

```js
// Il catalogo degli stili di evidenziazione: dati e basta. Ogni colore è l'id di un colore del tema
// (https://code.visualstudio.com/api/references/theme-color), mai un esadecimale: lo stile segue
// il tema, chiaro o scuro, e i temi che ridefiniscono quel colore. Gli altri valori sono stringhe
// CSS con i nomi di ThemableDecorationRenderOptions. Come diventano decorazioni: decorationPlan.mjs.
//
// Le parti di uno stile:
//   fg             il colore del testo del metatag (le sue parti di testo, non i buchi: tag, `{…}`,
//                  `${…}` restano come li colora il tema); null: resta il colore del contesto
//   text           fontStyle, textDecoration del testo; null: niente
//   cover          dove sta il chip: "all" il metatag (delimitatori compresi; nella forma
//                  componente il contenuto), "content" solo dentro i delimitatori
//   chip           backgroundColor, borderRadius; null: nessuno sfondo
//   border         borderColor, borderStyle, borderWidth (sullo stesso intervallo del chip)
//   delimiters     i `_%_`: opacity, letterSpacing, color (assente: quello di fg)
//   componentTags  `<Translate>`, `</Translate>`, `ts\`…\``: opacity; null: come li colora il tema
//   overviewRuler  color, lane (Left, Center, Right, Full): un segno nel righello a destra
//   weakOn         i tipi di tema ("light", "dark") su cui lo stile si vede poco coi colori di serie
//
// L'elenco delle impostazioni in idePlugin/package.json (vitetranslate.highlightStyle: enum,
// enumItemLabels, enumDescriptions) deve dire gli stessi id, nomi e descrizioni, nello stesso
// ordine: lo controlla idePluginHighlight.test.mjs.

/** Il valore dell'impostazione che spegne l'evidenziazione. */
export const HIGHLIGHT_OFF = "off";
/** Lo stile di serie. */
export const DEFAULT_STYLE = "escape-chip";

// I colori che prendono il posto degli scope TextMate dello schema di partenza: niente grammatica,
// il testo si colora con una decorazione (vedi il piano idePlugin_highlight, "Decisioni").
// charts.yellow è editorWarning.foreground: un oro che ogni tema definisce. textPreformat.foreground
// no: nei temi Modern di serie è quasi il colore del testo (#D0D0D0, #3B3B3B).
const ESCAPE = "charts.yellow"; // constant.character.escape
const PLACEHOLDER = "charts.blue"; // constant.other.placeholder
const KEYWORD = "charts.purple"; // keyword.control

export const STYLES = [
  {
    id: "escape-chip", name: "Escape chip", description: "Chip and ruler",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "textPreformat.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.4", letterSpacing: "-1px" }, componentTags: { opacity: "0.4" },
    overviewRuler: { color: "editorOverviewRuler.infoForeground", lane: "Right" }, weakOn: [],
  },
  {
    id: "pill", name: "Pill", description: "Chip on content",
    fg: ESCAPE, text: null, cover: "content",
    chip: { backgroundColor: "textPreformat.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.4" }, componentTags: { opacity: "0.4" }, overviewRuler: null, weakOn: [],
  },
  {
    id: "outlined-chip", name: "Outlined chip", description: "Chip with border",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "textPreformat.background", borderRadius: "3px" },
    border: { borderColor: "editorWidget.border", borderStyle: "solid", borderWidth: "1px" },
    delimiters: { opacity: "0.4" }, componentTags: { opacity: "0.4" }, overviewRuler: null, weakOn: [],
  },
  {
    id: "inset", name: "Inset", description: "Inset backdrop",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "textCodeBlock.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.4" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "quote", name: "Quote", description: "Left accent bar",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "textBlockQuote.background", borderRadius: "0" },
    border: { borderColor: "textBlockQuote.border", borderStyle: "solid", borderWidth: "0 0 0 2px" },
    delimiters: { opacity: "0.4" }, componentTags: null, overviewRuler: null, weakOn: ["light"],
  },
  {
    id: "placeholder", name: "Placeholder", description: "Snippet style",
    fg: PLACEHOLDER, text: null, cover: "all",
    chip: { backgroundColor: "editor.snippetTabstopHighlightBackground", borderRadius: "2px" }, border: null,
    delimiters: { opacity: "0.5" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "badge", name: "Badge", description: "Filled label",
    fg: "badge.foreground", text: null, cover: "content",
    chip: { backgroundColor: "badge.background", borderRadius: "8px" }, border: null,
    delimiters: { color: "editorCodeLens.foreground" }, componentTags: { opacity: "0.4" }, overviewRuler: null, weakOn: [],
  },
  {
    id: "inlay-hint", name: "Inlay hint", description: "Like inlay hints",
    fg: "editorInlayHint.foreground", text: { fontStyle: "italic" }, cover: "all",
    chip: { backgroundColor: "editorInlayHint.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.5" }, componentTags: null, overviewRuler: null, weakOn: ["light"],
  },
  {
    id: "link", name: "Link", description: "Dotted link",
    fg: "textLink.foreground", text: null, cover: "all", chip: null,
    border: { borderColor: "textLink.foreground", borderStyle: "dotted", borderWidth: "0 0 1px 0" },
    delimiters: { opacity: "0.4" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "neutral-italic", name: "Neutral italic", description: "Italic only",
    fg: null, text: { fontStyle: "italic" }, cover: "all", chip: null, border: null,
    delimiters: { color: "editorCodeLens.foreground" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "dotted-escape", name: "Dotted escape", description: "Fine underline",
    fg: ESCAPE, text: null, cover: "all", chip: null,
    border: { borderColor: "editorCodeLens.foreground", borderStyle: "dotted", borderWidth: "0 0 1px 0" },
    delimiters: { opacity: "0.4" }, componentTags: null, overviewRuler: null, weakOn: ["light"],
  },
  {
    id: "framed-box", name: "Framed box", description: "Box and frame",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "editorBracketMatch.background", borderRadius: "2px" },
    border: { borderColor: "editorBracketMatch.border", borderStyle: "solid", borderWidth: "1px" },
    delimiters: { opacity: "0.4" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "keyword-mark", name: "Keyword mark", description: "Keyword accent",
    fg: KEYWORD, text: { textDecoration: "underline" }, cover: "all",
    chip: { backgroundColor: "textPreformat.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.4" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "selection-veil", name: "Selection veil", description: "Like selection",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "editor.inactiveSelectionBackground", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.4", letterSpacing: "-1px" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "highlighter", name: "Highlighter", description: "Marker effect",
    fg: null, text: null, cover: "all",
    chip: { backgroundColor: "editor.rangeHighlightBackground", borderRadius: "0" }, border: null,
    delimiters: { opacity: "0.4" }, componentTags: null, overviewRuler: null, weakOn: ["dark"],
  },
];

const PER_ID = new Map(STYLES.map((s) => [s.id, s]));

/** Lo stile con questo id, o undefined. */
export const styleById = (id) => PER_ID.get(id);
```

### `idePlugin/src/highlight/decorationPlan.mjs` (nuovo)

```js
// Da uno stile del catalogo (highlightStyles.mjs) alle decorazioni dell'editor: quattro, una per
// parte del metatag, ognuna col suo intervallo. Nessun import di `vscode`: i colori diventano
// oggetti con la funzione `themeColor` che si passa (in highlighter.mjs, new vscode.ThemeColor),
// la corsia del righello con la tabella `lanes` (vscode.OverviewRulerLane).
//
// Le parti non si pestano i piedi: il colore sta solo su `text` e `delimiters`, che non si
// sovrappongono; `match` dà solo sfondo, bordo e righello. Così non conta quale decorazione
// l'editor disegna sopra l'altra.
import { lineRanges } from "./metatagScan.mjs";

/** Le parti, nell'ordine in cui si creano le decorazioni: lo sfondo prima. */
export const PARTS = ["match", "text", "delimiters", "componentTags"];

// Le opzioni senza i valori assenti; null se non ne resta nessuno (quella parte non si disegna).
function opzioni(o) {
  const piene = Object.entries(o).filter(([, v]) => v !== undefined && v !== null);
  return piene.length ? Object.fromEntries(piene) : null;
}

/**
 * Le opzioni di createTextEditorDecorationType per ogni parte; null per una parte che lo stile non
 * disegna.
 * @param {object} style - una voce di STYLES
 * @param {(id: string) => any} themeColor
 * @param {Record<string, number>} [lanes] - Left, Center, Right, Full
 * @returns {{ match: object|null, text: object|null, delimiters: object|null, componentTags: object|null }}
 */
export function renderOptionsOf(style, themeColor, lanes = {}) {
  const colore = (id) => (id ? themeColor(id) : undefined);
  const { chip, border, overviewRuler, text, delimiters, componentTags } = style;
  return {
    match: opzioni({
      backgroundColor: colore(chip?.backgroundColor),
      borderRadius: chip?.borderRadius,
      borderColor: colore(border?.borderColor),
      borderStyle: border?.borderStyle,
      borderWidth: border?.borderWidth,
      overviewRulerColor: colore(overviewRuler?.color),
      overviewRulerLane: overviewRuler ? lanes[overviewRuler.lane] : undefined,
    }),
    text: opzioni({ color: colore(style.fg), fontStyle: text?.fontStyle, textDecoration: text?.textDecoration }),
    delimiters: opzioni({
      color: colore(delimiters?.color ?? style.fg),
      opacity: delimiters?.opacity,
      letterSpacing: delimiters?.letterSpacing,
    }),
    componentTags: componentTags ? opzioni({ opacity: componentTags.opacity }) : null,
  };
}

/**
 * Gli intervalli di ogni parte per un metatag (metatagScan.mjs), in offset del testo. Il chip va
 * riga per riga, senza gli spazi a inizio riga: su un <Translate> che va a capo non colora il
 * rientro.
 * @returns {{ match: number[][], text: number[][], delimiters: number[][], componentTags: number[][] }}
 */
export function rangesOf(style, metatag, text) {
  const coperto = style.cover === "content" ? metatag.inner : [metatag.start, metatag.end];
  return {
    match: lineRanges(text, coperto),
    text: metatag.text,
    delimiters: metatag.delimiters,
    componentTags: metatag.componentTags.flatMap((r) => lineRanges(text, r)),
  };
}
```

### `idePlugin/src/highlight/highlighter.mjs` (nuovo)

```js
// L'evidenziazione dei metatag nell'editor: i file js, jsx, ts e tsx visibili, ridisegnati a ogni
// modifica (dopo una pausa), a ogni editor che compare e a ogni cambio di stile (l'impostazione
// vitetranslate.highlightStyle, o l'anteprima del comando di scelta). I metatag li trova
// metatagScan.mjs, le decorazioni le descrive decorationPlan.mjs. Niente grammatica TextMate: i
// colori sono del tema (ThemeColor), e uno stile nuovo si vede subito, senza ricaricare la finestra.
//
// Non dipende dal pannello: parte con l'estensione, anche quando l'ha attivata l'apertura di un
// file js/ts (activationEvents in package.json) e il pannello resta chiuso.
import * as vscode from "vscode";
import { findMetatags } from "./metatagScan.mjs";
import { HIGHLIGHT_OFF, DEFAULT_STYLE, styleById } from "./highlightStyles.mjs";
import { PARTS, renderOptionsOf, rangesOf } from "./decorationPlan.mjs";

/** L'impostazione, nella sezione "vitetranslate". */
export const HIGHLIGHT_SETTING = "highlightStyle";
// I linguaggi che legge walkSource (EXT_RE in lib/dev/vite/uty/walkSource.js), come li chiama VS Code.
const LANGUAGES = new Set(["javascript", "javascriptreact", "typescript", "typescriptreact"]);
// Quanto aspettare dopo l'ultimo tasto prima di ricolorare.
const PAUSA_MS = 150;
// Oltre questa lunghezza un file non si colora: un bundle, un file generato. 1 MB si legge in ~0,1 s.
const MAX_CHARS = 1_000_000;

export class Highlighter {
  /**
   * @param {object} p
   * @param {(riga: string) => void} p.log
   */
  constructor({ log }) {
    this.log = log;
    this.stile = null; // lo stile disegnato adesso (una voce di STYLES), null se spento
    this.tipi = null; // parte -> TextEditorDecorationType (o null), dello stile disegnato
    this.anteprima = null; // l'id in prova dal comando di scelta, o null
    this.timer = new Map(); // uri -> la pausa in corso
    this.letti = new WeakMap(); // documento -> { version, text, metatags }
    this.ascolti = [
      vscode.window.onDidChangeVisibleTextEditors(() => this.ridisegna()),
      vscode.workspace.onDidChangeTextDocument((e) => this.cambiato(e.document)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(`vitetranslate.${HIGHLIGHT_SETTING}`)) this.applica();
      }),
    ];
    this.applica();
  }

  /** L'id scelto nelle impostazioni; un id che il catalogo non conosce vale quello di serie. */
  get configured() {
    const id = vscode.workspace.getConfiguration("vitetranslate").get(HIGHLIGHT_SETTING, DEFAULT_STYLE);
    return id === HIGHLIGHT_OFF || styleById(id) ? id : DEFAULT_STYLE;
  }

  /** L'id disegnato adesso: quello in anteprima, o quello delle impostazioni. */
  get current() {
    return this.anteprima ?? this.configured;
  }

  /** Uno stile in prova, senza toccare le impostazioni; null torna a quello delle impostazioni. */
  preview(id) {
    this.anteprima = id;
    this.applica();
  }

  // Le decorazioni dello stile corrente, rifatte se lo stile è cambiato. Chiudere quelle vecchie
  // le toglie da tutti gli editor.
  applica() {
    const id = this.current;
    const stile = id === HIGHLIGHT_OFF ? null : styleById(id);
    if (stile === this.stile) return;
    for (const t of Object.values(this.tipi ?? {})) t?.dispose();
    this.stile = stile;
    this.tipi = null;
    if (stile) {
      const opzioni = renderOptionsOf(stile, (c) => new vscode.ThemeColor(c), vscode.OverviewRulerLane);
      this.tipi = Object.fromEntries(PARTS.map((p) => [p, opzioni[p] ? vscode.window.createTextEditorDecorationType(opzioni[p]) : null]));
    }
    this.ridisegna();
  }

  ridisegna() {
    for (const editor of vscode.window.visibleTextEditors ?? []) this.decora(editor);
  }

  // Un documento cambiato: si ricolora dopo la pausa, negli editor che lo mostrano.
  cambiato(doc) {
    if (!this.stile || !LANGUAGES.has(doc.languageId)) return;
    const chiave = doc.uri.toString();
    clearTimeout(this.timer.get(chiave));
    this.timer.set(chiave, setTimeout(() => {
      this.timer.delete(chiave);
      for (const editor of vscode.window.visibleTextEditors ?? []) if (editor.document === doc) this.decora(editor);
    }, PAUSA_MS));
  }

  // I metatag di un documento, letti una volta per versione: due editor sullo stesso file, o uno
  // stile cambiato, non rileggono niente.
  lettura(doc) {
    const prima = this.letti.get(doc);
    if (prima?.version === doc.version) return prima;
    const text = doc.getText();
    const lettura = { version: doc.version, text, metatags: text.length > MAX_CHARS ? [] : findMetatags(text) };
    this.letti.set(doc, lettura);
    return lettura;
  }

  decora(editor) {
    const doc = editor.document;
    if (!this.stile || !LANGUAGES.has(doc.languageId)) return;
    const { text, metatags } = this.lettura(doc);
    const perParte = Object.fromEntries(PARTS.map((p) => [p, []]));
    for (const m of metatags) {
      const r = rangesOf(this.stile, m, text);
      for (const p of PARTS) perParte[p].push(...r[p]);
    }
    const range = ([s, e]) => new vscode.Range(doc.positionAt(s), doc.positionAt(e));
    for (const p of PARTS) if (this.tipi[p]) editor.setDecorations(this.tipi[p], perParte[p].map(range));
  }

  dispose() {
    for (const t of this.timer.values()) clearTimeout(t);
    for (const t of Object.values(this.tipi ?? {})) t?.dispose();
    for (const a of this.ascolti) a.dispose();
  }
}
```

### `idePlugin/src/highlight/stylePicker.mjs` (nuovo)

```js
// Il comando "viteTranslate: Choose highlight style…" (vitetranslate.highlightStyle): gli stili in
// una Quick Pick. Quello sotto la selezione si vede subito negli editor aperti (Highlighter.preview);
// diventa l'impostazione solo con Invio. Esc, o un clic fuori, rimette lo stile di prima.
import * as vscode from "vscode";
import { STYLES, HIGHLIGHT_OFF } from "./highlightStyles.mjs";
import { HIGHLIGHT_SETTING } from "./highlighter.mjs";

/** Le voci della Quick Pick: Off, poi il catalogo; quella in uso lo dice. */
export function pickerItems(attuale) {
  const voci = [
    { id: HIGHLIGHT_OFF, label: "Off", description: "No highlighting" },
    ...STYLES.map((s) => ({ id: s.id, label: s.name, description: s.description })),
  ];
  for (const v of voci) if (v.id === attuale) v.description += " · current";
  return voci;
}

// Scrive la scelta dove l'utente l'aveva già messa: se il workspace ha la sua, scriverla nelle
// impostazioni utente non cambierebbe niente.
async function salva(id) {
  const config = vscode.workspace.getConfiguration("vitetranslate");
  const dove = config.inspect(HIGHLIGHT_SETTING);
  const target = dove?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  await config.update(HIGHLIGHT_SETTING, id, target);
}

/**
 * Apre la scelta. Si risolve, a Quick Pick chiusa, con l'id salvato, o null se non è cambiato niente.
 * @param {import("./highlighter.mjs").Highlighter} highlighter
 * @returns {Promise<string | null>}
 */
export function pickHighlightStyle(highlighter) {
  const attuale = highlighter.configured;
  const qp = vscode.window.createQuickPick();
  qp.title = "viteTranslate: highlight style";
  qp.placeholder = "Move through the list to try each style in the editor. Enter keeps it.";
  qp.items = pickerItems(attuale);
  qp.activeItems = qp.items.filter((v) => v.id === attuale);
  let scelto = null;
  return new Promise((resolve) => {
    qp.onDidChangeActive(([v]) => v && highlighter.preview(v.id));
    qp.onDidAccept(() => {
      scelto = qp.activeItems[0] ?? null;
      qp.hide();
    });
    // Prima si salva, poi si toglie l'anteprima: al contrario lo stile vecchio tornerebbe per un
    // attimo, finché l'impostazione nuova non arriva.
    qp.onDidHide(async () => {
      qp.dispose();
      const cambia = scelto && scelto.id !== attuale;
      try {
        if (cambia) await salva(scelto.id);
      } finally {
        highlighter.preview(null);
      }
      resolve(cambia ? scelto.id : null);
    });
    qp.show();
  });
}
```

## Appendice G — `test/list/idePluginHighlight.test.mjs` (file nuovo, testo completo)

### `test/list/idePluginHighlight.test.mjs` (nuovo)

```js
// Estensione per l'editor (idePlugin): l'evidenziazione dei metatag (idePlugin/src/highlight/).
//   1. le parti di un metatag (metatagScan.mjs): delimitatori, testo, tag, buchi;
//   2. la parità con l'estrazione: le regex trovano quello che trova Babel (extractMarkers di questo
//      repo), sui casi difficili e su tutti i sorgenti di site/ e demo/ — nessuna voce persa,
//      nessuna evidenza in più;
//   3. un posto solo: il catalogo (highlightStyles.mjs) e l'impostazione in package.json dicono gli
//      stessi stili, le regex vengono da lib/markerSyntax.js;
//   4. le decorazioni nell'editor e la scelta con anteprima, sullo stub di `vscode`;
//   5. l'attivazione da un file js/ts: l'evidenziazione sì, il pannello no finché non si apre.
//
//   node test/list/idePluginHighlight.test.mjs
import module from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

if (typeof module.registerHooks !== "function") {
  console.log("  --  saltato: questo Node non ha module.registerHooks (serve 22.15+ o 23.5+)");
  process.exit(0);
}
const STUB = new URL("./idePluginVscodeStub.mjs", import.meta.url).href;
module.registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: STUB, shortCircuit: true } : next(specifier, context)),
});
const vscode = await import("vscode");
const { default: extractMarkers } = await import("../../lib/dev/babel/extractMarkers.js");
const { SOURCE_OPEN, MACRO_COMPONENT, mayHaveMarkers } = await import("../../lib/markerSyntax.js");
const { markerEnd } = await import("../../idePlugin/src/views/results/markerSpan.mjs");
const { findMetatags } = await import("../../idePlugin/src/highlight/metatagScan.mjs");
const { STRING_RE, macroNames, escapeRe } = await import("../../idePlugin/src/highlight/metatagPatterns.mjs");
const { STYLES, DEFAULT_STYLE, HIGHLIGHT_OFF } = await import("../../idePlugin/src/highlight/highlightStyles.mjs");
const { Highlighter } = await import("../../idePlugin/src/highlight/highlighter.mjs");
const { pickHighlightStyle, pickerItems } = await import("../../idePlugin/src/highlight/stylePicker.mjs");
const { activate } = await import("../../idePlugin/src/extension.mjs");
const stato = vscode.__stato;

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const IMP = `import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";\n`;

// Le forme che trova Babel, coi nomi di findMetatags ("attribute" è una stringa).
function formeBabel(code, filename = join(tmpdir(), "src", "Caso.tsx")) {
  const forme = [];
  extractMarkers(code, { filename, table: {}, rewrite: false, baseDir: tmpdir(), hints: {}, warn: () => {}, onMarker: (v) => forme.push(v.form) });
  return forme.map((f) => (f === "attribute" ? "string" : f));
}

console.log("\n== 1. le parti di un metatag ==");
{
  const fetta = (t, [s, e]) => t.slice(s, e);
  const parti = (t) => findMetatags(t).map((m) => ({
    form: m.form, match: fetta(t, [m.start, m.end]), delimiters: m.delimiters.map((r) => fetta(t, r)),
    componentTags: m.componentTags.map((r) => fetta(t, r)), holes: m.holes.map((r) => fetta(t, r)), text: m.text.map((r) => fetta(t, r)),
  }));
  eq("stringa: i delimitatori fuori dal testo, le virgolette fuori da tutto",
    [{ form: "string", match: "_%_Semplice_%_", delimiters: ["_%_", "_%_"], componentTags: [], holes: [], text: ["Semplice"] }],
    parti(`const s = "_%_Semplice_%_";`));
  eq("<Translate>: i tag a parte, il testo riga per riga, i buchi esclusi",
    [{ form: "translate", match: "Ciao <b>{n}</b>,\n    benvenuto", delimiters: [], componentTags: ['<Translate className="x">', "</Translate>"],
      holes: ["<b>", "{n}", "</b>"], text: ["Ciao", ",", "benvenuto"] }],
    parti(`${IMP}const A = ({ n }) => <Translate className="x">Ciao <b>{n}</b>,\n    benvenuto</Translate>;`));
  eq("<Translate> con i delimitatori dentro",
    [["_%_", "_%_"], ["Con delimitatori"]],
    parti(`${IMP}const A = () => <Translate>_%_Con delimitatori_%_</Translate>;`).flatMap((m) => [m.delimiters, m.text]));
  eq("frase con tag e valori",
    [{ form: "sentence", match: "_%_Ciao <b>{n}</b> qui_%_", delimiters: ["_%_", "_%_"], componentTags: [], holes: ["<b>", "{n}", "</b>"], text: ["Ciao", "qui"] }],
    parti(`const A = ({ n }) => <p>_%_Ciao <b>{n}</b> qui_%_</p>;`));
  eq("ts`…`: il tag e i backtick a parte, ${…} escluso",
    [{ form: "ts", match: "Ciao ${n}", delimiters: [], componentTags: ["ts`", "`"], holes: ["${n}"], text: ["Ciao"] }],
    parti(`${IMP}function A({ n }) { const ts = useTranslateToString(); return ts\`Ciao \${n}\`; }`));
  eq("nessun marcatore né import: niente, senza leggere", [false, []], [mayHaveMarkers("const a = 1;"), findMetatags("const a = 1;")]);
}

console.log("\n== 2a. parità con Babel: i casi difficili ==");
{
  const casi = [
    ["apostrofi sulla stessa riga", `const A = () => <div><p>_%_Dell'app_%_</p><p>_%_L'utente_%_</p></div>;`],
    ["apostrofo nel testo, attributo marcato dopo", `const A = () => <p>L'app <a title="_%_Apri_%_">x</a></p>;`],
    ["attributo su due righe", `const A = () => <p title="_%_Riga uno\n  riga due_%_">x</p>;`],
    ["commento di riga", `// const x = "_%_vecchio_%_";\nconst y = 1;`],
    ["commento JSX", `const A = () => <div>{/* <p>_%_vecchio_%_</p> */}</div>;`],
    ["commento a blocco, poi una stringa", `/* "_%_vecchio_%_" */ const y = "_%_nuovo_%_";`],
    ["URL nel testo marcato", `const A = () => <p>_%_Vai su https://x.it ora_%_</p>;`],
    ["alias di Translate", `import { Translate as T } from "@sepoina/vitetranslate/react";\nconst A = () => <T>Ciao mondo</T>;`],
    ["alias dell'hook", `import { useTranslateToString as useTs } from "@sepoina/vitetranslate/react";\nfunction A({ n }) { const tr = useTs(); return tr\`Ciao \${n}\`; }`],
    ["hook tipato", `${IMP}function A() { const ts: (s: TemplateStringsArray) => string = useTranslateToString(); return ts\`Ciao\`; }`],
    ["stringhe marcate nei buchi di un <Translate>", `${IMP}const A = ({ x }) => <Translate>Ciao {x ? "_%_sì_%_" : "_%_no_%_"}</Translate>;`],
    ["%s in una macro: rifiutata", `${IMP}const A = () => <Translate>Hai %s messaggi</Translate>;`],
    ["%s in una stringa: va bene", `const A = () => <Translate t={["_%_Hai %s messaggi_%_", 3]} />;`],
    ["stringa marcata in un ${} di template", "const t = `Ciao ${\"_%_mondo_%_\"}`;"],
    ["template annidati, poi una stringa", "const c = `a ${x ? `b` : \"\"}`; const y = \"_%_dopo_%_\";"],
    ["virgolette scappate", `const s = "_%_Ha detto \\"ciao\\"_%_";`],
    ["<Translate> con attributi e una freccia", `${IMP}const A = () => <Translate className="x" onClick={() => a > b}>Ciao</Translate>;`],
    ["<Translate key={t}>: t è un valore, non la prop", `${IMP}const A = ({ t }) => <Translate key={t}>Ciao</Translate>;`],
    ["<Translate t=…/>: niente macro, la stringa sì", `${IMP}const A = () => <Translate t="_%_Ciao_%_" />;`],
    ["frase su più righe con tag", `const A = ({ n }) => (\n  <p>\n    _%_Ciao <b>{n}</b>,\n    benvenuto_%_\n  </p>\n);`],
    ["<Translate> annidati: una voce", `${IMP}const A = () => <Translate>Fuori <Translate>dentro</Translate></Translate>;`],
    ["due _%_ spaiati in due <p>: niente", `const A = () => <div><p>_%_Senza chiusura</p><p>ciao_%_</p></div>;`],
    ["marcatore in mezzo a una stringa: niente", `const s = "Prima _%_dentro_%_ dopo";`],
    ["regex con le virgolette, poi una stringa", `const r = /["']/; const s = "_%_dopo la regex_%_";`],
    ["possessivo inglese", `const A = () => <p>_%_The students' books_%_</p>;`],
    ["testo JSX con virgolette", `const A = () => <p>_%_Il "nome" giusto_%_</p>;`],
    ["esempio di codice in una stringa: resta stringa", `const s = '<Translate>_%_x_%_</Translate>';`],
  ];
  for (const [nome, code] of casi) eq(nome, formeBabel(code), findMetatags(code).map((m) => m.form));
}

console.log("\n== 2b. parità con Babel: site/ e demo/ ==");
{
  const sorgenti = [];
  (function giro(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) giro(p);
      else if (/\.(jsx?|tsx?)$/.test(e.name)) sorgenti.push(p);
    }
  })(join(REPO, "site"));
  sorgenti.push(...readdirSync(join(REPO, "demo"), { recursive: true }).filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/node_modules|dist/.test(f)).map((f) => join(REPO, "demo", f)));
  const offsetDi = (t, line, column) => {
    let o = 0;
    for (let l = 1; l < line; l++) o = t.indexOf("\n", o) + 1;
    return o + column - 1;
  };
  let voci = 0;
  const perse = [];
  const inPiù = [];
  for (const file of sorgenti) {
    const code = readFileSync(file, "utf8");
    if (!mayHaveMarkers(code)) continue;
    const entries = [];
    try {
      extractMarkers(code, { filename: file, table: {}, rewrite: false, baseDir: REPO, hints: {}, warn: () => {}, onMarker: (v) => entries.push(v) });
    } catch {
      continue; // un file che Babel non legge (vitetranslate-slice.js): la libreria lo salterebbe
    }
    const intervalli = entries.map((v) => {
      const s = offsetDi(code, v.line, v.column);
      return { v, s, e: markerEnd(code, s) ?? s + 1 };
    });
    const trovati = findMetatags(code);
    const dove = (o) => `${file.slice(REPO.length)}:${code.slice(0, o).split("\n").length}`;
    for (const { v, s, e } of intervalli) {
      voci++;
      if (!trovati.some((m) => m.span[0] < e && m.span[1] > s)) perse.push(`${dove(s)} ${v.form}`);
    }
    for (const m of trovati) if (!intervalli.some(({ s, e }) => m.span[0] < e && m.span[1] > s)) inPiù.push(`${dove(m.start)} ${m.form}`);
  }
  eq("le voci del sito sono tante (il test guarda davvero)", true, voci > 500);
  eq("nessuna voce di Babel senza evidenza", [], perse);
  eq("nessuna evidenza senza voce di Babel", [], inPiù);
}

console.log("\n== 3. un posto solo ==");
{
  const manifest = JSON.parse(readFileSync(join(REPO, "idePlugin/package.json"), "utf8"));
  const imp = manifest.contributes.configuration.properties["vitetranslate.highlightStyle"];
  eq("enum: off, poi gli id del catalogo, nello stesso ordine", [HIGHLIGHT_OFF, ...STYLES.map((s) => s.id)], imp.enum);
  eq("enumItemLabels: i nomi", ["Off", ...STYLES.map((s) => s.name)], imp.enumItemLabels);
  eq("enumDescriptions: le descrizioni", ["No highlighting", ...STYLES.map((s) => s.description)], imp.enumDescriptions);
  eq("il default è quello del catalogo", DEFAULT_STYLE, imp.default);
  eq("quindici stili, id unici", [15, 15], [STYLES.length, new Set(STYLES.map((s) => s.id)).size]);
  eq("il comando c'è, con la sua categoria", "viteTranslate", manifest.contributes.commands.find((c) => c.command === "vitetranslate.highlightStyle")?.category);
  eq("si attiva sui quattro linguaggi", ["javascript", "javascriptreact", "typescript", "typescriptreact"],
    manifest.activationEvents.filter((a) => a.startsWith("onLanguage:")).map((a) => a.slice(11)));
  // Ogni colore è un id del tema, mai un valore: niente #, niente rgb(.
  const colori = STYLES.flatMap((s) => [s.fg, s.chip?.backgroundColor, s.border?.borderColor, s.delimiters?.color, s.overviewRuler?.color]).filter(Boolean);
  eq("colori: solo id del tema", [], colori.filter((c) => !/^[a-zA-Z]+(\.[a-zA-Z]+)+$/.test(c)));
  eq("le regex vengono dalla libreria: il delimitatore", true, STRING_RE.source.includes(escapeRe(SOURCE_OPEN)));
  eq("…e il nome del componente", [MACRO_COMPONENT], [...macroNames(IMP).component]);
}

console.log("\n== 4. l'editor ==");
// Un documento e un editor finti: positionAt come VS Code (riga e colonna da 0).
function documento(text, languageId = "javascriptreact", nome = "App.jsx") {
  const doc = {
    uri: { toString: () => `file:///${nome}` }, languageId, version: 1, text,
    getText: () => doc.text,
    positionAt: (o) => {
      const righe = doc.text.slice(0, o).split("\n");
      return new vscode.Position(righe.length - 1, righe.at(-1).length);
    },
  };
  return doc;
}
function editor(doc) {
  const ed = { document: doc, disegni: new Map(), setDecorations: (tipo, ranges) => ed.disegni.set(tipo, ranges) };
  return ed;
}
const vivi = () => stato.decorazioni.filter((t) => !t.disposed);
// Quello che un editor mostra adesso, per parte: [[riga, col, riga, col], …].
function mostra(ed, h) {
  const fuori = {};
  for (const [p, tipo] of Object.entries(h.tipi ?? {})) {
    if (tipo) fuori[p] = (ed.disegni.get(tipo) ?? []).map((r) => [r.start.line, r.start.character, r.end.line, r.end.character]);
  }
  return fuori;
}
const imposta = (id) => vscode.workspace.getConfiguration("vitetranslate").update("highlightStyle", id, vscode.ConfigurationTarget.Global);
{
  const APP = `const A = () => <p title="_%_Ciao_%_">x</p>;\n`;
  const doc = documento(APP);
  const ed = editor(doc);
  const css = editor(documento(`.a { content: "_%_no_%_"; }`, "css", "a.css"));
  stato.visibleTextEditors = [ed, css];
  const h = new Highlighter({ log: () => {} });

  eq("escape-chip: quattro decorazioni, una per parte", 4, vivi().length);
  eq("…il chip col righello a destra", {
    backgroundColor: "textPreformat.background", borderRadius: "3px", overviewRulerColor: "editorOverviewRuler.infoForeground", overviewRulerLane: 4,
  }, Object.fromEntries(Object.entries(h.tipi.match.options).map(([k, v]) => [k, v?.id ?? v])));
  eq("…il testo nell'oro del tema", "charts.yellow", h.tipi.text.options.color.id);
  eq("…i delimitatori attenuati, compattati, col colore del testo", ["0.4", "-1px", "charts.yellow"],
    [h.tipi.delimiters.options.opacity, h.tipi.delimiters.options.letterSpacing, h.tipi.delimiters.options.color.id]);
  eq("le parti di un attributo marcato", {
    match: [[0, 26, 0, 36]], text: [[0, 29, 0, 33]], delimiters: [[0, 26, 0, 29], [0, 33, 0, 36]], componentTags: [],
  }, mostra(ed, h));
  eq("un file css non si tocca", 0, css.disegni.size);

  await imposta("off");
  eq("off: le decorazioni chiuse, nessuna nuova", 0, vivi().length);
  await imposta("badge");
  eq("badge: il chip solo sul contenuto", [[0, 29, 0, 33]], mostra(ed, h).match);
  await imposta("non-esiste");
  eq("un id sconosciuto vale quello di serie", DEFAULT_STYLE, h.stile.id);
  await imposta("neutral-italic");
  eq("neutral-italic: niente chip, testo senza colore, corsivo", [null, undefined, "italic"],
    [h.tipi.match, h.tipi.text.options.color, h.tipi.text.options.fontStyle]);

  doc.text = `${APP}const B = "_%_Due_%_";\n`;
  doc.version = 2;
  for (const f of stato.documenti) f({ document: doc });
  eq("si scrive: subito, ancora il disegno di prima", 1, mostra(ed, h).text.length);
  await pausa(200);
  eq("…dopo la pausa, anche la stringa nuova", [[0, 29, 0, 33], [1, 14, 1, 17]], mostra(ed, h).text);

  const voci = pickerItems("neutral-italic");
  eq("la scelta: Off in cima, poi i 15 stili", [16, "Off", "Escape chip"], [voci.length, voci[0].label, voci[1].label]);
  eq("…quella in uso lo dice", "Italic only · current", voci.find((v) => v.id === "neutral-italic").description);

  let fine = pickHighlightStyle(h);
  eq("si apre sulla voce in uso", "neutral-italic", stato.quickPick.activeItems[0]?.id);
  stato.quickPick.attiva(stato.quickPick.items.find((v) => v.id === "link"));
  eq("anteprima: link disegnato, impostazione intatta", ["link", "neutral-italic"], [h.stile.id, stato.config["vitetranslate.highlightStyle"]]);
  stato.quickPick.chiudi();
  eq("Esc: niente salvato, torna neutral-italic", [null, "neutral-italic"], [await fine, h.stile.id]);

  stato.aggiornate.length = 0;
  fine = pickHighlightStyle(h);
  stato.quickPick.attiva(stato.quickPick.items.find((v) => v.id === "pill"));
  stato.quickPick.accetta();
  eq("Invio: pill nelle impostazioni utente", ["pill", [["vitetranslate.highlightStyle", "pill", vscode.ConfigurationTarget.Global]]], [await fine, stato.aggiornate]);
  eq("…e disegnato, senza anteprima", ["pill", null], [h.stile.id, h.anteprima]);

  stato.configWorkspace["vitetranslate.highlightStyle"] = "pill";
  stato.aggiornate.length = 0;
  fine = pickHighlightStyle(h);
  stato.quickPick.attiva(stato.quickPick.items.find((v) => v.id === "off"));
  stato.quickPick.accetta();
  await fine;
  eq("il workspace ha la sua: si scrive nel workspace", [["vitetranslate.highlightStyle", "off", vscode.ConfigurationTarget.Workspace]], stato.aggiornate);
  h.dispose();
  delete stato.configWorkspace["vitetranslate.highlightStyle"];
  delete stato.config["vitetranslate.highlightStyle"];
}

console.log("\n== 5. attivata da un file js: il pannello aspetta ==");
{
  let cercati = 0;
  stato.findFiles = async () => (cercati++, []);
  const ed = editor(documento(`const s = "_%_Ciao_%_";\n`));
  stato.visibleTextEditors = [ed];
  stato.activeTextEditor = ed;
  const memoria = new Map();
  const context = {
    subscriptions: [], asAbsolutePath: (rel) => rel, extensionUri: vscode.Uri.file(join(tmpdir(), "ext")),
    workspaceState: { get: (k) => memoria.get(k), update: async (k, v) => void memoria.set(k, v) },
  };
  const { preparato, highlighter } = activate(context);
  await pausa(300);
  eq("l'evidenziazione c'è subito", "escape-chip", highlighter.stile?.id);
  eq("…e l'editor è colorato", true, [...ed.disegni.values()].some((r) => r.length > 0));
  eq("il comando di scelta è registrato", true, stato.comandi.has("vitetranslate.highlightStyle"));
  eq("pannello chiuso: nessun progetto cercato, niente pronto", [0, undefined], [cercati, stato.contesto["vitetranslate.ready"]]);
  stato.webviews.get("vitetranslate.selector").resolveWebviewView({
    webview: {
      options: {}, html: "", cspSource: "vscode-webview://x", asWebviewUri: (u) => `vscode-webview://x${u.fsPath}`,
      onDidReceiveMessage: () => ({ dispose() {} }), postMessage: async () => {},
    },
    visible: true, onDidChangeVisibility: () => ({ dispose() {} }), onDidDispose: () => ({ dispose() {} }),
  });
  await preparato;
  eq("Selector aperto: il pannello parte e si prepara", [true, true], [cercati > 0, stato.contesto["vitetranslate.ready"]]);
  for (const d of context.subscriptions) d.dispose?.();
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
```
