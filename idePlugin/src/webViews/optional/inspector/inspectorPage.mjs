// La pagina di Inspector, nella sezione facoltativa (al posto di Results e Project): in alto, e
// scorre, l'albero di vitetranslate, package.json e vite.config; in fondo, ferma, Back. Qui lo
// scheletro: lo riempie optionalWebview.mjs dallo stato (inspectorState.mjs). Nessun import di
// `vscode`.
import { pageHead, COLUMN_CSS, OPTIONAL_CSS, BACK_BUTTON } from "../../pageCommon.mjs";

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function inspectorHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${OPTIONAL_CSS}
    main { padding-top: 8px; }
    #message { margin: 6px 0 12px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <main>
    <p id="message" hidden></p>
    <vscode-tree id="tree" indent-guides="onHover" hidden></vscode-tree>
  </main>
  <footer>
    ${BACK_BUTTON}
  </footer>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
