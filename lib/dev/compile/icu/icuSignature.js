// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// La "firma" di un testo (le chiavi dei suoi argomenti, con famiglia) e il confronto fra due
// firme: un'unica funzione, compareIcu, usata dalla compilazione, da --status e dal validatore
// LLM (piano 4.6.3, "Stessi argomenti del sorgente").

import { parseIcu, isIcuCandidate, normalizePlaceholders, forEachIcuNode, TYPE } from "../../../icu/parse.js";
import { PLACEHOLDER } from "../../../markerSyntax.js";

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

/**
 * Confronta gli argomenti ICU di un testo sorgente e della sua traduzione.
 * @returns {{ errors: {code:string,message:string}[], warnings: {code:string,message:string}[] }}
 */
export function compareIcu(sourceText, translationText, targetTag) {
  const EMPTY = { errors: [], warnings: [] };
  // Nessuno dei due è ICU: nessun parse, il percorso 4.6.2 non paga niente.
  if (!isIcuCandidate(sourceText) && !isIcuCandidate(translationText)) return EMPTY;

  const s = signatureOf(sourceText);
  if (!s.ok) return EMPTY; // la sorgente rotta la segnala la sua lingua

  const t = signatureOf(translationText, targetTag);
  if (!t.ok) return { errors: [{ code: t.code, message: t.message }], warnings: [] };

  const errors = [];
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
