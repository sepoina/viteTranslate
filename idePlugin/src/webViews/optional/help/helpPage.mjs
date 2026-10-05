// La pagina Help della sezione facoltativa (una webview al posto di Results e Project): come si
// accende LLM. Compare quando si clicca LLM su un progetto senza blocco `llm` (OptionalView, la
// context key `vitetranslate.optional`), e se ne va con Back o con la freccia nel titolo. Nessun
// import di `vscode`, come selectorPage.mjs: stessa CSP, stessi codicons; lo script è quello della
// sezione (dist/optionalWebview.js), che qui rimanda solo i clic dei bottoni. Nella barra dei
// comandi, dopo Back, "Open the options".
//
// La variante `trouble`: il ? del pannello LLM, quando un controllo è andato male. Il blocco c'è
// già: stessi passi 1 e 2 (com'è fatta la connessione, dove va la chiave), ma titolo, introduzione
// e passo 3 per chi deve trovare cosa non va; niente nota su Restricted Mode.
import { pageHead, COLUMN_CSS, OPTIONAL_CSS } from "../../pageCommon.mjs";
import { commandBarHtml, COMMAND_BAR_CSS } from "../../commandBar/commandBar.mjs";
import { TOOLTIP_CSS } from "../../tooltip/tooltip.mjs";

/** La documentazione completa di `llm`, aperta nel browser dal link in fondo. */
export const LLM_DOC_URL = "https://github.com/sepoina/viteTranslate/blob/main/doc/llm.md";

// I testi che cambiano tra le due varianti.
const TESTI = {
  off: {
    title: "LLM translation is off",
    intro: `The <b>LLM</b> button wakes up when <code>vitetranslate()</code> in vite.config gets an <code>llm</code> block. Three steps, no new dependency.`,
    last: `Save vite.config: <b>LLM</b> gets its <span class="codicon codicon-chevron-right"></span> and a menu. Start with <i>Ping</i>, then <i>Estimate the cost</i>.`,
    note: `<p class="note">Already there? In Restricted Mode vite.config is not run, so the block can't be seen: trust the workspace.</p>`,
  },
  trouble: {
    title: "LLM check failed? Go through the setup",
    intro: `The <code>llm</code> block is there, but something doesn't add up. Hover the failed line in the LLM panel for the reason, then hold your setup against these steps.`,
    last: `Fixed it? Go <b>Back</b>, open <b>LLM</b> <span class="codicon codicon-chevron-right"></span> again and hit <i>Check again</i>.`,
    note: "",
  },
};

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @param {boolean} [p.trouble] - aperta dal ? del pannello LLM: il blocco c'è, un controllo no
 * @returns {string}
 */
export function helpHtml({ scriptUri, codiconsUri, cspSource, nonce, trouble = false }) {
  const t = TESTI[trouble ? "trouble" : "off"];
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${OPTIONAL_CSS}${COMMAND_BAR_CSS}${TOOLTIP_CSS}
    p, ol { margin: 6px 0; line-height: 1.45; }
    ol { padding-left: 18px; }
    li { margin-bottom: 8px; }
    code { font-family: var(--vscode-editor-font-family); font-size: 0.95em; }
    pre {
      margin: 6px 0; padding: 6px 8px; overflow-x: auto; border-radius: 3px;
      background: var(--vscode-textCodeBlock-background);
    }
    .note { color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <main>
  <h2>${t.title}</h2>
  <p>${t.intro}</p>
  <ol>
    <li>Point it at any OpenAI-compatible model:
<pre><code>vitetranslate({
  // …your options
  llm: {
    connection: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.5-flash",
      apiKeyEnv: "VITETRANSLATE_API_KEY",
    },
  },
})</code></pre>
      <span class="note"><code>apiKeyEnv</code> is the <i>name</i> of the variable, never the key.</span>
    </li>
    <li>Give it the key, in <code>.env.local</code>:
<pre><code>VITETRANSLATE_API_KEY=your-key-here</code></pre>
    </li>
    <li>${t.last}</li>
  </ol>
  ${t.note}
  <p><a href="${LLM_DOC_URL}">Every option, costs and budget</a></p>
  </main>
  ${commandBarHtml({
    back: { icon: "question", name: "Help" },
    commands: [{ cmd: "openPluginConfig", label: "Open the options", icon: "zap", title: "Open the vitetranslate options in vite.config" }],
  })}
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
