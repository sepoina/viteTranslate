// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "2b. Compilazione delle tabelle".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import parseMarkup from "./parseMarkup.js";
import { ARG, pushTextParts, nodesExpr } from "./emitTree.js";
import { compileIcuEntry } from "./icu/compileIcu.js";
import { compareIcu } from "./icu/icuSignature.js";
import { parseIcu } from "../../icu/parse.js";
import { ERROR_SOLVE_DEFAULTS } from "../../errorSolve.js";
import { PLACEHOLDER, UNTRANSLATED_KEY } from "../../markerSyntax.js";
import { defaultWarn } from "../babel/markerCore.js";

// Nome dell'helper nel modulo generato: la stessa costante di emitTree.js (vedi lì).
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
//
// Dalla 4.6.3 (unica eccezione dichiarata al byte per byte, vedi doc/icu.md e lib/namedArgs.js,
// che ne è la copia per chi non passa dal chunk compilato): accetta anche l'oggetto degli
// argomenti con nome, e un oggetto semplice come VALORE non arriva mai a React (che lo
// rifiuterebbe lanciando) — diventa il segnaposto di argomento mancante come tutto il resto.
const argHelper = (missingArg) => `const _m = ${JSON.stringify(missingArg)};
function _named(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v) || v.$$typeof !== undefined) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}
function ${ARG}(list, i) {
  if (list === false || list == null) return _m;
  const v = Array.isArray(list) ? list[i] : _named(list) ? (Object.hasOwn(list, i) ? list[i] : undefined) : i === 0 ? list : undefined;
  return v == null || _named(v) ? _m : v;
}`;

// `{nome}`: il campo dell'oggetto degli argomenti — l'argomento stesso, o il primo della lista.
// Stessa regola di lettura di `lib/namedArgs.js` (argNamed), verificata dalla parità in
// namedArgs.test.mjs.
const KEY_HELPER = `function _key(list, k) {
  const o = Array.isArray(list) ? list[0] : list;
  const v = _named(o) && Object.hasOwn(o, k) ? o[k] : undefined;
  return v == null || _named(v) ? _m : v;
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
 * @param {(message: string, kind?: string) => void} [warn] - canale per gli avvisi di
 *   `parseMarkup` (tag incrociati); passato a valle, non dice nulla su cosa farne qui
 * @param {{ locale?: string, key: string, quiet?: boolean }} [icuCtx] - se presente, il testo è
 *   provato prima come messaggio ICU MessageFormat (piano 4.6.3): un messaggio ICU valido
 *   produce una quinta forma, `(a, o) => …`, che chiama gli helper di "virtual:vitetranslate/icu".
 *   Senza `icuCtx` il comportamento è quello di sempre (i chiamanti esterni, come
 *   test/exampleLangCompile.mjs, non passano questo parametro).
 * @returns {string} un'espressione JS
 */
export function compileEntry(source, used, warn, icuCtx) {
  if (icuCtx !== undefined) {
    const parsed = parseIcu(source, icuCtx.locale);
    if (parsed.icu) {
      const say = icuCtx.quiet ? () => {} : (warn ?? defaultWarn);
      const label = `${icuCtx.locale ?? "?"}: key "${icuCtx.key}"`;
      if (parsed.ok) {
        for (const w of parsed.warnings) say(`${label} — ${w.message}`, w.code);
        return compileIcuEntry(parsed.ast, { locale: icuCtx.locale, used, warn });
      }
      say(`${label} is not a valid ICU message, shown as plain text: ${parsed.message}`, parsed.code);
    }
  }

  const nodes = parseMarkup(source, warn);
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

/**
 * Genera il sorgente completo del modulo lingua compilato.
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
 * @param {Record<string, any>} table - la tabella così com'è sul disco: solo stringhe e `null`,
 *   senza eccezioni
 * @param {string} [tag] - la locale delle voci tradotte: non solo cortesia, dalla 4.6.3 è anche
 *   la locale con cui si formattano i loro messaggi ICU (plurali, select, number, date)
 * @param {Record<string, any>} [sourceTable] - tabella della lingua sorgente, da cui pescare
 *   il testo delle chiavi non tradotte
 * @param {{missingArg?: string, emitUntranslated?: boolean, warn?: (message: string, kind?: string) => void,
 *   icu?: boolean, icuModule?: string, sourceTag?: string}} [options] - `icu` (default `true`)
 *   spegne il riconoscimento dei messaggi ICU; `icuModule` (default "virtual:vitetranslate/icu")
 *   è da dove i chunk importano gli helper; `sourceTag` è la locale della lingua sorgente, usata
 *   per compilare i messaggi ICU delle voci ricadute su di essa
 * @returns {string} sorgente ES module con `export default`
 */
export function compileLanguageModule(table, tag = "", sourceTable = null, options = {}) {
  const missingArg = options.missingArg ?? ERROR_SOLVE_DEFAULTS.mark.absentDataInArray;
  const emitUntranslated = options.emitUntranslated === true;
  const warn = options.warn;
  const icuOn = options.icu !== false;
  const icuModule = options.icuModule ?? "virtual:vitetranslate/icu";
  const used = { jsx: false, jsxs: false, fragment: false, arg: false, cat: false, key: false, icu: new Set(), icuOpts: new Map() };
  const entries = [];
  const untranslated = [];

  const emit = (key, value) => {
    let own = value;
    // Una traduzione ICU con argomenti diversi dal sorgente vale come non tradotta: si mostra
    // il testo sorgente, con 🔸 se acceso. È l'invariante 21 (vedi doc/structure.md).
    if (icuOn && typeof own === "string" && sourceTable !== null && typeof sourceTable[key] === "string") {
      const { errors, warnings } = compareIcu(sourceTable[key], own, tag);
      const label = `${tag}: key "${key}"`;
      for (const w of warnings) (warn ?? defaultWarn)(`${label} — ${w.message}`, w.code);
      if (errors.length > 0) {
        (warn ?? defaultWarn)(`${label} — ${errors[0].message}; shown in ${options.sourceTag || "the source language"} until fixed`, errors[0].code);
        own = null;
      }
    }
    // Il fallback vale solo se è testo: una sorgente a sua volta non tradotta non aggiunge
    // nulla, e lasciare il null tiene in piedi la catena di runtime come ultima risorsa.
    const resolved = own === null && sourceTable !== null && typeof sourceTable[key] === "string"
      ? sourceTable[key]
      : own;
    // `own` e non `resolved`: la domanda è se questa lingua abbia una traduzione propria (o
    // sia stata ricondotta a "non tradotta" da un argomento ICU sbagliato), non se sia stato
    // possibile mostrare qualcosa al posto suo.
    if (emitUntranslated && own === null) untranslated.push(key);
    const fromSource = own === null;
    const icuCtx = icuOn ? { locale: (fromSource ? options.sourceTag : tag) || undefined, key, quiet: fromSource } : undefined;
    const expr = typeof resolved === "string" ? compileEntry(resolved, used, warn, icuCtx) : JSON.stringify(resolved);
    entries.push(`  ${JSON.stringify(key)}: ${expr}`);
  };

  for (const [key, value] of Object.entries(table)) {
    emit(key, value);
  }

  // Chiavi che la lingua sorgente ha e questa no: succede quando il file non è ancora passato
  // dal comando di sincronizzazione. Senza di esse la tabella non sarebbe autonoma proprio nel
  // caso in cui serve di più — una lingua rimasta indietro. L'ordine le mette in coda, così il
  // resto del modulo non cambia forma rispetto a prima.
  if (sourceTable !== null) {
    for (const [key, value] of Object.entries(sourceTable)) {
      if (Object.hasOwn(table, key)) continue;
      // Una chiave che questa lingua non ha proprio è non tradotta quanto una a null, e va
      // segnata qui: dopo l'emissione sarà presente nel modulo come tutte le altre, e a
      // runtime nessuno potrebbe più distinguerla.
      if (emitUntranslated) untranslated.push(key);
      emit(key, typeof value === "string" ? value : null);
    }
  }

  // In coda alle voci, così il resto del modulo non cambia forma rispetto a prima. La chiave è
  // riservata: le chiavi vere sono `Basename_hash`, generate dal compilatore, e non possono
  // collidere.
  if (emitUntranslated && untranslated.length > 0) {
    const flags = untranslated.map((key) => `${JSON.stringify(key)}: 1`).join(", ");
    entries.push(`  ${JSON.stringify(UNTRANSLATED_KEY)}: { ${flags} }`);
  }

  const imported = ["Fragment", "jsx", "jsxs"].filter(
    (name) => used[name === "Fragment" ? "fragment" : name]
  );

  const head = [`// generato da vitetranslate${tag ? ` — ${tag}` : ""}: non modificare, si rigenera a ogni build`];
  if (imported.length > 0) head.push(`import { ${imported.join(", ")} } from "react/jsx-runtime";`);
  // Gli helper ICU non sono inline come _arg/_cat: un solo modulo condiviso, una sola cache
  // Intl per tutta l'app (piano 4.6.3, "Helper ICU"). Un chunk che non usa l'ICU non importa
  // niente da qui, e il bundler lo scarta del tutto.
  const ICU_HELPERS = [["icuDate", "_icuD"], ["icuNumber", "_icuN"], ["icuPlural", "_icuP"], ["icuSelect", "_icuS"]];
  const icuNames = ICU_HELPERS.filter(([name]) => used.icu.has(name)).map(([name, alias]) => `${name} as ${alias}`);
  if (icuNames.length > 0) head.push(`import { ${icuNames.join(", ")} } from ${JSON.stringify(icuModule)};`);
  for (const [json, name] of used.icuOpts) head.push(`const ${name} = ${json};`);
  if (used.arg) head.push(argHelper(missingArg));
  if (used.key) head.push(KEY_HELPER);
  if (used.cat) head.push(CAT_HELPER);

  return `${head.join("\n")}\n\nexport default {\n${entries.join(",\n")}\n};\n`;
}
