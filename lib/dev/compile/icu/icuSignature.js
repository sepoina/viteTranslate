// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// La "firma" di un testo (le chiavi dei suoi argomenti, con famiglia) e il confronto fra due
// firme: un'unica funzione, compareIcu, usata dalla compilazione, da --status e dal validatore
// LLM (piano 4.6.3, "Stessi argomenti del sorgente").

import { parseIcu, isIcuCandidate, normalizePlaceholders, forEachIcuNode, TYPE } from "../../../icu/parse.js";
import { PLACEHOLDER, SLOT_TAG_RE } from "../../../markerSyntax.js";

const FAMILY_BY_TYPE = {
  [TYPE.argument]: "any",
  [TYPE.number]: "number",
  [TYPE.date]: "date",
  [TYPE.time]: "date",
  [TYPE.select]: "select",
  [TYPE.plural]: "number",
};

/**
 * La firma di un testo: le chiavi dei suoi argomenti (con la loro famiglia), più le chiavi dei
 * rami di ogni plurale e select. Non fallisce mai su un testo non ICU: conta i placeholder "%s".
 *
 * @returns {{ ok: true, icu: boolean, args: Map<string, Set<string>>, plurals: {key:string, ordinal:boolean, keys:string[]}[], selects: {key:string, keys:string[]}[], warnings?: object[] } | { ok: false, icu: true, code: string, message: string }}
 */
export function signatureOf(text, tag) {
  if (typeof text !== "string") return { ok: true, icu: false, args: new Map(), plurals: [], selects: [] };

  const p = parseIcu(text, tag);
  if (!p.icu) {
    const n = text.split(PLACEHOLDER).length - 1;
    const args = new Map();
    for (let i = 0; i < n; i++) args.set(String(i), new Set(["any"]));
    return { ok: true, icu: false, args, plurals: [], selects: [] };
  }
  if (!p.ok) return { ok: false, icu: true, code: p.code, message: p.message };

  const args = new Map();
  const plurals = [];
  const selects = [];
  forEachIcuNode(p.ast, (node) => {
    if (node.type < TYPE.argument || node.type > TYPE.plural) return undefined;
    let set = args.get(node.value);
    if (set === undefined) { set = new Set(); args.set(node.value, set); }
    set.add(FAMILY_BY_TYPE[node.type]);
    if (node.type === TYPE.plural) {
      plurals.push({ key: node.value, ordinal: node.pluralType === "ordinal", keys: Object.keys(node.options) });
    } else if (node.type === TYPE.select) {
      selects.push({ key: node.value, keys: Object.keys(node.options) });
    }
    return undefined;
  });
  return { ok: true, icu: true, args, plurals, selects, warnings: p.warnings };
}

// CLDR ordina le categorie sempre così, e non tutte le lingue le hanno tutte.
const CLDR_ORDER = ["zero", "one", "two", "few", "many", "other"];
const requiredCache = new Map();

/** Le categorie plurali obbligatorie per `tag`: quelle che Intl.PluralRules restituisce per gli
 * interi da 0 a 1000, più "other", ordinate come in CLDR. Un tag non valido -> ["other"]. */
export function requiredPluralCategories(tag, ordinal) {
  const cacheKey = `${tag}|${ordinal}`;
  const cached = requiredCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let result;
  try {
    const pr = new Intl.PluralRules(tag, { type: ordinal ? "ordinal" : "cardinal" });
    const found = new Set(["other"]);
    for (let n = 0; n <= 1000; n++) found.add(pr.select(n));
    result = CLDR_ORDER.filter((c) => found.has(c));
  } catch {
    result = ["other"];
  }
  requiredCache.set(cacheKey, result);
  return result;
}

// Gli slot (4.6.4): gli indici aperti con <n> e quelli chiusi con </n>. Una traduzione che ne perde
// uno perde un link o un componente; una che ne inventa uno riceverebbe il valore di un altro
// argomento. Valgono come argomenti diversi dal sorgente: errore, e la voce ricade sulla sorgente
// (invariante 21). Insiemi e non conteggi: un ramo plurale in più ripete lo stesso slot.
function slotSets(text) {
  const aperti = new Set();
  const chiusi = new Set();
  if (typeof text !== "string" || !/<\/?\d/.test(text)) return { aperti, chiusi };
  for (const m of text.matchAll(SLOT_TAG_RE)) (m[1] ? chiusi : aperti).add(m[2]);
  return { aperti, chiusi };
}

const stessiElementi = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

function compareSlots(sourceText, translationText) {
  const s = slotSets(sourceText);
  const t = slotSets(translationText);
  if (s.aperti.size === 0 && t.aperti.size === 0 && t.chiusi.size === 0) return [];
  const errors = [];
  if (!stessiElementi(t.aperti, t.chiusi)) {
    errors.push({ code: "slot-unbalanced", message: "a numbered tag is opened and never closed, or closed and never opened" });
  }
  const mancanti = [...s.aperti].filter((k) => !t.aperti.has(k));
  const inattesi = [...t.aperti].filter((k) => !s.aperti.has(k));
  if (mancanti.length > 0 || inattesi.length > 0) {
    const parti = [];
    if (mancanti.length > 0) parti.push(`missing ${mancanti.map((k) => `<${k}>`).join(", ")}`);
    if (inattesi.length > 0) parti.push(`unexpected ${inattesi.map((k) => `<${k}>`).join(", ")}`);
    errors.push({ code: "slot-args", message: `numbered tags differ from the source: ${parti.join("; ")}` });
  }
  return errors;
}

/**
 * Confronta gli argomenti ICU di un testo sorgente e della sua traduzione. Confronta anche gli
 * slot (4.6.4), anche su testi che non sono ICU.
 * @returns {{ errors: {code:string,message:string}[], warnings: {code:string,message:string}[] }}
 */
export function compareIcu(sourceText, translationText, targetTag) {
  const EMPTY = { errors: [], warnings: [] };
  const slotErrors = compareSlots(sourceText, translationText);
  // Nessuno dei due è ICU: nessun parse, il percorso 4.6.2 paga solo la regex degli slot.
  if (!isIcuCandidate(sourceText) && !isIcuCandidate(translationText)) {
    return slotErrors.length > 0 ? { errors: slotErrors, warnings: [] } : EMPTY;
  }

  const s = signatureOf(sourceText);
  if (!s.ok) return slotErrors.length > 0 ? { errors: slotErrors, warnings: [] } : EMPTY;

  const t = signatureOf(translationText, targetTag);
  if (!t.ok) return { errors: [...slotErrors, { code: t.code, message: t.message }], warnings: [] };

  const errors = [...slotErrors];
  const warnings = [];

  const sKeys = [...s.args.keys()];
  const tKeys = [...t.args.keys()];
  const tKeySet = new Set(tKeys);
  const sKeySet = new Set(sKeys);
  const missing = sKeys.filter((k) => !tKeySet.has(k));
  const unexpected = tKeys.filter((k) => !sKeySet.has(k));
  if (missing.length > 0 || unexpected.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`missing ${missing.map((k) => `{${k}}`).join(", ")}`);
    if (unexpected.length > 0) parts.push(`unexpected ${unexpected.map((k) => `{${k}}`).join(", ")}`);
    errors.push({ code: "icu-args", message: `arguments differ from the source: ${parts.join("; ")}` });
  }

  for (const key of sKeys) {
    if (!tKeySet.has(key)) continue;
    const sFam = s.args.get(key);
    const tFam = t.args.get(key);
    if ((sFam.has("number") && tFam.has("date")) || (sFam.has("date") && tFam.has("number"))) {
      errors.push({ code: "icu-arg-type", message: `argument {${key}} is a number in one text and a date in the other` });
    }
  }

  if (targetTag) {
    for (const p of t.plurals) {
      const required = requiredPluralCategories(targetTag, p.ordinal);
      const have = new Set(p.keys.filter((k) => !k.startsWith("=")));
      const lacking = required.filter((c) => !have.has(c));
      if (lacking.length > 0) {
        warnings.push({ code: "icu-plural-categories", message: `plural {${p.key}} lacks the ${targetTag} categories: ${lacking.join(", ")}` });
      }
    }
  }

  for (const sel of s.selects) {
    const haveKeys = new Set();
    for (const tsel of t.selects) {
      if (tsel.key !== sel.key) continue;
      for (const k of tsel.keys) haveKeys.add(k);
    }
    const lacking = sel.keys.filter((k) => !haveKeys.has(k));
    if (lacking.length > 0) {
      warnings.push({ code: "icu-select-keys", message: `select {${sel.key}} lacks the source keys: ${lacking.join(", ")}` });
    }
  }

  return { errors, warnings };
}

/** Il testo sorgente così come lo vede l'LLM: invariato, salvo la normalizzazione di "%s" quando
 * il testo è anche ICU (il k-esimo "%s" diventa "{k}", l'LLM può riordinarlo). */
export function llmSourceText(text) {
  if (typeof text !== "string" || !isIcuCandidate(text) || !text.includes(PLACEHOLDER)) return text;
  return normalizePlaceholders(text).text;
}
