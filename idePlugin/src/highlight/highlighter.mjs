// L'evidenziazione dei metatag nell'editor: i file js, jsx, ts e tsx visibili, ridisegnati a ogni
// modifica (dopo una pausa), a ogni editor che compare e a ogni cambio di stile (l'impostazione
// vitetranslate.highlightStyle, o l'anteprima del comando di scelta). I metatag li trova
// metatagScan.mjs, le decorazioni le descrive decorationPlan.mjs. Niente grammatica TextMate: i
// colori sono del tema (ThemeColor), e uno stile nuovo si vede subito, senza ricaricare la finestra.
//
// La selezione l'editor la disegna sotto le decorazioni: lo sfondo del chip si toglie dove c'è
// una selezione (a ogni suo cambio, solo quella parte), così si vede come sempre. Cornice e righello
// restano (decorationPlan.mjs, "La selezione").
//
// I delimitatori sono quelli del progetto che contiene il file (ProjectMarkers, 4.7.0): `_%_` finché
// non si sanno (lettura in corso, Restricted Mode, libreria più vecchia).
//
// Non dipende dal pannello: parte con l'estensione, anche quando l'ha attivata l'apertura di un
// file js/ts (activationEvents in package.json) e il pannello resta chiuso.
import * as vscode from "vscode";
import { findMetatags } from "./metatagScan.mjs";
import { HIGHLIGHT_OFF, DEFAULT_STYLE, styleById } from "./highlightStyles.mjs";
import { PARTS, renderOptionsOf, rangesOf, subtractRanges } from "./decorationPlan.mjs";

/** L'impostazione, nella sezione "vitetranslate". */
export const HIGHLIGHT_SETTING = "highlightStyle";
// I linguaggi che legge walkSource (EXT_RE in lib/dev/vite/uty/walkSource.js), come li chiama VS Code.
const LANGUAGES = new Set(["javascript", "javascriptreact", "typescript", "typescriptreact"]);
// Quanto aspettare dopo l'ultimo tasto prima di ricolorare.
const PAUSA_MS = 150;
// Oltre questa lunghezza un file non si colora: un bundle, un file generato. 1 MB si legge in ~0,1 s.
const MAX_CHARS = 1_000_000;

// Le selezioni non vuote di un editor, in offset del testo.
const selezioni = (editor) =>
  (editor.selections ?? []).filter((s) => !s.isEmpty).map((s) => [editor.document.offsetAt(s.start), editor.document.offsetAt(s.end)]);

export class Highlighter {
  /**
   * @param {object} p
   * @param {(riga: string) => void} p.log
   * @param {import("./projectMarkers.mjs").ProjectMarkers} [p.markers] - assente nei test: allora sempre `_%_`
   */
  constructor({ log, markers }) {
    this.log = log;
    this.markers = markers ?? null;
    this.stile = null; // lo stile disegnato adesso (una voce di STYLES), null se spento
    this.tipi = null; // parte -> TextEditorDecorationType (o null), dello stile disegnato
    this.anteprima = null; // l'id in prova dal comando di scelta, o null
    this.timer = new Map(); // uri -> la pausa in corso
    this.letti = new WeakMap(); // documento -> { version, text, metatags }
    this.sfondi = new WeakMap(); // editor -> { version, ranges, bucato }: lo sfondo intero, e se ha buchi
    this.ascolti = [
      vscode.window.onDidChangeVisibleTextEditors(() => this.ridisegna()),
      vscode.window.onDidChangeTextEditorSelection((e) => this.selezionato(e.textEditor)),
      vscode.workspace.onDidChangeTextDocument((e) => this.cambiato(e.document)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(`vitetranslate.${HIGHLIGHT_SETTING}`)) this.applica();
      }),
      // Una lettura arrivata può cambiare i delimitatori di un file: la chiave della lettura lo vede.
      ...(this.markers ? [this.markers.onDidChange(() => this.ridisegna())] : []),
    ];
    this.applica();
  }

  /** L'id scelto nelle impostazioni; un id che il catalogo non conosce vale quello di serie. */
  get configured() {
    const id = vscode.workspace.getConfiguration("vitetranslate").get(HIGHLIGHT_SETTING, DEFAULT_STYLE);
    return id === HIGHLIGHT_OFF || styleById(id) ? id : DEFAULT_STYLE;
  }

  /** L'id disegnato adesso: quello in anteprima, o quello delle impostazioni. */
  get current() {
    return this.anteprima ?? this.configured;
  }

  /** Uno stile in prova, senza toccare le impostazioni; null torna a quello delle impostazioni. */
  preview(id) {
    this.anteprima = id;
    this.applica();
  }

  // Le decorazioni dello stile corrente, rifatte se lo stile è cambiato. Chiudere quelle vecchie
  // le toglie da tutti gli editor.
  applica() {
    const id = this.current;
    const stile = id === HIGHLIGHT_OFF ? null : styleById(id);
    if (stile === this.stile) return;
    for (const t of Object.values(this.tipi ?? {})) t?.dispose();
    this.stile = stile;
    this.tipi = null;
    if (stile) {
      const opzioni = renderOptionsOf(stile, (c) => new vscode.ThemeColor(c), vscode.OverviewRulerLane);
      this.tipi = Object.fromEntries(PARTS.map((p) => [p, opzioni[p] ? vscode.window.createTextEditorDecorationType(opzioni[p]) : null]));
    }
    this.ridisegna();
  }

  ridisegna() {
    for (const editor of vscode.window.visibleTextEditors ?? []) this.decora(editor);
  }

  // Un documento cambiato: si ricolora dopo la pausa, negli editor che lo mostrano.
  cambiato(doc) {
    if (!this.stile || !LANGUAGES.has(doc.languageId)) return;
    const chiave = doc.uri.toString();
    clearTimeout(this.timer.get(chiave));
    this.timer.set(chiave, setTimeout(() => {
      this.timer.delete(chiave);
      for (const editor of vscode.window.visibleTextEditors ?? []) if (editor.document === doc) this.decora(editor);
    }, PAUSA_MS));
  }

  // I metatag di un documento, letti una volta per versione e per coppia di delimitatori: due editor
  // sullo stesso file, o uno stile cambiato, non rileggono niente.
  lettura(doc) {
    const mk = this.markers?.markersFor(doc.uri.fsPath) ?? null;
    const k = mk ? `${mk.start}\u0000${mk.end}` : "";
    const prima = this.letti.get(doc);
    if (prima?.version === doc.version && prima.k === k) return prima;
    const text = doc.getText();
    const lettura = { version: doc.version, k, text, metatags: text.length > MAX_CHARS ? [] : findMetatags(text, mk ?? undefined) };
    this.letti.set(doc, lettura);
    return lettura;
  }

  decora(editor) {
    const doc = editor.document;
    if (!this.stile || !LANGUAGES.has(doc.languageId)) return;
    const { text, metatags } = this.lettura(doc);
    const perParte = Object.fromEntries(PARTS.map((p) => [p, []]));
    for (const m of metatags) {
      const r = rangesOf(this.stile, m, text);
      for (const p of PARTS) perParte[p].push(...r[p]);
    }
    // Lo sfondo intero si tiene: a ogni cambio di selezione gli si tolgono le selezioni nuove.
    const buchi = selezioni(editor);
    this.sfondi.set(editor, { version: doc.version, ranges: perParte.match, bucato: buchi.length > 0 });
    perParte.match = subtractRanges(perParte.match, buchi);
    for (const p of PARTS) if (this.tipi[p]) this.metti(editor, this.tipi[p], perParte[p]);
  }

  // La selezione è cambiata: lo sfondo si ridisegna senza i tratti selezionati. Un cursore che si
  // muove senza selezione, prima e dopo, non ridisegna niente; un documento cambiato aspetta il
  // ridisegno dopo la pausa (gli offset tenuti sono della versione di prima).
  selezionato(editor) {
    const sfondo = editor && this.sfondi.get(editor);
    if (!sfondo || !this.tipi?.match || sfondo.version !== editor.document.version) return;
    const buchi = selezioni(editor);
    if (!buchi.length && !sfondo.bucato) return;
    sfondo.bucato = buchi.length > 0;
    this.metti(editor, this.tipi.match, subtractRanges(sfondo.ranges, buchi));
  }

  metti(editor, tipo, offsets) {
    const doc = editor.document;
    editor.setDecorations(tipo, offsets.map(([s, e]) => new vscode.Range(doc.positionAt(s), doc.positionAt(e))));
  }

  dispose() {
    for (const t of this.timer.values()) clearTimeout(t);
    for (const t of Object.values(this.tipi ?? {})) t?.dispose();
    for (const a of this.ascolti) a.dispose();
  }
}
