// La sezione facoltativa: una webview che si prende il pannello, all'avvio, dopo un clic su LLM o
// sull'ingranaggio di Project, o per un guasto della libreria. Prende il posto di Results (una
// TreeView non può diventare una webview: sono due sezioni, e la context key OPTIONAL_CONTEXT
// decide quale si vede) e nasconde Project e Selector: le sue scelte qui non servono a niente,
// tranne che sul guasto, dove con più progetti Selector resta per passare a un altro (il suo
// `when` in package.json). La barra dei comandi passa qui, la stessa (commandBar.mjs), con Back.
// Lo sfondo tinto (OPTIONAL_CSS in pageCommon.mjs) dice che è un'altra modalità. Sei modi, `mode`,
// un solo script (dist/optionalWebview.js):
//   - "loading": l'avvio (loading/loadingPage.mjs). Il modo di partenza: finché la prima immagine
//     del pannello non è pronta (Startup) c'è solo questa sezione, che dice cosa si prepara; poi
//     lascia il posto a Results e Project, o al guasto se la prima scansione l'ha trovato (avvio).
//     OPTIONAL_CONTEXT è vera da subito, perché a pannello pronto non si veda passare il resto;
//     prima dell'attivazione la mostra `!vitetranslate.ready`;
//   - "help": su un progetto senza `llm`, come configurarlo; testo fisso (help/helpPage.mjs);
//   - "llm": il pannello LLM — dove sta la chiave, se le impostazioni bastano, se il modello
//     risponde, e le azioni --llm-* (llm/llmController.mjs);
//   - "trouble": Help nella variante per chi ha il blocco ma un controllo andato male; la apre il
//     ? del pannello LLM. Non si torna a LLM: Back chiude, come sempre, e non c'è niente da ricordare;
//   - "settings": tutto quello che è impostazione (settings/settingsPage.mjs). Highlight style, gli
//     stili di evidenziazione col loro campione: il clic su uno lo salva
//     (settings/highlightState.mjs); Vite config e Detailed config, due azioni (openPluginConfig,
//     extensionSettings); Local file status, l'albero di vitetranslate, package.json e vite.config
//     (settings/inspectorState.mjs). La apre l'ingranaggio di Project;
//   - "library": la libreria del progetto selezionato manca o non si legge (LIBRARY_PROBLEMS in
//     markedScan.mjs), e Results e Project non avrebbero niente da fare (library/libraryPage.mjs).
//     Non la apre un clic ma la scansione (allarme), senza focus, e se ne va quando una scansione
//     riesce. Back non c'è; quello delle altre pagine, aperte sopra, torna qui. Con Results
//     nascosta nessun disegno riscansiona: lo fa questa sezione (riscansiona), quando un
//     package.json o un vite.config cambiano, o con Check again.
// LLM, Settings, il guasto e l'avvio chiedono lo stato al caricamento (`ready`), poi push() lo
// rimanda solo quando cambia. show() la mette e la porta in primo piano, setMode() cambia pagina
// senza spostare il focus, close() (Back) rimette Results e Project, o il guasto se c'è, o l'avvio
// se non è finito (una pagina aperta dalla palette). Aperta, segue il progetto selezionato: Help o
// LLM secondo il suo vite.config; Settings resta Settings, sul progetto nuovo; trouble resta com'è.
// Chiusa, o sul guasto, guarda se il guasto c'è.
import * as vscode from "vscode";
import { PageView } from "../pageView.mjs";
import { helpHtml } from "./help/helpPage.mjs";
import { llmHtml } from "./llm/llmPage.mjs";
import { LlmController } from "./llm/llmController.mjs";
import { settingsHtml } from "./settings/settingsPage.mjs";
import { inspectorState } from "./settings/inspectorState.mjs";
import { highlightState } from "./settings/highlightState.mjs";
import { libraryHtml, libraryState } from "./library/libraryPage.mjs";
import { loadingHtml } from "./loading/loadingPage.mjs";
import { saveHighlightStyle } from "../../highlight/stylePicker.mjs";
import { HIGHLIGHT_SETTING } from "../../highlight/highlighter.mjs";
import { openFile, openPluginConfig, progressIn } from "../../core/editorUi.mjs";
import { installedVersion } from "../../core/readPackage.mjs";
import { LIBRARY_PROBLEMS } from "../../probes/markedScan.mjs";

export const OPTIONAL_VIEW_ID = "vitetranslate.optional";
// Vera mentre la sezione facoltativa sta al posto di Results e Project (i loro `when` in package.json).
const OPTIONAL_CONTEXT = "vitetranslate.optional";
// Vera mentre mostra il guasto della libreria: la freccia ← del titolo non c'è (menus in package.json).
const LIBRARY_CONTEXT = "vitetranslate.libraryProblem";

const modoDi = (dati) => (dati?.probe?.vitetranslate?.llm ? "llm" : "help");
// La pagina e il nome della sezione, per modo.
const PAGINE = {
  help: helpHtml, trouble: (p) => helpHtml({ ...p, trouble: true }), llm: llmHtml, settings: settingsHtml, library: libraryHtml, loading: loadingHtml,
};
const TITOLI = { help: "Help", trouble: "Help", llm: "LLM", settings: "Settings", library: "Library", loading: "Loading" };
// I modi che chiedono lo stato al caricamento: Help è testo fisso.
const VIVI = new Set(["llm", "settings", "library", "loading"]);
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
   * @param {import("../../core/startup.mjs").Startup} p.startup - l'avvio: la prima pagina
   * @param {string} p.extensionId - per le impostazioni dell'estensione (`@ext:`)
   * @param {string | null} [p.extensionVersion] - la versione dell'estensione, in VERSION (Settings)
   * @param {boolean} [p.preview] - l'estensione è in preview: la pagina del guasto chiede `next`
   * @param {(riga: string) => void} p.log
   * @param {() => void} [p.onVisible]
   * @param {() => void} [p.onOpen]
   */
  constructor({ extensionUri, projects, results, cli, highlighter, startup, extensionId, extensionVersion = null, preview = false, log, onVisible, onOpen }) {
    super({ extensionUri, name: "Optional", script: "optionalWebview.js", log, onVisible, onOpen });
    this.projects = projects;
    this.results = results;
    this.startup = startup;
    this.extensionVersion = extensionVersion;
    this.preview = preview;
    this.highlighter = highlighter;
    // null: chiusa. Si parte dall'avvio, al posto di tutto.
    this.mode = startup.starting ? "loading" : null;
    if (this.mode) vscode.commands.executeCommand("setContext", OPTIONAL_CONTEXT, true);
    // L'uscita dall'avvio in corso: la aspetta `preparato` (extension.mjs), quindi i test.
    this.avviata = Promise.resolve();
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
      // La pagina del guasto della libreria: Check again è Refresh (rilegge, e invalidate()
      // riscansiona); l'ingranaggio apre Settings, e il suo Back torna qui.
      refresh: () => vscode.commands.executeCommand("vitetranslate.refresh"),
      settings: () => this.show("settings"),
    };
    this.commands = {
      "vitetranslate.llm": () => this.open(),
      "vitetranslate.settings": () => this.toggle("settings"),
      "vitetranslate.closeOptional": () => this.close(),
    };
    const segui = () => this.follow();
    this.ascolti.push(projects.onDidChange(segui), projects.onDidRead(segui), results.onDidChange(segui));
    this.ascolti.push(startup.onDidChange(() => (this.avviata = this.avvio())));
    // Highlight style segue l'impostazione (cambiata anche da fuori: la palette, settings.json) e il tema.
    const stili = () => this.mode === "settings" && this.push();
    this.ascolti.push(
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration(`vitetranslate.${HIGHLIGHT_SETTING}`) && stili()),
      vscode.window.onDidChangeActiveColorTheme(stili)
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
    if (this.mode === "loading") {
      const tappa = this.startup.starting;
      return tappa && { loading: tappa };
    }
    if (this.mode === "library") {
      const guasto = await this.guasto();
      return guasto && libraryState({ title: this.projects.titleOf(guasto.project), dir: guasto.project.dir, marked: guasto.marked, preview: this.preview });
    }
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
      // VERSION: la libreria dal node_modules, senza aspettare la lettura; il suo IDE_API
      // dall'ultima scansione; la versione dell'estensione.
      cli: scelto ? installedVersion(scelto.dir, "@sepoina/vitetranslate") : null,
      marked: scelto ? this.results.tree.resultOf(scelto.dir) : null,
      extension: this.extensionVersion,
    });
  }

  /** @param {"help" | "trouble" | "llm" | "settings" | "library" | "loading"} mode */
  setMode(mode) {
    if (mode === this.mode) return this.push();
    if ((mode === "library") !== (this.mode === "library")) vscode.commands.executeCommand("setContext", LIBRARY_CONTEXT, mode === "library");
    this.mode = mode;
    this.render();
  }

  /** @param {"help" | "trouble" | "llm" | "settings"} mode */
  async show(mode) {
    this.setMode(mode);
    await vscode.commands.executeCommand("setContext", OPTIONAL_CONTEXT, true);
    return vscode.commands.executeCommand(`${OPTIONAL_VIEW_ID}.focus`);
  }

  // Back. Sul guasto e sull'avvio non c'è dove tornare; da una pagina aperta sopra si torna lì.
  async close() {
    if (!this.mode || this.mode === "library" || this.mode === "loading") return;
    if (this.startup.starting) return this.setMode("loading");
    if (await this.guasto()) return this.mostraGuasto();
    return this.chiudi();
  }

  // L'avvio: una tappa nuova si mostra; a pannello pronto, il guasto se la prima scansione l'ha
  // trovato, altrimenti Results e Project. Una pagina aperta sopra l'avvio resta: il suo Back sa
  // dove tornare.
  async avvio() {
    if (this.mode !== "loading") return;
    if (this.startup.starting) return this.push();
    const guasto = await this.guasto();
    if (this.mode !== "loading") return;
    return guasto ? this.setMode("library") : this.chiudi();
  }

  // Results e Project di nuovo al loro posto.
  chiudi() {
    if (this.mode === "library") vscode.commands.executeCommand("setContext", LIBRARY_CONTEXT, false);
    this.mode = null;
    return vscode.commands.executeCommand("setContext", OPTIONAL_CONTEXT, false);
  }

  /**
   * Il guasto della libreria del progetto selezionato, dall'ultima scansione arrivata (anche se
   * superata: finché non ne arriva una nuova, è quello che si sa): { project, marked }, o null.
   */
  async guasto() {
    const progetto = await this.projects.selectedProject();
    const marked = progetto ? this.results.tree.resultOf(progetto.dir) : null;
    return marked && LIBRARY_PROBLEMS.has(marked.code) ? { project: progetto, marked } : null;
  }

  // Al posto di Results e Project c'è il guasto, se c'è; se non c'è più, tornano loro. Lo chiede
  // una scansione arrivata o un'altra selezione, non un clic: niente focus.
  async allarme() {
    const guasto = await this.guasto();
    if (guasto) return this.mode === "library" ? this.push() : this.mostraGuasto();
    if (this.mode === "library") return this.chiudi();
  }

  async mostraGuasto() {
    this.setMode("library");
    await vscode.commands.executeCommand("setContext", OPTIONAL_CONTEXT, true);
    // Il risultato può essere di prima di un cambiamento (aperto sopra c'era Settings): lo si rifà.
    return this.riscansiona();
  }

  // Con Results nascosta nessun disegno fa partire la scansione: la si chiede da qui. Arrivata,
  // results.onDidChange porta a follow(), e allarme() decide.
  async riscansiona() {
    const progetto = await this.projects.selectedProject();
    if (progetto) await this.results.tree.current(progetto);
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
  // Chiusa, o sul guasto, guarda se il guasto c'è. Sull'avvio decide avvio(), alla fine.
  async follow() {
    if (this.mode === "loading") return;
    if (!this.mode || this.mode === "library") return this.allarme();
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
    // Un package.json cambiato (la libreria aggiornata?), un vite.config, Check again.
    if (this.mode === "library") this.riscansiona();
  }

  dispose() {
    super.dispose();
    this.llm.dispose();
  }
}
