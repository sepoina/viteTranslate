// La voce di Results sotto il cursore dell'editor (la sonda inversa, seguiCursore in extension.mjs).
// La scansione dà di ogni voce solo dove comincia (riga e colonna, da extractMarkers): una voce su
// più righe — un <Translate> che va a capo, un template, un testo JSX lungo — non "possiede" le
// righe sotto. Qui si risale: la voce più vicina sopra il cursore vale se il cursore sta dentro
// di lei, e dove finisce lo si legge dal testo del documento, a partire da dove comincia.
// Nessun import di `vscode`. I delimitatori vengono da lib/markerSyntax.js, impacchettato qui alla
// build: mai riscritti a mano (invariante 14 in doc/structure.md).
import { SOURCE_OPEN, SOURCE_CLOSE } from "../../../../lib/markerSyntax.js";

// Da riga e colonna (da 1) all'offset nel testo; null se fuori.
function offsetDi(testo, line, column) {
  let offset = 0;
  for (let l = 1; l < line; l++) {
    const a = testo.indexOf("\n", offset);
    if (a === -1) return null;
    offset = a + 1;
  }
  return offset + column - 1;
}

// La fine di un elemento JSX che comincia a `inizio` (su `<`): dopo il suo tag di chiusura, contando
// gli elementi con lo stesso nome annidati. Un `>` dentro un attributo può ingannarla: è una sonda,
// e nel dubbio non sceglie.
function fineElemento(testo, inizio) {
  const nome = /^<([A-Za-z_$][\w$.:-]*)/.exec(testo.slice(inizio, inizio + 200))?.[1];
  if (!nome) return null;
  const re = new RegExp(`<(/?)${nome.replace(/[.$]/g, "\\$&")}(?=[\\s/>])`, "g");
  re.lastIndex = inizio;
  let profondità = 0;
  for (let m; (m = re.exec(testo)); ) {
    const chiude = testo.indexOf(">", m.index);
    if (chiude === -1) return null;
    if (m[1]) profondità--;
    else if (testo[chiude - 1] !== "/") profondità++;
    else if (profondità === 0) return chiude + 1; // <Nome … /> : finisce lì
    if (profondità === 0) return chiude + 1;
    re.lastIndex = chiude + 1;
  }
  return null;
}

// La fine di un template literal: il backtick che chiude, saltando gli escape e i `${…}`.
function fineTemplate(testo, apertura) {
  let graffe = 0;
  for (let i = apertura + 1; i < testo.length; i++) {
    const c = testo[i];
    if (c === "\\") i++;
    else if (graffe === 0 && c === "`") return i + 1;
    else if (c === "$" && testo[i + 1] === "{") {
      graffe++;
      i++;
    } else if (graffe > 0 && c === "{") graffe++;
    else if (graffe > 0 && c === "}") graffe--;
  }
  return null;
}

/**
 * Dove finisce (offset esclusivo) il costrutto marcato che comincia a `inizio`: un elemento JSX
 * (<Translate>, o quello che autoWrap avvolge) fino al suo tag di chiusura, un template literal
 * (anche col tag davanti: ts`…`) fino al backtick, una stringa fino alla sua virgoletta, un testo
 * marcato fino al `_%_` che lo chiude (con autoWrap può avere tag in mezzo), un altro testo JSX
 * fino al primo `<` o `{`. null se non si capisce.
 *
 * @param {string} testo
 * @param {number} inizio
 * @returns {number | null}
 */
export function markerEnd(testo, inizio) {
  const c = testo[inizio];
  if (c === undefined) return null;
  if (c === "<") return fineElemento(testo, inizio);
  const tag = /^[A-Za-z_$][\w$.]*\s*`/.exec(testo.slice(inizio, inizio + 100));
  if (c === "`" || tag) return fineTemplate(testo, c === "`" ? inizio : inizio + tag[0].length - 1);
  if (c === '"' || c === "'") {
    for (let i = inizio + 1; i < testo.length && testo[i] !== "\n"; i++) {
      if (testo[i] === "\\") i++;
      else if (testo[i] === c) return i + 1;
    }
    return null;
  }
  // Un testo marcato (`_%_…_%_`, anche quello che autoWrap avvolge con i suoi tag e valori in
  // mezzo): fino al `_%_` che lo chiude. Un testo JSX qualunque: fino al primo tag o `{`.
  if (testo.startsWith(SOURCE_OPEN, inizio)) {
    const chiude = testo.indexOf(SOURCE_CLOSE, inizio + SOURCE_OPEN.length);
    return chiude === -1 ? null : chiude + SOURCE_CLOSE.length;
  }
  const fine = testo.slice(inizio).search(/[<{]/);
  return fine === -1 ? testo.length : inizio + fine;
}

// Quante voci sopra il cursore si provano, al massimo, prima di arrendersi.
const RISALITA = 10;

/**
 * La voce sotto il cursore, fra le righe-voce di un file (quelle di Results: `line`, `column` da 1).
 *   1. una voce che comincia sulla riga del cursore: quella che comincia più vicino prima della
 *      colonna, o la prima della riga;
 *   2. altrimenti si risale: la voce più vicina sopra, se il cursore sta dentro di lei (markerEnd
 *      nel testo del documento); poi la precedente, fino a RISALITA voci.
 *
 * @param {Array<{ line: number, column: number }>} voci - nell'ordine del sorgente
 * @param {string | null} testo - il testo del documento; senza, solo il punto 1
 * @param {number} line
 * @param {number} column
 */
export function entryAtCursor(voci, testo, line, column) {
  const sullaRiga = voci.filter((r) => r.line === line);
  if (sullaRiga.length) return sullaRiga.filter((r) => (r.column ?? 1) <= column).at(-1) ?? sullaRiga[0];
  if (typeof testo !== "string") return null;
  const cursore = offsetDi(testo, line, column);
  if (cursore === null) return null;
  const sopra = voci.filter((r) => r.line < line).slice(-RISALITA).reverse();
  for (const r of sopra) {
    const inizio = offsetDi(testo, r.line, r.column ?? 1);
    if (inizio === null) continue;
    const fine = markerEnd(testo, inizio);
    if (fine !== null && cursore < fine) return r;
  }
  return null;
}
