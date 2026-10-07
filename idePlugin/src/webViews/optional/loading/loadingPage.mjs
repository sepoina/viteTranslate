// La pagina dell'avvio, nella sezione facoltativa (il modo "loading" di OptionalView): finché la
// prima immagine del pannello non è pronta (Startup, in core/startup.mjs) è l'unica sezione in
// vista — Selector, Results e Project aspettano — e dice cosa si sta preparando: il logo e, sotto,
// la tappa (`loading`, da Startup.starting). La prima tappa è già nell'HTML: si vede prima ancora
// che arrivi lo stato. Niente barra dei comandi e lo sfondo di sempre, non quello tinto delle
// altre pagine: non è un'altra modalità, è il pannello che parte. La tappa la scrive
// optionalWebview.mjs, con textContent. Nessun import di `vscode`.
import { pageHead, COLUMN_CSS } from "../../pageCommon.mjs";
import { LOGO_SVG, LOGO_CSS } from "../settings/logo.mjs";

// La prima tappa di Startup (startup.mjs, che la prende da qui): la pagina la mostra da subito.
export const FIRST_STEP = "Looking for Vite projects…";

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function loadingHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${LOGO_CSS}
    /* Il logo e la tappa, al centro della sezione. */
    #loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding-bottom: 12px; }
    #loading .logo { width: min(170px, 70%); }
    .tappa { margin: 0; display: flex; align-items: center; gap: 6px; text-align: center; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <main id="loading" aria-busy="true">
    ${LOGO_SVG}
    <p class="tappa" role="status"><vscode-icon name="loading" spin></vscode-icon><span id="loadingText">${FIRST_STEP}</span></p>
  </main>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
