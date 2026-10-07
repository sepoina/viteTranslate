// L'elenco dei progetti Vite del workspace, la selezione, e le letture di ciascuno (vite.config via
// sonda, package.json). Non è una vista: lo mostra Selector, e Results e Project lo seguono
// (onDidChange: elenco cambiato, selezione cambiata; onDidRead: una lettura arrivata).
import * as vscode from "vscode";
import path from "node:path";
import { CONFIG_GLOB, dedupeConfigs } from "./pickProject.mjs";
import readPackage from "./readPackage.mjs";
import runProbe from "../probes/runProbe.mjs";

// La chiave della selezione in workspaceState: il percorso del progetto selezionato.
const SELECTED_KEY = "vitetranslate.selected";

// La firma di un elenco: se non cambia, il pannello non si ridisegna.
const firma = (projects) => projects.map((p) => path.join(p.dir, p.configFile)).join("\n");

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
    // Una lettura (vite.config, package.json) arrivata: Project accende LLM se c'è `llm`.
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

  /** L'elenco mostrato, o vuoto se non si legge (lo dice già il canale): per chi disegna. */
  async listOrEmpty() {
    try {
      return await this.currentList();
    } catch {
      return [];
    }
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

  /**
   * Il messaggio di Results cambia fra "nessun progetto" e "selezionane uno"; Selector resta
   * accanto al guasto della libreria solo se c'è un altro progetto da scegliere (il suo `when`).
   */
  syncContext(progetti) {
    const contesto = { "vitetranslate.hasProjects": progetti.length > 0, "vitetranslate.manyProjects": progetti.length > 1 };
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

  /** Il selezionato, per un comando che ne vuole uno: senza, lo si dice all'utente. */
  async selectedOrAsk() {
    const progetto = await this.selectedProject();
    if (!progetto) vscode.window.showInformationMessage("Select a project in Selector first.");
    return progetto;
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
