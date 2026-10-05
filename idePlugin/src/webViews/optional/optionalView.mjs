// La sezione facoltativa: una webview che si prende il pannello, solo dopo un clic su LLM o
// sull'ingranaggio di Project. Prende il posto di Results (una TreeView non può diventare una
// webview: sono due sezioni, e la context key OPTIONAL_CONTEXT decide quale si vede) e nasconde
// Project: la barra dei comandi passa qui, la stessa (commandBar.mjs), con Back. Lo sfondo tinto
// (OPTIONAL_CSS in pageCommon.mjs) dice che è un'altra modalità. Quattro modi, `mode`, un solo
// script (dist/optionalWebview.js):
//   - "help": su un progetto senza `llm`, come configurarlo; testo fisso (help/helpPage.mjs);
//   - "llm": il pannello LLM — dove sta la chiave, se le impostazioni bastano, se il modello
//     risponde, e le azioni --llm-* (llm/llmController.mjs);
//   - "trouble": Help nella variante per chi ha il blocco ma un controllo andato male; la apre il
//     ? del pannello LLM. Non si torna a LLM: Back chiude, come sempre, e non c'è niente da ricordare;
//   - "settings": tutto quello che è impostazione (settings/settingsPage.mjs). Highlight style, gli
//     stili di evidenziazione col loro campione: il clic su uno lo salva
//     (settings/highlightState.mjs); Vite config e Detailed config, due azioni (openPluginConfig,
//     extensionSettings); Local file status, l'albero di vitetranslate, package.json e vite.config
//     (settings/inspectorState.mjs). La apre l'ingranaggio di Project.
// LLM e Settings chiedono lo stato al caricamento (`ready`), poi push() lo rimanda solo quando
// cambia. show() la mette e la porta in primo piano, setMode() cambia pagina senza spostare il
// focus, close() (Back) rimette Results e Project. Aperta, segue il progetto selezionato: Help o
// LLM secondo il suo vite.config; Settings resta Settings, sul progetto nuovo; trouble resta com'è.
import * as vscode from "vscode";
import { PageView } from "../pageView.mjs";
import { helpHtml } from "./help/helpPage.mjs";
import { llmHtml } from "./llm/llmPage.mjs";
import { LlmController } from "./llm/llmController.mjs";
import { settingsHtml } from "./settings/settingsPage.mjs";
import { inspectorState } from "./settings/inspectorState.mjs";
import { highlightState } from "./settings/highlightState.mjs";
import { saveHighlightStyle } from "../../highlight/stylePicker.mjs";
import { HIGHLIGHT_SETTING } from "../../highlight/highlighter.mjs";
import { openFile, openPluginConfig, progressIn } from "../../core/editorUi.mjs";

export const OPTIONAL_VIEW_ID = "vitetranslate.optional";
// Vera mentre la sezione facoltativa sta al posto di Results e Project (i loro `when` in package.json).
const OPTIONAL_CONTEXT = "vitetranslate.optional";

const modoDi = (dati) => (dati?.probe?.vitetranslate?.llm ? "llm" : "help");
// La pagina e il nome della sezione, per modo.
const PAGINE = { help: helpHtml, trouble: (p) => helpHtml({ ...p, trouble: true }), llm: llmHtml, settings: settingsHtml };
const TITOLI = { help: "Help", trouble: "Help", llm: "LLM", settings: "Settings" };
// I modi che chiedono lo stato al caricamento: Help è testo fisso.
const VIVI = new Set(["llm", "settings"]);
// Il tipo di tema, come lo dice weakOn in highlightStyles.mjs (ColorThemeKind: 1 Light, 2 Dark,
// 3 HighContrast, 4 HighContrastLight).
const temaDi = (kind) => ({ 1: "light", 2: "dark", 3: "dark", 4: "light" })[kind] ?? null;

export class OptionalView extends PageView {
  /**
   * @param {object} p
   * @param {vscode.Uri} p.extensionUri
   * @param {import("../../core/projects.mjs").Projects} p.projects
   * @param {import("../../views/results/resultsView.mjs").ResultsView} p.results
   * @param {import("../../core/cliTasks.mjs").CliTasks} p.cli
   * @param {import("../../highlight/highlighter.mjs").Highlighter} p.highlighter
   * @param {string} p.extensionId - per le impostazioni dell'estensione (`@ext:`)
   * @param {(riga: string) => void} p.log
   * @param {() => void} [p.onOpen]
   */
  constructor({ extensionUri, projects, results, cli, highlighter, extensionId, log, onOpen }) {
    super({ extensionUri, name: "Optional", script: "optionalWebview.js", log, onOpen });
    this.projects = projects;
    this.highlighter = highlighter;
    this.mode = null; // null: chiusa
    this.letture = new WeakSet(); // le letture già date alla barra di avanzamento (Settings)
    this.barra = progressIn(OPTIONAL_VIEW_ID);
    this.llm = new LlmController({ projects, results, cli, log, onUpdate: () => this.push() });
    this.actions = {
      close: () => this.close(),
      openPluginConfig: async () => {
        const progetto = await projects.selectedOrAsk();
        return progetto && openPluginConfig(progetto);
      },
      action: (id) => this.llm.action(id),
      // Il ? del pannello LLM, con un controllo andato male: Help, nella variante "qualcosa non va".
      help: () => this.setMode("trouble"),
      // Una riga dell'albero di Settings col suo file: package.json, vite.config.
      open: (file) => file && openFile(file),
      recheck: async () => {
        await this.llm.recheck();
        return this.push();
      },
      // Uno stile di Highlight style: diventa l'impostazione; la pagina si aggiorna da
      // onDidChangeConfiguration.
      style: (id) => id && saveHighlightStyle(id),
      // Detailed config, in Settings: le impostazioni di VS Code filtrate su questa estensione.
      extensionSettings: () => vscode.commands.executeCommand("workbench.action.openSettings", `@ext:${extensionId}`),
    };
    this.commands = {
      "vitetranslate.llm": () => this.open(),
      "vitetranslate.settings": () => this.toggle("settings"),
      "vitetranslate.closeOptional": () => this.close(),
    };
    const segui = () => this.follow();
    this.ascolti.push(projects.onDidChange(segui), projects.onDidRead(segui), results.onDidChange(segui));
    // Highlight style segue l'impostazione (cambiata anche da fuori: la palette, settings.json) e il tema.
    const stili = () => this.mode === "settings" && this.push();
    this.ascolti.push(
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration(`vitetranslate.${HIGHLIGHT_SETTING}`) && stili()),
      ...[vscode.window.onDidChangeActiveColorTheme?.(stili)].filter(Boolean)
    );
  }

  // Help è testo fisso: non aspetta stati.
  get live() {
    return VIVI.has(this.mode) && !!this.view;
  }

  page() {
    return PAGINE[this.mode] ?? helpHtml;
  }

  // La pagina del modo corrente, e il nome della sezione: "Help", "LLM" o "Settings".
  render() {
    if (!this.view) return;
    this.view.title = TITOLI[this.mode] ?? TITOLI.help;
    this.view.description = undefined;
    super.render();
  }

  async state() {
    if (this.mode === "settings") {
      const highlight = highlightState({ current: this.highlighter.configured, theme: temaDi(vscode.window.activeColorTheme?.kind) });
      return { ...(await this.inspectorState()), highlight };
    }
    const progetto = await this.projects.selectedProject();
    const opzioni = progetto ? this.projects.ready(progetto.dir)?.probe?.vitetranslate : null;
    return opzioni?.llm ? this.llm.state(progetto, opzioni) : null;
  }

  describe(stato) {
    return stato.title ?? undefined;
  }

  // Come Project: finché la lettura del vite.config non è arrivata la chiede (Projects.data la fa
  // una volta sola), con la barra di avanzamento della sezione; all'arrivo onDidRead ridisegna.
  async inspectorState() {
    const progetti = await this.projects.listOrEmpty();
    const scelto = await this.projects.selectedProject();
    const dati = scelto ? this.projects.ready(scelto.dir) : undefined;
    if (scelto && !dati) {
      const lettura = this.projects.data(scelto);
      if (!this.letture.has(lettura)) {
        this.letture.add(lettura);
        this.barra(lettura);
      }
    }
    return inspectorState({
      hasProjects: progetti.length > 0,
      project: scelto ?? null,
      title: scelto ? this.projects.titleOf(scelto) : null,
      dati,
    });
  }

  /** @param {"help" | "trouble" | "llm" | "settings"} mode */
  setMode(mode) {
    if (mode === this.mode) return this.push();
    this.mode = mode;
    this.render();
  }

  /** @param {"help" | "trouble" | "llm" | "settings"} mode */
  async show(mode) {
    this.setMode(mode);
    await vscode.commands.executeCommand("setContext", OPTIONAL_CONTEXT, true);
    return vscode.commands.executeCommand(`${OPTIONAL_VIEW_ID}.focus`);
  }

  async close() {
    if (!this.mode) return;
    this.mode = null;
    return vscode.commands.executeCommand("setContext", OPTIONAL_CONTEXT, false);
  }

  // Il bottone LLM: col blocco `llm` il pannello LLM, senza Help, che spiega come aggiungerlo. Si
  // aspetta la lettura di vite.config, se non è ancora arrivata.
  async open() {
    const progetto = await this.projects.selectedOrAsk();
    if (!progetto) return;
    return this.show(modoDi(await this.projects.data(progetto)));
  }

  // L'ingranaggio di Project apre Settings. Un secondo clic (o la palette) con la pagina già aperta
  // la chiude.
  /** @param {"settings"} mode */
  toggle(mode) {
    return this.mode === mode ? this.close() : this.show(mode);
  }

  // Aperta, segue il progetto selezionato, con la lettura che c'è già. Settings resta Settings.
  async follow() {
    if (!this.mode) return;
    if (this.mode === "settings") return this.push();
    if (this.mode === "trouble") return;
    const progetto = await this.projects.selectedProject();
    const dati = progetto ? this.projects.ready(progetto.dir) : null;
    if (dati) this.setMode(modoDi(dati));
  }

  /**
   * Il vite.config di `dir` (o di tutti) non vale più: i controlli LLM si rifanno, l'albero di
   * Settings si svuota subito ("Reading vite.config…").
   */
  invalidate(dir) {
    this.llm.forget(dir);
    if (this.mode === "settings") this.push();
  }

  dispose() {
    super.dispose();
    this.llm.dispose();
  }
}
