# Piano di implementazione idePlugin 0.0.5: Selector, Results, Details

> [!NOTE]
> **Per il revisore umano**
> - **Tre sezioni invece di quattro**, dall'alto: **Selector** (webview), **Results** (l'albero dei file, già "Marked"), **Details** (invariata).
> - **Selector** contiene: *Config* (l'elenco dei progetti, solo se più di uno), *Filter* (solo se oltre ad All c'è qualcosa), i tre bottoni di Actions. Config e Filter sono `vscode-tree` di `@vscode-elements/elements`.
> - **Spariscono** la TreeView Configs, il gruppo Filter dentro Marked, la sezione Actions e `choiceList.mjs` (con il suo test).
> - **Chi comanda:** lo stato resta nell'estensione (progetto selezionato, filtro, conteggi). La webview lo riceve con `postMessage` e rimanda solo i clic. Si ridisegna da zero a ogni riapertura (niente `retainContextWhenHidden`).
> - **Invariati:** il file attivo che seleziona il progetto, il blocco dei dati superati, la scansione con indice e worker, il comando Sync.
> - **Limite noto:** VS Code non adatta l'altezza di una webview al contenuto; Selector si ridimensiona trascinando il bordo.

> [!TIP]
> **logDiary**
> - **Fatto come da piano:** `Projects` (ex `ProjectTree`) è solo modello; `SelectorView` sostituisce `ActionsView`; `MarkedTree` mostra la sezione Results senza il gruppo Filter; `selectorState.mjs` è puro e testato.
> - **Test:** `idePluginSelector` nuovo (15), `idePluginExtension` riscritto dove guidava Configs (121). Via `idePluginChoice`. `npm test -- idePlugin`: 7/7.
> - **Prova in Chrome headless** della pagina vera (`dist/webview.js`, CSP col nonce, variabili del tema): elenchi e bottoni disegnati, il clic su una riga manda `select`/`filter`, un clic ripetuto sulla riga già scelta non manda niente.
> - **Scoperte:** `vsc-tree-select` passa un array in `detail` (il `.d.ts` dice `{ selectedItems }`): gestite tutte e due. Il clic di `vscode-tree-item` è sull'elemento interno `[part=wrapper]`.
> - **Peso:** `dist/webview.js` passa da 31 a 66 kB (tree e tree-item); `.vsix` 64,6 kB.

> [!CAUTION]
> - **`choiceList.mjs` rimosso con modifiche non committate** (erano nel working tree a inizio sessione): il componente non serve più, ma quelle modifiche non esistono più.
> - **Fase 4 non fatta nell'editor:** altezza della sezione, focus da tastiera negli elenchi e aspetto coi temi veri restano da vedere.
> - **`npm test`: 79/81**, come prima: `compileGolden` preesistente, `site` per i refusi di prova in `playEdge`.

---

## Istruzioni per chi implementa

Le sette fasi di `AGENTS.md`. `vscode` solo in `extension.mjs`; lo stato del Selector in un modulo Node puro
(`selectorState.mjs`), così si prova senza editor. Nessuna dipendenza nuova: `vscode-tree` e `vscode-tree-item`
stanno già in `@vscode-elements/elements`.

## Decisioni (prese da me, da confermare in review)

| Punto | Scelta |
| --- | --- |
| Segno del selezionato | la selezione nativa di `vscode-tree` (evidenziazione), niente 🔵/▪️ |
| Conteggi del filtro | nello slot `description` della riga ("3 of 12"), come oggi |
| Nessun progetto nel workspace | Selector mostra la frase e i bottoni (Refresh utile) |
| Id delle viste | `vitetranslate.selector` (nuova), `vitetranslate.results` (era `marked`), `details` invariata |
| Context key `singleProject` | via: nascondeva Configs, che non c'è più |
| Testi nella webview | sempre via `textContent`, mai `innerHTML`: i nomi vengono dai `package.json` |

## Protocollo webview ↔ estensione

- Webview → estensione: `{ cmd: "ready" }` al caricamento; `{ cmd: "select", value: dir }`;
  `{ cmd: "filter", value }`; `{ cmd: "sync" | "refresh" | "openConfig" }`.
- Estensione → webview: `{ type: "state", projects, selected, filters, filter, empty }`, dove `projects`
  e `filters` sono `null` quando la sezione non si mostra. Inviato dopo `ready`, a ogni cambio di
  elenco, selezione, risultato di Results o filtro, e solo se diverso dall'ultimo inviato.

## Fasi

1. **Implementazione:** `selectorState.mjs`, `selectorPage.mjs` (sostituisce `actionsPage.mjs`), `webview.mjs`,
   `extension.mjs` (`ProjectTree` perde la TreeView e diventa modello; `MarkedTree` perde il gruppo filtro;
   `SelectorView` sostituisce `ActionsView`), `package.json` (viste, viewsWelcome, menu).
2. **Test:** `idePluginSelector.test.mjs` (stato puro); `idePluginExtension.test.mjs` riscritto dove guidava
   Configs; via `idePluginChoice.test.mjs`.
3. **Build:** `ide:package`, prova headless della pagina in Chrome.
4. **Review:** a mano nell'editor se possibile.
5. **Documentazione:** `idePlugin/README.md`, `doc/structure.md` (sezione dell'estensione).
6. **Pulizia**, 7. **logDiary**.
