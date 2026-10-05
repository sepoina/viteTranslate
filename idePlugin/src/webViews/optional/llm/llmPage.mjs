// La pagina del pannello LLM, nella sezione facoltativa (al posto di Results): in alto i tre
// controlli (chiave, impostazioni, ping), sotto le azioni --llm-*, in fondo, ferma, la barra con
// "Check again" e Close. Qui lo scheletro: lo riempie optionalWebview.mjs dallo stato
// (llmPanel.mjs). Nessun import di `vscode`.
import { pageHead, COLUMN_CSS } from "../../pageCommon.mjs";

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function llmHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}
    footer {
      flex: none; display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;
      padding: 8px 12px 10px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
    }
    .check { display: flex; align-items: baseline; gap: 6px; margin: 4px 0 4px 7px; }
    .check vscode-icon { flex: none; position: relative; top: 2px; }
    .check .desc { color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .check[data-state="ok"] vscode-icon { color: var(--vscode-testing-iconPassed); }
    .check[data-state="warning"] vscode-icon { color: var(--vscode-problemsWarningIcon-foreground); }
    .check[data-state="error"] vscode-icon { color: var(--vscode-problemsErrorIcon-foreground); }
  </style>
</head>
<body>
  <main>
    <section>
      <h2>Ready?</h2>
      <div id="checks"></div>
    </section>
    <section>
      <h2>Actions</h2>
      <vscode-tree id="actions" hide-arrows></vscode-tree>
    </section>
  </main>
  <footer>
    <vscode-button data-cmd="recheck" id="recheck" secondary icon="refresh" title="Look for the key and ping the model again">Check again</vscode-button>
    <vscode-button data-cmd="close" secondary icon="close" title="Back to Results">Close</vscode-button>
  </footer>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
