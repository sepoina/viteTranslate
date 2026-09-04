// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "2a. Estrazione: parse e splice".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { parseSync } from "@babel/core";
import parserOptionsFor from "./parserOptionsFor.js";
import {
  markedTextOf, rawTextOf, innerTextOf, compiledMarker, escapeTemplateRaw, registerMarker,
  relPathOf, defaultWarn, OPEN,
} from "./markerCore.js";
import { colorize } from "../../utility.js";

// L'estrazione dei marcatori, usata dal plugin Vite e dal comando di sync.
//
// Si ferma al parse: niente `File` di @babel/core, niente NodePath, niente scope, niente
// `generate()`. Misurato sui sorgenti del playground, il transform completo con generate e
// sourcemap costa 18,7 ms contro i 2,3 ms di `parseSync` — il parser non era il collo di
// bottiglia, lo era tutto il resto.
//
// Il modo ovvio di fare la stessa cosa — sostituire i nodi e lasciare che Babel rigeneri —
// è conservato in test/list/babelTranslateReference.mjs e serve da termine di paragone: è quello
// che dimostra che questa versione è corretta.
//
// Può permetterselo perché la riscrittura è puntuale: il plugin sostituisce solo nodi il cui
// valore è **per intero** un marcatore, quindi bastano gli offset dei nodi trovati e uno
// splice sul sorgente. Come effetto collaterale il codice non marcato esce byte per byte
// com'era entrato — commenti, formattazione e direttive (`@__PURE__`, `@vite-ignore`)
// compresi, che una rigenerazione avrebbe potuto alterare.

const SKIP_KEYS = new Set([
  "loc", "extra", "comments", "tokens",
  "leadingComments", "trailingComments", "innerComments",
]);

// Visita l'AST come oggetto semplice, portandosi dietro il solo genitore: è l'unica cosa
// che serve, per distinguere uno StringLiteral in posizione valore-di-attributo JSX.
function walk(node, parent, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, parent, visit);
    return;
  }
  if (node === null || typeof node !== "object" || typeof node.type !== "string") return;
  visit(node, parent);
  for (const key in node) {
    if (SKIP_KEYS.has(key)) continue;
    const child = node[key];
    if (child !== null && typeof child === "object") walk(child, node, visit);
  }
}

// Letterale JS per il testo compilato. `JSON.stringify` non fa l'escape dei non-ASCII, e va
// bene così: era proprio l'escape del generatore Babel (`è` -> `\xE8`) a rendere necessario
// avvolgere gli attributi JSX in un'espressione. U+2028/U+2029 sono validi in JSON ma non in
// ogni parser JS, quindi restano escapati a mano.
function countNewlines(text, from, to) {
  let n = 0;
  for (let i = from; i < to; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function jsString(value) {
  return JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// Quanto testo citare di una stringa malformata: abbastanza da riconoscerla nel file, non
// tanto da riempire la riga. Il marcatore sbagliato sta quasi sempre a un capo o all'altro.
const CITAZIONE = 60;
const cita = (testo) => (testo.length <= CITAZIONE ? testo : `${testo.slice(0, CITAZIONE)}\u2026`);

/**
 * Trova i marcatori `_%_..._%_` di un file, li registra nella tabella e — se richiesto —
 * restituisce il sorgente riscritto con i marcatori compilati.
 *
 * @param {string} code
 * @param {object} options
 * @param {string} options.filename - percorso del file (decide il prefisso degli id e i parser plugin)
 * @param {Record<string,string>} options.table - accumulatore id -> testo originale, mutato
 * @param {boolean} [options.includeFallback=true] - incorpora il testo sorgente nel marcatore
 * @param {boolean} [options.rewrite=true] - false: solo estrazione, nessuno splice (comando di sync)
 * @param {boolean} [options.sourceMaps=false]
 * @param {string} [options.baseDir] - radice da cui relativizzare `filename` nel checksum
 * @param {(message: string, kind?: "nested"|"collision"|"malformed") => void} [options.warn] -
 *   dove segnalare marcatori annidati, malformati e collisioni di id; il default è la console
 *   col prefisso del plugin (vedi markerCore). Il secondo argomento serve a chi vuole
 *   raggrupparli per tipo — il comando di sync ne elenca alcuni per esteso e altri a conteggio —
 *   e si può ignorare.
 * @returns {{ code: string, map: object|null } | null} null se non c'è nulla da riscrivere
 */
export default function extractMarkers(code, options) {
  const { filename, table, includeFallback = true, rewrite = true, sourceMaps = false, baseDir, warn } = options;

  const ast = parseSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    parserOpts: parserOptionsFor(filename),
  });

  const edits = [];

  walk(ast.program, null, (node, parent) => {
    const type = node.type;
    if (type !== "StringLiteral" && type !== "JSXText" && type !== "TemplateElement") return;

    const marked = markedTextOf(node);
    if (marked === null) {
      // Il caso che prima non lasciava traccia: una stringa che CONTIENE "_%_" senza esserne
      // avvolta per intero. Il riconoscimento guarda inizio e fine, quindi qui non c'è nessun
      // marcatore da estrarre — e finora l'unico segno era che la traduzione non compariva,
      // il che si scopre a schermo, molto dopo. Non è un errore di sintassi e non ferma niente:
      // è quasi sempre un delimitatore dimenticato, o un marcatore in mezzo alla frase.
      const raw = rawTextOf(node);
      if (raw !== null && raw.includes(OPEN)) {
        // Stesso canale — e stesso default — dei marcatori annidati: sono la stessa classe di
        // problema, e farne sentire uno solo in `vite dev` vorrebbe dire che il più comune dei
        // due si vede solo lanciando il comando di sync.
        (warn ?? defaultWarn)(
          `malformed marker in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: "${cita(raw)}" contains "${OPEN}" ` +
          `but is not wrapped by it — nothing was extracted. ` +
          `A marker must open AND close the whole string.`,
          "malformed"
        );
      }
      return;
    }

    const inner = innerTextOf(marked);
    const id = registerMarker(inner, filename, table, baseDir, warn);
    if (!rewrite) return;

    const value = compiledMarker(id, inner, includeFallback);

    // Gli offset dei nodi coprono: virgolette comprese per StringLiteral, testo grezzo con
    // gli spazi attorno per JSXText, il solo contenuto fra i delimitatori per TemplateElement
    // (verificato sull'AST, non dedotto).
    let text;
    if (type === "TemplateElement") {
      // `raw` va ri-escapato: un "\" o un "`" nel testo cambierebbe il significato del
      // template. Il `tail` non si tocca perché lo splice non ricostruisce il nodo.
      text = escapeTemplateRaw(value);
    } else if (type === "JSXText") {
      // Espressione, non testo: il marcatore compilato contiene un "<" letterale, che in un
      // nodo di testo JSX non è sintassi valida. `{"..."}` lo tiene una stringa JS a tutti
      // gli effetti e lascia il JSX intatto per il plugin React del progetto.
      //
      // Gli a-capo inghiottiti vengono rimessi in coda. Un marcatore scritto sulla propria
      // riga occupa tre righe di sorgente e ne produrrebbe una sola, spostando in su tutto
      // il resto del file: la nostra sourcemap lo tiene, ma chi viene dopo legge le
      // posizioni dal codice che gli passiamo e le incide come VALORI, non come mappature —
      // il `lineNumber` che il plugin React mette in ogni jsxDEV, e gli stack di errore.
      // Reinserirli è gratis e inerte: un testo JSX di soli spazi che contiene un a-capo
      // viene scartato dal JSX stesso, esattamente come quello che stiamo sostituendo.
      text = `{${jsString(value)}}` + "\n".repeat(countNewlines(code, node.start, node.end));
    } else if (parent?.type === "JSXAttribute") {
      // In un valore di attributo la stringa rigenerata lascerebbe gli escape non
      // interpretati (il backslash lì non è un escape): serve anche qui un'espressione.
      text = `{${jsString(value)}}`;
    } else {
      text = jsString(value);
    }

    edits.push({ start: node.start, end: node.end, text });
  });

  if (!rewrite || edits.length === 0) return null;

  // Il walk scende in ordine di dichiarazione delle proprietà, non di posizione: lo splice
  // ha bisogno degli offset crescenti.
  edits.sort((a, b) => a.start - b.start);

  return splice(code, edits, filename, sourceMaps);
}

/**
 * Applica gli splice e, se servono, costruisce la sourcemap.
 *
 * La mappa è a livello di riga: ogni riga prodotta punta alla riga sorgente da cui viene.
 * Serve perché una sostituzione può cambiare il conteggio delle righe — un JSXText scritto
 * su tre righe diventa un `{"..."}` su una sola — e senza mappa tutto ciò che sta sotto
 * risulterebbe spostato per il resto della catena.
 */
function splice(code, edits, filename, sourceMaps) {
  let out = "";
  let cursor = 0;
  let srcLine = 0;   // riga sorgente corrispondente a `cursor`
  let outLine = 0;
  const lineToSrc = sourceMaps ? [0] : null;

  // `limit` è la riga sorgente oltre la quale questo pezzo non può spingersi. Per il testo
  // copiato tale e quale non c'è limite: avanza di pari passo col sorgente. Per il testo
  // inserito è la riga in cui finisce il nodo sostituito — così gli a-capo che rimettiamo in
  // coda a un JSXText si riallineano uno a uno con quelli che avevano preso il posto (la
  // mappa torna l'identità), e una sostituzione che invece accorcia si ferma dove deve
  // invece di sfilare in avanti.
  const copy = (chunk, limit) => {
    out += chunk;
    if (!sourceMaps) return;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk.charCodeAt(i) !== 10) continue;
      outLine++;
      if (limit === undefined || srcLine < limit) srcLine++;
      lineToSrc[outLine] = srcLine;
    }
  };

  for (const { start, end, text } of edits) {
    copy(code.slice(cursor, start));
    const endLine = srcLine + countNewlines(code, start, end);
    copy(text, endLine);
    // Le righe sorgente coperte dal nodo sostituito sono consumate anche quando il testo
    // nuovo non le riproduce tutte.
    srcLine = endLine;
    cursor = end;
  }
  copy(code.slice(cursor));

  return { code: out, map: sourceMaps ? buildMap(code, filename, lineToSrc) : null };
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function vlq(n) {
  let v = n < 0 ? (-n << 1) | 1 : n << 1;
  let out = "";
  do {
    let digit = v & 31;
    v >>>= 5;
    if (v > 0) digit |= 32;
    out += BASE64[digit];
  } while (v > 0);
  return out;
}

function buildMap(code, filename, lineToSrc) {
  let previous = 0;
  const mappings = new Array(lineToSrc.length);
  for (let i = 0; i < lineToSrc.length; i++) {
    const line = lineToSrc[i] ?? previous;
    // segmento [colonna generata 0, sorgente 0, delta riga, colonna sorgente 0]
    mappings[i] = `AA${vlq(line - previous)}A`;
    previous = line;
  }
  return {
    version: 3,
    sources: [filename],
    sourcesContent: [code],
    names: [],
    mappings: mappings.join(";"),
  };
}
