// La pagina Settings, nella sezione facoltativa (al posto di Results e Project): tutto quello che è
// impostazione, in un posto. La apre l'ingranaggio di Project. In testa il logo intero (logo.mjs)
// e, a destra, un riquadro con due versioni, ognuna con la sua icona e il suo fumetto: quella del CLI
// installato nel progetto selezionato (dallo stato, versionsState in inspectorState.mjs; in giallo
// se è sotto la minima o manca) e la minima che l'estensione chiede (LIB_MIN, fissa). Sotto, e scorre,
// la sezione CONFIG: le voci nello stile delle azioni di LLM (icona, nome, sotto il dettaglio). Due sono
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
// In fondo, ferma, la barra dei comandi: Back e l'icona della pagina (commandBar.mjs). Qui lo
// scheletro: lo riempie optionalWebview.mjs dallo stato. Nessun import di `vscode`.
import { pageHead, COLUMN_CSS, OPTIONAL_CSS, ACTION_CSS, actionRowHtml } from "../../pageCommon.mjs";
import { commandBarHtml, COMMAND_BAR_CSS } from "../../commandBar/commandBar.mjs";
import { TOOLTIP_CSS } from "../../tooltip/tooltip.mjs";
import { accordionHtml, ACCORDION_CSS } from "../../accordion/accordion.mjs";
import { LOGO_SVG } from "./logo.mjs";
import { LIB_MIN } from "../../../probes/markedScan.mjs";


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
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${OPTIONAL_CSS}${ACTION_CSS}${ACCORDION_CSS}${COMMAND_BAR_CSS}${TOOLTIP_CSS}
    main { padding-top: 8px; }
    /* La testata: il logo, che si stringe se la sezione è stretta, e il riquadro delle versioni a
       destra. La scritta ha il colore del testo, il "%" l'accento della pagina (i titoli). */
    .testata { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 4px 0 10px; }
    .logo { display: block; flex: 0 1 170px; min-width: 70px; height: auto; }
    .logo-testo { fill: var(--vscode-foreground); }
    .logo-pct { fill: var(--vscode-chat-linesAddedForeground); }
    .versioni {
      flex: none; display: grid; grid-template-columns: auto auto; align-items: center; column-gap: 5px; row-gap: 1px;
      padding: 3px 7px; border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); border-radius: 4px;
      font-family: var(--vscode-editor-font-family); font-size: 11px; color: var(--vscode-descriptionForeground);
    }
    .versioni vscode-icon { display: block; }
    #cliVersion { color: var(--vscode-foreground); }
    .versioni[data-old] #cliVersion { color: var(--vscode-problemsWarningIcon-foreground); }
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
      <div class="versioni" id="versions">
        <vscode-icon id="cliIcon" name="terminal-bash" title="The vitetranslate CLI of the selected project."></vscode-icon><span id="cliVersion">—</span>
        <vscode-icon name="git-branch-conflicts" title="The oldest vitetranslate this extension fully works with.\nOlder ones still work, with less in Results."></vscode-icon><span>${LIB_MIN}</span>
      </div>
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
  </main>
  ${commandBarHtml({ back: { icon: "settings-gear", name: "Settings" } })}
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
