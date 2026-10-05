// La sezione Project: in alto, e scorrono, i file di lingua (Translations); in fondo, ferma, la barra
// dei comandi: i bottoni Sync e LLM e le icone GitHub, Settings (l'ingranaggio: highlight,
// vite.config, impostazioni dell'estensione, sintesi di vitetranslate, package.json e vite.config,
// nella sezione facoltativa), Refresh. Stato in projectState.mjs, pagina in projectPage.mjs e projectWebview.mjs.
//
// Finché la lettura del vite.config non è arrivata la chiede (Projects.data la fa una volta sola),
// con la barra di avanzamento della sezione; all'arrivo onDidRead ridisegna. I file di lingua si
// colorano coi conteggi dell'ultima scansione di Results, e si rileggono dalla cartella a ogni
// stato (tablesRow): push() manda solo se qualcosa è cambiato.
import * as vscode from "vscode";
import path from "node:path";
import { PageView } from "../pageView.mjs";
import { projectHtml } from "./projectPage.mjs";
import { projectState, keyPosition } from "./projectState.mjs";
import { openFile, progressIn, readText } from "../../core/editorUi.mjs";
import { PROJECT_URL } from "../commandBar/commandBar.mjs";

export const PROJECT_VIEW_ID = "vitetranslate.project";

// Le tappe di una pagina nuova, nel canale dell'avvio.
const TAPPE = { page: "Project page created", script: "Project script loaded", drawn: "Project drawn" };

export class ProjectView extends PageView {
  /**
   * @param {object} p
   * @param {vscode.Uri} p.extensionUri
   * @param {import("../../core/projects.mjs").Projects} p.projects
   * @param {import("../../views/results/resultsView.mjs").ResultsView} p.results
   * @param {import("../../core/cliTasks.mjs").CliTasks} p.cli
   * @param {import("../../core/startup.mjs").Startup} p.startup
   * @param {(riga: string) => void} p.log
   * @param {() => void} [p.onVisible]
   * @param {() => void} [p.onOpen]
   */
  constructor({ extensionUri, projects, results, cli, startup, log, onVisible, onOpen }) {
    super({ extensionUri, name: "Project", html: projectHtml, script: "projectWebview.js", log, onVisible, onOpen, onStage: (fase) => startup.stage(TAPPE[fase]) });
    Object.assign(this, { projects, results, cli });
    this.letture = new WeakSet(); // le letture già date alla barra di avanzamento
    this.barra = progressIn(PROJECT_VIEW_ID);
    const scelto = (f) => async () => {
      const progetto = await projects.selectedOrAsk();
      return progetto && f(progetto);
    };
    // I bottoni passano dai comandi registrati: Sync, LLM, Refresh e Settings li ha anche la palette.
    this.actions = {
      sync: () => vscode.commands.executeCommand("vitetranslate.sync"),
      llm: () => vscode.commands.executeCommand("vitetranslate.llm"),
      refresh: () => vscode.commands.executeCommand("vitetranslate.refresh"),
      openLanguage: (file) => this.openLanguage(file),
      // L'ingranaggio: Settings, nella sezione facoltativa (le impostazioni di VS Code sono lì, sulla
      // chiave inglese).
      settings: () => vscode.commands.executeCommand("vitetranslate.settings"),
      // GitHub: il progetto, nel browser.
      github: () => vscode.env.openExternal(vscode.Uri.parse(PROJECT_URL)),
    };
    this.commands = { "vitetranslate.sync": scelto((progetto) => cli.run(progetto, [], "sync")) };
    // Segue l'elenco, la selezione, le letture, i risultati; il cuore accanto a Translations
    // segue la voce scelta in Results; Translations i file di lingua creati o cancellati.
    const push = () => this.push();
    this.ascolti.push(
      projects.onDidChange(push),
      projects.onDidRead(push),
      results.onDidChange(push),
      results.onDidChangeSelectedKey(push),
      results.onDidChangeLanguageFiles(push)
    );
  }

  async state() {
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
    return projectState({
      hasProjects: progetti.length > 0,
      project: scelto ?? null,
      title: scelto ? this.projects.titleOf(scelto) : null,
      dati,
      stats: scelto ? this.results.tree.resultOf(scelto.dir)?.languages?.stats ?? null : null,
      llm: !!dati?.probe?.vitetranslate?.llm,
      jumpKey: (await this.results.selectedKey())?.id ?? null,
    });
  }

  describe(stato) {
    return stato.title ?? undefined;
  }

  /** Quanto letto non vale più: la pagina si svuota subito ("Reading vite.config…"). */
  invalidate() {
    this.push();
  }

  // Un file di lingua: sulla riga della voce selezionata in Results (selectedKey), se il file ce
  // l'ha; il cursore all'inizio del valore, pronto per la traduzione. Senza voce, o con una chiave
  // che il file non ha ancora (la sync non è passata), il file in cima.
  async openLanguage(file) {
    if (!file) return;
    const chiave = await this.results.selectedKey();
    if (chiave) {
      const testo = readText(file);
      const dove = testo === null ? null : keyPosition(testo, chiave.id);
      if (dove) return openFile(file, dove);
      vscode.window.setStatusBarMessage(`viteTranslate: ${chiave.id} is not in ${path.basename(file)} yet. Run the sync.`, 5000);
    }
    return openFile(file);
  }
}
