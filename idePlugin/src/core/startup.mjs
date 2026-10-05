// L'avvio. Finché la prima immagine non è pronta Results e Project restano nascoste e Selector
// scrive cosa si sta facendo (`starting`). Pronta vuol dire: l'elenco dei progetti c'è e, se uno è
// selezionato, il suo vite.config è letto e la sua prima scansione è arrivata — così le sezioni
// compaiono già piene, invece di passare da "Loading…". La preparazione la fa questo giro, non
// le sezioni: nascoste, VS Code non chiede loro niente. Da lì la chiave resta vera: i ricalcoli
// successivi hanno già i loro segni (Loading…, ⏳). Un tetto di tempo, nel caso qualcosa si pianti.
// Il giro parte con la prima sezione in vista (avviaPannello in extension.mjs), non con l'estensione.
//
// I tempi, nel canale: quanto ci mette a essere pronto, e da lì quanto ci mette VS Code a mostrare
// Results e a creare, caricare e disegnare la pagina di Project (stage). Una volta sola.
import * as vscode from "vscode";

// Vera quando la prima immagine del pannello è pronta: fino ad allora Results e Project non si
// vedono (i loro `when` in package.json) e Selector dice cosa sta preparando. Poi resta vera.
const READY_CONTEXT = "vitetranslate.ready";
// Oltre questo tempo le sezioni si mostrano comunque: col loro "Loading…", ma si mostrano.
const READY_TIMEOUT_MS = 30000;

export class Startup {
  /**
   * @param {object} p
   * @param {import("./projects.mjs").Projects} p.projects
   * @param {{ prepare: (project: object) => Promise<void> }} p.marked - la prima scansione (MarkedTree)
   * @param {(riga: string) => void} p.log
   */
  constructor({ projects, marked, log }) {
    Object.assign(this, { projects, marked, log });
    this.cambiato = new vscode.EventEmitter();
    this.onDidChange = this.cambiato.event; // `starting` è cambiato
    // Il tempo e il tetto partono con start(), non con l'estensione: attivata da un file js/ts (per
    // l'evidenziazione), il pannello può aprirsi molto dopo.
    this.t0 = null;
    this.timer = undefined;
    this.tPronto = null;
    this.tappe = new Set();
    this.pronto = false;
    this.testo = "Looking for Vite projects…";
  }

  /** Cosa si sta preparando, o null a preparazione finita. */
  get starting() {
    return this.pronto ? null : this.testo;
  }

  /** Una tappa dopo il pronto, nel canale; ognuna una volta sola. */
  stage(nome) {
    if (this.tPronto === null || this.tappe.has(nome)) return;
    this.tappe.add(nome);
    this.log(`startup: ${nome} +${Date.now() - this.tPronto} ms after ready`);
  }

  /** Prepara la prima immagine; si risolve a pannello pronto. */
  async start() {
    if (this.pronto) return;
    this.t0 ??= Date.now();
    this.timer ??= setTimeout(() => this.accendi(), READY_TIMEOUT_MS);
    try {
      await this.projects.currentList();
    } catch {
      return this.accendi();
    }
    const progetto = await this.projects.selectedProject();
    if (!progetto) return this.accendi();
    const nome = this.projects.titleOf(progetto);
    this.passo(`Reading the vite.config of ${nome}…`);
    await this.projects.data(progetto);
    this.passo(`Scanning ${nome} for marked strings…`);
    await this.marked.prepare(progetto);
    // Nel frattempo è cambiata la selezione (il file attivo, un clic): si prepara quella.
    if ((await this.projects.selectedProject())?.dir !== progetto.dir) return this.start();
    this.accendi();
  }

  passo(testo) {
    this.testo = testo;
    this.cambiato.fire(undefined);
  }

  accendi() {
    if (this.pronto) return;
    this.pronto = true;
    clearTimeout(this.timer);
    this.tPronto = Date.now();
    this.log(`startup: ready in ${this.tPronto - this.t0} ms`);
    vscode.commands.executeCommand("setContext", READY_CONTEXT, true);
    this.cambiato.fire(undefined);
  }

  dispose() {
    clearTimeout(this.timer);
  }
}
