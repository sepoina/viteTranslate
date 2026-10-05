// L'ingresso dell'estensione: compone le sezioni e le registra, niente altro. Ogni compito sta nel
// modulo di chi lo usa:
//   - core/: quello che più sezioni condividono — i progetti e le loro letture (projects.mjs), il
//     CLI in un task (cliTasks.mjs), l'avvio (startup.mjs), i watcher dei vite.config
//     (projectWatch.mjs), i gesti sull'editor (editorUi.mjs); più i moduli in Node puro;
//   - probes/: i processi figli che leggono vite.config e le voci marcate;
//   - views/results/: Results, la TreeView delle voci marcate (resultsView.mjs, markedTree.mjs);
//   - webViews/: Selector, Project e la sezione facoltativa (Help, LLM, Inspector), su una base comune
//     (pageView.mjs).
// I moduli di stato e di pagina (…State.mjs, …Page.mjs, markedRows.mjs, …) non importano `vscode`
// e si provano in Node puro.
//
// Il pannello è un contenitore suo della Activity Bar (contributes.viewsContainers in
// package.json) con tre sezioni, dall'alto: Selector, Results (o al suo posto la facoltativa),
// Project. Finché non c'è una selezione Results e Project sono vuote: Results mostra il messaggio
// di viewsWelcome ("Select a project…"), Project lo scrive da sé.
//
// Le sezioni parlano la stessa lingua, e qui si usano solo così:
//   - invalidate(dir?): quanto letto di un progetto (o di tutti) non vale più;
//   - commands: i comandi che la sezione porta, { id: handler };
//   - dispose().
import * as vscode from "vscode";
import path from "node:path";
import { Projects } from "./core/projects.mjs";
import { CliTasks } from "./core/cliTasks.mjs";
import { Startup } from "./core/startup.mjs";
import { ProjectWatch } from "./core/projectWatch.mjs";
import { ResultsView } from "./views/results/resultsView.mjs";
import { SelectorView, SELECTOR_VIEW_ID } from "./webViews/selector/selectorView.mjs";
import { ProjectView, PROJECT_VIEW_ID } from "./webViews/project/projectView.mjs";
import { OptionalView, OPTIONAL_VIEW_ID } from "./webViews/optional/optionalView.mjs";

export function activate(context) {
  const canale = vscode.window.createOutputChannel("viteTranslate");
  const log = (riga) => canale.appendLine(`[${new Date().toLocaleTimeString()}] ${riga}`);
  const sonda = (file) => context.asAbsolutePath(path.join("dist", file));
  const { extensionUri, workspaceState: state } = context;
  const extensionId = context.extension?.id ?? "sepoina.vitetranslate-ide";

  const projects = new Projects({ probePath: sonda("probe.mjs"), log, state });
  const results = new ResultsView({ projects, probePath: sonda("markedProbe.mjs"), log, state });
  const cli = new CliTasks({ projects, log });
  const startup = new Startup({ projects, marked: results.tree, log });
  // Una sezione tornata in vista recupera quanto rimandato mentre il pannello era nascosto.
  const allaVista = () => (results.wake(), watch.wake());
  const selector = new SelectorView({ extensionUri, projects, results, startup, log, onVisible: allaVista });
  const project = new ProjectView({ extensionUri, extensionId, projects, results, cli, startup, log, onVisible: allaVista });
  const optional = new OptionalView({ extensionUri, projects, results, cli, log });
  const preparato = startup.start();

  const invalidate = (dir) => {
    projects.forget(dir);
    for (const sezione of [results, optional, project]) sezione.invalidate(dir);
  };
  const watch = new ProjectWatch({ projects, invalidate, isVisible: () => selector.visible || results.visible || project.visible });

  const comandi = {
    "vitetranslate.select": (dir) => projects.select(dir),
    "vitetranslate.refresh": () => (invalidate(), projects.relist(true)),
    ...project.commands,
    ...optional.commands,
  };

  context.subscriptions.push(
    canale,
    results,
    cli,
    startup,
    watch,
    selector,
    project,
    optional,
    vscode.window.registerWebviewViewProvider(SELECTOR_VIEW_ID, selector),
    vscode.window.registerWebviewViewProvider(PROJECT_VIEW_ID, project),
    vscode.window.registerWebviewViewProvider(OPTIONAL_VIEW_ID, optional),
    results.onDidChangeVisibility(() => (results.visible && startup.stage("Results shown"), allaVista())),
    ...Object.entries(comandi).map(([id, f]) => vscode.commands.registerCommand(id, f))
  );
  return { tree: projects, marked: results.tree, project, selector, optional, controlli: optional.llm.checks, preparato };
}

export function deactivate() {}
