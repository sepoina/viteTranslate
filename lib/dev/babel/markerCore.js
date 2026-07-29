// Architettura d'insieme: doc/structure.md § "Fase 0 — Autoring: il marcatore".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 1.

import pathCmd from "path";

// Regole dei marcatori condivise dai due lettori dell'AST: l'estrazione vera
// (extractMarkers.js, l'unica che la libreria usa) e l'implementazione di riferimento contro
// cui i test la confrontano (test/list/babelTranslateReference.mjs, non distribuita).
//
// Erano la stessa logica scritta una volta sola quando il lettore era uno; con due, la prima
// divergenza produrrebbe id diversi per lo stesso testo — cioè traduzioni che spariscono
// senza che nulla lo segnali. Tenendo qui tutto ciò che è semantico, al confronto fra i due
// resta da mettere alla prova la sola meccanica della riscrittura, che è il punto.

// FNV-1a 32-bit hash (from the 'fnv1a' npm package, inlined to drop the dependency).
// The `(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)` sum is the FNV prime (0x01000193) multiplication
// decomposed into shifts, avoiding a 32-bit overflow-prone `h * prime`.
const FNV_OFFSET_BASIS = 0x811c9dc5;
export function hash(s, h = FNV_OFFSET_BASIS) {
  const l = s.length;
  for (let i = 0; i < l; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

export const OPEN = "_%_";
export const CLOSE = "_%_";
// Lunghezza minima di una stringa marcata: "_%__%_" (marcatore vuoto).
export const MIN_MARKED_LENGTH = OPEN.length + CLOSE.length;

/**
 * Estrae il testo su cui lavorare da un nodo, nella forma specifica del suo tipo.
 *
 * - `StringLiteral`   -> `value` è già la stringa.
 * - `JSXText`         -> `value` è il testo **grezzo**, virgolette di JSX comprese: un
 *   marcatore scritto su una riga a sé (`<Translate>\n  _%_ciao_%_\n</Translate>`, cioè
 *   la formattazione normale) arriva qui con newline e indentazione attorno. Vanno tolti
 *   prima del confronto, altrimenti il nodo non viene mai riconosciuto. Sono gli stessi
 *   spazi che JSX scarterebbe comunque nel render.
 * - `TemplateElement` -> `value` è un oggetto `{ raw, cooked }`, non una stringa: leggere
 *   `value` direttamente faceva fallire il controllo di tipo e rendeva il visitor inerte.
 *   Un template con interpolazioni ha più quasi, e nessuno di essi apre *e* chiude il
 *   marcatore: restano correttamente esclusi.
 *
 * @returns {string | null} il testo marcato, o null se il nodo non è marcato
 */
export function markedTextOf(node) {
  let value;
  if (node.type === "TemplateElement") value = node.value.cooked ?? node.value.raw;
  else if (node.type === "JSXText") value = typeof node.value === "string" ? node.value.trim() : null;
  else value = node.value;

  if (typeof value !== "string" || value.length < MIN_MARKED_LENGTH) return null;
  if (!(value.startsWith(OPEN) && value.endsWith(CLOSE))) return null;
  return value;
}

/** Il contenuto di un marcatore, senza i delimitatori. */
export const innerTextOf = (marked) => marked.slice(OPEN.length, -CLOSE.length);

/**
 * Marcatore compilato: `_<_id_/_fallback_>_` in sviluppo (il testo sorgente resta a
 * portata di mano prima che una sync abbia popolato i file di lingua), `_<_id_>_` in
 * build (il comando di prepare-translation-table gira prima, quindi il fallback in
 * bundle sarebbe ridondante).
 */
export function compiledMarker(id, inner, includeFallback) {
  return includeFallback ? `_<_${id}_/_${inner}_>_` : `_<_${id}_>_`;
}

/** Escape dei soli caratteri che dentro un template literal non stanno per se stessi. */
export function escapeTemplateRaw(value) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/**
 * Registra il testo nella tabella e restituisce il suo id (`nomefile_hash`).
 *
 * @param {string} inner - testo originale, senza delimitatori
 * @param {string} filename - percorso del file in cui è stato trovato
 * @param {Record<string, string>} table - accumulatore, mutato
 * @returns {string} l'id da inserire nel codice
 */
export function registerMarker(inner, filename, table) {
  const nameFile = pathCmd.parse(filename || "unknown").name;
  // base 36 per accorciare la stringa
  const id = `${nameFile}_${hash(inner).toString(36)}`;

  // Due marcatori nella stessa stringa (`"_%_uno_%_ e _%_due_%_"`) non sono due voci: il
  // riconoscimento guarda l'inizio e la fine del valore, quindi l'apertura del primo si
  // accoppia con la chiusura del secondo e ne esce UNA chiave sola, il cui testo contiene i
  // delimitatori rimasti in mezzo. Non è un errore di sintassi e non fa fallire niente: si
  // vede solo a schermo, come un "_%_" in mezzo alla frase, e a quel punto è finito anche
  // nei file di lingua e sul tavolo del traduttore. Meglio dirlo qui.
  if (inner.includes(OPEN)) {
    console.warn(
      `[vitetranslate] nested markers in "${filename}": "${inner}" was read as a single text. ` +
      `A marker must wrap the whole string — split it into separate <Translate> or ts() calls.`
    );
  }

  // Due testi diversi che collidono sullo stesso id si sovrascriverebbero a vicenda, e uno
  // dei due sparirebbe dalla tabella senza che nulla lo segnali: la traduzione dell'altro
  // comparirebbe al suo posto. È raro (32 bit, nello spazio di un solo nome file) ma va
  // detto, perché a schermo si vedrebbe solo il testo sbagliato.
  const previous = table[id];
  if (previous !== undefined && previous !== inner) {
    console.warn(
      `[vitetranslate] id collision "${id}" in "${filename}": ` +
      `"${previous}" and "${inner}" produce the same key. ` +
      `Change one of the two texts slightly (or rename the file) to separate them.`
    );
  }

  table[id] = inner;
  return id;
}
