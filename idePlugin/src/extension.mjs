// L'ingresso dell'estensione: compone le sezioni e le registra, niente altro. Ogni compito sta nel
// modulo di chi lo usa:
//   - core/: quello che più sezioni condividono — i progetti e le loro letture (projects.mjs), il
//     CLI in un task (cliTasks.mjs), l'avvio (startup.mjs), i watcher dei vite.config
//     (projectWatch.mjs), i gesti sull'editor (editorUi.mjs); più i moduli in Node puro;
//   - probes/: i processi figli che leggono vite.config e le voci marcate;
//   - views/results/: Results, la TreeView delle voci marcate (resultsView.mjs, markedTree.mjs);
//   - webViews/: Selector, Project e la sezione facoltativa (Help, LLM, Settings), su una base comune
//     (pageView.mjs);
//   - highlight/: l'evidenziazione dei metatag nell'editor, e il comando che ne sceglie lo stile.
//     Non dipende dal pannello (l'accordion Highlight style di Settings, sì, da lei).
//
// Due modi di partire. L'estensione si attiva all'apertura del pannello, o di un file js/jsx/ts/tsx
// (activationEvents in package.json: serve all'evidenziazione). L'evidenziazione parte subito; il
// pannello — elenco dei progetti, vite.config, scansione, i watcher dei file, il file attivo
// inseguito — solo quando
// una sua sezione si apre (avviaPannello): con il pannello chiuso non si esegue niente del progetto.
// I moduli di stato e di pagina (…State.mjs, …Page.mjs, markedRows.mjs, …) non importano `vscode`
// e si provano in Node puro.
//
// Il pannello è un contenitore suo della Activity Bar (contributes.viewsContainers in
// package.json) con tre sezioni, dall'alto: Selector, Results, Project. Quando c'è, la facoltativa
// prende il posto di tutte e tre (Selector resta solo accanto al guasto della libreria, se c'è un
// altro progetto da scegliere); all'avvio è lei a dire cosa si prepara. Finché non c'è una
// selezione Results e Project sono vuote: Results mostra il messaggio di viewsWelcome ("Select a
// project…"), Project lo scrive da sé.
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
import { Highlighter } from "./highlight/highlighter.mjs";
import { pickHighlightStyle } from "./highlight/stylePicker.mjs";

export function activate(context) {
  const canale = vscode.window.createOutputChannel("viteTranslate");
  const log = (riga) => canale.appendLine(`[${new Date().toLocaleTimeString()}] ${riga}`);
  const sonda = (file) => context.asAbsolutePath(path.join("dist", file));
  const { extensionUri, workspaceState: state } = context;
  const extensionId = context.extension?.id ?? "sepoina.vitetranslate-ide";
  // In preview la libreria si chiede a npm col tag `next` (la pagina del guasto, libraryPage.mjs).
  const preview = context.extension?.packageJSON?.preview === true;
  // In VERSION, nella pagina Settings.
  const extensionVersion = context.extension?.packageJSON?.version ?? null;

  const highlighter = new Highlighter({ log });
  const projects = new Projects({ probePath: sonda("probe.mjs"), log, state });
  const results = new ResultsView({ projects, probePath: sonda("markedProbe.mjs"), log, state });
  const cli = new CliTasks({ runner: sonda("cliRunner.mjs"), runAsNodeCmd: sonda("runAsNode.cmd"), projects, log });
  const startup = new Startup({ projects, marked: results.tree, log });

  // Il pannello parte la prima volta che una sua sezione si apre: una webview risolta (di solito la
  // facoltativa, che all'avvio è l'unica in vista), o Results in vista. `preparato` si risolve a
  // pannello pronto, e la facoltativa uscita dall'avvio (i test lo aspettano).
  let avviato = false;
  let segnalaPronto;
  const preparato = new Promise((r) => (segnalaPronto = r));
  const avviaPannello = () => {
    if (avviato) return;
    avviato = true;
    watch.start();
    results.start();
    startup.start().then(() => optional.avviata).then(segnalaPronto, segnalaPronto);
  };
  // Una sezione tornata in vista recupera quanto rimandato mentre il pannello era nascosto.
  const allaVista = () => (results.wake(), watch.wake());
  const selector = new SelectorView({ extensionUri, projects, results, log, onVisible: allaVista, onOpen: avviaPannello });
  const project = new ProjectView({ extensionUri, projects, results, cli, startup, log, onVisible: allaVista, onOpen: avviaPannello });
  const optional = new OptionalView({
    extensionUri, projects, results, cli, highlighter, startup, extensionId, extensionVersion, preview, log, onVisible: allaVista, onOpen: avviaPannello,
  });

  const invalidate = (dir) => {
    projects.forget(dir);
    for (const sezione of [results, optional, project]) sezione.invalidate(dir);
  };
  // Anche la facoltativa: con lei in vista Selector, di solito, non c'è.
  const watch = new ProjectWatch({ projects, invalidate, isVisible: () => selector.visible || results.visible || project.visible || optional.visible });

  const comandi = {
    "vitetranslate.select": (dir) => projects.select(dir),
    "vitetranslate.refresh": () => (invalidate(), projects.relist(true)),
    "vitetranslate.highlightStyle": () => pickHighlightStyle(highlighter),
    ...project.commands,
    ...optional.commands,
  };

  context.subscriptions.push(
    canale,
    highlighter,
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
    results.onDidChangeVisibility(() => {
      if (results.visible) {
        avviaPannello();
        startup.stage("Results shown");
      }
      allaVista();
    }),
    ...Object.entries(comandi).map(([id, f]) => vscode.commands.registerCommand(id, f))
  );
  // Per i test. VS Code la offre alle altre estensioni come `exports`: non è un'API promessa.
  return { tree: projects, marked: results.tree, project, selector, optional, controlli: optional.llm.checks, preparato, highlighter };
}

export function deactivate() {}
