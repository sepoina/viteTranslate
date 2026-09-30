// L'unico file che parla con VS Code. Tutto il resto (quale progetto, cosa leggere, quali righe)
// sta nei moduli accanto, che non importano `vscode` e si provano in Node puro.
//
// Il pannello è un contenitore suo della Activity Bar (contributes.viewsContainers in
// package.json) con tre sezioni, tre TreeView:
//
//   - Configs (ProjectTree): tutti i progetti Vite del workspace, un elenco a scelta singola
//     (choiceList.mjs): triangolo sul selezionato, puntino sugli altri. Selezionare la riga
//     seleziona il progetto, subito e senza ridisegnare l'elenco (ProjectTree.select). La selezione sopravvive alla chiusura
//     dell'editor (workspaceState) e il file attivo non la sposta mai. Con un progetto solo la
//     sezione sparisce (when: !vitetranslate.singleProject) e quel progetto è il selezionato.
//   - Marked (MarkedTree): le voci marcate del selezionato, file per file, col filtro in testa —
//     lo stesso elenco a scelta singola di Configs.
//   - Details (DetailsTree): la sintesi di vite.config e package.json del selezionato.
//
// Finché non c'è una selezione Marked e Details sono vuote, e VS Code mostra al loro posto il
// messaggio di viewsWelcome ("Select a project in Configs"). ProjectTree tiene anche le letture
// dei progetti (vite.config via sonda, package.json), che le altre due sezioni chiedono a lui.
//
// Configs si ricalcola quando cambia un package.json o un vite.config.*, quando cambiano le
// cartelle del workspace, quando il workspace diventa fidato, e a comando (il pulsante ↻); le
// altre due lo seguono. Marked in più quando si salva un sorgente del suo srcDir o un file di
// lingua della sua localeDir (le traduzioni decidono quali voci hanno problemi), e quando si sposta
// il suo filtro (problematiche / tutte), che però non rilancia la scansione.
import * as vscode from "vscode";
import path from "node:path";
import { CONFIG_GLOB, WATCH_GLOB, inNodeModules, dedupeConfigs } from "./pickProject.mjs";
import readPackage from "./readPackage.mjs";
import runProbe from "./runProbe.mjs";
import { projectRow, projectChildren } from "./summarize.mjs";
import { markedInput, markedChildren, markedSummary, filterItems, hasEntries, FILTERS } from "./markedRows.mjs";
import { ChoiceList } from "./choiceList.mjs";

const VIEW_ID = "vitetranslate.project";
const MARKED_VIEW_ID = "vitetranslate.marked";
const DETAILS_VIEW_ID = "vitetranslate.details";
// Le estensioni che legge walkSource (EXT_RE in lib/dev/vite/uty/walkSource.js), più i file di
// lingua (LANG_EXT in lib/dev/vite/uty/languageFileFormat.js).
const SOURCE_GLOB = "**/*.{js,jsx,ts,tsx,yml}";
// La chiave della selezione in workspaceState: il percorso del progetto selezionato.
const SELECTED_KEY = "vitetranslate.selected";
// E quella del filtro di Marked: "problems" o "all".
const FILTER_KEY = "vitetranslate.markedFilter";

function workspaceRoots() {
  return (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === "file").map((f) => f.uri.fsPath);
}

const dentro = (dir, file) => file.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);

// La firma di un elenco: se non cambia, il pannello non si ridisegna.
const firma = (projects) => projects.map((p) => path.join(p.dir, p.configFile)).join("\n");

// L'id di ogni TreeItem è il percorso delle chiavi dal progetto in giù: VS Code lo usa per
// ricordare cosa l'utente ha aperto e chiuso fra un ridisegno e l'altro. La chiave è l'etichetta,
// se la riga non ne porta una sua (le voci di Marked: due testi uguali nello stesso file). Una
// riga che ha già il suo id passa com'è, lo stesso oggetto: è il caso delle righe di un ChoiceList,
// che pick() cambia sul posto e che quindi devono essere proprio quelle consegnate a VS Code.
const conId = (righe, padre) => righe.map((r) => (r.id ? r : { ...r, id: `${padre}/${r.key ?? r.label}` }));

// Da riga (summarize.mjs, markedRows.mjs) a TreeItem: uno solo per le tre sezioni.
function treeItem(row) {
  const State = vscode.TreeItemCollapsibleState;
  const apribile = row.children?.length;
  const item = new vscode.TreeItem(row.label, !apribile ? State.None : row.expanded ? State.Expanded : State.Collapsed);
  item.id = row.id;
  if (row.description) item.description = row.description;
  if (row.tooltip) item.tooltip = row.tooltip;
  // Con `resourceUri` e l'icona generica di file o cartella, l'icona vera la sceglie il tema dei file.
  if (row.resource) item.resourceUri = vscode.Uri.file(row.resource);
  if (row.icon) item.iconPath = new vscode.ThemeIcon(row.icon, row.iconColor ? new vscode.ThemeColor(row.iconColor) : undefined);
  else if (row.kind) item.iconPath = row.kind === "folder" ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;
  if (row.open) {
    const argomenti = [vscode.Uri.file(row.open)];
    if (row.line) {
      const punto = new vscode.Position(row.line - 1, row.column - 1);
      argomenti.push({ selection: new vscode.Range(punto, punto) });
    }
    item.command = { command: "vscode.open", title: "Open", arguments: argomenti };
  }
  return item;
}

export class ProjectTree {
  /**
   * @param {object} p
   * @param {string} p.probePath - percorso assoluto della sonda compilata (dist/probe.mjs)
   * @param {(riga: string) => void} p.log
   * @param {{ get: (k: string) => any, update: (k: string, v: any) => any }} [p.state] - workspaceState
   */
  constructor({ probePath, log, state }) {
    this.probePath = probePath;
    this.log = log;
    this.state = state;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
    /** @type {vscode.TreeView | null} impostato da activate() */
    this.view = null;
    this.list = null; // Promise dell'elenco mostrato
    this.listKey = null; // la sua firma
    this.seq = 0; // numera i ricalcoli: vince l'ultimo partito, non l'ultimo arrivato
    this.cache = new Map(); // dir -> Promise<{ pkg, probe }>
    this.names = new Map(); // dir -> il name del package.json, o null
    // L'elenco dei progetti, a scelta singola: il valore è la cartella del selezionato.
    this.choice = new ChoiceList({ name: "project", value: state?.get(SELECTED_KEY) ?? null });
    this.contesto = null; // le chiavi di contesto già date a VS Code, per non ridarle uguali
  }

  /** La cartella del progetto scelto, o null. */
  get selected() {
    return this.choice.value;
  }

  async computeList() {
    const uris = await vscode.workspace.findFiles(CONFIG_GLOB, "**/node_modules/**", 500);
    return dedupeConfigs(uris.map((u) => u.fsPath));
  }

  /** L'elenco mostrato; alla prima apertura del pannello lo si calcola. */
  currentList() {
    this.list ??= this.computeList();
    return this.list;
  }

  /** Ricalcola l'elenco; ridisegna solo se cambia, o sempre con `force`. */
  async relist(force = false) {
    const seq = ++this.seq;
    const list = this.computeList();
    let progetti;
    try {
      progetti = await list;
    } catch (error) {
      this.log(`could not list the projects: ${error?.message ?? error}`);
      return;
    }
    if (seq !== this.seq) return;
    this.syncContext(progetti);
    const chiave = firma(progetti);
    if (!force && chiave === this.listKey) return;
    this.list = list;
    this.listKey = chiave;
    this.emitter.fire(undefined);
  }

  /**
   * Le chiavi di contesto che decidono cosa si vede: Configs sparisce con un progetto solo, e il
   * messaggio di Marked e Details cambia fra "nessun progetto" e "selezionane uno".
   */
  syncContext(progetti) {
    const contesto = { "vitetranslate.singleProject": progetti.length === 1, "vitetranslate.hasProjects": progetti.length > 0 };
    const chiave = JSON.stringify(contesto);
    if (chiave === this.contesto) return;
    this.contesto = chiave;
    for (const [k, v] of Object.entries(contesto)) vscode.commands.executeCommand("setContext", k, v);
  }

  /**
   * Seleziona `dir`. Ottimistica: il segno passa subito sulla riga nuova, senza aspettare niente
   * (Details e Marked caricano dopo, per conto loro). In Configs si ridisegnano solo le due righe
   * che cambiano segno, cambiate sul posto: ridisegnare tutto l'elenco farebbe perdere a VS Code
   * l'evidenziazione e il focus che l'utente ha appena messo sulla riga.
   *
   * @param {string} dir
   * @param {{ reveal?: boolean }} [p] - porta anche l'evidenziazione e il focus di VS Code sulla
   *   riga: serve quando la selezione non nasce da un clic nell'elenco (il comando)
   */
  select(dir, { reveal = false } = {}) {
    const riga = this.choice.rowOf(dir);
    if (reveal && riga && this.view) this.view.reveal(riga, { select: true, focus: true });
    const cambiate = this.choice.pick(dir);
    if (!cambiate) return;
    this.state?.update(SELECTED_KEY, dir);
    // Una riga che non è nell'elenco mostrato (il comando, prima che Configs si apra): tutto.
    this.emitter.fire(riga ? cambiate : undefined);
  }

  /**
   * Il progetto selezionato: l'unico, se ce n'è uno solo; altrimenti quello scelto dall'utente,
   * se è ancora nell'elenco. Nessuna scelta automatica: senza selezione Marked e Details
   * aspettano.
   *
   * @returns {Promise<{ dir: string, configFile: string } | null>}
   */
  async selectedProject() {
    let progetti;
    try {
      progetti = await this.currentList();
    } catch (error) {
      this.log(`could not list the projects: ${error?.message ?? error}`);
      return null;
    }
    this.listKey ??= firma(progetti);
    this.syncContext(progetti);
    if (progetti.length === 1) return progetti[0];
    return progetti.find((p) => p.dir === this.selected) ?? null;
  }

  nameOf(dir) {
    if (!this.names.has(dir)) {
      const pkg = readPackage(dir);
      this.names.set(dir, pkg.ok ? pkg.name ?? null : null);
    }
    return this.names.get(dir);
  }

  /** Dimentica quanto letto per `dir`, o tutto senza argomenti. */
  forget(dir) {
    if (dir === undefined) {
      this.cache.clear();
      this.names.clear();
    } else {
      this.cache.delete(dir);
      this.names.delete(dir);
    }
  }

  /** package.json e vite.config di un progetto, letti una volta e tenuti. */
  data(project) {
    let dati = this.cache.get(project.dir);
    if (!dati) {
      dati = this.load(project);
      this.cache.set(project.dir, dati);
    }
    return dati;
  }

  getTreeItem(row) {
    return treeItem(row);
  }

  getChildren(row) {
    return row ? [] : this.rootRows();
  }

  // Un elenco piatto: nessuna riga ha un padre. Serve a view.reveal().
  getParent() {
    return undefined;
  }

  async rootRows() {
    const scelto = await this.selectedProject();
    const roots = workspaceRoots();
    const righe = this.choice.rows(
      (await this.currentList()).map((p) => ({ value: p.dir, ...projectRow(p, { roots, name: this.nameOf(p.dir) }), id: `project:${p.dir}` }))
    );
    // L'evidenziazione di VS Code segue il segno: all'apertura, o dopo un elenco ricalcolato, la si
    // riporta sul selezionato se non c'è già. Senza focus: aprire il pannello non deve rubarlo.
    const riga = scelto && this.choice.rowOf(scelto.dir);
    if (riga && this.view && !this.view.selection?.some((r) => this.choice.owns(r) && r.choice.value === scelto.dir)) {
      setTimeout(() => this.view?.reveal(riga, { select: true, focus: false }), 0);
    }
    return righe;
  }

  /** Il nome da mostrare nelle intestazioni: quello del package.json, o la cartella. */
  titleOf(project) {
    return this.nameOf(project.dir) || path.basename(project.dir);
  }

  async load(project) {
    const pkg = readPackage(project.dir);
    // Eseguire vite.config vuol dire eseguire codice del progetto: in Restricted Mode no.
    if (!vscode.workspace.isTrusted) return { pkg, probe: { ok: false, untrusted: true } };
    const probe = await runProbe({ dir: project.dir, configFile: project.configFile, probePath: this.probePath });
    const file = path.join(project.dir, project.configFile);
    this.log(
      `${file}: ${probe.ok ? "read" : "FAILED"} in ${probe.ms} ms` +
        (probe.ok ? "" : `\n  ${probe.error}`) +
        (probe.output ? `\n  output of vite.config:\n${probe.output}` : "")
    );
    return { pkg, probe };
  }
}

// La sezione Details: le righe che erano sotto ogni progetto in Configs (vitetranslate,
// package.json, vite.config), per il solo selezionato. Il nome del progetto va nell'intestazione.
export class DetailsTree {
  /** @param {{ configs: ProjectTree }} p */
  constructor({ configs }) {
    this.configs = configs;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
    /** @type {vscode.TreeView | null} impostato da activate(), per l'intestazione */
    this.view = null;
    configs.onDidChangeTreeData(() => this.emitter.fire(undefined));
  }

  getTreeItem(row) {
    return treeItem(row);
  }

  getChildren(row) {
    if (!row) return this.rootRows();
    return conId(row.children ?? [], row.id);
  }

  async rootRows() {
    const project = await this.configs.selectedProject();
    if (this.view) this.view.description = project ? this.configs.titleOf(project) : undefined;
    if (!project) return [];
    return conId(projectChildren({ project, ...(await this.configs.data(project)) }), `details:${project.dir}`);
  }
}

// La sezione Marked: l'albero dei file del progetto selezionato in Configs, dalla radice della
// sezione; il nome del progetto va nell'intestazione.
export class MarkedTree {
  /**
   * @param {object} p
   * @param {ProjectTree} p.configs - la selezione e la risposta della sonda del vite.config
   * @param {string} p.probePath - percorso assoluto di dist/markedProbe.mjs
   * @param {(riga: string) => void} p.log
   * @param {{ get: (k: string) => any, update: (k: string, v: any) => any }} [p.state] - workspaceState
   */
  constructor({ configs, probePath, log, state }) {
    this.configs = configs;
    this.state = state;
    const salvato = state?.get(FILTER_KEY);
    // Il filtro, a scelta singola come l'elenco dei progetti: "problems" o "all".
    this.filterChoice = new ChoiceList({ name: "filter", value: FILTERS.includes(salvato) ? salvato : "all" });
    this.probePath = probePath;
    this.log = log;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
    /** @type {vscode.TreeView | null} impostato da activate(), per l'intestazione */
    this.view = null;
    this.cache = new Map(); // dir -> Promise<risposta di markedProbe>
    this.watched = new Map(); // dir -> [srcDir, localeDir] assoluti, per sapere quali salvataggi contano
    // Una selezione nuova, un elenco nuovo o un vite.config riletto cambiano anche questa sezione.
    configs.onDidChangeTreeData(() => this.emitter.fire(undefined));
  }

  /** Dimentica la scansione di `dir`, o tutte senza argomenti. */
  forget(dir) {
    if (dir === undefined) this.cache.clear();
    else this.cache.delete(dir);
  }

  /**
   * Un sorgente o un file di lingua salvato: dimentica la scansione dei progetti che lo
   * contengono. Vero se ce n'erano.
   */
  forgetFile(file) {
    let toccato = false;
    for (const [dir, cartelle] of this.watched) {
      if (this.cache.has(dir) && cartelle.some((c) => dentro(c, file))) {
        this.cache.delete(dir);
        toccato = true;
      }
    }
    return toccato;
  }

  refresh() {
    this.emitter.fire(undefined);
  }

  /** Il filtro scelto: "problems" o "all". */
  get filter() {
    return this.filterChoice.value;
  }

  /**
   * Sposta il filtro. Le voci sono già in mano: nessuna nuova scansione, ma cambia l'albero sotto
   * il filtro, quindi qui si ridisegna tutta la sezione e non solo le due righe del segno.
   */
  setFilter(filter) {
    if (!FILTERS.includes(filter) || !this.filterChoice.pick(filter)) return;
    this.state?.update(FILTER_KEY, filter);
    this.emitter.fire(undefined);
  }

  getTreeItem(row) {
    return treeItem(row);
  }

  getChildren(row) {
    if (!row) return this.rootRows();
    return conId(row.children ?? [], row.id);
  }

  async rootRows() {
    const project = await this.configs.selectedProject();
    if (!project) {
      if (this.view) this.view.description = undefined;
      return [];
    }
    const { rows, marked } = await this.rowsOf(project);
    if (this.view) this.view.description = [this.configs.titleOf(project), markedSummary(marked)].filter(Boolean).join(" · ");
    return conId(rows, `marked:${project.dir}`);
  }

  async rowsOf(project) {
    const { probe } = await this.configs.data(project);
    const scelta = markedInput(probe);
    if (scelta.rows) return { rows: scelta.rows };
    let marked = this.cache.get(project.dir);
    if (!marked) {
      marked = this.scan(project, scelta.input);
      this.cache.set(project.dir, marked);
    }
    const risposta = await marked;
    const albero = markedChildren({ dir: project.dir, input: scelta.input, marked: risposta, filter: this.filter, glyphs: scelta.glyphs });
    const filtro = () => this.filterChoice.rows(filterItems(risposta).map((v) => ({ ...v, id: `marked:${project.dir}/filter:${v.value}` })));
    const rows = hasEntries(risposta) ? [...filtro(), ...albero] : albero;
    return { rows, marked: risposta };
  }

  async scan(project, input) {
    const baseDir = path.resolve(project.dir, input.baseDir);
    this.watched.set(project.dir, [path.resolve(baseDir, input.srcDir), path.resolve(baseDir, input.localeDir ?? "locale")]);
    const marked = await runProbe({
      dir: project.dir,
      probePath: this.probePath,
      args: [JSON.stringify(input)],
      what: "the source scan",
      timeoutMs: 30000,
    });
    this.log(
      `${project.dir}: source ${marked.ok ? `scanned in ${marked.ms} ms, ${markedSummary(marked)}` : `NOT scanned\n  ${marked.error}`}` +
        (marked.warnings?.length ? `\n  ${marked.warnings.map((w) => `${w.rel}: ${w.message}`).join("\n  ")}` : "") +
        (marked.output ? `\n  output:\n${marked.output}` : "")
    );
    return marked;
  }
}

export function activate(context) {
  const canale = vscode.window.createOutputChannel("viteTranslate");
  const log = (riga) => canale.appendLine(`[${new Date().toLocaleTimeString()}] ${riga}`);
  const tree = new ProjectTree({ probePath: context.asAbsolutePath(path.join("dist", "probe.mjs")), log, state: context.workspaceState });
  const view = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: tree });
  tree.view = view;
  const marked = new MarkedTree({ configs: tree, probePath: context.asAbsolutePath(path.join("dist", "markedProbe.mjs")), log, state: context.workspaceState });
  const markedView = vscode.window.createTreeView(MARKED_VIEW_ID, { treeDataProvider: marked, showCollapseAll: true });
  marked.view = markedView;
  const details = new DetailsTree({ configs: tree });
  const detailsView = vscode.window.createTreeView(DETAILS_VIEW_ID, { treeDataProvider: details, showCollapseAll: true });
  details.view = detailsView;

  // Le notifiche arrivano a raffica (un salvataggio tocca più file, un git checkout molti): si
  // aspetta che si calmino. A pannello nascosto — tutte le sezioni chiuse o fuori vista — non si
  // ricalcola niente, lo si segna e basta: ci pensa il prossimo onDidChangeVisibility.
  const visibile = () => view.visible || markedView.visible || detailsView.visible;
  let timer;
  let forza = false;
  let sporco = false;
  const presto = (force) => {
    forza ||= force;
    if (!visibile()) {
      sporco = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const f = forza;
      forza = false;
      tree.relist(f);
    }, 200);
  };

  // Lo stesso per i salvataggi dei sorgenti, che toccano solo Marked.
  let timerMarked;
  let markedSporco = false;
  const prestoMarked = () => {
    if (!markedView.visible) {
      markedSporco = true;
      return;
    }
    clearTimeout(timerMarked);
    timerMarked = setTimeout(() => marked.refresh(), 300);
  };

  const watcher = vscode.workspace.createFileSystemWatcher(WATCH_GLOB);
  const cambiato = (uri) => {
    if (inNodeModules(uri.fsPath)) return;
    tree.forget(path.dirname(uri.fsPath));
    marked.forget(path.dirname(uri.fsPath));
    presto(true);
  };
  const sorgenti = vscode.workspace.createFileSystemWatcher(SOURCE_GLOB);
  const sorgenteCambiato = (uri) => {
    if (inNodeModules(uri.fsPath)) return;
    if (marked.forgetFile(uri.fsPath)) prestoMarked();
  };

  // Un elenco a scelta singola (choiceList.mjs) dentro una vista: selezionare una sua riga — clic,
  // Invio, spazio — è sceglierla. Le altre righe della vista (in Marked i file e le voci) no.
  const sceltaDa = (vista, elenco, scegli) =>
    vista.onDidChangeSelection((e) => {
      const riga = e.selection[0];
      if (elenco.owns(riga)) scegli(riga.choice.value);
    });

  const allaVista = () => {
    if (visibile() && sporco) {
      sporco = false;
      presto(false);
    }
    if (markedView.visible && markedSporco) {
      markedSporco = false;
      prestoMarked();
    }
  };

  context.subscriptions.push(
    canale,
    view,
    markedView,
    detailsView,
    watcher,
    watcher.onDidChange(cambiato),
    watcher.onDidCreate(cambiato),
    watcher.onDidDelete(cambiato),
    sorgenti,
    sorgenti.onDidChange(sorgenteCambiato),
    sorgenti.onDidCreate(sorgenteCambiato),
    sorgenti.onDidDelete(sorgenteCambiato),
    sceltaDa(view, tree.choice, (dir) => tree.select(dir)),
    sceltaDa(markedView, marked.filterChoice, (filtro) => marked.setFilter(filtro)),
    view.onDidChangeVisibility(allaVista),
    markedView.onDidChangeVisibility(allaVista),
    detailsView.onDidChangeVisibility(allaVista),
    vscode.workspace.onDidChangeWorkspaceFolders(() => presto(true)),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      tree.forget();
      marked.forget();
      presto(true);
    }),
    vscode.commands.registerCommand("vitetranslate.select", (dir) => tree.select(dir, { reveal: true })),
    vscode.commands.registerCommand("vitetranslate.refresh", () => {
      tree.forget();
      marked.forget();
      return tree.relist(true);
    }),
    { dispose: () => (clearTimeout(timer), clearTimeout(timerMarked)) }
  );
  return { tree, marked, details };
}

export function deactivate() {}
