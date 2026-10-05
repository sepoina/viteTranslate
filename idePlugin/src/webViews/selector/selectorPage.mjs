// La pagina della sezione Selector (una webview): Config, Filter e Search, fatti coi componenti di
// @vscode-elements/elements. Qui solo lo scheletro: elenchi e ricerca li riempie webview.mjs dallo
// stato che l'estensione manda (selectorState.mjs). I bottoni (Sync, LLM, le icone) stanno nella
// sezione Project (projectPage.mjs). Nessun import di `vscode`: chi la usa (PageView in
// extension.mjs) le passa l'indirizzo dello script e la sorgente ammessa dalla CSP.
import { pageHead, COLUMN_CSS } from "../pageCommon.mjs";

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/webview.js come lo vede la webview (webview.asWebviewUri)
 * @param {string} p.codiconsUri - dist/codicon.css, allo stesso modo: le icone di vscode-icon
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function selectorHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}
    main { padding-bottom: 4px; }
    #query { width: "-webkit-fill-available"; }
    /* Il campo di ricerca e, alla sua destra, l'icona che lo svuota (invisibile a campo vuoto,
       senza far saltare il campo). */
    .campo { display: flex; align-items: center; gap: 4px; }
    .campo #query { flex: 1 1 auto; min-width: 0; }
    #clear[aria-hidden="true"] { visibility: hidden; }
    #empty { margin: 6px 0 12px; color: var(--vscode-descriptionForeground); }
    /* L'avvio: visibile da subito, prima ancora che arrivi lo stato. */
    #starting { margin: 10px 0 12px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px; }
  </style>
</head>
<body>
  <main>
    <p id="starting"><vscode-icon name="loading" spin></vscode-icon><span id="startingText">Looking for Vite projects…</span></p>
    <section id="config" hidden>
      <h2>Config</h2>
      <vscode-tree id="projects" hide-arrows></vscode-tree>
    </section>
    <section id="filter" hidden>
      <h2>Filter</h2>
      <vscode-tree id="filters" hide-arrows></vscode-tree>
    </section>
    <section id="search" hidden>
      <h2>Search</h2>
      <div class="campo">
        <vscode-textfield class="ciro" id="query" aria-selected="false" placeholder="Text or file path" aria-label="Search the entries"></vscode-textfield>
        <vscode-icon id="clear" name="close" action-icon label="Clear the search" title="Clear the search" aria-hidden="true"></vscode-icon>
      </div>
    </section>
    <p id="empty" hidden>No Vite project in this workspace: no vite.config.* was found.</p>
  </main>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
