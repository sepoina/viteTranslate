// La sonda di Marked come processo che può restare vivo: una per progetto, una richiesta alla
// volta. Node puro, nessun `vscode`.
//
// Quanto vive lo decide la risposta. Babel costa ~380 ms a caricarsi in un processo nuovo, e
// ~15 ms a parsare un file dopo: tenere il processo ha senso solo se l'ha caricato. Quindi:
//   - `babel: false` (tutto dall'indice della sync o dall'overlay) e nessuna richiesta in coda:
//     si chiude subito. Fuori dalle sessioni di scrittura non resta niente acceso;
//   - `babel: true`: resta vivo finché arrivano richieste, e si chiude dopo `idleMs` di silenzio.
// Si chiude anche su un timeout (un processo che non risponde non si riusa) e con dispose().
//
// Due casi in cui si riprova una volta con un processo nuovo: il processo riusato si è chiuso
// senza rispondere (morto mentre aspettava), o risponde STALE_WORKER (la libreria sul disco è
// cambiata sotto di lui: vedi markedScan.mjs).
import { forkProbe, MAX_OUTPUT } from "./runProbe.mjs";

export const IDLE_MS = 120000;

export class ScanWorker {
  /**
   * @param {object} p
   * @param {string} p.dir - cartella del progetto (la cwd della sonda)
   * @param {string} p.probePath - percorso assoluto di markedProbe.mjs
   * @param {number} [p.idleMs]
   * @param {number} [p.timeoutMs] - per ogni richiesta
   * @param {string} [p.what] - chi non ha risposto, nel messaggio di timeout
   * @param {typeof forkProbe} [p.fork] - per i test
   */
  constructor({ dir, probePath, idleMs = IDLE_MS, timeoutMs = 30000, what = "the source scan", fork = forkProbe }) {
    Object.assign(this, { dir, probePath, idleMs, timeoutMs, what, fork });
    this.child = null;
    this.idle = null;
    this.coda = Promise.resolve();
    this.inCoda = 0;
    this.seq = 0;
    this.disposed = false;
  }

  /** Vero se c'è un processo acceso. */
  get alive() {
    return this.child !== null;
  }

  /**
   * Una scansione. Mai un rifiuto: un errore è una risposta `{ ok: false, code, error }`.
   *
   * @param {object} input - gli argomenti di markedScan.scan
   * @param {object} [overlay]
   * @returns {Promise<object>} la risposta della sonda, più `ms` (tutto compreso) e `output`
   */
  request(input, overlay = {}) {
    this.inCoda++;
    const giro = this.coda
      .then(() => this.invia(input, overlay, true))
      .catch((error) => {
        // Non dovrebbe succedere (invia non lancia): la coda però non deve restare appesa.
        this.inCoda = Math.max(0, this.inCoda - 1);
        return { ok: false, code: null, error: String(error?.message ?? error), ms: 0, output: "" };
      });
    this.coda = giro;
    return giro;
  }

  dispose() {
    this.disposed = true;
    this.chiudi();
  }

  chiudi() {
    clearTimeout(this.idle);
    this.idle = null;
    const child = this.child;
    this.child = null;
    child?.kill();
  }

  avvia() {
    const child = this.fork(this.probePath, [], this.dir);
    // Morto da sé fra una richiesta e l'altra: la prossima ne apre un altro.
    child.once("close", () => {
      if (this.child === child) {
        this.child = null;
        clearTimeout(this.idle);
      }
    });
    child.on("error", () => {});
    this.child = child;
    return child;
  }

  async invia(input, overlay, riprova) {
    clearTimeout(this.idle);
    const inizio = Date.now();
    let risposta;
    if (this.disposed) risposta = { ok: false, code: "DISPOSED", error: "the panel was closed", output: "" };
    else {
      const riusato = this.child !== null;
      let child = this.child;
      try {
        child ??= this.avvia();
      } catch (error) {
        risposta = { ok: false, code: null, error: String(error?.message ?? error), output: "" };
      }
      if (!risposta) {
        risposta = await this.aspetta(child, input, overlay);
        const daRifare = risposta.code === "STALE_WORKER" || (riusato && risposta.code === "NO_ANSWER");
        if (daRifare || risposta.code === "TIMEOUT") this.chiudi();
        if (daRifare && riprova && !this.disposed) {
          this.inCoda++;
          return this.dopo(await this.invia(input, overlay, false), inizio);
        }
      }
    }
    return this.dopo(risposta, inizio);
  }

  // Dopo ogni risposta: tenere il processo o chiuderlo (vedi in cima al file).
  dopo(risposta, inizio) {
    this.inCoda--;
    if (this.child && this.inCoda === 0) {
      if (risposta.babel) {
        this.idle = setTimeout(() => this.chiudi(), this.idleMs);
        this.idle.unref?.();
      } else this.chiudi();
    }
    return { ...risposta, ms: Date.now() - inizio };
  }

  aspetta(child, input, overlay) {
    return new Promise((resolve) => {
      const id = ++this.seq;
      let output = "";
      let chiuso = false;
      const raccogli = (pezzo) => {
        if (output.length < MAX_OUTPUT) output += pezzo;
      };
      const fine = (risposta) => {
        if (chiuso) return;
        chiuso = true;
        clearTimeout(timer);
        child.off("message", messaggio);
        child.off("close", chiusura);
        child.off("error", errore);
        child.stdout?.off("data", raccogli);
        child.stderr?.off("data", raccogli);
        resolve({ ...risposta, output: output.trim() });
      };
      const messaggio = (m) => {
        if (m?.id !== id) return;
        const { id: _, ...risposta } = m;
        fine(risposta);
      };
      // 'close' e non 'exit': arriva dopo l'ultimo 'message' (vedi runProbe.mjs).
      const chiusura = (code) => fine({ ok: false, code: "NO_ANSWER", error: `the probe exited with code ${code} without answering` });
      const errore = (error) => fine({ ok: false, code: null, error: String(error?.message ?? error) });
      const timer = setTimeout(
        () => fine({ ok: false, code: "TIMEOUT", error: `${this.what} did not answer within ${this.timeoutMs / 1000} s` }),
        this.timeoutMs
      );
      child.stdout?.on("data", raccogli);
      child.stderr?.on("data", raccogli);
      child.on("message", messaggio);
      child.on("close", chiusura);
      child.on("error", errore);
      if (!child.connected) return chiusura(child.exitCode);
      try {
        child.send({ id, input, overlay }, (error) => error && errore(error));
      } catch (error) {
        errore(error);
      }
    });
  }
}
