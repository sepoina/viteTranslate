// La pagina della sezione Project (una webview), in due zone:
//   - in alto, e scorre se la sezione è bassa, Translations: i file di lingua del progetto
//     selezionato nello stile di Config in Selector (il resto della sintesi sta in Settings). Accanto
//     al titolo, con una chiave scelta in Results, il cuore: il clic su una lingua apre il file lì;
//   - in fondo, ferma, la barra dei comandi (commandBar.mjs): i bottoni Sync e LLM, le icone-bottone.
// Qui solo lo scheletro: lo riempie projectWebview.mjs dallo stato (projectState.mjs). Nessun
// import di `vscode`, come selectorPage.mjs.
import { pageHead, COLUMN_CSS } from "../pageCommon.mjs";
import { commandBarHtml, COMMAND_BAR_CSS } from "../commandBar/commandBar.mjs";
import { tooltipHtml, TOOLTIP_CSS } from "../tooltip/tooltip.mjs";

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/projectWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function projectHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${COMMAND_BAR_CSS}${TOOLTIP_CSS}
    .nota, #message { margin: 6px 0 12px; color: var(--vscode-descriptionForeground); }
    .nota vscode-icon { vertical-align: text-bottom; margin-right: 4px; }
    /* Il cuore accanto a Translations: c'è una chiave scelta in Results, il clic su una lingua
       apre il file lì. Il colore è quello del titolo: vscode-icon ne impone uno suo (icon.foreground),
       qui si rimette. Quando la chiave cambia batte un attimo (scale; inline-block, un elemento
       inline non si scala), non con le animazioni ridotte. Il suo tooltip (tooltip.mjs): tre righe,
       la chiave in mezzo. */
    #jump { display: inline-block; vertical-align: -1px; margin-left: 3px; }
    #jump vscode-icon { display: inline-block; color: var(--vscode-chat-linesAddedForeground); transform-origin: center; }
    #jump.nuovo vscode-icon { animation: battito 0.8s ease-in-out 3; }
    @keyframes battito {
      0%, 45%, 100% { transform: scale(1); }
      15% { transform: scale(1.4); }
      30% { transform: scale(1.15); }
    }
    @media (prefers-reduced-motion: reduce) { #jump.nuovo vscode-icon { animation: none; } }
    /* Invisibile finché non arriva il primo stato: niente scheletro vuoto, la pagina compare intera. */
    body:not([data-drawn]) { visibility: hidden; }
  </style>
</head>
<body>
  <main>
    <p id="message" hidden></p>
    <section id="languages" hidden>
      <h2>Translations <span id="jump" class="suggerito" role="img" hidden><vscode-icon name="heart-filled" size="12"></vscode-icon>${tooltipHtml([
        "Click a translation file to open it at", { id: "jumpKey", strong: true }, "the entry picked in Results",
      ])}</span></h2>
      <vscode-tree id="langs" hide-arrows></vscode-tree>
      <p id="langNote" class="nota" hidden></p>
    </section>
  </main>
  ${commandBarHtml()}
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
