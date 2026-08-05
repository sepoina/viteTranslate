// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "2b. Compilazione delle tabelle".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import parseMarkup from "./parseMarkup.js";
import { ERROR_SOLVE_DEFAULTS } from "../../errorSolve.js";

// Nome dell'helper nel modulo generato. È emesso inline in ogni chunk lingua invece di essere
// importato dal runtime: il chunk resta autosufficiente (l'unica dipendenza è il jsx-runtime,
// e solo quando serve davvero), non dipende dalla risolvibilità di un path del pacchetto da
// dentro la cartella locale dell'utente, e il minifier lo accorcia comunque a un carattere.
const ARG = "_arg";
const CAT = "_cat";

// L'unico punto in cui una funzione compilata legge i suoi parametri, quindi l'unico punto in
// cui può fallire. È scritto per non fallire mai: chiamare la voce senza argomenti, con null,
// con `false`, con una lista più corta dei segnaposto o con uno scalare al posto della lista
// produce sempre un valore renderizzabile. Uno `0` o una stringa vuota sono valori legittimi
// e passano; solo undefined e null diventano il segnaposto di argomento mancante.
//
// Il carattere del segnaposto mancante è inlineato qui e non importato dal runtime: il chunk
// di lingua resta autosufficiente (vedi ARG). Arriva da `errorSolve.mark.absentDataInArray`,
// quindi la stessa build lo scrive uguale in ogni chunk e uguale a quello che usa
// l'interpolazione a runtime — due strade diverse per la stessa regola, e devono dire lo stesso.
const argHelper = (missingArg) => `const _m = ${JSON.stringify(missingArg)};
function ${ARG}(list, i) {
  if (list === false || list == null) return _m;
  const v = Array.isArray(list) ? list[i] : i === 0 ? list : undefined;
  return v == null ? _m : v;
}`;

// Ricomposizione di un testo senza markup i cui segnaposto sono già stati risolti.
//
// Nel caso normale — argomenti primitivi — restituisce una stringa, che è la forma di cui
// ha bisogno `ts()` e quella che React rende senza costruire nulla. Ma un argomento può
// essere un nodo React: una concatenazione con `+` lo trasformerebbe nella stringa
// "[object Object]", e in silenzio. Peggio: dipenderebbe dalla lingua, perché la stessa
// voce compilata con del markup attorno al `%s` prende un'altra strada e l'elemento lo
// rende davvero. Qui i pezzi restano separati finché non si sa cosa contengono, e se ce
// n'è anche uno solo non primitivo diventano figli di un frammento.
const CAT_HELPER = `function ${CAT}(p) {
  for (let i = 0; i < p.length; i++) {
    const v = p[i];
    if (v !== null && typeof v === "object") return jsxs(Fragment, { children: p });
  }
  return p.join("");
}`;

const PLACEHOLDER = "%s";

/**
 * Compila il valore di una singola voce di tabella nell'espressione JS che la rappresenta.
 *
 * Quattro forme possibili, scelte in base a cosa contiene il testo:
 *  - testo semplice            -> una stringa letterale
 *  - testo + `%s`              -> `a => _cat(["...", _arg(a, 0), "..."])`
 *  - markup                    -> un elemento React costruito una volta sola
 *  - markup + `%s`             -> `a => jsxs(...)` con i segnaposto come figli
 *
 * @param {string} source - il testo così com'è scritto nel file di lingua
 * @param {{jsx:boolean, jsxs:boolean, fragment:boolean, arg:boolean, cat:boolean}} used - accumulatore
 *   di cosa il modulo dovrà importare o definire; mutato durante la compilazione
 * @returns {string} un'espressione JS
 */
export function compileEntry(source, used) {
  const nodes = parseMarkup(source);
  const counter = { n: 0 };

  const plainText = nodes.length === 0
    ? ""
    : nodes.length === 1 && nodes[0].type === "text" ? nodes[0].value : null;

  // Nessun markup: il valore resta una stringa, che è anche ciò che serve a ts().
  if (plainText !== null) {
    if (!plainText.includes(PLACEHOLDER)) return JSON.stringify(plainText);
    used.arg = true;
    // `_cat` sceglie a runtime fra stringa e frammento, quindi il modulo deve avere sotto
    // mano anche `jsxs`/`Fragment` — non li userà a meno che un argomento non sia un nodo.
    used.cat = true;
    used.jsxs = true;
    used.fragment = true;
    const parts = [];
    pushTextParts(plainText, counter, parts);
    return `a => ${CAT}([${parts.join(", ")}])`;
  }

  const expr = nodesExpr(nodes, counter, used);
  // Senza segnaposto l'albero non dipende da nulla: si costruisce una volta alla valutazione
  // del modulo e mantiene identità stabile fra i render, che è ciò che permette a React di
  // saltare la riconciliazione del sottoalbero.
  if (counter.n === 0) return expr;
  used.arg = true;
  return `a => ${expr}`;
}

// Metadati della sincronizzazione (versione dello schema, autonimo, stato di completezza):
// servono al lato Node — che legge il file su disco, non questo modulo — e a chi apre il file
// di lingua. Nel bundle non li legge nessuno: il nome della lingua arriva a runtime da
// `languageNames`, calcolato una volta sola nel modulo virtuale. Ricopiarli qui significava
// spedire a ogni visitatore, in ogni chunk di lingua, dati che nessun ramo del runtime tocca.
const METADATA_KEY = "__builder__";

// Chiave riservata con l'elenco delle voci che in questa lingua una traduzione non ce l'hanno.
// Il lettore è `prefixFor` in lib/react/resolveEntry.js, che da lì decide se mostrare il
// prefisso `errorSolve.mark.untranslated`. Mappa a `1` e non array: a runtime è un lookup
// per chiave a ogni render, non una scansione.
const UNTRANSLATED_KEY = "__untranslated__";

/**
 * Genera il sorgente completo del modulo lingua compilato.
 *
 * La voce di metadati `__builder__` viene esclusa: è informazione di sincronizzazione, non
 * contenuto da tradurre (vedi METADATA_KEY).
 *
 * Con `sourceTable` il modulo prodotto è **autonomo**: ogni chiave non ancora tradotta (null)
 * o assente porta con sé il testo della lingua sorgente, già compilato nella stessa forma di
 * tutte le altre. Chi consuma la tabella non ha più bisogno di conoscere la lingua con cui il
 * progetto è stato scritto, né di averla caricata, per mostrare qualcosa di sensato.
 *
 * Senza `sourceTable` i null restano tali e la risoluzione ricade a runtime sulla catena
 * `lang.table[k] ?? sourceTable[k]`: è il comportamento di prima, tenuto per i chiamanti che
 * una tabella sorgente non ce l'hanno (i test, l'ispezione manuale).
 *
 * Con `emitUntranslated` il modulo porta anche l'elenco delle chiavi che una traduzione in
 * questa lingua non ce l'hanno, sotto la chiave riservata `__untranslated__`. È l'unico modo
 * per far sopravvivere quell'informazione fino al runtime: dopo la sostituzione qui sopra una
 * voce non tradotta è, nel modulo prodotto, identica a una tradotta bene. Serve al prefisso
 * `errorSolve.mark.untranslated`, quindi si emette solo quando quel prefisso è acceso —
 * una build di produzione con i default non spedisce nulla di tutto questo.
 *
 * @param {Record<string, any>} table - la tabella così com'è sul disco (stringhe, `null`,
 *   più la voce di metadati `__builder__`)
 * @param {string} [tag] - solo per l'intestazione di cortesia
 * @param {Record<string, any>} [sourceTable] - tabella della lingua sorgente, da cui pescare
 *   il testo delle chiavi non tradotte
 * @param {{missingArg?: string, emitUntranslated?: boolean}} [options]
 * @returns {string} sorgente ES module con `export default`
 */
export function compileLanguageModule(table, tag = "", sourceTable = null, options = {}) {
  const missingArg = options.missingArg ?? ERROR_SOLVE_DEFAULTS.mark.absentDataInArray;
  const emitUntranslated = options.emitUntranslated === true;
  const used = { jsx: false, jsxs: false, fragment: false, arg: false, cat: false };
  const entries = [];
  const untranslated = [];

  const emit = (key, value) => {
    // Il fallback vale solo se è testo: una sorgente a sua volta non tradotta non aggiunge
    // nulla, e lasciare il null tiene in piedi la catena di runtime come ultima risorsa.
    const resolved = value === null && sourceTable !== null && typeof sourceTable[key] === "string"
      ? sourceTable[key]
      : value;
    // `value` e non `resolved`: la domanda è se questa lingua abbia una traduzione propria,
    // non se sia stato possibile mostrare qualcosa al posto suo.
    if (emitUntranslated && value === null) untranslated.push(key);
    const expr = typeof resolved === "string" ? compileEntry(resolved, used) : JSON.stringify(resolved);
    entries.push(`  ${JSON.stringify(key)}: ${expr}`);
  };

  for (const [key, value] of Object.entries(table)) {
    if (key === METADATA_KEY) continue;
    emit(key, value);
  }

  // Chiavi che la lingua sorgente ha e questa no: succede quando il file non è ancora passato
  // dal comando di sincronizzazione. Senza di esse la tabella non sarebbe autonoma proprio nel
  // caso in cui serve di più — una lingua rimasta indietro. L'ordine le mette in coda, così il
  // resto del modulo non cambia forma rispetto a prima.
  if (sourceTable !== null) {
    for (const [key, value] of Object.entries(sourceTable)) {
      if (key === METADATA_KEY || Object.hasOwn(table, key)) continue;
      // Una chiave che questa lingua non ha proprio è non tradotta quanto una a null, e va
      // segnata qui: dopo l'emissione sarà presente nel modulo come tutte le altre, e a
      // runtime nessuno potrebbe più distinguerla.
      if (emitUntranslated) untranslated.push(key);
      emit(key, typeof value === "string" ? value : null);
    }
  }

  // In coda alle voci, così il resto del modulo non cambia forma rispetto a prima. La chiave è
  // riservata come `__builder__`: le chiavi vere sono `Basename_hash`, generate dal
  // compilatore, e non possono collidere.
  if (emitUntranslated && untranslated.length > 0) {
    const flags = untranslated.map((key) => `${JSON.stringify(key)}: 1`).join(", ");
    entries.push(`  ${JSON.stringify(UNTRANSLATED_KEY)}: { ${flags} }`);
  }

  const imported = ["Fragment", "jsx", "jsxs"].filter(
    (name) => used[name === "Fragment" ? "fragment" : name]
  );

  const head = [`// generato da vitetranslate${tag ? ` — ${tag}` : ""}: non modificare, si rigenera a ogni build`];
  if (imported.length > 0) head.push(`import { ${imported.join(", ")} } from "react/jsx-runtime";`);
  if (used.arg) head.push(argHelper(missingArg));
  if (used.cat) head.push(CAT_HELPER);

  return `${head.join("\n")}\n\nexport default {\n${entries.join(",\n")}\n};\n`;
}

// --- generazione delle espressioni ---

// Spezza un testo nei suoi pezzi letterali e nelle letture dei segnaposto. Vale sia in
// posizione "figlio JSX" (dove i pezzi diventano figli e un argomento può essere un elemento)
// sia in posizione stringa (dove `_cat` li ricompone), che è ciò che rende le due forme
// coerenti fra loro: lo stesso argomento si comporta allo stesso modo in entrambe.
function pushTextParts(value, counter, parts) {
  const segments = value.split(PLACEHOLDER);
  if (segments[0] !== "") parts.push(JSON.stringify(segments[0]));
  for (let i = 1; i < segments.length; i++) {
    parts.push(`${ARG}(a, ${counter.n++})`);
    if (segments[i] !== "") parts.push(JSON.stringify(segments[i]));
  }
}

function nodesExpr(nodes, counter, used) {
  const parts = collectParts(nodes, counter, used);
  if (parts.length === 0) return '""';
  if (parts.length === 1) return parts[0];
  used.fragment = true;
  used.jsxs = true;
  return `jsxs(Fragment, { children: [${parts.join(", ")}] })`;
}

function collectParts(nodes, counter, used) {
  const parts = [];
  for (const node of nodes) {
    if (node.type === "text") pushTextParts(node.value, counter, parts);
    else parts.push(elementExpr(node, counter, used));
  }
  return parts;
}

function elementExpr(node, counter, used) {
  const tag = JSON.stringify(node.tag);
  const children = collectParts(node.children, counter, used);

  if (children.length === 0) {
    used.jsx = true;
    return `jsx(${tag}, {})`;
  }
  if (children.length === 1) {
    used.jsx = true;
    return `jsx(${tag}, { children: ${children[0]} })`;
  }
  // `jsxs` e non `jsx`: segnala a React che la lista di figli è statica, evitando l'avviso
  // sulle key che scatterebbe passando un array a `jsx`.
  used.jsxs = true;
  return `jsxs(${tag}, { children: [${children.join(", ")}] })`;
}
