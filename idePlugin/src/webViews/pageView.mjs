// La base delle sezioni webview (Selector, Project, la facoltativa). Non tengono niente: `state()`
// dice cosa mostrare, e ogni clic arriva come messaggio `{ cmd, value }`, che `run` passa alla voce
// di `actions`. La pagina si ricrea da zero ogni volta che torna in vista, e appena carica chiede lo
// stato (`ready`); da lì in poi push() glielo rimanda solo quando cambia.
//
// Una sottoclasse dà `state()`, `actions` e, se serve, `describe()` (la descrizione
// nell'intestazione); `page()` e `live` se la pagina cambia (la sezione facoltativa).
import * as vscode from "vscode";
import { randomBytes } from "node:crypto";

export class PageView {
  /**
   * @param {object} p
   * @param {vscode.Uri} p.extensionUri
   * @param {string} p.name - il nome della sezione, nel canale
   * @param {string} p.script - il suo script, in dist/
   * @param {(p: object) => string} [p.html] - la pagina: selectorHtml, projectHtml
   * @param {(riga: string) => void} p.log
   * @param {() => void} [p.onVisible] - la sezione è tornata in vista
   * @param {(fase: "page" | "script" | "drawn") => void} [p.onStage] - le tappe di una pagina nuova:
   *   creata, script caricato (`ready`), primo stato disegnato (`drawn`, se la pagina lo dice)
   */
  constructor({ extensionUri, name, script, html, log, onVisible, onStage }) {
    Object.assign(this, { extensionUri, name, script, html, log, onVisible, onStage });
    /** @type {Record<string, (value?: string) => any>} i clic della pagina */
    this.actions = {};
    this.view = null;
    this.ultimo = null; // la firma dell'ultimo stato mandato
    this.turno = 0; // numera i push: uno superato non manda niente
    this.ascolti = []; // le sottoscrizioni della sottoclasse, chiuse da dispose()
  }

  /** Lo stato da mandare alla pagina, o null per non mandare niente. */
  async state() {
    return null;
  }

  /** La funzione che fa la pagina. */
  page() {
    return this.html;
  }

  /** Se la pagina c'è e aspetta uno stato. */
  get live() {
    return !!this.view;
  }

  get visible() {
    return this.view?.visible ?? false;
  }

  get dist() {
    return vscode.Uri.joinPath(this.extensionUri, "dist");
  }

  resolveWebviewView(view) {
    this.view = view;
    // Solo dist/: la pagina non vede nient'altro dell'estensione, né del workspace.
    view.webview.options = { enableScripts: true, localResourceRoots: [this.dist] };
    this.render();
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

  /** Rifà la pagina da zero: lo stato le andrà rimandato. */
  render() {
    if (!this.view) return;
    const { webview } = this.view;
    const indirizzo = (file) => String(webview.asWebviewUri(vscode.Uri.joinPath(this.dist, file)));
    this.ultimo = null;
    webview.html = this.page()({
      scriptUri: indirizzo(this.script),
      codiconsUri: indirizzo("codicon.css"),
      cspSource: webview.cspSource,
      nonce: randomBytes(16).toString("hex"),
    });
    this.onStage?.("page");
  }

  /** Un clic nella pagina: la voce di `actions`, o una riga nel canale. */
  run(cmd, value) {
    if (Object.hasOwn(this.actions, cmd)) return this.actions[cmd](value);
    this.log(`${this.name}: unknown command ${JSON.stringify(cmd)}`);
  }

  /**
   * Manda lo stato alla pagina, se è cambiato dall'ultima volta. Vince l'ultimo push partito: uno
   * superato mentre calcolava non manda niente, e si risolve con quello che l'ha superato — chi
   * aspetta un push trova la pagina aggiornata.
   */
  push() {
    if (!this.live) return Promise.resolve();
    this.inCorso = this.manda(++this.turno);
    return this.inCorso;
  }

  async manda(turno) {
    const stato = await this.state();
    if (turno !== this.turno) return this.inCorso;
    if (!this.live || !stato) return;
    if (this.describe) this.view.description = this.describe(stato);
    const firma = JSON.stringify(stato);
    if (firma === this.ultimo) return;
    this.ultimo = firma;
    return this.view.webview.postMessage({ type: "state", ...stato });
  }

  dispose() {
    for (const a of this.ascolti) a.dispose();
  }
}
