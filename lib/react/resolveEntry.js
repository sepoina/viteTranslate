// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { interpolate } from "./interpolate.js";
import { markerFallback } from "./parseCompiledMarker.js";
import { DEFAULT_DIAGNOSTICS, reportOnce } from "../errorSolve.js";
import { withPrefix } from "./withPrefix.js";
// Usato solo nel ramo di sviluppo di `missing()`. In produzione `import.meta.env.DEV` diventa
// `false`, il ramo sparisce e con lui l'import: verificato ricostruendo il playground, il
// bundle resta byte-identico. Il parser HTML non entra in produzione pur essendo importato qui.
import { basicHtmlToNodes } from "./basicHtmlToNodes.js";

// Una voce di tabella compilata può avere tre forme (vedi lib/dev/compile/compileTable.js):
// una stringa, un elemento React già costruito, o una funzione che riceve gli argomenti.
// Qui non si normalizza nulla prima di chiamarla: l'helper generato dentro il chunk lingua
// accetta già lista, scalare, `false`, `null` o nessun argomento senza fallire.

// Chiave riservata che il compilatore aggiunge alla tabella quando i prefissi diagnostici sono
// attivi: l'elenco delle voci che in questa lingua una traduzione non ce l'hanno. Senza,
// l'informazione non esisterebbe più a runtime — la tabella compilata incorpora il testo della
// lingua sorgente nelle chiavi non tradotte, quindi una voce non tradotta è indistinguibile da
// una tradotta bene (vedi compileLanguageModule).
const UNTRANSLATED_KEY = "__untranslated__";

/**
 * Il prefisso che spetta a questa chiave, o `""` se non ne merita nessuno.
 *
 * Due condizioni diverse, con due provenienze diverse:
 *
 *   `🔸` non tradotta QUI — la lingua attiva non ha una traduzione per questa chiave, quindi a
 *      schermo c'è il testo della lingua sorgente. Lo dice la tabella stessa, che se l'è
 *      portato dietro dal compilatore. Ci rientra anche la chiave che dalla tabella manca del
 *      tutto, cioè una sincronizzazione non ancora passata.
 *
 *   `🔹` non tradotta ALTROVE — qui la traduzione c'è, ma in almeno un'altra lingua del
 *      progetto no. È un'informazione globale: la calcola il plugin leggendo tutte le tabelle
 *      e la spedisce nel modulo virtuale.
 *
 * Un solo prefisso per stringa, e il primo vince: se manca la traduzione proprio nella lingua
 * che si sta guardando, dire anche che ne manca una altrove non aggiunge niente.
 */
function prefixFor(table, key, diag) {
  if (diag.untranslated !== "" && table !== undefined && table !== null) {
    if (table[UNTRANSLATED_KEY]?.[key] === 1) return diag.untranslated;
    if (!Object.hasOwn(table, key)) return diag.untranslated;
  }
  if (diag.notFullyTranslated !== "" && diag.partiallyTranslated[key] === 1) return diag.notFullyTranslated;
  return "";
}

/**
 * Risolve una chiave nella tabella della lingua attiva, ricadendo sulla tabella eager.
 *
 * @param {Record<string, any>|undefined} table - tabella della lingua attiva
 * @param {Record<string, any>|undefined} fallbackTable - tabella sempre presente nel bundle
 * @param {string} key
 * @param {any} args - argomenti per i `%s`, in qualunque forma
 * @param {string|undefined} marker - il marcatore compilato da cui viene `key`. Non il testo
 *   di riserva già estratto: da lì si ricava, ma solo in questo ramo. A regime la chiave c'è
 *   e il testo non serve, quindi estrarlo prima sarebbe lavoro buttato a ogni render.
 * @param {object} [diag] - configurazione diagnostica risolta (vedi lib/errorSolve.js). Con i
 *   default nessun prefisso è attivo e questa funzione si comporta come ha sempre fatto.
 * @returns {React.ReactNode}
 */
export function resolveEntry(table, fallbackTable, key, args, marker, diag = DEFAULT_DIAGNOSTICS) {
  const entry = table?.[key] ?? fallbackTable?.[key];

  // Senza un container sopra non c'è tabella attiva, e quella eager fa da lingua corrente a
  // tutti gli effetti: è lei che va interrogata sullo stato di traduzione, altrimenti ogni
  // stringa risulterebbe non tradotta.
  const prefix = prefixFor(table ?? fallbackTable, key, diag);

  if (entry === undefined || entry === null) return withPrefix(prefix, missing(key, args, marker, diag));
  if (typeof entry === "function") return withPrefix(prefix, entry(args));
  return withPrefix(prefix, entry);
}

/**
 * Come `resolveEntry`, ma garantisce una stringa: serve a `ts()`, usata per prop DOM come
 * `placeholder` o `aria-label`, che non accettano nodi.
 *
 * Una chiave che contiene markup si risolve in un elemento React, e in quel caso il testo
 * viene estratto scartando i tag. È una degradazione, non un uso previsto: il markup in un
 * `aria-label` non ha senso, e la cosa giusta è accorgersene a build time.
 *
 * @returns {string}
 */
export function resolveEntryText(table, fallbackTable, key, args, marker, diag = DEFAULT_DIAGNOSTICS) {
  const resolved = resolveEntry(table, fallbackTable, key, args, marker, diag);
  return typeof resolved === "string" ? resolved : flattenToText(resolved);
}

// Chiave assente da entrambe le tabelle. In sviluppo è la condizione **normale** subito dopo
// aver scritto una stringa nuova: il marcatore compilato esiste già, ma il file di lingua lo
// conoscerà solo dopo il comando di sincronizzazione. È esattamente ciò per cui esiste il
// fallback incorporato nel marcatore, quindi finché c'è non si segnala nulla.
// Senza fallback invece si sta per mostrare la chiave grezza a schermo, e quello va detto.
//
// Il fallback è testo sorgente, non compilato, quindi il suo markup va ancora interpretato a
// runtime: in sviluppo lo fa `basicHtmlToNodes`, che qui non costa nulla perché in produzione
// questo ramo non esiste. Senza il ramo di sviluppo resterebbe la sola interpolazione, e un
// `<b>` nel testo di riserva finirebbe letterale a schermo.
function missing(key, args, marker, diag) {
  // Il testo di riserva si estrae QUI, che è l'unico punto in cui serve davvero.
  const fallback = marker === undefined ? undefined : markerFallback(marker);

  // `reportOnce` e non `report`: questo è un percorso di render, e la condizione che lo
  // attiva — una chiave che non esiste da nessuna parte — non si risolve da sé, quindi si
  // ripresenterebbe identica a ogni render di ogni riga che la usa. La chiave di deduplica è
  // quella della voce, che è l'informazione: chiavi diverse restano segnalazioni diverse.
  if (fallback === undefined && import.meta.env?.DEV) {
    reportOnce(diag, `Translate: key "${key}" is missing from the active table, from the source language and has no fallback: the raw key will be shown.`);
  }
  if (import.meta.env?.DEV && fallback !== undefined) return basicHtmlToNodes(fallback, args, diag);
  return interpolate(fallback ?? key, args, diag);
}

function flattenToText(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    let out = "";
    for (const child of node) out += flattenToText(child);
    return out;
  }
  return flattenToText(node.props?.children);
}
