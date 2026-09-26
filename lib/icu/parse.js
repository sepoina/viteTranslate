// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// File puro: niente Node, niente React. Lo usano il CLI, il plugin e, in dev, il browser.
// Innesco, normalizzazione di "%s", parse con formatjs e controlli nostri sull'AST. Mai
// importare "@formatjs/..." da altrove in lib/: si passa sempre da qui.

import { parse, TYPE } from "../dist/icuParser.js";
import { ICU_TRIGGER_RE, ICU_NAME_RE } from "../markerSyntax.js";

export { TYPE };

// Due caratteri dell'area privata Unicode, mai attesi in un testo scritto a mano: usati come
// token per gli "slot" ICU dentro la stringa modello che poi passa da parseMarkup (vedi
// lib/dev/compile/icu/compileIcu.js). Un testo che li contiene già è un errore bloccante.
export const SLOT_OPEN = "";
export const SLOT_CLOSE = "";

/** Un testo è candidato ICU? Solo la presenza dell'innesco, senza validarlo. */
export function isIcuCandidate(text) {
  return typeof text === "string" && ICU_TRIGGER_RE.test(text);
}

/**
 * Il k-esimo "%s" (contato da 0) diventa "{k}". Gli apostrofi qui sono testo come gli altri:
 * la citazione di MF1 non esiste per viteTranslate (vedi `toParserText`).
 *
 * @returns {{ text: string, count: number, inBranch: boolean, offsets: number[] }} `offsets`
 *   sono le posizioni (nel testo normalizzato) in cui è stato scritto un "{k}" al posto di un
 *   "%s": servono all'avviso icu-mixed-index, per distinguerlo da un "{k}" scritto a mano.
 */
export function normalizePlaceholders(text) {
  let out = "";
  let count = 0;
  let depth = 0;
  let inBranch = false;
  const offsets = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") depth = Math.max(0, depth - 1);
    else if (c === "%" && text[i + 1] === "s") {
      if (depth > 0) inBranch = true;
      offsets.push(out.length);
      out += `{${count++}}`;
      i++;
      continue;
    }
    out += c;
  }
  return { text: out, count, inBranch, offsets };
}

/**
 * Il testo come lo deve vedere formatjs: ogni apostrofo raddoppiato, cioè letterale. In MF1
 * "'" prima di "{ } # |" apre una citazione: "dell'{0}" nasconde l'argomento, "'{0}'" diventa
 * testo, e ogni traduttore — umano o LLM — che "abbellisce" ' in ’ cambia gli argomenti del
 * messaggio. Qui, e solo qui, l'apostrofo smette di essere sintassi: chi scrive, chi traduce e
 * il validatore vedono testo normale. Le graffe letterali si scrivono con l'entità &#123;.
 */
function toParserText(text) {
  return text.replaceAll("'", "''");
}

const ORDINAL_WORDS = [
  "zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
];
const ordinalWord = (n) => ORDINAL_WORDS[n] ?? `${n}th`;

function localeOf(tag) {
  if (!tag) return undefined;
  try {
    return new Intl.Locale(tag);
  } catch {
    return undefined;
  }
}

// Ricava le opzioni Intl di un nodo number/date/time da node.style, e le valida costruendo
// il formatter vero: un'opzione che Intl rifiuta va detta ora, non al primo render. Restituisce
// `{ opts }` oppure `{ error: { code, message } }`.
function resolveNumberOptions(node, tag) {
  const i = node.value;
  const s = node.style;
  let opts;
  if (s === null || s === undefined) opts = undefined;
  else if (s === "integer") opts = { maximumFractionDigits: 0 };
  else if (s === "percent") opts = { style: "percent" };
  else if (s === "currency") {
    return { error: { code: "icu-style", message: `{${i}, number, currency} needs a currency code: write {${i}, number, ::currency/EUR}` } };
  } else if (typeof s === "string") {
    return { error: { code: "icu-style", message: `{${i}, number, ${s}}: unknown style, use integer, percent or a :: skeleton` } };
  } else {
    opts = s.parsedOptions;
  }
  if (opts !== undefined) {
    try {
      // eslint-disable-next-line no-new
      new Intl.NumberFormat(tag || undefined, opts);
    } catch (e) {
      return { error: { code: "icu-options", message: `{${i}, number, …}: Intl rejects these options (${e.message})` } };
    }
  }
  return { opts };
}

function resolveDateTimeOptions(node, tag, kind) {
  const i = node.value;
  const s = node.style;
  const styleKey = kind === "date" ? "dateStyle" : "timeStyle";
  let opts;
  if (s === null || s === undefined) opts = { [styleKey]: "medium" };
  else if (s === "short" || s === "medium" || s === "long" || s === "full") opts = { [styleKey]: s };
  else if (typeof s === "string") {
    return { error: { code: "icu-style", message: `{${i}, ${kind}, ${s}}: unknown style, use short, medium, long, full or a :: skeleton` } };
  } else {
    opts = s.parsedOptions;
  }
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat(tag || undefined, opts);
  } catch (e) {
    return { error: { code: "icu-options", message: `{${i}, ${kind}, …}: Intl rejects these options (${e.message})` } };
  }
  return { opts };
}

/**
 * Prova a interpretare un testo come messaggio ICU MessageFormat.
 *
 * @param {string} text
 * @param {string} [tag] - locale BCP 47, usata da Intl.PluralRules dentro formatjs e dalla
 *   validazione delle opzioni number/date/time
 * @returns {{ icu: false } | { icu: true, ok: false, code: string, message: string } |
 *   { icu: true, ok: true, ast: object[], normalized: string, pctCount: number, warnings: {code:string,message:string}[] }}
 *   `normalized` è il testo dato al parser: "%s" numerati, apostrofi raddoppiati.
 */
export function parseIcu(text, tag) {
  if (!isIcuCandidate(text)) return { icu: false };

  if (text.includes(SLOT_OPEN) || text.includes(SLOT_CLOSE)) {
    return { icu: true, ok: false, code: "icu-reserved-char", message: "the text contains U+E000/U+E001, reserved by viteTranslate's ICU compiler" };
  }

  const norm = normalizePlaceholders(toParserText(text));
  if (norm.inBranch) {
    return { icu: true, ok: false, code: "icu-placeholder-in-branch", message: "\"%s\" inside an ICU argument or branch: write the argument as {n} there" };
  }

  const locale = localeOf(tag);
  let ast;
  try {
    ast = parse(norm.text, { ignoreTag: true, requiresOtherClause: true, shouldParseSkeletons: true, captureLocation: true, locale });
  } catch (e) {
    const at = e.location ? ` at column ${e.location.start.column}` : "";
    return { icu: true, ok: false, code: "icu-syntax", message: `invalid ICU syntax (${e.message}${at})` };
  }

  const err = forEachIcuNode(ast, (node) => {
    if (node.type < TYPE.argument || node.type > TYPE.plural) return undefined;
    if (!ICU_NAME_RE.test(node.value)) {
      return { code: "icu-argument-name", message: `argument {${node.value}}: a name is letters, digits and "_", not starting with a digit — or a plain number` };
    }
    if (node.type === TYPE.number) {
      const { opts, error } = resolveNumberOptions(node, tag);
      if (error) return error;
      node.vtOptions = opts;
    } else if (node.type === TYPE.date || node.type === TYPE.time) {
      const { opts, error } = resolveDateTimeOptions(node, tag, node.type === TYPE.date ? "date" : "time");
      if (error) return error;
      node.vtOptions = opts;
    }
    return undefined;
  });
  if (err) return { icu: true, ok: false, ...err };

  const warnings = [];
  const offsetSet = new Set(norm.offsets);
  const flaggedIndexes = new Set();
  let hasNamed = false;
  forEachIcuNode(ast, (node) => {
    if (node.type < TYPE.argument || node.type > TYPE.plural) return undefined;
    if (/^\d+$/.test(node.value)) {
      const k = Number(node.value);
      if (k < norm.count && !offsetSet.has(node.location.start.offset) && !flaggedIndexes.has(k)) {
        flaggedIndexes.add(k);
        warnings.push({ code: "icu-mixed-index", message: `argument {${k}} is used both as the ${ordinalWord(k + 1)} "%s" and as {${k}}: check that this is intended` });
      }
    } else {
      hasNamed = true;
    }
    return undefined;
  });
  if (norm.count > 0 && hasNamed) {
    warnings.push({ code: "icu-mixed-named", message: "\"%s\" and named arguments in the same message: \"%s\" counts from the first argument, which holds the names — write {1}, {2}… instead" });
  }

  return { icu: true, ok: true, ast, normalized: norm.text, pctCount: norm.count, warnings };
}

/**
 * Visita in profondità i nodi ICU: ogni nodo, e (per select/plural) i nodi di ogni ramo.
 * Se `visit` restituisce un valore diverso da `undefined`, la visita si interrompe e lo
 * restituisce.
 */
export function forEachIcuNode(ast, visit) {
  for (const node of ast) {
    const result = visit(node);
    if (result !== undefined) return result;
    if (node.type === TYPE.select || node.type === TYPE.plural) {
      for (const key of Object.keys(node.options)) {
        const nested = forEachIcuNode(node.options[key].value, visit);
        if (nested !== undefined) return nested;
      }
    }
  }
  return undefined;
}
