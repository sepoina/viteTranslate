// La sezione facoltativa: una webview che si prende il pannello, solo dopo un clic su LLM o sulla (i)
// di Project. Prende il posto di Results (una TreeView non può diventare una webview: sono due
// sezioni, e la context key OPTIONAL_CONTEXT decide quale si vede) e nasconde Project: la sua barra,
// con Back, è l'unica. Lo sfondo tinto (OPTIONAL_CSS in pageCommon.mjs) dice che è un'altra
// modalità. Tre pagine, `mode`, un solo script (dist/optionalWebview.js):
//   - "help": su un progetto senza `llm`, come configurarlo; testo fisso (help/helpPage.mjs);
//   - "llm": il pannello LLM — dove sta la chiave, se le impostazioni bastano, se il modello
//     risponde, e le azioni --llm-* (llm/llmController.mjs);
//   - "inspector": la sintesi di vitetranslate, package.json e vite.config, in un albero
//     (inspector/inspectorState.mjs). La apre l'icona (i) di Project.
// LLM e Inspector chiedono lo stato al caricamento (`ready`), poi push() lo rimanda solo quando
// cambia. show() la mette e la porta in primo piano, setMode() cambia pagina senza spostare il
// focus, close() (Back) rimette Results e Project. Aperta, segue il progetto selezionato: Help o LLM secondo il suo
// vite.config; Inspector resta Inspector, sul progetto nuovo.
import * as vscode from "vscode";
import { PageView } from "../pageView.mjs";
import { helpHtml } from "./help/helpPage.mjs";
import { llmHtml } from "./llm/llmPage.mjs";
import { LlmController } from "./llm/llmController.mjs";
import { inspectorHtml } from "./inspector/inspectorPage.mjs";
import { inspectorState } from "./inspector/inspectorState.mjs";
import { openFile, openPluginConfig, progressIn } from "../../core/editorUi.mjs";

export const OPTIONAL_VIEW_ID = "vitetranslate.optional";
// Vera mentre la sezione facoltativa sta al posto di Results e Project (i loro `when` in package.json).
const OPTIONAL_CONTEXT = "vitetranslate.optional";

const modoDi = (dati) => (dati?.probe?.vitetranslate?.llm ? "llm" : "help");
// La pagina e il nome della sezione, per modo.
const PAGINE = { help: helpHtml, llm: llmHtml, inspector: inspectorHtml };
const TITOLI = { help: "Help", llm: "LLM", inspector: "Inspector" };

export class OptionalView extends PageView {
  /**
   * @param {object} p
   * @param {vscode.Uri} p.extensionUri
   * @param {import("../../core/projects.mjs").Projects} p.projects
   * @param {import("../../views/results/resultsView.mjs").ResultsView} p.results
   * @param {import("../../core/cliTasks.mjs").CliTasks} p.cli
   * @param {(riga: string) => void} p.log
   */
  constructor({ extensionUri, projects, results, cli, log }) {
    super({ extensionUri, name: "Optional", script: "optionalWebview.js", log });
    this.projects = projects;
    this.mode = null; // null: chiusa
    this.letture = new WeakSet(); // le letture già date alla barra di avanzamento (Inspector)
    this.barra = progressIn(OPTIONAL_VIEW_ID);
    this.llm = new LlmController({ projects, results, cli, log, onUpdate: () => this.push() });
    this.actions = {
      close: () => this.close(),
      openPluginConfig: async () => {
        const progetto = await projects.selectedOrAsk();
        return progetto && openPluginConfig(progetto);
      },
      action: (id) => this.llm.action(id),
      // Una riga di Inspector col suo file: package.json, vite.config.
      open: (file) => file && openFile(file),
      recheck: async () => {
        await this.llm.recheck();
        return this.push();
      },
    };
    this.commands = {
      "vitetranslate.llm": () => this.open(),
      "vitetranslate.inspector": () => this.toggleInspector(),
      "vitetranslate.closeOptional": () => this.close(),
    };
    const segui = () => this.follow();
    this.ascolti.push(projects.onDidChange(segui), projects.onDidRead(segui), results.onDidChange(segui));
  }

  // Help è testo fisso: non aspetta stati.
  get live() {
    return (this.mode === "llm" || this.mode === "inspector") && !!this.view;
  }

  page() {
    return PAGINE[this.mode] ?? helpHtml;
  }

  // La pagina del modo corrente, e il nome della sezione: "Help", "LLM" o "Inspector".
  render() {
    if (!this.view) return;
    this.view.title = TITOLI[this.mode] ?? TITOLI.help;
    this.view.description = undefined;
    super.render();
  }

  async state() {
    if (this.mode === "inspector") return this.inspectorState();
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

  /** @param {"help" | "llm" | "inspector"} mode */
  setMode(mode) {
    if (mode === this.mode) return this.push();
    this.mode = mode;
    this.render();
  }

  /** @param {"help" | "llm" | "inspector"} mode */
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

  // L'icona (i) di Project: apre Inspector. Dalla palette, con Inspector già aperto, lo chiude.
  toggleInspector() {
    return this.mode === "inspector" ? this.close() : this.show("inspector");
  }

  // Aperta, segue il progetto selezionato, con la lettura che c'è già. Inspector resta Inspector.
  async follow() {
    if (!this.mode) return;
    if (this.mode === "inspector") return this.push();
    const progetto = await this.projects.selectedProject();
    const dati = progetto ? this.projects.ready(progetto.dir) : null;
    if (dati) this.setMode(modoDi(dati));
  }

  /**
   * Il vite.config di `dir` (o di tutti) non vale più: i controlli LLM si rifanno, Inspector si
   * svuota subito ("Reading vite.config…").
   */
  invalidate(dir) {
    this.llm.forget(dir);
    if (this.mode === "inspector") this.push();
  }

  dispose() {
    super.dispose();
    this.llm.dispose();
  }
}
