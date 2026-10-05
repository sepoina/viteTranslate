// La pagina Help della sezione facoltativa (una webview al posto di Results e Project): come si
// accende LLM. Compare quando si clicca LLM su un progetto senza blocco `llm` (OptionalView, la
// context key `vitetranslate.optional`), e se ne va con Back o con la freccia nel titolo. Nessun
// import di `vscode`, come selectorPage.mjs: stessa CSP, stessi codicons; lo script è quello della
// sezione (dist/optionalWebview.js), che qui rimanda solo i clic dei bottoni.
import { pageHead, COLUMN_CSS, OPTIONAL_CSS, BACK_BUTTON } from "../../pageCommon.mjs";

/** La documentazione completa di `llm`, aperta nel browser dal link in fondo. */
export const LLM_DOC_URL = "https://github.com/sepoina/viteTranslate/blob/main/doc/llm.md";

/**
 * @param {object} p
 * @param {string} p.scriptUri - dist/optionalWebview.js come lo vede la webview
 * @param {string} p.codiconsUri - dist/codicon.css
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 * @returns {string}
 */
export function helpHtml({ scriptUri, codiconsUri, cspSource, nonce }) {
  return `${pageHead({ codiconsUri, cspSource, nonce })}${COLUMN_CSS}${OPTIONAL_CSS}
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
  <h2>LLM translation is off</h2>
  <p>The <b>LLM</b> button wakes up when <code>vitetranslate()</code> in vite.config gets an <code>llm</code> block. Three steps, no new dependency.</p>
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
    <li>Save vite.config: <b>LLM</b> gets its <span class="codicon codicon-chevron-right"></span> and a menu. Start with <i>Ping</i>, then <i>Estimate the cost</i>.</li>
  </ol>
  <p class="note">Already there? In Restricted Mode vite.config is not run, so the block can't be seen: trust the workspace.</p>
  <p><a href="${LLM_DOC_URL}">Every option, costs and budget</a></p>
  </main>
  <footer>
    ${BACK_BUTTON}
    <div class="destra">
      <vscode-button data-cmd="openPluginConfig" icon="wrench" title="Open the vitetranslate options in vite.config">Open the options</vscode-button>
    </div>
  </footer>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
