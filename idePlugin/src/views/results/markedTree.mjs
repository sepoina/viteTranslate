// La sezione Results: l'albero dei file del progetto selezionato, con le loro voci marcate, filtrate
// dal filtro scelto in Selector; il nome del progetto va nell'intestazione. Il modello (un
// TreeDataProvider); la TreeView e quello che la muove stanno in resultsView.mjs.
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
// solo al refresh (l'attesa di resultsView.mjs, 300 ms): `attesa`.
import * as vscode from "vscode";
import path from "node:path";
import { pathKey } from "../../core/pickProject.mjs";
import { ScanWorker } from "../../probes/scanWorker.mjs";
import { markedInput, markedChildren, markedSummary, filterItems, FILTERS, loadingRow, frozenRows } from "./markedRows.mjs";
import { entryAtCursor } from "./markerSpan.mjs";

// La chiave del filtro in workspaceState: una voce di FILTERS (markedRows.mjs).
const FILTER_KEY = "vitetranslate.markedFilter";

const dentro = (dir, file) => file.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);

// L'id di ogni TreeItem è il percorso delle chiavi dal progetto in giù: VS Code lo usa per
// ricordare cosa l'utente ha aperto e chiuso fra un ridisegno e l'altro. La chiave è l'etichetta,
// se la riga non ne porta una sua (le voci di Results: due testi uguali nello stesso file). Una
// riga che ha già il suo id passa com'è. Su tutto l'albero e una volta sola per disegno: VS Code riconosce una
// riga dall'oggetto — reveal la cerca fra quelle che getChildren gli ha dato — quindi fra un
// ridisegno e l'altro getChildren deve restituire sempre gli stessi. Annota in `disegno` i padri
// (per getParent), le righe dei file, per percorso (per follow), e le voci con una chiave, per id
// (la voce selezionata è ancora nel disegno? vedi selectedKey in resultsView.mjs).
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

export class MarkedTree {
  /**
   * @param {object} p
   * @param {import("../../core/projects.mjs").Projects} p.configs - la selezione e la risposta della sonda del vite.config
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
    /** @type {vscode.TreeView | null} impostato da ResultsView, per l'intestazione */
    this.view = null;
    /** @type {((p: Promise<any>) => void) | null} la barra di avanzamento, da ResultsView */
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
    const da = o ? ` [api ${marked.ideApi ?? "by path"}, index ${marked.index}: ${o.index} from the index, ${o.overlay} kept, ${o.parsed} parsed${marked.babel ? ", Babel warm" : ""}]` : "";
    this.log(
      `${project.dir}: source ${marked.ok ? `scanned in ${marked.ms} ms, ${markedSummary(marked)}${da}` : `NOT scanned\n  ${marked.error}`}` +
        (marked.warnings?.length ? `\n  ${marked.warnings.map((w) => `${w.rel}: ${w.message}`).join("\n  ")}` : "") +
        (marked.output ? `\n  output:\n${marked.output}` : "")
    );
    return marked;
  }
}
