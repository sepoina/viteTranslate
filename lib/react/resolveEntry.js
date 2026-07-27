import { interpolate } from "./interpolate.js";
// Usato solo nel ramo di sviluppo di `missing()`. In produzione `import.meta.env.DEV` diventa
// `false`, il ramo sparisce e con lui l'import: verificato ricostruendo il playground, il
// bundle resta byte-identico. Il parser HTML non entra in produzione pur essendo importato qui.
import { basicHtmlToNodes } from "./basicHtmlToNodes.js";

// Una voce di tabella compilata può avere tre forme (vedi lib/dev/compile/compileTable.js):
// una stringa, un elemento React già costruito, o una funzione che riceve gli argomenti.
// Qui non si normalizza nulla prima di chiamarla: l'helper generato dentro il chunk lingua
// accetta già lista, scalare, `false`, `null` o nessun argomento senza fallire.

/**
 * Risolve una chiave nella tabella della lingua attiva, ricadendo sulla lingua sorgente.
 *
 * @param {Record<string, any>|undefined} table - tabella della lingua attiva
 * @param {Record<string, any>|undefined} sourceTable - tabella della lingua sorgente
 * @param {string} key
 * @param {any} args - argomenti per i `%s`, in qualunque forma
 * @param {string|undefined} fallback - testo grezzo di ultima istanza (in dev è quello
 *   incorporato nel marcatore compilato; in produzione non c'è)
 * @returns {React.ReactNode}
 */
export function resolveEntry(table, sourceTable, key, args, fallback) {
  const entry = table?.[key] ?? sourceTable?.[key];

  if (entry === undefined || entry === null) return missing(key, args, fallback);
  if (typeof entry === "function") return entry(args);
  return entry;
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
export function resolveEntryText(table, sourceTable, key, args, fallback) {
  const resolved = resolveEntry(table, sourceTable, key, args, fallback);
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
function missing(key, args, fallback) {
  if (fallback === undefined && import.meta.env?.DEV) {
    console.error(`Translate: chiave "${key}" assente dalla tabella, dalla lingua sorgente e senza fallback: verrà mostrata la chiave grezza.`);
  }
  if (import.meta.env?.DEV && fallback !== undefined) return basicHtmlToNodes(fallback, args);
  return interpolate(fallback ?? key, args);
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
