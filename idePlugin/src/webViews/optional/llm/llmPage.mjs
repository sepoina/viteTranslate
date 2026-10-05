// La pagina del pannello LLM, nella sezione facoltativa (al posto di Results e Project): in alto i
// tre controlli (chiave, impostazioni, ping), sotto le azioni --llm-*, in fondo, ferma, la barra dei
// comandi con Back, "Check again" e, se un controllo è andato male, il ? che apre Help nella sua
// variante "qualcosa non va" (commandBar.mjs). Qui lo scheletro: lo riempie optionalWebview.mjs
// dallo stato (llmPanel.mjs). Nessun import di `vscode`.
//
// Un'azione è una riga a due piani (ACTION_CSS, in pageCommon.mjs): icona e nome, poi sotto,
// rientrata sotto il nome, la descrizione, anche su più righe. Sono <div> con role="button", che si
// cliccano e rispondono a Invio e Spazio.
import { pageHead, COLUMN_CSS, OPTIONAL_CSS, ACTION_CSS } from "../../pageCommon.mjs";
import { commandBarHtml, COMMAND_BAR_CSS } from "../../commandBar/commandBar.mjs";
import { TOOLTIP_CSS } from "../../tooltip/tooltip.mjs";

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function llmHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${OPTIONAL_CSS}${ACTION_CSS}${COMMAND_BAR_CSS}${TOOLTIP_CSS}
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
      <div id="actions"></div>
    </section>
  </main>
  ${commandBarHtml({
    back: { icon: "sparkle", name: "LLM" },
    commands: [
      { cmd: "recheck", id: "recheck", label: "Check again", icon: "refresh", title: "Look for the key and ping the model again" },
      { cmd: "help", id: "help", label: "Help", icon: "question", title: "Something failed? How the llm block and its key should look", iconOnly: true, hidden: true },
    ],
  })}
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
