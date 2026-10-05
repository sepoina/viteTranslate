// La sezione Selector: Config, l'elenco dei progetti Vite del workspace (solo se più di uno);
// Filter, le scelte del filtro di Results (solo se oltre ad All ce n'è qualcuna); Search. Lo stato
// lo calcola selectorState.mjs, la pagina (selectorPage.mjs, webview.mjs) rimanda i clic. La
// selezione del progetto e il filtro sopravvivono alla chiusura (workspaceState). Durante l'avvio
// mostra solo cosa si sta preparando (Startup.starting).
import * as vscode from "vscode";
import { PageView } from "../pageView.mjs";
import { selectorHtml } from "./selectorPage.mjs";
import { selectorState } from "./selectorState.mjs";

export const SELECTOR_VIEW_ID = "vitetranslate.selector";

function workspaceRoots() {
  return (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === "file").map((f) => f.uri.fsPath);
}

export class SelectorView extends PageView {
  /**
   * @param {object} p
   * @param {vscode.Uri} p.extensionUri
   * @param {import("../../core/projects.mjs").Projects} p.projects
   * @param {import("../../views/results/resultsView.mjs").ResultsView} p.results
   * @param {import("../../core/startup.mjs").Startup} p.startup
   * @param {(riga: string) => void} p.log
   * @param {() => void} [p.onVisible]
   * @param {() => void} [p.onOpen]
   */
  constructor({ extensionUri, projects, results, startup, log, onVisible, onOpen }) {
    super({ extensionUri, name: "Selector", html: selectorHtml, script: "webview.js", log, onVisible, onOpen });
    Object.assign(this, { projects, marked: results.tree, startup });
    this.actions = {
      select: (dir) => projects.select(dir),
      filter: (filtro) => this.marked.setFilter(filtro),
      search: (testo) => this.marked.setSearch(testo),
    };
    // Segue l'elenco, la selezione, le letture, i risultati, il filtro e l'avvio.
    const push = () => this.push();
    this.ascolti.push(projects.onDidChange(push), projects.onDidRead(push), results.onDidChange(push), startup.onDidChange(push));
  }

  async state() {
    const progetti = await this.projects.listOrEmpty();
    const scelto = await this.projects.selectedProject();
    return selectorState({
      projects: progetti,
      selected: scelto?.dir ?? null,
      roots: workspaceRoots(),
      nameOf: (dir) => this.projects.nameOf(dir),
      marked: scelto ? this.marked.resultOf(scelto.dir) : null,
      filter: this.marked.filter,
      search: this.marked.search,
      starting: this.startup.starting,
    });
  }
}
