// L'unico file che parla con VS Code. Tutto il resto (quale progetto, cosa leggere, quali righe)
// sta nei moduli accanto, che non importano `vscode` e si provano in Node puro.
//
// Il pannello è un contenitore suo della Activity Bar (contributes.viewsContainers in
// package.json) con tre sezioni, dall'alto:
//
//   - Selector (PageView): una webview coi componenti di @vscode-elements/elements. Config,
//     l'elenco dei progetti Vite del workspace (solo se più di uno); Filter, le scelte del filtro di
//     Results (solo se oltre ad All ce n'è qualcuna); Search.
//     Lo stato lo tiene l'estensione (selectorState.mjs) e glielo manda; la webview rimanda i
//     clic. La selezione del progetto e il filtro sopravvivono alla chiusura (workspaceState).
//   - Results (MarkedTree): le voci marcate del selezionato, file per file, filtrate.
//   - la sezione facoltativa (OptionalView): al posto di Results, solo dopo un clic su LLM. Su un
//     progetto senza `llm` è Help, come configurarlo (helpPage.mjs); con `llm` è il pannello LLM:
//     dove sta la chiave, se le impostazioni bastano, se il modello risponde (un controllo in
//     background, llmCheck.mjs), e le azioni --llm-* (llmPanel.mjs, llmPage.mjs). Close la toglie
//     e Results torna.
//   - Project (PageView, come Selector): in alto, e scorrono, i file di lingua (Languages) e la
//     sintesi di vitetranslate, package.json e vite.config (Details, un vscode-tree); in fondo, ferma,
//     la barra dei comandi: i bottoni Sync e LLM e le icone Refresh, vite.config, opzioni del
//     plugin, impostazioni. Stato in projectState.mjs.
//
// Finché non c'è una selezione Results e Project sono vuote: Results mostra il messaggio di
// viewsWelcome ("Select a project…"), Project lo scrive da sé. Projects tiene l'elenco, la selezione
// e le letture dei progetti (vite.config via sonda, package.json), che le sezioni chiedono a lui.
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
// E il cursore, a ritroso (seguiCursore): su una riga che ha una voce, Results la seleziona.
//
// Results e Project non aspettano mai una sonda per disegnare: quello che mostrano o è giusto o si
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
import { markedInput, markedChildren, markedSummary, filterItems, FILTERS, loadingRow, frozenRows } from "./markedRows.mjs";
import { ScanWorker } from "./scanWorker.mjs";
import { entryAtCursor } from "./markerSpan.mjs";
import { selectorHtml } from "./selectorPage.mjs";
import { projectHtml } from "./projectPage.mjs";
import { helpHtml } from "./helpPage.mjs";
import { llmHtml } from "./llmPage.mjs";
import { llmPanelState } from "./llmPanel.mjs";
import { runLlmCheck } from "./llmCheck.mjs";
import { selectorState } from "./selectorState.mjs";
import { projectState, keyPosition } from "./projectState.mjs";
import { findCli, LLM_ACTIONS, pluginCallPosition } from "./syncCommand.mjs";
import fs from "node:fs";

const SELECTOR_VIEW_ID = "vitetranslate.selector";
const MARKED_VIEW_ID = "vitetranslate.results";
const OPTIONAL_VIEW_ID = "vitetranslate.optional";
// Vera mentre la sezione facoltativa sta al posto di Results (i `when` delle due in package.json).
const OPTIONAL_CONTEXT = "vitetranslate.optional";
// Vera quando la prima immagine del pannello è pronta: fino ad allora Results e Project non si
// vedono (i loro `when` in package.json) e Selector dice cosa sta preparando. Poi resta vera.
const READY_CONTEXT = "vitetranslate.ready";
// Oltre questo tempo le sezioni si mostrano comunque: col loro "Loading…", ma si mostrano.
const READY_TIMEOUT_MS = 30000;
const PROJECT_VIEW_ID = "vitetranslate.project";
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
// riga che ha già il suo id passa com'è. Su tutto l'albero e una volta sola per disegno: VS Code riconosce una
// riga dall'oggetto — reveal la cerca fra quelle che getChildren gli ha dato — quindi fra un
// ridisegno e l'altro getChildren deve restituire sempre gli stessi. Annota in `disegno` i padri
// (per getParent), le righe dei file, per percorso (per follow), e le voci con una chiave, per id
// (la voce selezionata è ancora nel disegno? vedi chiaveScelta in activate).
function fissa(righe, padre, disegno, genitore) {
  return righe.map((r) => {
    const riga = r.id ? r : { ...r, id: `${padre}/${r.key ?? r.label}` };
    if (riga.children) riga.children = fissa(riga.children, riga.id, disegno, riga);
    if (genitore) disegno.parents.set(riga, genitore);
    if (riga.kind === "file" && riga.resource) disegno.files.set(pathKey(riga.resource), riga);
    if (riga.keyId) disegno.keys.set(riga.id, riga);
    return riga;
  });
}

// Da riga (markedRows.mjs) a TreeItem, per Results.
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

// L'elenco dei progetti Vite del workspace, la selezione, e le letture di ciascuno (vite.config via
// sonda, package.json). Non è una vista: lo mostra Selector, e Results e Project lo seguono
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
    // Una lettura (vite.config, package.json) arrivata: Selector accende LLM se c'è `llm`.
    this.letto = new vscode.EventEmitter();
    this.onDidRead = this.letto.event;
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

  /** Il messaggio di Results cambia fra "nessun progetto" e "selezionane uno". */
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
   * se è ancora nell'elenco. Nessuna scelta automatica: senza selezione Results e Project
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
        if (this.cache.get(project.dir) !== dati) return;
        this.letti.set(project.dir, valore);
        this.letto.fire(project.dir);
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
    // Un disegno nuovo consegnato a VS Code (`rendered`): dopo, non prima come onDidChangeTreeData.
    this.disegnato = new vscode.EventEmitter();
    this.onDidRender = this.disegnato.event;
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

  /**
   * Il primo carico di `project` senza aspettare che Results lo disegni (l'avvio, con la sezione
   * ancora nascosta). Si risolve quando c'è un risultato, buono o no.
   */
  async prepare(project) {
    const s = this.statoDi(project.dir);
    if (!s.risultato && !s.carico && !s.attesa) this.avvia(project, s);
    if (s.carico) await s.carico;
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
  /**
   * La voce del disegno corrente sotto il cursore in `file` (riga e colonna da 1): sulla riga, o
   * risalendo fino a una voce su più righe che la contiene (entryAtCursor, col `testo` del
   * documento). Solo voci cliccabili: quelle di un file bloccato (salvato e in riscansione, o con
   * modifiche non salvate) hanno righe forse vecchie, e niente `open`.
   */
  entryAt(file, line, column, testo = null) {
    const disegno = this.rendered;
    if (!disegno || disegno.loading) return null;
    const voci = (disegno.files.get(pathKey(file))?.children ?? []).filter((r) => r.open && r.line);
    return entryAtCursor(voci, testo, line, column);
  }

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
    const disegno = { dir: project.dir, parents: new Map(), files: new Map(), keys: new Map(), loading: !s.risultato };
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
      this.disegnato.fire(disegno);
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

// Le sezioni Selector e Project: due webview (selectorPage.mjs e projectPage.mjs, gli script in
// dist/). Non tengono niente: `stato()` dice cosa mostrare, e ogni clic arriva qui come messaggio `{ cmd, value }`,
// che `run` esegue. La pagina si ricrea da zero ogni volta che torna in vista, e appena carica
// chiede lo stato (`ready`); da lì in poi push() glielo rimanda solo quando cambia.
export class PageView {
  /**
   * @param {object} p
   * @param {vscode.Uri} p.extensionUri
   * @param {(p: object) => string} p.html - la pagina: selectorHtml, projectHtml
   * @param {string} p.script - il suo script, in dist/
   * @param {() => Promise<object>} p.stato - selectorState.mjs, projectState.mjs
   * @param {(cmd: string, value?: string) => any} p.run
   * @param {() => void} [p.onVisible] - la sezione è tornata in vista
   * @param {(stato: object) => string | undefined} [p.describe] - la descrizione nell'intestazione
   * @param {(fase: "page" | "script" | "drawn") => void} [p.onStage] - le tappe di una pagina nuova:
   *   creata, script caricato (`ready`), primo stato disegnato (`drawn`, se la pagina lo dice)
   */
  constructor({ extensionUri, html, script, stato, run, onVisible, describe, onStage }) {
    Object.assign(this, { extensionUri, html, script, stato, run, onVisible, describe, onStage });
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
    view.webview.html = this.html({
      scriptUri: String(view.webview.asWebviewUri(vscode.Uri.joinPath(dist, this.script))),
      codiconsUri: String(view.webview.asWebviewUri(vscode.Uri.joinPath(dist, "codicon.css"))),
      cspSource: view.webview.cspSource,
      nonce: randomBytes(16).toString("hex"),
    });
    this.onStage?.("page");
    const ascolti = [
      view.webview.onDidReceiveMessage((m) => {
        if (m?.cmd === "ready") {
          this.onStage?.("script");
          // Una pagina nuova non ha niente: lo stato va rimandato anche se uguale.
          this.ultimo = null;
          return this.push();
        }
        if (m?.cmd === "drawn") return this.onStage?.("drawn");
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
    if (this.describe) this.view.description = this.describe(stato);
    const firma = JSON.stringify(stato);
    if (firma === this.ultimo) return;
    this.ultimo = firma;
    return this.view.webview.postMessage({ type: "state", ...stato });
  }
}

/**
 * La sezione facoltativa: una webview che prende il posto di Results (una TreeView non può
 * diventare una webview: sono due sezioni, e la context key OPTIONAL_CONTEXT decide quale si
 * vede). Due pagine, `mode`:
 *   - "help": come configurare `llm`, testo fisso (helpPage.mjs);
 *   - "llm": il pannello LLM, che disegna lo stato di `stato()` (llmPanel.mjs) come fa PageView:
 *     chiede lo stato al caricamento (`ready`), poi push() lo rimanda solo quando cambia.
 * show() la mette e la porta in primo piano, setMode() cambia pagina senza spostare il focus,
 * close() rimette Results. I clic finiscono in `run`.
 */
export class OptionalView {
  /**
   * @param {object} p
   * @param {vscode.Uri} p.extensionUri
   * @param {() => Promise<object | null>} p.stato - lo stato del pannello LLM, o null
   * @param {(cmd: string, value?: string) => any} p.run
   */
  constructor({ extensionUri, stato, run }) {
    Object.assign(this, { extensionUri, stato, run });
    this.mode = null; // null: chiusa
    this.view = null;
    this.ultimo = null;
    this.turno = 0;
  }

  resolveWebviewView(view) {
    this.view = view;
    const dist = vscode.Uri.joinPath(this.extensionUri, "dist");
    view.webview.options = { enableScripts: true, localResourceRoots: [dist] };
    this.render();
    const ascolto = view.webview.onDidReceiveMessage((m) => {
      if (m?.cmd === "ready") {
        this.ultimo = null;
        return this.push();
      }
      return this.run(m?.cmd, m?.value);
    });
    view.onDidDispose(() => {
      ascolto.dispose();
      if (this.view === view) this.view = null;
    });
  }

  // La pagina del modo corrente, e il nome della sezione: "LLM" o "Help".
  render() {
    if (!this.view) return;
    const dist = vscode.Uri.joinPath(this.extensionUri, "dist");
    const llm = this.mode === "llm";
    this.ultimo = null;
    this.view.title = llm ? "LLM" : "Help";
    this.view.description = undefined;
    this.view.webview.html = (llm ? llmHtml : helpHtml)({
      scriptUri: String(this.view.webview.asWebviewUri(vscode.Uri.joinPath(dist, "optionalWebview.js"))),
      codiconsUri: String(this.view.webview.asWebviewUri(vscode.Uri.joinPath(dist, "codicon.css"))),
      cspSource: this.view.webview.cspSource,
      nonce: randomBytes(16).toString("hex"),
    });
  }

  /** @param {"help" | "llm"} mode */
  setMode(mode) {
    if (mode === this.mode) return this.push();
    this.mode = mode;
    this.render();
  }

  /** @param {"help" | "llm"} mode */
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

  /** Manda lo stato al pannello LLM, se è aperto ed è cambiato dall'ultima volta. */
  async push() {
    if (this.mode !== "llm" || !this.view) return;
    const turno = ++this.turno;
    const stato = await this.stato();
    if (turno !== this.turno || this.mode !== "llm" || !this.view || !stato) return;
    this.view.description = stato.title ?? undefined;
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
  // La voce selezionata adesso in Results, per Languages in Project: { dir, id }, o null. Vale solo
  // se è una voce (con la chiave, non un file né una cartella), se sta nel disegno corrente (un
  // filtro, una ricerca, un ridisegno possono averla tolta), se è del progetto selezionato, e se
  // Results è in vista (non chiusa, non coperta dalla sezione facoltativa). Non si salva: si guarda.
  const chiaveScelta = async () => {
    if (!markedView.visible) return null;
    const riga = markedView.selection?.[0];
    const disegno = marked.rendered;
    if (!riga?.keyId || !disegno?.keys.has(riga.id)) return null;
    if ((await tree.selectedProject())?.dir !== disegno.dir) return null;
    return { dir: disegno.dir, id: riga.keyId };
  };
  // La barra di avanzamento della sezione: VS Code la mostra da sé solo mentre getChildren
  // aspetta, e qui getChildren non aspetta mai (né c'è un getChildren, in Project).
  const barra = (viewId) => (promessa) => vscode.window.withProgress({ location: { viewId } }, () => promessa);
  // Il CLI del progetto selezionato: quello della libreria installata lì (syncCommand.mjs), in un
  // task — il pannello del terminale, coi colori del CLI, il suo codice d'uscita, e l'input (un
  // --llm-translate chiede conferma, --llm-key-set la chiave). Col binario dell'editor in modalità
  // Node, come le sonde: nessun `node` né `npx` richiesto nel PATH. Il CLI esegue vite.config,
  // quindi non in Restricted Mode; un comando alla volta per progetto. Le tabelle che scrive le vede
  // il watcher dei sorgenti, e Results si aggiorna da sé.
  //   `nome` è il nome del task e del comando nei messaggi ("sync", "llm translate", …).
  const lanciaCli = async (progetto, args, nome) => {
    if (!vscode.workspace.isTrusted) return vscode.window.showWarningMessage(`Trust the workspace to run ${nome}: it executes vite.config.`);
    const trovato = findCli(progetto.dir);
    if (!trovato.ok) return vscode.window.showErrorMessage(`viteTranslate: ${trovato.error}`);
    const inCorso = vscode.tasks.taskExecutions.find((e) => e.task.definition.type === "vitetranslate" && e.task.definition.dir === progetto.dir);
    if (inCorso) return vscode.window.showInformationMessage(`A ${inCorso.task.definition.command} is already running for this project.`);
    const task = new vscode.Task(
      { type: "vitetranslate", command: nome, dir: progetto.dir },
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(progetto.dir)) ?? vscode.TaskScope.Workspace,
      `${nome} ${tree.titleOf(progetto)}`,
      "viteTranslate",
      new vscode.ProcessExecution(process.execPath, [trovato.cli, ...args], { cwd: progetto.dir, env: { ELECTRON_RUN_AS_NODE: "1" } })
    );
    task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, clear: true };
    log(`${progetto.dir}: ${nome} started (${trovato.name} ${trovato.version})`);
    return vscode.tasks.executeTask(task);
  };
  const progettoScelto = async () => {
    const progetto = await tree.selectedProject();
    if (!progetto) vscode.window.showInformationMessage("Select a project in Selector first.");
    return progetto;
  };
  const sincronizza = async () => {
    const progetto = await progettoScelto();
    return progetto && lanciaCli(progetto, [], "sync");
  };

  // Il bottone LLM: la sezione facoltativa al posto di Results. Col blocco `llm` il pannello LLM
  // (controlli e azioni), senza Help, che spiega come aggiungerlo. Si aspetta la lettura di
  // vite.config, se non è ancora arrivata.
  const llm = async () => {
    const progetto = await progettoScelto();
    if (!progetto) return;
    const dati = await tree.data(progetto);
    return optional.show(dati?.probe?.vitetranslate?.llm ? "llm" : "help");
  };

  // Un'azione del pannello LLM (LLM_ACTIONS): il CLI in un task. --llm-retranslate vuole le
  // lingue: una scelta multipla fra quelle di destinazione.
  const azioneLlm = async (id) => {
    const azione = LLM_ACTIONS.find((a) => a.id === id);
    if (!azione) return log(`LLM: unknown action ${JSON.stringify(id)}`);
    const progetto = await progettoScelto();
    if (!progetto) return;
    let args = azione.args;
    if (azione.languages) {
      const lingue = marked.resultOf(progetto.dir)?.languages?.targets ?? [];
      if (!lingue.length) return vscode.window.showInformationMessage("No target language to retranslate yet: run the sync first.");
      const scelte = await vscode.window.showQuickPick(lingue, { title: `Retranslate · ${tree.titleOf(progetto)}`, placeHolder: "Which languages?", canPickMany: true });
      if (!scelte?.length) return;
      args = [...args, ...scelte];
    }
    return lanciaCli(progetto, args, `llm ${azione.args.map((a) => a.replace(/^--llm-/, "")).join(" ")}`);
  };

  // La chiave inglese: vite.config aperto sulla chiamata vitetranslate(…), le opzioni del plugin.
  const apriOpzioni = async () => {
    const progetto = await progettoScelto();
    if (!progetto) return;
    const file = path.join(progetto.dir, progetto.configFile);
    let dove = null;
    try {
      dove = pluginCallPosition(fs.readFileSync(file, "utf8"));
    } catch {
      // non si legge: lo apre comunque l'editor, che dirà lui perché
    }
    const punto = new vscode.Position((dove?.line ?? 1) - 1, (dove?.column ?? 1) - 1);
    return vscode.commands.executeCommand("vscode.open", vscode.Uri.file(file), { selection: new vscode.Range(punto, punto) });
  };

  // I clic di Selector: i due elenchi e i bottoni.
  const azioni = {
    select: (dir) => tree.select(dir),
    filter: (filtro) => marked.setFilter(filtro),
    search: (testo) => marked.setSearch(testo),
    sync: () => vscode.commands.executeCommand("vitetranslate.sync"),
    llm: () => vscode.commands.executeCommand("vitetranslate.llm"),
    refresh: () => vscode.commands.executeCommand("vitetranslate.refresh"),
    openConfig: async () => {
      const progetto = await progettoScelto();
      return progetto && vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path.join(progetto.dir, progetto.configFile)));
    },
    openPluginConfig: () => apriOpzioni(),
    // Una riga di Project col suo file: package.json, vite.config.
    open: (file) => file && vscode.commands.executeCommand("vscode.open", vscode.Uri.file(file)),
    // Un file di lingua: sulla riga della voce selezionata in Results (chiaveScelta), se il file
    // ce l'ha; il cursore all'inizio del valore, pronto per la traduzione. Senza voce, o con una
    // chiave che il file non ha ancora (la sync non è passata), il file in cima.
    openLanguage: async (file) => {
      if (!file) return;
      const chiave = await chiaveScelta();
      if (chiave) {
        let dove = null;
        try {
          dove = keyPosition(fs.readFileSync(file, "utf8"), chiave.id);
        } catch {
          // non si legge: lo apre comunque l'editor, che dirà lui perché
        }
        if (dove) {
          const punto = new vscode.Position(dove.line - 1, dove.column - 1);
          return vscode.commands.executeCommand("vscode.open", vscode.Uri.file(file), { selection: new vscode.Range(punto, punto) });
        }
        vscode.window.setStatusBarMessage(`viteTranslate: ${chiave.id} is not in ${path.basename(file)} yet. Run the sync.`, 5000);
      }
      return vscode.commands.executeCommand("vscode.open", vscode.Uri.file(file));
    },
    // L'ingranaggio: le impostazioni di VS Code filtrate su questa estensione.
    settings: () => vscode.commands.executeCommand("workbench.action.openSettings", `@ext:${context.extension?.id ?? "sepoina.vitetranslate-ide"}`),
  };
  // I controlli del pannello LLM (llmCheck.mjs), uno per progetto: partono la prima volta che il
  // pannello si apre su un progetto, e valgono finché non cambia il suo vite.config, non si chiede
  // "Check again" o non finisce un --llm-key-set|clear. Uno solo alla volta per progetto.
  const controlli = new Map(); // dir -> { stato, running, cancel }
  const dimenticaControllo = (dir) => {
    const dirs = dir === undefined ? [...controlli.keys()] : [dir];
    for (const d of dirs) {
      controlli.get(d)?.cancel();
      controlli.delete(d);
    }
  };
  const controlla = (progetto) => {
    let voce = controlli.get(progetto.dir);
    if (voce) return voce;
    if (!vscode.workspace.isTrusted) {
      voce = { stato: { error: "Restricted Mode: trust the workspace to run the check." }, running: false, cancel() {} };
    } else {
      const trovato = findCli(progetto.dir);
      if (!trovato.ok) voce = { stato: { error: trovato.error }, running: false, cancel() {} };
      else {
        voce = { stato: {}, running: true };
        const giro = runLlmCheck({
          cli: trovato.cli,
          dir: progetto.dir,
          onUpdate: (stato) => {
            if (controlli.get(progetto.dir) !== voce) return;
            voce.stato = stato;
            optional.push();
          },
        });
        voce.cancel = giro.cancel;
        voce.done = giro.done.then((stato) => {
          if (controlli.get(progetto.dir) !== voce) return;
          Object.assign(voce, { stato, running: false });
          log(`${progetto.dir}: llm check — key ${stato.key ?? "?"}, ping ${stato.ping ? (stato.ping.ok ? "ok" : stato.ping.skipped ? "skipped" : `failed: ${stato.ping.error}`) : "?"}${stato.error ? `, ${stato.error}` : ""}`);
          optional.push();
        });
      }
    }
    controlli.set(progetto.dir, voce);
    return voce;
  };
  const optional = new OptionalView({
    extensionUri: context.extensionUri,
    stato: async () => {
      const progetto = await tree.selectedProject();
      const opzioni = progetto ? tree.ready(progetto.dir)?.probe?.vitetranslate : null;
      if (!opzioni?.llm) return null;
      return llmPanelState({
        llm: opzioni.llm,
        // Dove il CLI cerca .env.local e .env: il baseDir del plugin, di solito il progetto.
        baseDir: opzioni.baseDir ? path.resolve(progetto.dir, opzioni.baseDir) : progetto.dir,
        check: controlla(progetto).stato,
        title: tree.titleOf(progetto),
      });
    },
    run: async (cmd, value) => {
      if (cmd === "close") return optional.close();
      if (cmd === "openPluginConfig") return apriOpzioni();
      if (cmd === "action") return azioneLlm(value);
      if (cmd === "recheck") {
        const progetto = await tree.selectedProject();
        if (progetto && !controlli.get(progetto.dir)?.running) dimenticaControllo(progetto.dir);
        return optional.push();
      }
      log(`Optional: unknown command ${JSON.stringify(cmd)}`);
    },
  });
  // Aperta, la sezione facoltativa segue il progetto selezionato: Help o LLM secondo il suo vite.config.
  const seguiOptional = async () => {
    if (!optional.mode) return;
    const progetto = await tree.selectedProject();
    const dati = progetto ? tree.ready(progetto.dir) : null;
    if (dati) optional.setMode(dati.probe?.vitetranslate?.llm ? "llm" : "help");
  };
  // Un clic in una pagina: il comando in `azioni`, o una riga nel canale.
  const esegui = (sezione) => (cmd, value) => (Object.hasOwn(azioni, cmd) ? azioni[cmd](value) : log(`${sezione}: unknown command ${JSON.stringify(cmd)}`));
  // L'avvio (vedi prepara, più sotto): finché non è pronto, Selector mostra solo `avvio`.
  // I tempi, nel canale: quanto ci mette a essere pronto, e da lì quanto ci mette VS Code a
  // mostrare Results e a creare, caricare e disegnare la pagina di Project. Una volta sola.
  const t0 = Date.now();
  let tPronto = null;
  const tappe = new Set();
  const tappa = (nome) => {
    if (tPronto === null || tappe.has(nome)) return;
    tappe.add(nome);
    log(`startup: ${nome} +${Date.now() - tPronto} ms after ready`);
  };
  let pronto = false;
  let avvio = "Looking for Vite projects…";
  const selector = new PageView({
    extensionUri: context.extensionUri,
    html: selectorHtml,
    script: "webview.js",
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
        starting: pronto ? null : avvio,
      });
    },
    run: esegui("Selector"),
    onVisible: () => allaVista(),
  });
  // Project: finché la lettura del vite.config non è arrivata la chiede (Projects.data la fa una
  // volta sola), con la barra di avanzamento della sezione; all'arrivo onDidRead ridisegna. I file
  // di lingua si colorano coi conteggi dell'ultima scansione di Results, e si rileggono dalla
  // cartella a ogni stato (tablesRow): push() manda solo se qualcosa è cambiato.
  const letture = new WeakSet();
  const project = new PageView({
    extensionUri: context.extensionUri,
    html: projectHtml,
    script: "projectWebview.js",
    stato: async () => {
      let progetti = [];
      try {
        progetti = await tree.currentList();
      } catch {
        // l'elenco non si legge: lo dice il canale, qui un elenco vuoto
      }
      const scelto = await tree.selectedProject();
      const dati = scelto ? tree.ready(scelto.dir) : undefined;
      if (scelto && !dati) {
        const lettura = tree.data(scelto);
        if (!letture.has(lettura)) {
          letture.add(lettura);
          barra(PROJECT_VIEW_ID)(lettura);
        }
      }
      return projectState({
        hasProjects: progetti.length > 0,
        project: scelto ?? null,
        title: scelto ? tree.titleOf(scelto) : null,
        dati,
        stats: scelto ? marked.resultOf(scelto.dir)?.languages?.stats ?? null : null,
        llm: !!dati?.probe?.vitetranslate?.llm,
        jumpKey: (await chiaveScelta())?.id ?? null,
      });
    },
    run: esegui("Project"),
    onVisible: () => allaVista(),
    describe: (stato) => stato.title ?? undefined,
    onStage: (fase) => tappa({ page: "Project page created", script: "Project script loaded", drawn: "Project drawn" }[fase]),
  });
  // L'avvio. Finché la prima immagine non è pronta Results e Project restano nascoste e Selector
  // scrive cosa si sta facendo (`avvio`). Pronta vuol dire: l'elenco dei progetti c'è e, se uno è
  // selezionato, il suo vite.config è letto e la sua prima scansione è arrivata — così le sezioni
  // compaiono già piene, invece di passare da "Loading…". La preparazione la fa questo giro, non
  // le sezioni: nascoste, VS Code non chiede loro niente. Da lì la chiave resta vera: i ricalcoli
  // successivi hanno già i loro segni (Loading…, ⏳). Un tetto di tempo, nel caso qualcosa si pianti.
  const timerAvvio = setTimeout(() => accendi(), READY_TIMEOUT_MS);
  const accendi = () => {
    if (pronto) return;
    pronto = true;
    clearTimeout(timerAvvio);
    tPronto = Date.now();
    log(`startup: ready in ${tPronto - t0} ms`);
    vscode.commands.executeCommand("setContext", READY_CONTEXT, true);
    selector.push();
  };
  const passo = (testo) => {
    avvio = testo;
    selector.push();
  };
  const prepara = async () => {
    if (pronto) return;
    try {
      await tree.currentList();
    } catch {
      return accendi();
    }
    const progetto = await tree.selectedProject();
    if (!progetto) return accendi();
    const nome = tree.titleOf(progetto);
    passo(`Reading the vite.config of ${nome}…`);
    await tree.data(progetto);
    passo(`Scanning ${nome} for marked strings…`);
    await marked.prepare(progetto);
    // Nel frattempo è cambiata la selezione (il file attivo, un clic): si prepara quella.
    if ((await tree.selectedProject())?.dir !== progetto.dir) return prepara();
    accendi();
  };
  const preparato = prepara();

  // Le due pagine seguono l'elenco, la selezione, le letture, i risultati e il filtro.
  const pagine = () => (selector.push(), project.push(), seguiOptional());
  tree.onDidChange(pagine);
  tree.onDidRead(pagine);
  marked.onDidChangeTreeData(pagine);

  marked.progress = barra(MARKED_VIEW_ID);

  // Le notifiche arrivano a raffica (un salvataggio tocca più file, un git checkout molti): si
  // aspetta che si calmino. A pannello nascosto — tutte le sezioni chiuse o fuori vista — non si
  // ricalcola niente, lo si segna e basta: ci pensa il prossimo onDidChangeVisibility.
  const visibile = () => selector.visible || markedView.visible || project.visible;
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
  // Subito, prima dell'attesa: Project si svuota ("Reading vite.config…") e Results si blocca.
  const cambiato = (uri) => {
    if (inNodeModules(uri.fsPath)) return;
    tree.forget(path.dirname(uri.fsPath));
    marked.forget(path.dirname(uri.fsPath));
    dimenticaControllo(path.dirname(uri.fsPath));
    project.push();
    presto(true);
  };
  const sorgenti = vscode.workspace.createFileSystemWatcher(SOURCE_GLOB);
  // forgetFile blocca subito la riga del file; la scansione parte dopo l'attesa.
  const sorgenteCambiato = (uri) => {
    if (inNodeModules(uri.fsPath)) return;
    if (marked.forgetFile(uri.fsPath)) prestoMarked();
  };
  // Un file creato o cancellato: se è un file di lingua cambia anche Languages in Project, che
  // rilegge la cartella a ogni stato.
  const sorgenteNuovoOVia = (uri) => {
    sorgenteCambiato(uri);
    if (!inNodeModules(uri.fsPath) && uri.fsPath.endsWith(".yml")) project.push();
  };
  // Le modifiche non salvate: la riga del file si blocca finché il documento è sporco. L'evento
  // arriva a ogni tasto, ma setDirty fa qualcosa solo quando lo stato cambia.
  const documento = (doc, sporco) => {
    if (doc?.uri?.scheme === "file") marked.setDirty(doc.uri.fsPath, sporco);
  };
  for (const doc of vscode.workspace.textDocuments ?? []) if (doc.isDirty) documento(doc, true);

  // La sonda inversa: il cursore nell'editor su una riga che ha una voce in Results, e Results la
  // seleziona — solo con Filter su All e Search vuota (l'albero intero: niente voci nascoste che
  // cambierebbero la scelta), Results in vista, il documento senza modifiche non salvate (le righe
  // del disegno sarebbero vecchie). Nessun giro vizioso: reveal non esegue il comando della riga
  // (lo fa solo un clic), quindi l'editor non si muove; un clic in Results che sposta il cursore
  // ritrova la voce già scelta, e lì si ferma. Il focus resta nell'editor.
  let timerCursore;
  const seguiCursore = (e) => {
    clearTimeout(timerCursore);
    timerCursore = setTimeout(() => {
      const doc = e.textEditor?.document;
      if (!markedView.visible || marked.filter !== "all" || marked.search.trim()) return;
      if (doc?.uri?.scheme !== "file" || doc.isDirty) return;
      const pos = e.textEditor.selection?.active ?? e.selections?.[0]?.active;
      if (!pos) return;
      const riga = marked.entryAt(doc.uri.fsPath, pos.line + 1, pos.character + 1, doc.getText?.() ?? null);
      if (!riga || markedView.selection?.[0]?.id === riga.id) return;
      markedView.reveal(riga, { select: true, focus: false });
    }, 150);
  };

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
    vscode.window.registerWebviewViewProvider(SELECTOR_VIEW_ID, selector),
    vscode.window.registerWebviewViewProvider(PROJECT_VIEW_ID, project),
    vscode.window.registerWebviewViewProvider(OPTIONAL_VIEW_ID, optional),
    watcher,
    watcher.onDidChange(cambiato),
    watcher.onDidCreate(cambiato),
    watcher.onDidDelete(cambiato),
    sorgenti,
    sorgenti.onDidChange(sorgenteCambiato),
    sorgenti.onDidCreate(sorgenteNuovoOVia),
    sorgenti.onDidDelete(sorgenteNuovoOVia),
    markedView.onDidChangeVisibility(() => (markedView.visible && tappa("Results shown"), allaVista())),
    // Il lampo accanto a Languages segue la selezione di Results, la sua visibilità e i suoi disegni.
    markedView.onDidChangeSelection(() => project.push()),
    markedView.onDidChangeVisibility(() => project.push()),
    marked.onDidRender(() => project.push()),
    vscode.window.onDidChangeActiveTextEditor(seguiEditor),
    vscode.window.onDidChangeTextEditorSelection(seguiCursore),
    vscode.workspace.onDidChangeTextDocument((e) => documento(e.document, e.document.isDirty)),
    vscode.workspace.onDidCloseTextDocument((doc) => documento(doc, false)),
    vscode.workspace.onDidChangeWorkspaceFolders(() => presto(true)),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      tree.forget();
      marked.forget();
      project.push();
      presto(true);
    }),
    vscode.commands.registerCommand("vitetranslate.select", (dir) => tree.select(dir)),
    vscode.commands.registerCommand("vitetranslate.sync", sincronizza),
    vscode.commands.registerCommand("vitetranslate.llm", llm),
    vscode.commands.registerCommand("vitetranslate.closeOptional", () => optional.close()),
    vscode.tasks.onDidEndTaskProcess((e) => {
      const d = e.execution.task.definition;
      if (d.type !== "vitetranslate") return;
      log(`${d.dir}: ${d.command} ended with exit code ${e.exitCode}`);
      if (e.exitCode) vscode.window.showErrorMessage(`viteTranslate: ${d.command} failed. See the terminal for why.`);
      // La chiave è cambiata nel keyring: il pannello LLM la cerca di nuovo.
      if (d.command === "llm key-set" || d.command === "llm key-clear") {
        dimenticaControllo(d.dir);
        optional.push();
      }
    }),
    vscode.commands.registerCommand("vitetranslate.refresh", () => {
      tree.forget();
      marked.forget();
      dimenticaControllo();
      project.push();
      return tree.relist(true);
    }),
    { dispose: () => (clearTimeout(timer), clearTimeout(timerMarked), clearTimeout(timerEditor), clearTimeout(timerAvvio), clearTimeout(timerCursore), marked.dispose(), dimenticaControllo()) }
  );
  // All'apertura, il file già attivo.
  seguiEditor(vscode.window.activeTextEditor);
  return { tree, marked, project, selector, optional, controlli, preparato };
}

export function deactivate() {}
