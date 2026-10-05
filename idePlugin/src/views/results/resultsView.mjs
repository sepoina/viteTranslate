// La sezione Results come la vede VS Code: la TreeView del modello (markedTree.mjs) e quello che la
// muove da fuori. Tutto qui è solo di Results:
//   - i salvataggi dei sorgenti del suo srcDir e dei file di lingua della sua localeDir (le
//     traduzioni decidono quali voci hanno problemi): la riga si blocca subito, la scansione parte
//     dopo la raffica;
//   - i documenti con modifiche non salvate: la loro riga si blocca finché restano sporchi;
//   - il file attivo (seguiEditor): se è di un altro progetto lo seleziona, come un clic in Config;
//     poi Results mostra la sua riga, aperta sulle voci (MarkedTree.follow), con un reveal e senza
//     ridisegnare niente;
//   - il cursore, a ritroso (seguiCursore): su una riga che ha una voce, Results la seleziona;
//   - la voce selezionata, per Languages in Project (selectedKey).
import * as vscode from "vscode";
import { inNodeModules, projectOf } from "../../core/pickProject.mjs";
import { progressIn } from "../../core/editorUi.mjs";
import { MarkedTree } from "./markedTree.mjs";

export const RESULTS_VIEW_ID = "vitetranslate.results";
// Le estensioni che legge walkSource (EXT_RE in lib/dev/vite/uty/walkSource.js), più i file di
// lingua (LANG_EXT in lib/dev/vite/uty/languageFileFormat.js).
const SOURCE_GLOB = "**/*.{js,jsx,ts,tsx,yml}";

export class ResultsView {
  /**
   * @param {object} p
   * @param {import("../../core/projects.mjs").Projects} p.projects
   * @param {string} p.probePath - percorso assoluto di dist/markedProbe.mjs
   * @param {(riga: string) => void} p.log
   * @param {{ get: (k: string) => any, update: (k: string, v: any) => any }} [p.state] - workspaceState
   */
  constructor({ projects, probePath, log, state }) {
    this.projects = projects;
    this.tree = new MarkedTree({ configs: projects, probePath, log, state });
    this.view = vscode.window.createTreeView(RESULTS_VIEW_ID, { treeDataProvider: this.tree, showCollapseAll: true });
    this.tree.view = this.view;
    this.tree.progress = progressIn(RESULTS_VIEW_ID);

    // Gli eventi per le altre sezioni.
    this.onDidChange = this.tree.onDidChangeTreeData; // risultati, filtro, ricerca
    this.onDidChangeVisibility = this.view.onDidChangeVisibility;
    // Quello da cui dipende selectedKey(): la selezione, la visibilità, un disegno nuovo
    // (onDidRender: dopo che `rendered` è cambiato, non prima come onDidChangeTreeData).
    this.chiave = new vscode.EventEmitter();
    this.onDidChangeSelectedKey = this.chiave.event;
    // Un file di lingua creato o cancellato: Languages in Project rilegge la cartella.
    this.lingue = new vscode.EventEmitter();
    this.onDidChangeLanguageFiles = this.lingue.event;

    this.sporco = false; // salvataggi arrivati a sezione nascosta: la scansione al ritorno in vista
    this.timer = undefined;
    this.timerCursore = undefined;
    this.timerEditor = undefined;

    const sorgenti = vscode.workspace.createFileSystemWatcher(SOURCE_GLOB);
    const nuovoOVia = (uri) => {
      this.sorgenteCambiato(uri);
      if (!inNodeModules(uri.fsPath) && uri.fsPath.endsWith(".yml")) this.lingue.fire(uri.fsPath);
    };
    const chiave = () => this.chiave.fire(undefined);
    this.ascolti = [
      this.view,
      this.view.onDidChangeSelection(chiave),
      this.view.onDidChangeVisibility(chiave),
      this.tree.onDidRender(chiave),
      sorgenti,
      sorgenti.onDidChange((uri) => this.sorgenteCambiato(uri)),
      sorgenti.onDidCreate(nuovoOVia),
      sorgenti.onDidDelete(nuovoOVia),
      vscode.window.onDidChangeActiveTextEditor((editor) => this.seguiEditor(editor)),
      vscode.window.onDidChangeTextEditorSelection((e) => this.seguiCursore(e)),
      vscode.workspace.onDidChangeTextDocument((e) => this.documento(e.document, e.document.isDirty)),
      vscode.workspace.onDidCloseTextDocument((doc) => this.documento(doc, false)),
    ];
    for (const doc of vscode.workspace.textDocuments ?? []) if (doc.isDirty) this.documento(doc, true);
    // All'apertura, il file già attivo.
    this.seguiEditor(vscode.window.activeTextEditor);
  }

  get visible() {
    return this.view.visible;
  }

  /**
   * La voce selezionata adesso in Results, per Languages in Project: { dir, id }, o null. Vale solo
   * se è una voce (con la chiave, non un file né una cartella), se sta nel disegno corrente (un
   * filtro, una ricerca, un ridisegno possono averla tolta), se è del progetto selezionato, e se
   * Results è in vista (non chiusa, non coperta dalla sezione facoltativa). Non si salva: si guarda.
   */
  async selectedKey() {
    if (!this.view.visible) return null;
    const riga = this.view.selection?.[0];
    const disegno = this.tree.rendered;
    if (!riga?.keyId || !disegno?.keys.has(riga.id)) return null;
    if ((await this.projects.selectedProject())?.dir !== disegno.dir) return null;
    return { dir: disegno.dir, id: riga.keyId };
  }

  /** Quanto letto di `dir` (o di tutti) non vale più: vite.config cambiato, refresh, fiducia. */
  invalidate(dir) {
    this.tree.forget(dir);
  }

  /** Una sezione è tornata in vista: il file attivo in attesa, e la scansione rimandata. */
  wake() {
    if (!this.view.visible) return;
    this.tree.applyTarget();
    if (!this.sporco) return;
    this.sporco = false;
    this.prestoScan();
  }

  // I salvataggi arrivano a raffica: si aspetta che si calmino. A sezione nascosta non si scansiona
  // niente, lo si segna e basta: ci pensa wake().
  prestoScan() {
    if (!this.view.visible) {
      this.sporco = true;
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tree.refresh(), 300);
  }

  // forgetFile blocca subito la riga del file; la scansione parte dopo l'attesa.
  sorgenteCambiato(uri) {
    if (inNodeModules(uri.fsPath)) return;
    if (this.tree.forgetFile(uri.fsPath)) this.prestoScan();
  }

  // Le modifiche non salvate: la riga del file si blocca finché il documento è sporco. L'evento
  // arriva a ogni tasto, ma setDirty fa qualcosa solo quando lo stato cambia.
  documento(doc, sporco) {
    if (doc?.uri?.scheme === "file") this.tree.setDirty(doc.uri.fsPath, sporco);
  }

  // La sonda inversa: il cursore nell'editor su una riga che ha una voce in Results, e Results la
  // seleziona — solo con Filter su All e Search vuota (l'albero intero: niente voci nascoste che
  // cambierebbero la scelta), Results in vista, il documento senza modifiche non salvate (le righe
  // del disegno sarebbero vecchie). Nessun giro vizioso: reveal non esegue il comando della riga
  // (lo fa solo un clic), quindi l'editor non si muove; un clic in Results che sposta il cursore
  // ritrova la voce già scelta, e lì si ferma. Il focus resta nell'editor.
  seguiCursore(e) {
    clearTimeout(this.timerCursore);
    this.timerCursore = setTimeout(() => {
      const doc = e.textEditor?.document;
      if (!this.view.visible || this.tree.filter !== "all" || this.tree.search.trim()) return;
      if (doc?.uri?.scheme !== "file" || doc.isDirty) return;
      const pos = e.textEditor.selection?.active ?? e.selections?.[0]?.active;
      if (!pos) return;
      const riga = this.tree.entryAt(doc.uri.fsPath, pos.line + 1, pos.character + 1, doc.getText?.() ?? null);
      if (!riga || this.view.selection?.[0]?.id === riga.id) return;
      this.view.reveal(riga, { select: true, focus: false });
    }, 150);
  }

  // Il file attivo porta il pannello dove sta. Passando da un editor all'altro in fretta (Ctrl+Tab)
  // conta solo l'ultimo. Un progetto diverso si seleziona come da un clic in Config; lo stesso
  // progetto non tocca niente. Poi Results mostra il file.
  seguiEditor(editor) {
    clearTimeout(this.timerEditor);
    this.timerEditor = setTimeout(() => this.segui(editor), 150);
  }

  async segui(editor) {
    const uri = editor?.document?.uri;
    if (uri?.scheme !== "file" || inNodeModules(uri.fsPath)) return;
    let progetti;
    try {
      progetti = await this.projects.currentList();
    } catch {
      return;
    }
    const progetto = projectOf(progetti, uri.fsPath);
    if (!progetto) return;
    if (progetti.length > 1) this.projects.select(progetto.dir);
    this.tree.follow(uri.fsPath, progetto.dir);
  }

  dispose() {
    clearTimeout(this.timer);
    clearTimeout(this.timerCursore);
    clearTimeout(this.timerEditor);
    this.tree.dispose();
    for (const a of this.ascolti) a.dispose();
  }
}
