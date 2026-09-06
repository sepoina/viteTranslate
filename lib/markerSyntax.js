// Architettura d'insieme: doc/structure.md § "Fase 0 — Autoring: il marcatore" e
// § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

// La sintassi del marcatore in un posto solo, come per il dialetto HTML (lib/htmlDialect.js)
// e per errorSolve (lib/errorSolve.js).
//
// Chi la scrive e chi la legge sono due programmi diversi: il marcatore sorgente lo scrive
// l'utente e lo legge l'estrazione (lato Node), il marcatore compilato lo scrive l'estrazione
// e lo legge il runtime (lato browser). Finché i delimitatori erano scritti a mano da
// entrambe le parti, la prima divergenza non avrebbe prodotto nessun errore: avrebbe prodotto
// testo sbagliato a schermo — i delimitatori interni mostrati all'utente finale, o ogni
// stringa che cade nel fallback.
//
// Il file non importa nulla e non dipende né da React né da Node: entrambi i lati lo prendono
// così com'è. Niente Object.freeze: vedi la nota in errorSolve.js sul perché una freeze non
// annotata trascina le costanti nel bundle di produzione.

// --- Marcatore SORGENTE: quello che si scrive nel codice, `_%_ciao_%_` ---

export const SOURCE_OPEN = "_%_";
export const SOURCE_CLOSE = "_%_";

/** "_%__%_": marcatore vuoto, la stringa marcata più corta che possa esistere. Sotto questa
 *  soglia un "_%_" isolato aprirebbe e chiuderebbe se stesso. */
export const MIN_SOURCE_MARKED = SOURCE_OPEN.length + SOURCE_CLOSE.length;

// --- Marcatore COMPILATO: quello che l'estrazione mette al suo posto ---
//
// `_<_id_/_fallback_>_` in sviluppo (il testo sorgente resta a portata di mano prima che una
// sync abbia popolato i file di lingua), `_<_id_>_` in build (il comando vtranslate-cli gira
// prima, quindi il fallback in bundle sarebbe ridondante).

export const COMPILED_OPEN = "_<_";
export const COMPILED_SEP = "_/_";
export const COMPILED_CLOSE = "_>_";

/** Costruisce il marcatore compilato. Lo legge `parseCompiledMarker.js`. */
export function compiledMarker(id, inner, includeFallback) {
  return includeFallback
    ? `${COMPILED_OPEN}${id}${COMPILED_SEP}${inner}${COMPILED_CLOSE}`
    : `${COMPILED_OPEN}${id}${COMPILED_CLOSE}`;
}

/** La stringa è un marcatore compilato? Il controllo che due emitter facevano a mano. */
export const isCompiledMarker = (text) =>
  text.startsWith(COMPILED_OPEN) && text.endsWith(COMPILED_CLOSE);

// --- Segnaposto degli argomenti ---
//
// Due lettori: il compilatore delle tabelle, che lo spezza (`split`), e l'interpolazione a
// runtime, che lo sostituisce (`replace`). Le due forme stanno su righe adiacenti proprio
// perché descrivono lo stesso token e devono cambiare insieme.

export const PLACEHOLDER = "%s";
export const PLACEHOLDER_RE = /%s/g;

// --- Chiave riservata delle tabelle compilate ---
//
// L'elenco delle voci che in questa lingua una traduzione non ce l'hanno. La scrive
// compileTable.js, la legge resolveEntry.js per decidere il prefisso 🔸. Le chiavi vere sono
// `Basename_hash` e non possono collidere con questa.

export const UNTRANSLATED_KEY = "__untranslated__";
