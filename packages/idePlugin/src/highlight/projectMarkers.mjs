// I delimitatori del progetto che contiene un file, per l'evidenziazione (4.7.0). Li dà la sonda di
// vite.config (Projects), la stessa del pannello: vitetranslateConfig.markers, che una libreria
// della 4.7.0 scrive sempre. null finché non si sanno — elenco non ancora calcolato, lettura in
// corso, Restricted Mode, libreria più vecchia — e allora chi colora usa quelli di serie.
//
// Chiedere i delimitatori di un file avvia la lettura del suo progetto, se manca: l'evidenziazione
// parte senza il pannello, e senza questo colorerebbe `_%_` in un progetto che usa altro. In un
// workspace non fidato Projects non esegue vite.config (risponde `untrusted`): nessun rischio nuovo.
import * as vscode from "vscode";
import path from "node:path";

// Su Windows i percorsi non distinguono le maiuscole (la lettera di unità, per esempio).
const norma = (p) => (process.platform === "win32" ? p.toLowerCase() : p);

export class ProjectMarkers {
  /** @param {{ projects: import("../core/projects.mjs").Projects }} p */
  constructor({ projects }) {
    this.projects = projects;
    this.elenco = null; // l'ultimo elenco dei progetti arrivato, ordinato dal più profondo
    this.emitter = new vscode.EventEmitter();
    this.onDidChange = this.emitter.event;
    this.ascolti = [
      projects.onDidRead(() => this.emitter.fire()),
      projects.onDidChange(() => {
        this.elenco = null;
        this.carica();
      }),
    ];
    this.carica();
  }

  carica() {
    this.projects.currentList().then((lista) => {
      this.elenco = [...lista].sort((a, b) => b.dir.length - a.dir.length);
      this.emitter.fire();
    }, () => {});
  }

  /** @returns {{ start: string, end: string } | null} */
  markersFor(fsPath) {
    if (typeof fsPath !== "string") return null;
    const file = norma(fsPath);
    const progetto = this.elenco?.find((p) => {
      const dir = norma(p.dir);
      return file === dir || file.startsWith(dir + path.sep);
    });
    if (!progetto) return null;
    const letto = this.projects.ready(progetto.dir);
    if (!letto) {
      // La lettura, quando arriva, fa scattare onDidRead.
      this.projects.data(progetto);
      return null;
    }
    return letto.probe?.vitetranslate?.markers ?? null;
  }

  dispose() {
    for (const a of this.ascolti) a.dispose();
    this.emitter.dispose();
  }
}
