// Architettura d'insieme: doc/structure.md § "Fase 0 — Autoring: il marcatore".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 1.

import pathCmd from "path";
import { colorize } from "../../utility.js";

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
export function rawTextOf(node) {
  if (node.type === "TemplateElement") {
    const value = node.value.cooked ?? node.value.raw;
    return typeof value === "string" ? value : null;
  }
  if (node.type === "JSXText") return typeof node.value === "string" ? node.value.trim() : null;
  return typeof node.value === "string" ? node.value : null;
}

export function markedTextOf(node) {
  const value = rawTextOf(node);
  if (value === null || value.length < MIN_MARKED_LENGTH) return null;
  if (!(value.startsWith(OPEN) && value.endsWith(CLOSE))) return null;
  return value;
}

/** Il contenuto di un marcatore, senza i delimitatori. */
export const innerTextOf = (marked) => marked.slice(OPEN.length, -CLOSE.length);

/**
 * Marcatore compilato: `_<_id_/_fallback_>_` in sviluppo (il testo sorgente resta a
 * portata di mano prima che una sync abbia popolato i file di lingua), `_<_id_>_` in
 * build (il comando `vtranslate-cli` gira prima, quindi il fallback in
 * bundle sarebbe ridondante).
 */
export function compiledMarker(id, inner, includeFallback) {
  return includeFallback ? `_<_${id}_/_${inner}_>_` : `_<_${id}_>_`;
}

/** Escape dei soli caratteri che dentro un template literal non stanno per se stessi. */
export function escapeTemplateRaw(value) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

// Nome della chiave, ricavato dal basename del file e reso sempre un identificatore JS valido:
// restano solo [A-Za-z0-9] (il "_" è riservato al separatore nome/checksum), una cifra iniziale
// viene preceduta da "n", e un nome che si svuota del tutto diventa "unNamed". La perdita è
// innocua: due nomi che collassano allo stesso identificatore restano distinti perché il
// checksum incorpora il percorso relativo del file (vedi registerMarker).
export function sanitizeName(name) {
  const clean = name.replace(/[^A-Za-z0-9]/g, "");
  if (clean === "") return "unNamed";
  if (/^[0-9]/.test(clean)) return `n${clean}`;
  return clean;
}

/**
 * Registra il testo nella tabella e restituisce il suo id (`nome_checksum`).
 *
 * Il checksum non copre solo il testo ma anche il percorso relativo del file: due file con lo
 * stesso basename e lo stesso testo (es. due index.jsx con "Salva") non condividono più l'id,
 * che era il limite documentato finora. Il percorso è normalizzato a "/" perché la chiave non
 * dipenda dal sistema operativo, e la catena hash(inner, hash(relPath)) evita l'ambiguità di
 * una concatenazione.
 *
 * @param {string} inner - testo originale, senza delimitatori
 * @param {string} filename - percorso del file in cui è stato trovato
 * @param {Record<string, string>} table - accumulatore, mutato
 * @param {string} [baseDir] - radice da cui relativizzare `filename`; se assente si usa
 *   `filename` così com'è (i test, l'uso isolato della reference)
 * @returns {string} l'id da inserire nel codice
 */
/**
 * Dove finiscono gli avvisi quando nessuno dice altrimenti: la console, col prefisso del
 * plugin, che è la forma giusta dentro l'output di Vite. Il comando standalone ha una sua
 * colonna e passa un canale suo — il messaggio dice cosa è successo, chi lo riceve decide
 * come incorniciarlo.
 */
export const defaultWarn = (message) => console.warn(`[vitetranslate] ${message}`);

/**
 * Il percorso con cui un file viene NOMINATO: relativo alla radice del progetto e sempre con
 * "/". Corto da leggere e, nel terminale di VS Code, cliccabile. È lo stesso che entra nel
 * checksum di un id, e per questo sta qui e non nel chiamante: se le due cose divergessero, un
 * avviso indicherebbe un file diverso da quello che ha davvero prodotto la chiave.
 *
 * @param {string} filename
 * @param {string} [baseDir]
 * @returns {string}
 */
export function relPathOf(filename, baseDir) {
  return (baseDir ? pathCmd.relative(baseDir, filename) : filename || "unknown").replace(/\\/g, "/");
}

export function registerMarker(inner, filename, table, baseDir, warn = defaultWarn) {
  const relPath = relPathOf(filename, baseDir);
  const nameFile = sanitizeName(pathCmd.parse(filename || "unknown").name);
  // base 36 per accorciare la stringa
  const id = `${nameFile}_${hash(inner, hash(relPath)).toString(36)}`;

  // Due marcatori nella stessa stringa (`"_%_uno_%_ e _%_due_%_"`) non sono due voci: il
  // riconoscimento guarda l'inizio e la fine del valore, quindi l'apertura del primo si
  // accoppia con la chiusura del secondo e ne esce UNA chiave sola, il cui testo contiene i
  // delimitatori rimasti in mezzo. Non è un errore di sintassi e non fa fallire niente: si
  // vede solo a schermo, come un "_%_" in mezzo alla frase, e a quel punto è finito anche
  // nei file di lingua e sul tavolo del traduttore. Meglio dirlo qui.
  if (inner.includes(OPEN)) {
    warn(
      `nested markers in ${colorize("nome", `"${relPath}"`)}: "${inner}" was read as a single text. ` +
      `A marker must wrap the whole string — split it into separate <Translate> or ts() calls.`,
      "nested"
    );
  }

  // Due testi diversi che collidono sullo stesso id si sovrascriverebbero a vicenda, e uno
  // dei due sparirebbe dalla tabella senza che nulla lo segnali: la traduzione dell'altro
  // comparirebbe al suo posto. È raro (32 bit, nello spazio di un solo nome file) ma va
  // detto, perché a schermo si vedrebbe solo il testo sbagliato.
  const previous = table[id];
  if (previous !== undefined && previous !== inner) {
    warn(
      `id collision "${id}" in ${colorize("nome", `"${relPath}"`)}: ` +
      `"${previous}" and "${inner}" produce the same key. ` +
      `Change one of the two texts slightly (or rename the file) to separate them.`,
      "collision"
    );
  }

  table[id] = inner;
  return id;
}
