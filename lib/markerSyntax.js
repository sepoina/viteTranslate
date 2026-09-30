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

// --- Messaggi ICU (4.6.3) ---
//
// Un testo è un messaggio ICU MessageFormat solo se contiene un argomento ICU: "{" + cifra
// ("{0", "{ 1 ,"), oppure "{" + nome chiuso subito ("{nome}") o seguito da una virgola e da un
// tipo ICU ("{n, plural,"). Una graffa qualunque non basta, e non è prudenza teorica: le tabelle
// di playEdge contengono già "{ t: null }", "{ t, a }" e "${}", che devono restare testo.
// Tre lettori: il compilatore delle tabelle, il validatore LLM e l'interprete di dev.
export const ICU_TRIGGER_RE =
  /\{\s*\d|\{\s*[\p{L}_][\p{L}\p{N}_]*\s*(?:\}|,\s*(?:number|date|time|plural|selectordinal|select)\s*[,}])/u;

// Il nome di un argomento: numerato ("0") oppure un identificatore ("nome", "città").
export const ICU_NAME_RE = /^(?:\d+|[\p{L}_][\p{L}\p{N}_]*)$/u;

// --- Slot (4.6.4) ---
//
// `<0>…</0>`: un elemento che sta nel CODICE (un link, un componente, un tag con attributi) e il
// cui contenuto sta nel TESTO. Il numero è l'indice dell'argomento che porta l'elemento, lo stesso
// spazio di `{0}`. Mai attributi, mai autochiusura: una traduzione può solo spostarlo. Un "<"
// seguito da una cifra non è un tag né per il browser né per TAG_RE: nessuna tabella scritta prima
// della 4.6.4 cambia significato. Tre lettori: parseMarkup, il confronto degli argomenti
// (icuSignature.js) e il validatore LLM. Con /g: si usa solo con matchAll.
export const SLOT_TAG_RE = /<(\/?)(\d{1,3})>/g;

// --- Il pre-filtro dei file (4.6.4) ---
//
// Chi importa il runtime può scrivere la macro senza "_%_" (`<Translate>…</Translate>`, `ts`…``).
// Una sola definizione per i tre punti che decidono se un file va letto — il transform, la
// scansione del CLI, la verifica veloce — perché se divergessero il CLI e il dev server
// troverebbero chiavi diverse (invariante 24).
export const RUNTIME_IMPORT = "@sepoina/vitetranslate/react";
const MACRO_IMPORT_RE = /import\s*\{[^}]*\b(?:Translate|useTranslateToString)\b[^}]*\}\s*from\s*["']@sepoina\/vitetranslate\/react["']/;

/** Il file può contenere qualcosa da estrarre? Un pre-scarto: il parse decide. */
export function mayHaveMarkers(code) {
  return code.includes(SOURCE_OPEN) || (code.includes(RUNTIME_IMPORT) && MACRO_IMPORT_RE.test(code));
}

// --- Chiave riservata delle tabelle compilate ---
//
// L'elenco delle voci che in questa lingua una traduzione non ce l'hanno. La scrive
// compileTable.js, la legge resolveEntry.js per decidere il prefisso 🔸. Le chiavi vere sono
// `Basename_hash` e non possono collidere con questa.

export const UNTRANSLATED_KEY = "__untranslated__";
