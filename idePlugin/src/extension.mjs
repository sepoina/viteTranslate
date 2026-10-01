// L'unico file che parla con VS Code. Tutto il resto (quale progetto, cosa leggere, quali righe)
// sta nei moduli accanto, che non importano `vscode` e si provano in Node puro.
//
// Il pannello è un contenitore suo della Activity Bar (contributes.viewsContainers in
// package.json) con tre sezioni, dall'alto:
//
//   - Selector (SelectorView): una webview coi componenti di @vscode-elements/elements. Config,
//     l'elenco dei progetti Vite del workspace (solo se più di uno); Filter, le scelte del filtro di
//     Results (solo se oltre ad All ce n'è qualcuna); i bottoni Sync, Refresh, Open vite.config.
//     Lo stato lo tiene l'estensione (selectorState.mjs) e glielo manda; la webview rimanda i
//     clic. La selezione del progetto e il filtro sopravvivono alla chiusura (workspaceState).
//   - Results (MarkedTree): le voci marcate del selezionato, file per file, filtrate.
//   - Details (DetailsTree): la sintesi di vite.config e package.json del selezionato.
//
// Finché non c'è una selezione Results e Details sono vuote, e VS Code mostra al loro posto il
// messaggio di viewsWelcome ("Select a project above"). Projects tiene l'elenco, la selezione e
// le letture dei progetti (vite.config via sonda, package.json), che le sezioni chiedono a lui.
//
// L'elenco si ricalcola quando cambia un package.json o un vite.config.*, quando cambiano le
// cartelle del workspace, quando il workspace diventa fidato, e a comando (il pulsante ↻); le
// sezioni lo seguono. Results in più quando si salva un sorgente del suo srcDir o un file di
// lingua della sua localeDir (le traduzioni decidono quali voci hanno problemi), quando un
// sorgente ha modifiche non salvate (la sua riga si blocca), e quando si sposta il suo filtro,
// che però non rilancia la scansione.
//
// Il file attivo porta il pannello dove sta (seguiEditor in activate): se è di un altro progetto
// lo seleziona, come un clic in Config; poi Results mostra la sua riga, aperta sulle voci
// (MarkedTree.follow), con un reveal e senza ridisegnare niente. Stesso progetto, nessun ridisegno.
//
// Results e Details non aspettano mai una sonda per disegnare: quello che mostrano o è giusto o si
// vede che non lo è. Un progetto mai letto mostra "Loading…" (mai i dati di un altro progetto);
// un disegno superato resta, bloccato — il segno sulla riga del file salvato o modificato, un
// messaggio in testa se sono cambiati i file di lingua o il vite.config — finché non arriva
// quello nuovo. La scansione di Results la fa un processo per progetto (scanWorker.mjs), che
// legge l'indice scritto dalla sync e rifà il parse solo dei file cambiati dopo.
import * as vscode from "vscode";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { CONFIG_GLOB, WATCH_GLOB, inNodeModules, dedupeConfigs, projectOf, pathKey } from "./pickProject.mjs";
import readPackage from "./readPackage.mjs";
import runProbe from "./runProbe.mjs";
import { projectChildren } from "./summarize.mjs";
import { markedInput, markedChildren, markedSummary, filterItems, FILTERS, loadingRow, frozenRows } from "./markedRows.mjs";
import { ScanWorker } from "./scanWorker.mjs";
import { selectorHtml } from "./selectorPage.mjs";
import { selectorState } from "./selectorState.mjs";
import { findCli } from "./syncCommand.mjs";

const SELECTOR_VIEW_ID = "vitetranslate.selector";
const MARKED_VIEW_ID = "vitetranslate.results";
const DETAILS_VIEW_ID = "vitetranslate.details";
// Le estensioni che legge walkSource (EXT_RE in lib/dev/vite/uty/walkSource.js), più i file di
// lingua (LANG_EXT in lib/dev/vite/uty/languageFileFormat.js).
const SOURCE_GLOB = "**/*.{js,jsx,ts,tsx,yml}";
// La chiave della selezione in workspaceState: il percorso del progetto selezionato.
const SELECTED_KEY = "vitetranslate.selected";
// E quella del filtro di Results: una voce di FILTERS (markedRows.mjs).
const FILTER_KEY = "vitetranslate.markedFilter";

function workspaceRoots() {
  return (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === "file").map((f) => f.uri.fsPath);
}

const dentro = (dir, file) => file.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);

// La firma di un elenco: se non cambia, il pannello non si ridisegna.
const firma = (projects) => projects.map((p) => path.join(p.dir, p.configFile)).join("\n");

// L'id di ogni TreeItem è il percorso delle chiavi dal progetto in giù: VS Code lo usa per
// ricordare cosa l'utente ha aperto e chiuso fra un ridisegno e l'altro. La chiave è l'etichetta,
// se la riga non ne porta una sua (le voci di Results: due testi uguali nello stesso file). Una
// riga che ha già il suo id passa com'è.
const conId = (righe, padre) => righe.map((r) => (r.id ? r : { ...r, id: `${padre}/${r.key ?? r.label}` }));

// Come conId, ma su tutto l'albero e una volta sola per disegno (Results). VS Code riconosce una
// riga dall'oggetto — reveal la cerca fra quelle che getChildren gli ha dato — quindi fra un
// ridisegno e l'altro getChildren deve restituire sempre gli stessi. Annota in `disegno` i padri
// (per getParent) e le righe dei file, per percorso (per follow).
function fissa(righe, padre, disegno, genitore) {
  return righe.map((r) => {
    const riga = r.id ? r : { ...r, id: `${padre}/${r.key ?? r.label}` };
    if (riga.children) riga.children = fissa(riga.children, riga.id, disegno, riga);
    if (genitore) disegno.parents.set(riga, genitore);
    if (riga.kind === "file" && riga.resource) disegno.files.set(pathKey(riga.resource), riga);
    return riga;
  });
}

// I badge delle righe (`badge` in summarize.mjs): VS Code li disegna solo come FileDecoration, cioè
// legati a un resourceUri. Uno schema tutto nostro, così il badge resta in questo pannello e non
// finisce sullo stesso file nell'Explorer. Le righe lo registrano qui quando diventano TreeItem.
const BADGE_SCHEME = "vitetranslate-badge";
class Badges {
  constructor() {
    this.mappa = new Map(); // uri -> { firma, badge }
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this.emitter.event;
  }

  /** L'uri della riga col badge: il suo file, nel nostro schema. */
  set(file, badge) {
    const uri = vscode.Uri.file(file).with({ scheme: BADGE_SCHEME });
    const chiave = uri.toString();
    const firma = JSON.stringify(badge);
    if (this.mappa.get(chiave)?.firma !== firma) {
      this.mappa.set(chiave, { firma, badge });
      this.emitter.fire(uri);
    }
    return uri;
  }

  provideFileDecoration(uri) {
    const b = this.mappa.get(uri.toString())?.badge;
    return b ? new vscode.FileDecoration(b.text, b.tooltip) : undefined;
  }
}
const badges = new Badges();

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
  else if (row.badge && row.open) item.resourceUri = badges.set(row.open, row.badge);
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

// L'elenco dei progetti Vite del workspace, la selezione, e le letture di ciascuno (vite.config via
// sonda, package.json). Non è una vista: lo mostra Selector, e Results e Details lo seguono
// (onDidChange: elenco cambiato, selezione cambiata).
export class Projects {
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
    this.onDidChange = this.emitter.event;
    this.list = null; // Promise dell'elenco mostrato
    this.listKey = null; // la sua firma
    this.seq = 0; // numera i ricalcoli: vince l'ultimo partito, non l'ultimo arrivato
    this.cache = new Map(); // dir -> Promise<{ pkg, probe }>
    this.letti = new Map(); // dir -> { pkg, probe } già arrivati: chi disegna non aspetta
    this.names = new Map(); // dir -> il name del package.json, o null
    this.scelto = state?.get(SELECTED_KEY) ?? null; // la cartella del progetto scelto
    this.contesto = null; // le chiavi di contesto già date a VS Code, per non ridarle uguali
  }

  /** La cartella del progetto scelto, o null. */
  get selected() {
    return this.scelto;
  }

  async computeList() {
    const uris = await vscode.workspace.findFiles(CONFIG_GLOB, "**/node_modules/**", 500);
    return dedupeConfigs(uris.map((u) => u.fsPath));
  }

  /** L'elenco mostrato; alla prima richiesta lo si calcola. */
  currentList() {
    this.list ??= this.computeList();
    return this.list;
  }

  /** Ricalcola l'elenco; avvisa solo se cambia, o sempre con `force`. */
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

  /** Il messaggio di Results e Details cambia fra "nessun progetto" e "selezionane uno". */
  syncContext(progetti) {
    const contesto = { "vitetranslate.hasProjects": progetti.length > 0 };
    const chiave = JSON.stringify(contesto);
    if (chiave === this.contesto) return;
    this.contesto = chiave;
    for (const [k, v] of Object.entries(contesto)) vscode.commands.executeCommand("setContext", k, v);
  }

  /** Seleziona `dir`, e lo ricorda. Niente se è già lui. */
  select(dir) {
    if (!dir || dir === this.scelto) return;
    this.scelto = dir;
    this.state?.update(SELECTED_KEY, dir);
    this.emitter.fire(undefined);
  }

  /**
   * Il progetto selezionato: l'unico, se ce n'è uno solo; altrimenti quello scelto dall'utente,
   * se è ancora nell'elenco. Nessuna scelta automatica: senza selezione Results e Details
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
    return progetti.find((p) => p.dir === this.scelto) ?? null;
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
      this.letti.clear();
      this.names.clear();
    } else {
      this.cache.delete(dir);
      this.letti.delete(dir);
      this.names.delete(dir);
    }
  }

  /** package.json e vite.config di un progetto, letti una volta e tenuti. */
  data(project) {
    let dati = this.cache.get(project.dir);
    if (!dati) {
      dati = this.load(project);
      this.cache.set(project.dir, dati);
      dati.then((valore) => {
        if (this.cache.get(project.dir) === dati) this.letti.set(project.dir, valore);
      });
    }
    return dati;
  }

  /** La lettura di `dir` se è già arrivata, altrimenti undefined: per chi non deve aspettare. */
  ready(dir) {
    return this.letti.get(dir);
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

// La sezione Details: la sintesi del progetto selezionato (vitetranslate, package.json,
// vite.config). Il nome del progetto va nell'intestazione.
// Finché la lettura del vite.config non è arrivata, una riga "Reading vite.config…": mai le righe
// di un altro progetto, né quelle di un config cambiato nel frattempo.
export class DetailsTree {
  /** @param {{ configs: Projects }} p */
  constructor({ configs }) {
    this.configs = configs;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
    /** @type {vscode.TreeView | null} impostato da activate(), per l'intestazione */
    this.view = null;
    /** @type {((p: Promise<any>) => void) | null} la barra di avanzamento, da activate() */
    this.progress = null;
    /** @type {((dir: string) => object | null) | null} i conteggi delle tabelle, da Results (activate) */
    this.stats = null;
    this.turno = 0; // numera i disegni: uno superato non tocca l'intestazione
    this.attese = new WeakSet(); // le letture a cui è già appeso un ridisegno
    this.pending = new Set(); // le letture in corso, per idle()
    configs.onDidChange(() => this.emitter.fire(undefined));
  }

  refresh() {
    this.emitter.fire(undefined);
  }

  /** Si risolve quando non c'è più niente in arrivo (per i test). */
  async idle() {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  getTreeItem(row) {
    return treeItem(row);
  }

  getChildren(row) {
    if (!row) return this.rootRows();
    return conId(row.children ?? [], row.id);
  }

  async rootRows() {
    const turno = ++this.turno;
    const project = await this.configs.selectedProject();
    if (turno === this.turno && this.view) this.view.description = project ? this.configs.titleOf(project) : undefined;
    if (!project) return [];
    const dati = this.configs.ready(project.dir);
    if (!dati) {
      this.aspetta(this.configs.data(project));
      return conId([loadingRow("Reading vite.config…")], `details:${project.dir}`);
    }
    return conId(projectChildren({ project, ...dati, stats: this.stats?.(project.dir) ?? null }), `details:${project.dir}`);
  }

  // Un ridisegno quando la lettura arriva, uno solo per lettura.
  aspetta(promessa) {
    if (this.attese.has(promessa)) return;
    this.attese.add(promessa);
    this.pending.add(promessa);
    this.progress?.(promessa);
    promessa.then(() => {
      this.pending.delete(promessa);
      this.emitter.fire(undefined);
    });
  }
}

// La sezione Results: l'albero dei file del progetto selezionato, con le loro voci marcate, filtrate
// dal filtro scelto in Selector; il nome del progetto va nell'intestazione.
//
// Per ogni progetto uno stato (statoDi): l'ultimo risultato arrivato, il carico in corso, e cosa
// è cambiato da allora. `gen` cresce a ogni cambiamento; un risultato è fresco se è della `gen`
// corrente. Il disegno non aspetta mai il carico:
//   - nessun risultato: la riga "Loading…";
//   - risultato superato: il vecchio, bloccato (frozenRows) — i file salvati (`toccati`) e quelli
//     con modifiche non salvate (`sporchi`) col segno e senza clic; un messaggio in testa se sono
//     cambiati i file di lingua o il vite.config (`tutto`);
//   - risultato fresco: com'è (solo i file sporchi bloccati).
// A carico arrivato si ridisegna. Un sorgente salvato blocca subito la sua riga, ma il carico parte
// solo al refresh (l'attesa di activate, 300 ms): `attesa`.
export class MarkedTree {
  /**
   * @param {object} p
   * @param {Projects} p.configs - la selezione e la risposta della sonda del vite.config
   * @param {string} p.probePath - percorso assoluto di dist/markedProbe.mjs
   * @param {(riga: string) => void} p.log
   * @param {{ get: (k: string) => any, update: (k: string, v: any) => any }} [p.state] - workspaceState
   */
  constructor({ configs, probePath, log, state }) {
    this.configs = configs;
    this.state = state;
    const salvato = state?.get(FILTER_KEY);
    // Il filtro, scelto in Selector: una voce di FILTERS.
    this.filtro = FILTERS.includes(salvato) ? salvato : "all";
    // Il testo di Search in Selector: restringe l'albero (searchFiles), non si ricorda fra le sessioni.
    this.cerca = "";
    this.probePath = probePath;
    this.log = log;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
    /** @type {vscode.TreeView | null} impostato da activate(), per l'intestazione */
    this.view = null;
    /** @type {((p: Promise<any>) => void) | null} la barra di avanzamento, da activate() */
    this.progress = null;
    this.stati = new Map(); // dir -> stato (statoDi)
    this.workers = new Map(); // dir -> ScanWorker
    this.overlays = new Map(); // dir -> l'overlay dell'ultima scansione (markedScan.mjs)
    this.watched = new Map(); // dir -> [srcDir, localeDir] assoluti, per sapere quali salvataggi contano
    this.sporchi = new Map(); // pathKey -> percorso: documenti con modifiche non salvate
    this.pending = new Set(); // i carichi in corso, per idle()
    this.turno = 0; // numera i disegni: uno superato non tocca intestazione né `rendered`
    this.rendered = null; // l'ultimo disegno: { dir, parents, files } (fissa)
    this.target = null; // il file attivo da mostrare, finché non lo si è mostrato: { file, dir }
    // Una selezione nuova, un elenco nuovo o un vite.config riletto cambiano anche questa sezione.
    configs.onDidChange(() => this.emitter.fire(undefined));
  }

  statoDi(dir) {
    let s = this.stati.get(dir);
    if (!s) {
      s = { risultato: null, genRisultato: -1, gen: 0, carico: null, attesa: false, toccati: new Set(), tutto: null };
      this.stati.set(dir, s);
    }
    return s;
  }

  /**
   * Il vite.config o il package.json di `dir` sono cambiati (o tutti, senza argomenti: refresh,
   * fiducia concessa): il disegno si blocca, il processo si chiude e l'overlay si butta — erano
   * della config di prima.
   */
  forget(dir) {
    const dirs = dir === undefined ? [...new Set([...this.stati.keys(), ...this.workers.keys()])] : [dir];
    for (const d of dirs) {
      this.workers.get(d)?.dispose();
      this.workers.delete(d);
      this.overlays.delete(d);
      const s = this.stati.get(d);
      if (!s) continue;
      s.gen++;
      s.tutto = "config";
      s.attesa = false;
    }
    this.emitter.fire(undefined);
  }

  /**
   * Un sorgente o un file di lingua salvato: blocca subito il disegno dei progetti che lo
   * contengono (la riga del file, o tutto per un file di lingua). La nuova scansione parte al
   * prossimo refresh(). Vero se c'erano.
   */
  forgetFile(file) {
    const k = pathKey(file);
    let toccato = false;
    for (const [dir, [src, locale]] of this.watched) {
      const s = this.stati.get(dir);
      if (!s) continue;
      if (dentro(locale, file)) s.tutto ??= "locale";
      else if (dentro(src, file)) s.toccati.add(k);
      else continue;
      s.gen++;
      s.attesa = true;
      toccato = true;
    }
    if (toccato) this.emitter.fire(undefined);
    return toccato;
  }

  /**
   * Un documento con modifiche non salvate, o che non ne ha più (salvato, annullato, chiuso). Si
   * ridisegna solo se la sua riga è in vista. Vero se si ridisegna.
   */
  setDirty(file, sporco) {
    const k = pathKey(file);
    if (sporco === this.sporchi.has(k)) return false;
    if (sporco) this.sporchi.set(k, file);
    else this.sporchi.delete(k);
    if (!this.rendered?.files.has(k)) return false;
    this.emitter.fire(undefined);
    return true;
  }

  /** I salvataggi in attesa diventano scansioni: ridisegna, e il disegno le fa partire. */
  refresh() {
    for (const s of this.stati.values()) s.attesa = false;
    this.emitter.fire(undefined);
  }

  /** Si risolve quando non c'è più niente in arrivo (per i test). */
  async idle() {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  dispose() {
    for (const w of this.workers.values()) w.dispose();
    this.workers.clear();
  }

  /** Il filtro scelto: una voce di FILTERS. */
  get filter() {
    return this.filtro;
  }

  /** Sposta il filtro. Le voci sono già in mano: nessuna nuova scansione, solo un ridisegno. */
  setFilter(filter) {
    if (!FILTERS.includes(filter) || filter === this.filtro) return;
    this.filtro = filter;
    this.state?.update(FILTER_KEY, filter);
    this.emitter.fire(undefined);
  }

  /** Il testo di ricerca. */
  get search() {
    return this.cerca;
  }

  /** Cambia il testo di ricerca: come il filtro, nessuna nuova scansione, solo un ridisegno. */
  setSearch(testo) {
    const nuovo = typeof testo === "string" ? testo : "";
    if (nuovo === this.cerca) return;
    this.cerca = nuovo;
    this.emitter.fire(undefined);
  }

  /** L'ultima scansione di `dir` arrivata, o null: per le scelte del filtro in Selector. */
  resultOf(dir) {
    return this.stati.get(dir)?.risultato?.marked ?? null;
  }

  getTreeItem(row) {
    return treeItem(row);
  }

  getChildren(row) {
    if (!row) return this.rootRows();
    return row.children ?? [];
  }

  // Serve a view.reveal(): risale dalla riga di un file alla radice.
  getParent(row) {
    return this.rendered?.parents.get(row);
  }

  /**
   * Il file attivo, del progetto `dir`: se ha voci in vista, Results porta lì l'evidenziazione e
   * apre la sua riga. Se Results non ha ancora disegnato quel progetto (lo si è appena
   * selezionato) o non è in vista, il file resta in attesa: ci pensa il prossimo disegno, o il
   * ritorno in vista.
   */
  follow(file, dir) {
    this.target = { file, dir };
    this.applyTarget();
  }

  applyTarget() {
    const t = this.target;
    if (!t || !this.view?.visible || this.rendered?.dir !== t.dir) return;
    const riga = this.rendered.files.get(pathKey(t.file));
    // Il progetto sta ancora caricando: il file aspetta il disegno vero.
    if (!riga && this.rendered.loading) return;
    this.target = null;
    // Senza voci, o nascoste dal filtro: niente da mostrare.
    if (!riga) return;
    // Già lì: la riga del file, o una sua voce — cliccarla apre il file, e il file attivo che
    // cambia non deve spostare la selezione dalla voce alla sua riga.
    const sel = this.view.selection?.[0];
    if (sel === riga || (sel && sel.open && pathKey(sel.open) === pathKey(t.file))) return;
    this.view.reveal(riga, { select: true, focus: false, expand: true });
  }

  async rootRows() {
    const turno = ++this.turno;
    const project = await this.configs.selectedProject();
    const attuale = turno === this.turno;
    if (!project) {
      if (attuale) {
        this.rendered = null;
        this.mostra(undefined, undefined);
      }
      return [];
    }
    const s = this.statoDi(project.dir);
    const superato = !s.risultato || s.gen !== s.genRisultato;
    if (superato && !s.carico && !s.attesa) this.avvia(project, s);
    const nome = this.configs.titleOf(project);
    const disegno = { dir: project.dir, parents: new Map(), files: new Map(), loading: !s.risultato };
    let righe;
    if (!s.risultato) {
      righe = fissa([loadingRow(`Loading ${nome}…`)], `marked:${project.dir}`, disegno);
      if (attuale) this.mostra(nome, undefined);
    } else {
      const { rows, marked } = this.righe(project, s.risultato);
      righe = fissa(frozenRows(rows, this.bloccati(project.dir, s, superato)), `marked:${project.dir}`, disegno);
      if (attuale) {
        const messaggio = !superato ? undefined
          : s.tutto === "config" ? "⏳ vite.config changed: updating…"
          : s.tutto === "locale" ? "⏳ Language files changed: updating…"
          : undefined;
        const cercato = this.cerca.trim() && marked ? `matching "${this.cerca.trim()}"` : null;
        this.mostra([nome, markedSummary(marked), cercato, superato && "updating…"].filter(Boolean).join(" · "), messaggio);
      }
    }
    if (attuale) {
      this.rendered = disegno;
      // Il file attivo in attesa: dopo che VS Code ha le righe.
      if (this.target) setTimeout(() => this.applyTarget(), 0);
    }
    return righe;
  }

  mostra(description, message) {
    if (!this.view) return;
    this.view.description = description;
    this.view.message = message;
  }

  // I file da bloccare nel disegno: i salvati da riscansionare, se il risultato è superato, e i
  // documenti con modifiche non salvate di questo progetto.
  bloccati(dir, s, superato) {
    const fuori = new Map();
    if (superato) for (const k of s.toccati) fuori.set(k, "saved");
    const src = this.watched.get(dir)?.[0];
    if (src) for (const [k, file] of this.sporchi) if (dentro(src, file)) fuori.set(k, "unsaved");
    return fuori;
  }

  // Il carico di un progetto: la lettura del vite.config (quella di Projects), poi la scansione.
  // Mai un rifiuto. Arrivato, diventa il risultato se è della gen corrente; se nel frattempo è
  // cambiato qualcosa lo diventa lo stesso quando è riuscito (è comunque più nuovo), ma resta
  // superato e il disegno ne fa partire un altro.
  avvia(project, s) {
    const gen = s.gen;
    const carico = (async () => {
      try {
        const { probe } = await this.configs.data(project);
        const scelta = markedInput(probe);
        if (scelta.rows) return { rows: scelta.rows };
        const marked = await this.scan(project, scelta.input);
        return { marked, input: scelta.input, glyphs: scelta.glyphs };
      } catch (error) {
        return { rows: [{ label: "the source scan failed", description: String(error?.message ?? error), icon: "error" }] };
      }
    })();
    s.carico = carico;
    this.pending.add(carico);
    this.progress?.(carico);
    carico.then((valore) => {
      this.pending.delete(carico);
      s.carico = null;
      const riuscito = !!valore.rows || !!valore.marked?.ok;
      if (s.gen === gen) {
        s.toccati.clear();
        s.tutto = null;
      }
      if (s.gen === gen || riuscito || !s.risultato) {
        s.risultato = valore;
        s.genRisultato = gen;
      }
      this.emitter.fire(undefined);
    });
  }

  // Dal risultato alle righe, filtrate.
  righe(project, risultato) {
    if (risultato.rows) return { rows: risultato.rows };
    const { marked: risposta, input, glyphs } = risultato;
    // Un filtro che non trova più niente (le sue voci sono state sistemate) torna ad All, e lo si
    // ricorda: in Selector non lo si vedrebbe più.
    if (risposta.ok && this.filtro !== "all" && !filterItems(risposta).some((v) => v.value === this.filtro)) {
      this.filtro = "all";
      this.state?.update(FILTER_KEY, "all");
    }
    return { rows: markedChildren({ dir: project.dir, input, marked: risposta, filter: this.filtro, search: this.cerca, glyphs }), marked: risposta };
  }

  async scan(project, input) {
    const baseDir = path.resolve(project.dir, input.baseDir);
    this.watched.set(project.dir, [path.resolve(baseDir, input.srcDir), path.resolve(baseDir, input.localeDir ?? "locale")]);
    let worker = this.workers.get(project.dir);
    if (!worker) {
      worker = new ScanWorker({ dir: project.dir, probePath: this.probePath });
      this.workers.set(project.dir, worker);
    }
    const { overlay, ...marked } = await worker.request(input, this.overlays.get(project.dir) ?? {});
    // Un overlay di un processo chiuso da forget() è della config di prima.
    if (marked.ok && overlay && this.workers.get(project.dir) === worker) this.overlays.set(project.dir, overlay);
    // Chiuso da forget() mentre lavorava: la risposta non serve a nessuno, e non è un errore.
    if (marked.code === "DISPOSED") return marked;
    const o = marked.origin;
    const da = o ? ` [index ${marked.index}: ${o.index} from the index, ${o.overlay} kept, ${o.parsed} parsed${marked.babel ? ", Babel warm" : ""}]` : "";
    this.log(
      `${project.dir}: source ${marked.ok ? `scanned in ${marked.ms} ms, ${markedSummary(marked)}${da}` : `NOT scanned\n  ${marked.error}`}` +
        (marked.warnings?.length ? `\n  ${marked.warnings.map((w) => `${w.rel}: ${w.message}`).join("\n  ")}` : "") +
        (marked.output ? `\n  output:\n${marked.output}` : "")
    );
    return marked;
  }
}

// La sezione Selector: una webview (selectorPage.mjs, lo script in dist/webview.js). Non tiene
// niente: `stato()` le dice cosa mostrare, e ogni clic arriva qui come messaggio `{ cmd, value }`,
// che `run` esegue. La pagina si ricrea da zero ogni volta che torna in vista, e appena carica
// chiede lo stato (`ready`); da lì in poi push() glielo rimanda solo quando cambia.
export class SelectorView {
  /**
   * @param {object} p
   * @param {vscode.Uri} p.extensionUri
   * @param {() => Promise<object>} p.stato - selectorState.mjs
   * @param {(cmd: string, value?: string) => any} p.run
   * @param {() => void} [p.onVisible] - la sezione è tornata in vista
   */
  constructor({ extensionUri, stato, run, onVisible }) {
    Object.assign(this, { extensionUri, stato, run, onVisible });
    this.view = null;
    this.ultimo = null; // la firma dell'ultimo stato mandato
    this.turno = 0; // numera i push: uno superato non manda niente
  }

  get visible() {
    return this.view?.visible ?? false;
  }

  resolveWebviewView(view) {
    this.view = view;
    this.ultimo = null;
    const dist = vscode.Uri.joinPath(this.extensionUri, "dist");
    // Solo dist/: la pagina non vede nient'altro dell'estensione, né del workspace.
    view.webview.options = { enableScripts: true, localResourceRoots: [dist] };
    view.webview.html = selectorHtml({
      scriptUri: String(view.webview.asWebviewUri(vscode.Uri.joinPath(dist, "webview.js"))),
      codiconsUri: String(view.webview.asWebviewUri(vscode.Uri.joinPath(dist, "codicon.css"))),
      cspSource: view.webview.cspSource,
      nonce: randomBytes(16).toString("hex"),
    });
    const ascolti = [
      view.webview.onDidReceiveMessage((m) => {
        if (m?.cmd === "ready") {
          // Una pagina nuova non ha niente: lo stato va rimandato anche se uguale.
          this.ultimo = null;
          return this.push();
        }
        return this.run(m?.cmd, m?.value);
      }),
      view.onDidChangeVisibility?.(() => view.visible && this.onVisible?.()),
    ].filter(Boolean);
    view.onDidDispose(() => {
      for (const a of ascolti) a.dispose();
      if (this.view === view) this.view = null;
    });
  }

  /** Manda lo stato alla pagina, se è cambiato dall'ultima volta. */
  async push() {
    if (!this.view) return;
    const turno = ++this.turno;
    const stato = await this.stato();
    if (turno !== this.turno || !this.view) return;
    const firma = JSON.stringify(stato);
    if (firma === this.ultimo) return;
    this.ultimo = firma;
    return this.view.webview.postMessage({ type: "state", ...stato });
  }
}

export function activate(context) {
  const canale = vscode.window.createOutputChannel("viteTranslate");
  const log = (riga) => canale.appendLine(`[${new Date().toLocaleTimeString()}] ${riga}`);
  const tree = new Projects({ probePath: context.asAbsolutePath(path.join("dist", "probe.mjs")), log, state: context.workspaceState });
  const marked = new MarkedTree({ configs: tree, probePath: context.asAbsolutePath(path.join("dist", "markedProbe.mjs")), log, state: context.workspaceState });
  const markedView = vscode.window.createTreeView(MARKED_VIEW_ID, { treeDataProvider: marked, showCollapseAll: true });
  marked.view = markedView;
  const details = new DetailsTree({ configs: tree });
  const detailsView = vscode.window.createTreeView(DETAILS_VIEW_ID, { treeDataProvider: details, showCollapseAll: true });
  details.view = detailsView;
  // Il sync del progetto selezionato: il CLI della libreria installata lì (syncCommand.mjs), in un
  // task — il pannello del terminale, coi colori del CLI e il suo codice d'uscita. Col binario
  // dell'editor in modalità Node, come le sonde: nessun `node` né `npx` richiesto nel PATH. Il CLI
  // esegue vite.config, quindi non in Restricted Mode; uno alla volta per progetto. Le tabelle che
  // scrive le vede il watcher dei sorgenti, e Results si aggiorna da sé.
  const sincronizza = async () => {
    const progetto = await tree.selectedProject();
    if (!progetto) return vscode.window.showInformationMessage("Select a project in Selector first.");
    if (!vscode.workspace.isTrusted) return vscode.window.showWarningMessage("Trust the workspace to run the sync: it executes vite.config.");
    const trovato = findCli(progetto.dir);
    if (!trovato.ok) return vscode.window.showErrorMessage(`viteTranslate: ${trovato.error}`);
    const inCorso = vscode.tasks.taskExecutions.some((e) => e.task.definition.type === "vitetranslate" && e.task.definition.dir === progetto.dir);
    if (inCorso) return vscode.window.showInformationMessage("A sync is already running for this project.");
    const task = new vscode.Task(
      { type: "vitetranslate", command: "sync", dir: progetto.dir },
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(progetto.dir)) ?? vscode.TaskScope.Workspace,
      `sync ${tree.titleOf(progetto)}`,
      "viteTranslate",
      new vscode.ProcessExecution(process.execPath, [trovato.cli], { cwd: progetto.dir, env: { ELECTRON_RUN_AS_NODE: "1" } })
    );
    task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, clear: true };
    log(`${progetto.dir}: sync started (${trovato.name} ${trovato.version})`);
    return vscode.tasks.executeTask(task);
  };

  // I clic di Selector: i due elenchi e i bottoni.
  const azioni = {
    select: (dir) => tree.select(dir),
    filter: (filtro) => marked.setFilter(filtro),
    search: (testo) => marked.setSearch(testo),
    sync: () => vscode.commands.executeCommand("vitetranslate.sync"),
    refresh: () => vscode.commands.executeCommand("vitetranslate.refresh"),
    openConfig: async () => {
      const progetto = await tree.selectedProject();
      if (!progetto) return vscode.window.showInformationMessage("Select a project in Selector first.");
      return vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path.join(progetto.dir, progetto.configFile)));
    },
  };
  const selector = new SelectorView({
    extensionUri: context.extensionUri,
    stato: async () => {
      let progetti = [];
      try {
        progetti = await tree.currentList();
      } catch {
        // l'elenco non si legge: lo dice il canale, qui un elenco vuoto
      }
      const scelto = await tree.selectedProject();
      return selectorState({
        projects: progetti,
        selected: scelto?.dir ?? null,
        roots: workspaceRoots(),
        nameOf: (dir) => tree.nameOf(dir),
        marked: scelto ? marked.resultOf(scelto.dir) : null,
        filter: marked.filter,
        search: marked.search,
      });
    },
    run: (cmd, value) => (Object.hasOwn(azioni, cmd) ? azioni[cmd](value) : log(`Selector: unknown command ${JSON.stringify(cmd)}`)),
    onVisible: () => allaVista(),
  });
  // Lo stato di Selector segue l'elenco, la selezione, i risultati e il filtro.
  tree.onDidChange(() => selector.push());
  marked.onDidChangeTreeData(() => selector.push());
  // "yml tables" in Details colora i file di lingua coi conteggi dell'ultima scansione di Results:
  // si ridisegna quando cambiano, non a ogni ridisegno di Results.
  details.stats = (dir) => marked.resultOf(dir)?.languages?.stats ?? null;
  let firmaStats;
  marked.onDidChangeTreeData(async () => {
    const progetto = await tree.selectedProject();
    const firma = JSON.stringify(progetto ? details.stats(progetto.dir) : null);
    if (firma === firmaStats) return;
    firmaStats = firma;
    details.refresh();
  });

  // La barra di avanzamento della sezione: VS Code la mostra da sé solo mentre getChildren
  // aspetta, e qui getChildren non aspetta mai.
  const barra = (viewId) => (promessa) => vscode.window.withProgress({ location: { viewId } }, () => promessa);
  marked.progress = barra(MARKED_VIEW_ID);
  details.progress = barra(DETAILS_VIEW_ID);

  // Le notifiche arrivano a raffica (un salvataggio tocca più file, un git checkout molti): si
  // aspetta che si calmino. A pannello nascosto — tutte le sezioni chiuse o fuori vista — non si
  // ricalcola niente, lo si segna e basta: ci pensa il prossimo onDidChangeVisibility.
  const visibile = () => selector.visible || markedView.visible || detailsView.visible;
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

  // Lo stesso per i salvataggi dei sorgenti, che toccano solo Results.
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
  // Subito, prima dell'attesa: Details si svuota ("Reading vite.config…") e Results si blocca.
  const cambiato = (uri) => {
    if (inNodeModules(uri.fsPath)) return;
    tree.forget(path.dirname(uri.fsPath));
    marked.forget(path.dirname(uri.fsPath));
    details.refresh();
    presto(true);
  };
  const sorgenti = vscode.workspace.createFileSystemWatcher(SOURCE_GLOB);
  // forgetFile blocca subito la riga del file; la scansione parte dopo l'attesa.
  const sorgenteCambiato = (uri) => {
    if (inNodeModules(uri.fsPath)) return;
    if (marked.forgetFile(uri.fsPath)) prestoMarked();
  };
  // Un file creato o cancellato: se è un file di lingua cambia anche l'elenco "yml tables" di
  // Details, che rilegge la cartella a ogni disegno.
  const sorgenteNuovoOVia = (uri) => {
    sorgenteCambiato(uri);
    if (!inNodeModules(uri.fsPath) && uri.fsPath.endsWith(".yml")) details.refresh();
  };
  // Le modifiche non salvate: la riga del file si blocca finché il documento è sporco. L'evento
  // arriva a ogni tasto, ma setDirty fa qualcosa solo quando lo stato cambia.
  const documento = (doc, sporco) => {
    if (doc?.uri?.scheme === "file") marked.setDirty(doc.uri.fsPath, sporco);
  };
  for (const doc of vscode.workspace.textDocuments ?? []) if (doc.isDirty) documento(doc, true);

  // Il file attivo porta il pannello dove sta. Passando da un editor all'altro in fretta (Ctrl+Tab)
  // conta solo l'ultimo. Un progetto diverso si seleziona come da un clic in Config; lo stesso
  // progetto non tocca niente. Poi Results mostra il file.
  let timerEditor;
  const segui = async (editor) => {
    const uri = editor?.document?.uri;
    if (uri?.scheme !== "file" || inNodeModules(uri.fsPath)) return;
    let progetti;
    try {
      progetti = await tree.currentList();
    } catch {
      return;
    }
    const progetto = projectOf(progetti, uri.fsPath);
    if (!progetto) return;
    if (progetti.length > 1) tree.select(progetto.dir);
    marked.follow(uri.fsPath, progetto.dir);
  };
  const seguiEditor = (editor) => {
    clearTimeout(timerEditor);
    timerEditor = setTimeout(() => segui(editor), 150);
  };

  const allaVista = () => {
    if (markedView.visible) marked.applyTarget();
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
    markedView,
    detailsView,
    vscode.window.registerWebviewViewProvider(SELECTOR_VIEW_ID, selector),
    vscode.window.registerFileDecorationProvider(badges),
    watcher,
    watcher.onDidChange(cambiato),
    watcher.onDidCreate(cambiato),
    watcher.onDidDelete(cambiato),
    sorgenti,
    sorgenti.onDidChange(sorgenteCambiato),
    sorgenti.onDidCreate(sorgenteNuovoOVia),
    sorgenti.onDidDelete(sorgenteNuovoOVia),
    markedView.onDidChangeVisibility(allaVista),
    detailsView.onDidChangeVisibility(allaVista),
    vscode.window.onDidChangeActiveTextEditor(seguiEditor),
    vscode.workspace.onDidChangeTextDocument((e) => documento(e.document, e.document.isDirty)),
    vscode.workspace.onDidCloseTextDocument((doc) => documento(doc, false)),
    vscode.workspace.onDidChangeWorkspaceFolders(() => presto(true)),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      tree.forget();
      marked.forget();
      details.refresh();
      presto(true);
    }),
    vscode.commands.registerCommand("vitetranslate.select", (dir) => tree.select(dir)),
    vscode.commands.registerCommand("vitetranslate.sync", sincronizza),
    vscode.tasks.onDidEndTaskProcess((e) => {
      const d = e.execution.task.definition;
      if (d.type !== "vitetranslate") return;
      log(`${d.dir}: sync ended with exit code ${e.exitCode}`);
      if (e.exitCode) vscode.window.showErrorMessage("viteTranslate: the sync failed. See the terminal for why.");
    }),
    vscode.commands.registerCommand("vitetranslate.refresh", () => {
      tree.forget();
      marked.forget();
      details.refresh();
      return tree.relist(true);
    }),
    { dispose: () => (clearTimeout(timer), clearTimeout(timerMarked), clearTimeout(timerEditor), marked.dispose()) }
  );
  // All'apertura, il file già attivo.
  seguiEditor(vscode.window.activeTextEditor);
  return { tree, marked, details, selector };
}

export function deactivate() {}
