// Quando ricalcolare l'elenco dei progetti: un package.json o un vite.config.* cambiato, le cartelle
// del workspace cambiate, il workspace diventato fidato. Le notifiche arrivano a raffica (un
// salvataggio tocca più file, un git checkout molti): si aspetta che si calmino. A pannello
// nascosto — tutte le sezioni chiuse o fuori vista — non si ricalcola niente, lo si segna e basta:
// ci pensa wake(), quando una sezione torna in vista.
import * as vscode from "vscode";
import path from "node:path";
import { WATCH_GLOB, inNodeModules } from "./pickProject.mjs";

export class ProjectWatch {
  /**
   * @param {object} p
   * @param {import("./projects.mjs").Projects} p.projects
   * @param {() => boolean} p.isVisible - almeno una sezione in vista
   * @param {(dir?: string) => void} p.invalidate - quanto letto di `dir` (o di tutti) non vale più
   */
  constructor({ projects, isVisible, invalidate }) {
    Object.assign(this, { projects, isVisible, invalidate });
    this.timer = undefined;
    this.forza = false;
    this.sporco = false;
    const watcher = vscode.workspace.createFileSystemWatcher(WATCH_GLOB);
    // Subito, prima dell'attesa: Project si svuota ("Reading vite.config…") e Results si blocca.
    const cambiato = (uri) => {
      if (inNodeModules(uri.fsPath)) return;
      invalidate(path.dirname(uri.fsPath));
      this.schedule(true);
    };
    this.ascolti = [
      watcher,
      watcher.onDidChange(cambiato),
      watcher.onDidCreate(cambiato),
      watcher.onDidDelete(cambiato),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.schedule(true)),
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        invalidate();
        this.schedule(true);
      }),
    ];
  }

  /** Ricalcola dopo la raffica; `force` avvisa le sezioni anche se l'elenco è lo stesso. */
  schedule(force) {
    this.forza ||= force;
    if (!this.isVisible()) {
      this.sporco = true;
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const f = this.forza;
      this.forza = false;
      this.projects.relist(f);
    }, 200);
  }

  /** Una sezione è tornata in vista: il ricalcolo rimandato, se c'è. */
  wake() {
    if (!this.sporco || !this.isVisible()) return;
    this.sporco = false;
    this.schedule(false);
  }

  dispose() {
    clearTimeout(this.timer);
    for (const a of this.ascolti) a.dispose();
  }
}
