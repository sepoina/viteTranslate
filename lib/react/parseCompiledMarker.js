// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import {
  COMPILED_OPEN, COMPILED_SEP, COMPILED_CLOSE, SOURCE_OPEN, SOURCE_CLOSE, MIN_SOURCE_MARKED,
} from "../markerSyntax.js";

// Un marcatore compilato è "_<_key_/_fallback_>_" in sviluppo (con il testo sorgente
// incorporato) oppure "_<_key_>_" in build (il comando vtranslate-cli gira prima,
// quindi il fallback in bundle sarebbe ridondante).
//
// Le due parti si estraggono separatamente perché servono con frequenze molto diverse: la
// chiave a ogni render, il fallback solo quando la tabella non ha quella chiave.

// Marcatore -> chiave. I marcatori sono letterali del sorgente compilato, quindi la stessa
// stringa torna identica a ogni render: l'estrazione si paga una volta per punto di chiamata
// invece che una volta per render. Il valore in cache è anche la STESSA istanza di stringa,
// quindi le chiamate successive non allocano nulla — che era il costo vero, non l'oggetto
// { key, fallback } che V8 già eliminava non facendolo mai uscire dalla funzione.
const keyCache = new Map();

// I marcatori nascono dal compilatore, quindi il loro numero è fissato a build time: il tetto
// non serve a contenere una crescita illimitata ma a mettere un limite superiore certo anche
// se qualcuno costruisse marcatori a mano a runtime. Superandolo si scarta la voce più
// vecchia: chi cade fuori ripaga l'estrazione di prima, mai di più.
const KEY_CACHE_MAX = 5000;

/**
 * La chiave di un marcatore compilato.
 *
 * Va chiamata solo dopo aver verificato startsWith("_<_") && endsWith("_>_").
 *
 * @param {string} text
 * @returns {string}
 */
export function markerKey(text) {
  const cached = keyCache.get(text);
  if (cached !== undefined) return cached;

  const sep = text.indexOf(COMPILED_SEP, COMPILED_OPEN.length);
  const key = sep === -1
    ? text.slice(COMPILED_OPEN.length, -COMPILED_CLOSE.length)
    : text.slice(COMPILED_OPEN.length, sep);

  if (keyCache.size >= KEY_CACHE_MAX) keyCache.delete(keyCache.keys().next().value);
  keyCache.set(text, key);
  return key;
}

/**
 * Il testo sorgente incorporato in un marcatore, se c'è.
 *
 * Non è in cache di proposito: serve solo quando la chiave manca da tutte le tabelle, cioè
 * per una stringa appena scritta e non ancora sincronizzata. È la condizione normale mentre
 * si lavora, ma riguarda una manciata di voci — metterla in cache costerebbe memoria per un
 * risparmio che non si misura.
 *
 * @param {string} text
 * @returns {string | undefined}
 */
export function markerFallback(text) {
  const sep = text.indexOf(COMPILED_SEP, COMPILED_OPEN.length);
  return sep === -1 ? undefined : text.slice(sep + COMPILED_SEP.length, -COMPILED_CLOSE.length);
}

/**
 * Toglie i delimitatori `_%_..._%_` da una stringa sorgente mai passata dal compilatore,
 * restituendo il testo che c'è dentro. Una stringa non marcata torna invariata.
 *
 * Serve nei percorsi di degrado: un file che il plugin non è riuscito ad analizzare, un
 * marcatore dentro `node_modules` (escluso dal transform), una stringa costruita a runtime.
 * Senza questo passaggio il testo raggiunge l'utente finale con i delimitatori interni
 * ancora attaccati — `_%_Benvenuto_%_` invece di `Benvenuto`.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripSourceMarker(text) {
  if (text.length < MIN_SOURCE_MARKED) return text;
  if (!(text.startsWith(SOURCE_OPEN) && text.endsWith(SOURCE_CLOSE))) return text;
  return text.slice(SOURCE_OPEN.length, -SOURCE_CLOSE.length);
}
