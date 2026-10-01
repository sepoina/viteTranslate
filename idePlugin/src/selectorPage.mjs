// La pagina della sezione Selector (una webview): Config, Filter e i bottoni, fatti coi componenti di
// @vscode-elements/elements. I bottoni stanno in un piede ancorato al fondo della sezione; sopra,
// gli elenchi scorrono se la sezione è bassa. Qui solo lo scheletro: elenchi e ricerca li riempie webview.mjs dallo stato
// che l'estensione manda (selectorState.mjs). Nessun import di `vscode`: chi la usa (SelectorView in
// extension.mjs) le passa l'indirizzo dello script e la sorgente ammessa dalla CSP.
//
// La CSP chiude tutto tranne lo script col `nonce` (dist/webview.js) e gli stili: quelli dei
// componenti Lit passano da adoptedStyleSheets, il piccolo <style> qui sotto è inline. I colori
// sono le variabili del tema di VS Code, che la webview riceve già: chiaro o scuro, nessun lavoro.

/** I bottoni, nell'ordine in cui si vedono: `cmd` è il messaggio che manda il clic. */
export const ACTIONS = [
  { cmd: "sync", label: "Sync", title: "Run the sync: bring the language files in line with the source" },
  { cmd: "refresh", label: "Refresh", title: "Read vite.config and scan the source again", secondary: true },
  { cmd: "openConfig", label: "Open vite.config", title: "Open the selected project's vite.config", secondary: true },
];

const escape = (testo) => String(testo).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/webview.js come lo vede la webview (webview.asWebviewUri)
 * @param {string} p.codiconsUri - dist/codicon.css, allo stesso modo: le icone di vscode-icon
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function selectorHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  const bottoni = ACTIONS.map(
    (a) => `<vscode-button data-cmd="${a.cmd}" title="${escape(a.title)}"${a.secondary ? " secondary" : ""}>${escape(a.label)}</vscode-button>`
  ).join("\n    ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};">
  <link id="vscode-codicon-stylesheet" rel="stylesheet" href="${codiconsUri}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Una colonna alta quanto la sezione: gli elenchi scorrono, i bottoni stanno fermi in basso. */
    html, body { height: 100%; margin: 0; }
    body {
      display: flex; flex-direction: column; box-sizing: border-box; padding: 0;
      font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground);
    }
    main { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 12px 0; }
    footer { flex: none; padding: 8px 12px 10px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, transparent 100); }
    section { margin-bottom: 12px; }
    h2 {
      margin: 8px 0 5px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--vscode-chat-linesAddedForeground);
    }
    .ciro {    
     border-left: 1px solid color-mix(in srgb, var(--vscode-chat-linesAddedForeground), transparent 80%);
     margin-left: 7px;    
     padding-left: 9px;
     }  
    .ciro[aria-selected="true"] {   
      border-left: 2px solid color-mix(in srgb, var(--vscode-chat-linesAddedForeground), transparent 44%);
      margin-left: 7px;
      padding-left: 8px;
    }
    [hidden] { display: none !important; }
    #query { width: "-webkit-fill-available"; }
    /* Il campo di ricerca e, alla sua destra, l'icona che lo svuota (invisibile a campo vuoto,
       senza far saltare il campo). */
    .campo { display: flex; align-items: center; gap: 4px; }
    .campo #query { flex: 1 1 auto; min-width: 0; }
    #clear[aria-hidden="true"] { visibility: hidden; }
    .actions { 
        display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: center;
    background-color: var(--vscode-chat-inputWorkingBorderColor2);
    }
    #empty { margin: 6px 0 12px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <main>
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
  <footer class="actions">
    ${bottoni}
  </footer>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
