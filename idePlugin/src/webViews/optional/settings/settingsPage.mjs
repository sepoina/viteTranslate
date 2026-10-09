// La pagina Settings, nella sezione facoltativa (al posto di Results e Project): tutto quello che è
// impostazione, in un posto. La apre l'ingranaggio di Project. In testa il logo intero (logo.mjs).
// Sotto, e scorre, la sezione CONFIG: le voci nello stile delle azioni di LLM (icona, nome, sotto il
// dettaglio). Due sono
// accordion (accordion.mjs) che si aprono sotto di sé, uno aperto alla volta, in evidenza; chiusi
// la prima volta, poi come li ha lasciati l'utente (rememberAccordions, in optionalWebview.mjs).
// Due sono azioni, con la stessa faccia (actionRowHtml, in pageCommon.mjs). Nell'ordine:
//   - Highlight style: gli stili di evidenziazione dei metatag, uno per riga — il segno di quello in
//     uso, il nome, la descrizione e sotto un campione: lui solo ha lo sfondo dell'editor, il resto
//     quello della pagina. Il clic (o Invio, Spazio) su una riga lo sceglie: diventa l'impostazione
//     vitetranslate.highlightStyle, e gli editor aperti cambiano subito (highlightState.mjs);
//   - Vite config (azione): vite.config aperto sulle opzioni del plugin;
//   - Detailed config (azione): le impostazioni dell'estensione in VS Code;
//   - Local file status: l'albero di vitetranslate, package.json e vite.config del progetto
//     selezionato (inspectorState.mjs). Un ramo con un file lo apre.
// Poi la sezione VERSION: una riga per versione, icona, nome e il valore a destra, ognuna col suo
// fumetto (VERSION_ROWS). Quelle dell'estensione e del progetto le scrive lo stato (versionsState
// in inspectorState.mjs; in giallo quando mancano o sono troppo vecchie), quelle che l'estensione
// chiede (LIB_MIN, IDE_API_MIN) sono fisse.
// In fondo, ferma, la barra dei comandi: Back e l'icona della pagina (commandBar.mjs). Qui lo
// scheletro: lo riempie optionalWebview.mjs dallo stato. Nessun import di `vscode`.
import { pageHead, COLUMN_CSS, OPTIONAL_CSS, ACTION_CSS, actionRowHtml, escape } from "../../pageCommon.mjs";
import { commandBarHtml, COMMAND_BAR_CSS } from "../../commandBar/commandBar.mjs";
import { TOOLTIP_CSS } from "../../tooltip/tooltip.mjs";
import { accordionHtml, ACCORDION_CSS } from "../../accordion/accordion.mjs";
import { LOGO_SVG, LOGO_CSS } from "./logo.mjs";
import { LIB_MIN, IDE_API_MIN } from "../../../probes/markedScan.mjs";

/**
 * Le righe di VERSION, nell'ordine. `value` è l'HTML del valore: uno <span> con `id` lo riempie lo
 * stato. Una riga con `id` prende dallo stato anche il fumetto e il giallo (`data-old`); le altre
 * hanno il loro `tip`, fisso.
 */
export const VERSION_ROWS = [
  { icon: "extensions", title: "VS Code extension", value: `<span id="extensionVersion">—</span>`, tip: "The viteTranslate extension you're running." },
  { id: "libraryRow", icon: "package", title: "Project library", value: `<span id="libraryVersion">—</span>` },
  { icon: "git-branch-conflicts", title: "Min. required by extension", value: LIB_MIN, tip: "The oldest vitetranslate this extension works with." },
  { id: "ideRow", icon: "plug", title: "IDE API present/required", value: `<span id="ideVersion">—</span>/${IDE_API_MIN}` },
];

const versionRowHtml = ({ id, icon, title, value, tip }) =>
  `<div class="versione ciro"${id ? ` id="${id}"` : ""}${tip ? ` title="${escape(tip)}"` : ""}><vscode-icon name="${icon}"></vscode-icon><span>${escape(title)}</span><span class="valore">${value}</span></div>`;

/**
 * Le voci di CONFIG, nell'ordine. Con `id` e `group` sono accordion (uno aperto alla volta), con
 * `cmd` azioni: il clic manda il comando (OptionalView.actions).
 */
export const SECTIONS = {
  highlight: {
    id: "highlight", group: "config", title: "Highlight style", icon: "symbol-color",
    detail: "How marked strings stand out in the editor. Pick one: open editors switch at once.",
  },
  vite: {
    cmd: "openPluginConfig", title: "Vite config", icon: "zap",
    detail: "Open vite.config right on the vitetranslate({…}) options.",
  },
  detailed: {
    cmd: "extensionSettings", title: "Detailed config", icon: "wrench",
    detail: "Every viteTranslate setting in VS Code's Settings editor.",
  },
  status: {
    id: "status", group: "config", title: "Local file status", icon: "file-code",
    detail: "What the selected project's files say: the plugin options as the plugin resolved them, the dependencies and scripts in package.json, the plugins and server in vite.config.",
  },
};

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function settingsHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${OPTIONAL_CSS}${ACTION_CSS}${ACCORDION_CSS}${COMMAND_BAR_CSS}${TOOLTIP_CSS}${LOGO_CSS}
    main { padding-top: 8px; }
    /* La testata: il logo, che si stringe se la sezione è stretta. Sotto, l'aria la dà h2
       (OPTIONAL_CSS). */
    .testata { margin: 4px 0 0; }
    .testata .logo { width: min(170px, 100%); }
    /* VERSION: icona, nome e, a destra, il valore; in giallo quando manca o è troppo vecchio. */
    .versione { display: grid; grid-template-columns: 16px 1fr auto; column-gap: 6px; align-items: center; padding: 2px 6px 2px 9px; }
    .versione + .versione { margin-top: 2px; }
    .versione .valore { font-family: var(--vscode-editor-font-family); color: var(--vscode-descriptionForeground); }
    .versione[data-old] .valore { color: var(--vscode-problemsWarningIcon-foreground); }
    #message { margin: 4px 0 8px; color: var(--vscode-descriptionForeground); }
    /* Uno stile: il segno nella prima colonna; nome e descrizione, poi il campione, nella seconda. */
    .stile {
      display: grid; grid-template-columns: 16px 1fr; column-gap: 6px; align-items: center;
      padding: 4px 6px 5px 9px; cursor: pointer;
    }
    .stile + .stile { margin-top: 2px; }
    .stile:hover { background: var(--vscode-list-hoverBackground); }
    .stile:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    .stile[aria-checked="true"] vscode-icon.segno { color: var(--vscode-chat-linesAddedForeground); }
    .stile .desc { margin-left: 6px; color: var(--vscode-descriptionForeground); }
    .stile .debole { margin-left: 4px; color: var(--vscode-problemsWarningIcon-foreground); vertical-align: middle; }
    /* Il campione come nell'editor: il suo font, il suo sfondo; solo lui. */
    .campione {
      grid-column: 2; justify-self: start; margin-top: 3px; padding: 1px 6px; border-radius: 3px;
      font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size);
      background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); white-space: pre;
    }
  </style>
</head>
<body>
  <main>
    <header class="testata">
      ${LOGO_SVG}
    </header>
    <section>
      <h2>Config</h2>
      ${accordionHtml({ ...SECTIONS.highlight, body: `<div id="styles" role="radiogroup" aria-label="Highlight style"></div>` })}
      ${actionRowHtml(SECTIONS.vite)}
      ${actionRowHtml(SECTIONS.detailed)}
      ${accordionHtml({
        ...SECTIONS.status,
        body: `<p id="message" hidden></p>
        <vscode-tree id="tree" indent-guides="onHover" hidden></vscode-tree>`,
      })}
    </section>
    <section id="versions">
      <h2>Version</h2>
      ${VERSION_ROWS.map(versionRowHtml).join("\n      ")}
    </section>
  </main>
  ${commandBarHtml({ back: { icon: "settings-gear", name: "Settings" } })}
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
