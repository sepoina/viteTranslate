// La pagina di Inspector, nella sezione facoltativa (al posto di Results): in alto, e scorre,
// l'albero di vitetranslate, package.json e vite.config; in fondo, ferma, Close. Qui lo scheletro:
// lo riempie optionalWebview.mjs dallo stato (inspectorState.mjs). Nessun import di `vscode`.
import { pageHead, COLUMN_CSS } from "../../pageCommon.mjs";

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function inspectorHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}
    main { padding-top: 8px; }
    footer {
      flex: none; display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;
      padding: 8px 12px 10px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
    }
    #message { margin: 6px 0 12px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <main>
    <p id="message" hidden></p>
    <vscode-tree id="tree" indent-guides="onHover" hidden></vscode-tree>
  </main>
  <footer>
    <vscode-button data-cmd="close" secondary icon="close" title="Back to Results">Close</vscode-button>
  </footer>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
