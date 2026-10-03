// La pagina della sezione Project (una webview), in due zone:
//   - in alto i dettagli del progetto selezionato, che scorrono se la sezione è bassa: Languages,
//     i file di lingua nello stile di Config in Selector, e Details, un vscode-tree con la sintesi
//     di vitetranslate, package.json e vite.config;
//   - in fondo, ferma, la barra dei comandi: i bottoni Sync e LLM, le icone-bottone.
// Qui solo lo scheletro: lo riempie projectWebview.mjs dallo stato (projectState.mjs). Nessun
// import di `vscode`, come selectorPage.mjs.
import { escape, pageHead, COLUMN_CSS } from "./pageCommon.mjs";

/**
 * La barra in fondo: a sinistra i bottoni, a destra le icone-bottone (codicon). `cmd` è il
 * messaggio che manda il clic. LLM è sempre cliccabile, e parte "da configurare" (icona `?`,
 * tooltip LLM_OFF): se il progetto ha `llm` lo stato gli dà la freccia del sottomenu (LLM_ICON).
 */
export const ACTIONS = [
  { cmd: "sync", label: "Sync", title: "Run the sync: bring the language files in line with the source" },
  { cmd: "llm", label: "LLM", title: "Translate with an LLM, and the other --llm-* actions", iconAfter: "question", off: true },
];
export const ICONS = [
  { cmd: "refresh", icon: "refresh", title: "Refresh: read vite.config and scan the source again" },
  { cmd: "openConfig", icon: "zap", title: "Open vite.config" },
  { cmd: "openPluginConfig", icon: "wrench", title: "Open the vitetranslate options in vite.config" },
  { cmd: "settings", icon: "settings-gear", title: "Open the extension settings" },
];
/** Il tooltip di LLM quando il progetto non ha `llm`: il clic apre Help. */
export const LLM_OFF = "LLM is not set up for this project: click to see how";
/** L'icona dopo LLM: il sottomenu delle azioni, o il `?` di Help. */
export const LLM_ICON = { on: "chevron-right", off: "question" };

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/projectWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function projectHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  const bottoni = ACTIONS.map(
    (a) => `<vscode-button id="btn-${a.cmd}" data-cmd="${a.cmd}" title="${escape(a.off ? LLM_OFF : a.title)}" data-title="${escape(a.title)}"${a.iconAfter ? ` icon-after="${a.iconAfter}"` : ""}>${escape(a.label)}</vscode-button>`
  ).join("\n      ");
  const icone = ICONS.map(
    (i) => `<vscode-icon data-cmd="${i.cmd}" name="${i.icon}" action-icon label="${escape(i.title)}" title="${escape(i.title)}"></vscode-icon>`
  ).join("\n      ");
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}
    /* La barra dei comandi non si restringe mai: se la sezione è bassa cede prima <main>, fino a zero. */
    footer { flex: none; padding: 8px 12px 10px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, transparent 100); }
    .actions {
        display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: center;
    background-color: var(--vscode-chat-inputWorkingBorderColor2);
    }
    /* Bottoni a sinistra, icone a destra: il margine automatico spinge le icone in fondo. */
    .bottoni, .icone { display: flex; align-items: center; gap: 6px; }
    .icone { margin-left: auto; gap: 2px; }
    .nota, #message { margin: 6px 0 12px; color: var(--vscode-descriptionForeground); }
    .nota vscode-icon { vertical-align: text-bottom; margin-right: 4px; }
    /* Il lampo accanto a Languages: c'è una chiave scelta in Results, il clic su una lingua ci va. Solo un segno. */
    #jump { vertical-align: -1px; margin-left: 2px; color: var(--vscode-chat-linesAddedForeground); }
    /* Invisibile finché non arriva il primo stato: niente scheletro vuoto, la pagina compare intera. */
    body:not([data-drawn]) { visibility: hidden; }
  </style>
</head>
<body>
  <main>
    <p id="message" hidden></p>
    <section id="languages" hidden>
      <h2>Languages <vscode-icon id="jump" name="zap" size="12" hidden></vscode-icon></h2>
      <vscode-tree id="langs" hide-arrows></vscode-tree>
      <p id="langNote" class="nota" hidden></p>
    </section>
    <section id="details" hidden>
      <h2>Details</h2>
      <vscode-tree id="tree" indent-guides="onHover"></vscode-tree>
    </section>
  </main>
  <footer class="actions">
    <div class="bottoni">
      ${bottoni}
    </div>
    <div class="icone">
      ${icone}
    </div>
  </footer>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
