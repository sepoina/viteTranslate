// La pagina del guasto della libreria, nella sezione facoltativa (al posto di Results e Project): il
// progetto selezionato non ha @sepoina/vitetranslate, ne ha una di prima di `./ide/scan`, o una che
// non si carica (LIBRARY_PROBLEMS in markedScan.mjs). Results non avrebbe niente da mostrare e
// Project lavorerebbe a vuoto: al loro posto, cosa non va e il comando che lo sistema. Non la apre
// un clic ma la scansione (OptionalView, il modo "library"), e se ne va da sola quando la scansione
// dopo riesce. Selector resta solo se c'è un altro progetto da scegliere (vitetranslate.manyProjects,
// nel suo `when`): un altro progetto può stare bene; con uno solo non avrebbe niente da offrire.
//
// Il comando è uno solo, installa o aggiorna: `npm install @sepoina/vitetranslate@<tag>`. Il tag è
// quello che il controllo di rilascio accetta (AGENTS.md, "REGOLE DI RILASCIO"; `check` in
// scripts/code.mjs): `next` finché l'estensione è in preview, poi `latest`.
//
// Nella barra niente Back (non c'è niente a cui tornare): Check again, che rilegge e riscansiona
// come Refresh, e l'ingranaggio di Settings, che mostra le versioni. Qui lo scheletro e lo stato
// (libraryState); la pagina la riempie optionalWebview.mjs, con textContent. Nessun import di `vscode`.
import { pageHead, COLUMN_CSS, OPTIONAL_CSS } from "../../pageCommon.mjs";
import { commandBarHtml, COMMAND_BAR_CSS } from "../../commandBar/commandBar.mjs";
import { TOOLTIP_CSS } from "../../tooltip/tooltip.mjs";
import { LIB_MIN } from "../../../probes/markedScan.mjs";

// Per guasto: il titolo e la frase, con il nome del progetto e la versione installata.
const TESTI = {
  NO_LIBRARY: {
    heading: "viteTranslate isn't installed here",
    intro: (nome) => `${nome} uses the plugin, but its node_modules has no @sepoina/vitetranslate. Install it:`,
  },
  TOO_OLD: {
    heading: "This viteTranslate is too old",
    intro: (nome, versione) => `${nome} has @sepoina/vitetranslate ${versione}: this extension needs ${LIB_MIN} or later. Update it:`,
  },
  UNREADABLE_LIBRARY: {
    heading: "This viteTranslate can't be read",
    intro: (nome, versione) => `${nome} has @sepoina/vitetranslate ${versione}, but it won't load: the install looks broken. Reinstall it:`,
  },
};

/**
 * Lo stato della pagina: il nome del progetto per l'intestazione, e i testi.
 * @param {object} p
 * @param {string} p.title - il nome del progetto
 * @param {string} p.dir - la sua cartella: lì va lanciato il comando
 * @param {{ code: string, error?: string, version?: string }} p.marked - la risposta della scansione
 * @param {boolean} [p.preview] - l'estensione è in preview: il comando chiede `next`
 */
export function libraryState({ title, dir, marked, preview = false }) {
  const t = TESTI[marked.code] ?? TESTI.UNREADABLE_LIBRARY;
  return {
    title,
    library: {
      heading: t.heading,
      intro: t.intro(title, marked.version ?? "?"),
      command: `npm install @sepoina/vitetranslate@${preview ? "next" : "latest"}`,
      where: `Run it in ${dir}, then Check again.`,
      detail: marked.error ? String(marked.error).split("\n")[0] : null,
    },
  };
}

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function libraryHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${OPTIONAL_CSS}${COMMAND_BAR_CSS}${TOOLTIP_CSS}
    h2 { display: flex; align-items: center; gap: 6px; }
    h2 vscode-icon { color: var(--vscode-problemsWarningIcon-foreground); }
    p { margin: 6px 0; line-height: 1.45; }
    pre {
      margin: 6px 0; padding: 6px 8px; overflow-x: auto; border-radius: 3px;
      background: var(--vscode-textCodeBlock-background);
    }
    code { font-family: var(--vscode-editor-font-family); font-size: 0.95em; }
    .note { color: var(--vscode-descriptionForeground); overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main id="library">
    <h2><vscode-icon name="warning"></vscode-icon><span id="libHeading"></span></h2>
    <p id="libIntro"></p>
    <pre><code id="libCommand"></code></pre>
    <p id="libWhere" class="note"></p>
    <p id="libDetail" class="note" hidden></p>
  </main>
  ${commandBarHtml({
    back: { icon: "warning", name: "Library" },
    withBack: false,
    commands: [
      { cmd: "refresh", label: "Check again", icon: "refresh", title: "Read vite.config and scan the source again" },
      { cmd: "settings", label: "Settings", icon: "settings-gear", title: "Settings: the installed version and the one this extension wants", iconOnly: true },
    ],
  })}
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
