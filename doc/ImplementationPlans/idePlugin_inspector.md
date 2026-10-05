# Piano di implementazione idePlugin: Inspector

> [!NOTE]
> **Per il revisore umano**
> - **Project si alleggerisce:** restano Languages e la barra dei comandi. Details esce.
> - **Inspector** è il terzo modo della sezione facoltativa (accanto a Help e LLM): prende il posto di Results e mostra l'albero che oggi è Details (vitetranslate, package.json, vite.config).
> - **La barra:** l'icona ⚡ "Open vite.config" sparisce; al suo posto un'icona `info` (i) che apre/chiude Inspector (comando `vitetranslate.inspector`).
> - **Nessun bundle nuovo:** Inspector usa lo script della facoltativa (`dist/optionalWebview.js`), che eredita da `projectWebview.mjs` il codice dell'albero.
> - **Stato puro** in `webViews/optional/inspector/inspectorState.mjs`, pagina in `inspectorPage.mjs`; `projectState` perde `details`.
> - **Via:** `openConfig` (azione di Project ed `editorUi.openConfig`), l'azione `open` di Project.
> - **Prova:** `npm test -- idePlugin` verde, test Details spostati su Inspector, build pulita.

> [!TIP]
> **logDiary**
> - **Fatto come da piano**, decisioni della tabella tutte applicate (toggle sulla (i), Close in fondo, Inspector che segue il progetto senza cambiare modo).
> - **Test:** `npm test -- idePlugin` 11/11, 495 asserzioni (erano 485). In `idePluginExtension` la facoltativa si risolve subito e `ispettore()` apre/legge/richiude Inspector; in `idePluginStartup` il "primo ready completo" ora guarda Languages.
> - **Bundle:** `projectWebview.js` 69,3 → 68,4 kB, `optionalWebview.js` 66,0 → 67,5 kB; nessun input nuovo in rolldown.
> - **Via:** `editorUi.openConfig`, le azioni `openConfig`/`open` di Project. Commenti stantii su "Details" corretti anche in `summarize.mjs` e `markedScan.mjs`.
> - **Deviazione:** i file `necessarytest`/`necessarydoc` non creati: tutto in una sessione, gli elenchi stavano nel piano.

> [!CAUTION]
> - **Non provato nell'editor** (`npm run ide:install`): aspetto della (i), toggle e memoria delle righe aperte nella sezione facoltativa restano da vedere a mano.
> - **Working tree:** il lavoro sta sopra il riordino di `src/` (piano `idePlugin_srcLayout`) ancora non committato.

---

## Istruzioni per chi implementa

Segui le sette fasi di `AGENTS.md` **nell'ordine**: implementazione, test, build, review, documentazione,
pulizia, logDiary. Gli appunti per test e doc vanno in `idePlugin_inspector.necessarytest.md` e
`idePlugin_inspector.necessarydoc.md` (o, se fai tutto in una sessione, segui gli elenchi qui sotto e dillo nel logDiary).

Regole di questo piano:

- `vscode` si importa solo nei moduli `…View.mjs` e in `core/` come oggi: `inspectorState.mjs` e `inspectorPage.mjs` **non** importano `vscode`.
- Stile del codice: quello dei file vicini (nomi e commenti in italiano, testi utente in inglese).
- I testi dell'albero arrivano da vite.config e package.json: nella pagina solo `textContent`, mai HTML.
- Lavora dalla radice del repo: `/run/media/aldo/4TB_Dati/L/Web/Dev/React/viteTranslate4`.
- Baseline prima di iniziare: `npm test -- idePlugin` → 11/11, 485 asserzioni.

## Decisioni (prese da me, da confermare in review)

| Punto | Scelta |
| --- | --- |
| Dove vive Inspector | terzo `mode` di `OptionalView` (`"inspector"`), stessa sezione `vitetranslate.optional` |
| Titolo della sezione | `Inspector`, descrizione = nome del progetto (come LLM) |
| Icona | codicon `info`, nello stesso posto del lampo (seconda icona della barra) |
| Clic sull'icona con Inspector già aperto | lo chiude (toggle): torna Results |
| Clic su LLM con Inspector aperto | passa a LLM/Help, come oggi da Results |
| Progetto cambiato con Inspector aperto | resta Inspector e segue il nuovo progetto (non diventa Help/LLM) |
| Footer della pagina | un bottone Close, come Help e LLM |
| Intestazione dentro la pagina | nessuna `<h2>`: il titolo della sezione dice già Inspector |
| Il lampo `#jump` accanto a Languages | **resta**: è un altro lampo (la chiave scelta in Results) |
| Comando | `vitetranslate.inspector`, in palette, `$(info)` |

## Fase 1 — Implementazione

### 1.1 `idePlugin/src/webViews/project/projectState.mjs`

- Esporta `colore` (serve a Inspector): `export const colore = …`.
- Togli la funzione `nodo` (va in inspectorState) e il campo `details` dallo stato iniziale.
- `const [tabelle, ...resto] = projectChildren(...)` → `const [tabelle] = projectChildren(...)`; togli la riga `stato.details = …`.
- Commento in testa: le altre righe (vitetranslate, package.json, vite.config) ora vanno in Inspector (`inspectorState.mjs`).

### 1.2 `idePlugin/src/webViews/project/projectPage.mjs`

- In `ICONS` sostituisci `{ cmd: "openConfig", icon: "zap", … }` con
  `{ cmd: "inspector", icon: "info", title: "Inspector: the plugin options, package.json and vite.config, in Results' place" }`.
- Togli `<section id="details">…</section>`.
- Commento in testa: una zona sola in alto (Languages).

### 1.3 `idePlugin/src/webViews/project/projectWebview.mjs`

- Togli: import di `vscode-tree-item`? **No**, serve alle lingue: resta. Togli `aperti`, `ricorda`, `nodo`, `dettagli`, il blocco `$("details")` in `disegna`, il listener `click/keyup` su `#tree`, la coppia `["tree", "open"]` nel ciclo dei `vsc-tree-select` (resta solo `langs` → `openLanguage`).
- `firme` resta (la usa `lingue`).
- Commento in testa: niente più Details né `vscode.setState`.

### 1.4 `idePlugin/src/webViews/project/projectView.mjs`

- Azioni: togli `openConfig` e `open`; aggiungi `inspector: () => vscode.commands.executeCommand("vitetranslate.inspector")`.
- Import da `editorUi.mjs`: togli `openConfig`.
- Commento in testa: icone Refresh, Inspector, opzioni del plugin, impostazioni.

### 1.5 `idePlugin/src/core/editorUi.mjs`

- Togli `openConfig` (non lo usa più nessuno: verifica con `grep -rn openConfig idePlugin/src test`).

### 1.6 Nuovo `idePlugin/src/webViews/optional/inspector/inspectorState.mjs`

```js
import { projectChildren } from "../../../core/summarize.mjs";
import { colore, NO_PROJECTS, NO_SELECTION, READING } from "../../project/projectState.mjs";
// nodo(riga, padre): identico a quello tolto da projectState.
export function inspectorState({ hasProjects, project, title = null, dati }) {
  const stato = { title: project ? title : null, message: null, details: null };
  if (!hasProjects) return { ...stato, message: NO_PROJECTS };
  if (!project) return { ...stato, message: NO_SELECTION };
  if (!dati) return { ...stato, message: READING };
  const [, ...resto] = projectChildren({ project, ...dati });
  return { ...stato, details: resto.map((r) => nodo(r, project.dir)) };
}
```

### 1.7 Nuovo `idePlugin/src/webViews/optional/inspector/inspectorPage.mjs`

`inspectorHtml({ scriptUri, codiconsUri, cspSource, nonce })` con `pageHead` + `COLUMN_CSS` (come `llmPage.mjs`):

```html
<main>
  <p id="message" hidden></p>
  <vscode-tree id="tree" indent-guides="onHover" hidden></vscode-tree>
</main>
<footer>
  <vscode-button data-cmd="close" secondary icon="close" title="Back to Results">Close</vscode-button>
</footer>
```

Stile del footer e di `#message` copiati da `llmPage.mjs` / `projectPage.mjs`; `main` con un margine sopra all'albero (`padding-top`).

### 1.8 `idePlugin/src/webViews/optional/optionalWebview.mjs`

- Aggiungi (spostate da projectWebview, identiche): `aperti` (da `vscode.getState()`), `firme`, `icona`, `riga`, `ricorda`, `nodo`, `dettagli`.
- `disegnaInspector(stato)`: `#message` come in Project, `#tree.hidden = !stato.details`, `dettagli(stato.details)`.
- Listener `message`: `checks` → `disegna` (LLM); `tree` → `disegnaInspector`.
- `vsc-tree-select` su `#tree` → `{ cmd: "open", value }`; `click`/`keyup` su `#tree` → `setTimeout(ricorda)`.
- `ready` se c'è `#checks` **o** `#tree`.
- Commento in testa: le tre pagine.

### 1.9 `idePlugin/src/webViews/optional/optionalView.mjs`

- Import: `inspectorHtml`, `inspectorState`, `openFile`, `progressIn`.
- `const TITOLI = { help: "Help", llm: "LLM", inspector: "Inspector" }`, `PAGINE = { help: helpHtml, llm: llmHtml, inspector: inspectorHtml }`.
- `live`: `(this.mode === "llm" || this.mode === "inspector") && !!this.view`.
- `page()`: `PAGINE[this.mode] ?? helpHtml`. `render()`: `TITOLI[this.mode] ?? "Help"`.
- `state()`: se `mode === "inspector"` → come `ProjectView.state` senza stats/llm/jumpKey: elenco, selezionato, `ready(dir)`; se manca la lettura, `projects.data(scelto)` con barra (`progressIn(OPTIONAL_VIEW_ID)`, una volta per lettura: `WeakSet` come Project); ritorna `inspectorState(...)`. Altrimenti il codice di oggi.
- Azione `open: (file) => file && openFile(file)`.
- Comando `"vitetranslate.inspector": () => this.toggleInspector()`; `toggleInspector()`: `mode === "inspector"` → `close()`, altrimenti `show("inspector")`.
- `follow()`: con `mode === "inspector"` solo `push()` (niente cambio di modo).
- `invalidate(dir)`: oltre a `llm.forget`, se `mode === "inspector"` → `push()` (mostra "Reading vite.config…").
- Commento in testa: tre pagine.

### 1.10 `idePlugin/package.json`

Nuovo comando: `{ "command": "vitetranslate.inspector", "title": "Inspector", "category": "viteTranslate", "icon": "$(info)" }`.

### 1.11 `idePlugin/src/extension.mjs`, `rolldown.config.mjs`

Solo commenti: la facoltativa ha Help, LLM, Inspector. Nessun input nuovo in rolldown.

## Fase 2 — Test

- `test/list/idePluginProject.test.mjs`: sezione Details → `inspectorState` (stessi controlli + messaggi); `s.details` sparisce dai controlli di projectState (verifica che non ci sia: `"details" in s` false). Pagina: sezioni nascoste solo `["languages"]`, un solo tree `langs`, barra `["sync","llm","refresh","inspector","openPluginConfig","settings"]`, icone `["refresh","info","wrench","settings-gear"]`. Nuovo blocco "Inspector: la pagina": CSP/script, `#tree` e Close.
- `test/list/idePluginExtension.test.mjs`: la webview facoltativa risolta subito dopo Project; helper `ispettore()` (apre Inspector, push finché non è più READING, chiude). Sostituisci gli usi di `progetto().details` (selezione di app, cambio a other, Restricted Mode). Il clic `open` su package.json passa per la facoltativa. Al posto di `openConfig`: clic su `inspector` → contesto `vitetranslate.optional` vero, titolo `Inspector`, descrizione il progetto; secondo clic → chiusa. Comando registrato `vitetranslate.inspector`.

## Fase 3 — Build

`npm run ide:build` dalla radice (o `npm run build` in `idePlugin/`): nessun errore; `dist/projectWebview.js` più piccolo, `dist/optionalWebview.js` più grande.

## Fase 4 — Review

Rileggi il diff: nessun riferimento a `details`/`openConfig` rimasto in Project (`grep`), Inspector segue il progetto, il toggle non lascia la context key sbagliata.
Prova nell'editor (`npm run ide:install`) se possibile; altrimenti segnalalo in [!CAUTION].

## Fase 5 — Documentazione

- `idePlugin/README.md`: Project perde **Details** (diventa un paragrafo `### Inspector` dopo `### LLM`, o prima); la barra: ⓘ Inspector al posto di ⚡.
- `doc/structure.md` (parte idePlugin): il punto "Project is a webview in two zones" (niente Details, icone aggiornate) e "The optional section…" (tre pagine, Inspector, toggle).
- Testi in inglese, brevi.

## Fase 6 — Pulizia

Rimuovi i `idePlugin_inspector.necessary*.md` se creati.

## Fase 7 — logDiary

Nota [!TIP] subito dopo la [!NOTE], e [!CAUTION] per quanto non provato.
