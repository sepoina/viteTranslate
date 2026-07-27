import parseMarkup from "./parseMarkup.js";
import { MISSING_ARG } from "../../react/interpolate.js";

// Nome dell'helper nel modulo generato. È emesso inline in ogni chunk lingua invece di essere
// importato dal runtime: il chunk resta autosufficiente (l'unica dipendenza è il jsx-runtime,
// e solo quando serve davvero), non dipende dalla risolvibilità di un path del pacchetto da
// dentro la cartella locale dell'utente, e il minifier lo accorcia comunque a un carattere.
const ARG = "_arg";

// L'unico punto in cui una funzione compilata legge i suoi parametri, quindi l'unico punto in
// cui può fallire. È scritto per non fallire mai: chiamare la voce senza argomenti, con null,
// con `false`, con una lista più corta dei segnaposto o con uno scalare al posto della lista
// produce sempre un valore renderizzabile. Uno `0` o una stringa vuota sono valori legittimi
// e passano; solo undefined e null diventano il segnaposto di argomento mancante.
const ARG_HELPER = `const _m = ${JSON.stringify(MISSING_ARG)};
function ${ARG}(list, i) {
  if (list === false || list == null) return _m;
  const v = Array.isArray(list) ? list[i] : i === 0 ? list : undefined;
  return v == null ? _m : v;
}`;

const PLACEHOLDER = "%s";

/**
 * Compila il valore di una singola voce di tabella nell'espressione JS che la rappresenta.
 *
 * Quattro forme possibili, scelte in base a cosa contiene il testo:
 *  - testo semplice            -> una stringa letterale
 *  - testo + `%s`              -> `a => "..." + _arg(a, 0) + "..."`
 *  - markup                    -> un elemento React costruito una volta sola
 *  - markup + `%s`             -> `a => jsxs(...)` con i segnaposto come figli
 *
 * @param {string} source - il testo così com'è scritto nel file di lingua
 * @param {{jsx:boolean, jsxs:boolean, fragment:boolean, arg:boolean}} used - accumulatore
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
    return `a => ${concatExpr(plainText, counter)}`;
  }

  const expr = nodesExpr(nodes, counter, used);
  // Senza segnaposto l'albero non dipende da nulla: si costruisce una volta alla valutazione
  // del modulo e mantiene identità stabile fra i render, che è ciò che permette a React di
  // saltare la riconciliazione del sottoalbero.
  if (counter.n === 0) return expr;
  used.arg = true;
  return `a => ${expr}`;
}

/**
 * Genera il sorgente completo del modulo lingua compilato.
 *
 * @param {Record<string, any>} table - la tabella così com'è sul disco (stringhe, `null`,
 *   più la voce di metadati `__builder__`)
 * @param {string} [tag] - solo per l'intestazione di cortesia
 * @returns {string} sorgente ES module con `export default`
 */
export function compileLanguageModule(table, tag = "") {
  const used = { jsx: false, jsxs: false, fragment: false, arg: false };
  const entries = [];

  for (const [key, value] of Object.entries(table)) {
    // __builder__ sono metadati, e un null è una chiave non ancora tradotta: entrambi vanno
    // ricopiati come dati, così la catena `lang.table[k] ?? sourceTable[k]` continua a valere.
    const expr = typeof value === "string" ? compileEntry(value, used) : JSON.stringify(value);
    entries.push(`  ${JSON.stringify(key)}: ${expr}`);
  }

  const imported = ["Fragment", "jsx", "jsxs"].filter(
    (name) => used[name === "Fragment" ? "fragment" : name]
  );

  const head = [`// generato da vitetranslate${tag ? ` — ${tag}` : ""}: non modificare, si rigenera a ogni build`];
  if (imported.length > 0) head.push(`import { ${imported.join(", ")} } from "react/jsx-runtime";`);
  if (used.arg) head.push(ARG_HELPER);

  return `${head.join("\n")}\n\nexport default {\n${entries.join(",\n")}\n};\n`;
}

// --- generazione delle espressioni ---

// Testo con segnaposto in posizione stringa. Parte sempre da un letterale, anche vuoto: senza,
// un testo che comincia con `%s` produrrebbe un'espressione il cui primo termine non è una
// stringa, e `_arg` restituendo un numero darebbe una somma invece di una concatenazione.
function concatExpr(value, counter) {
  const segments = value.split(PLACEHOLDER);
  let out = JSON.stringify(segments[0]);
  for (let i = 1; i < segments.length; i++) {
    out += ` + ${ARG}(a, ${counter.n++})`;
    if (segments[i] !== "") out += ` + ${JSON.stringify(segments[i])}`;
  }
  return out;
}

// Testo con segnaposto in posizione "figlio JSX": qui il valore non va concatenato, va passato
// a React così com'è — è questo che permette a un argomento di essere a sua volta un elemento.
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
