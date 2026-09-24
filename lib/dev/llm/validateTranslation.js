// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Il pezzo che vale di più di tutta la funzione LLM. Puro: niente I/O, niente config, si prova
// con due stringhe e basta. Nessun import oltre a markerSyntax.js e parseMarkup.js (invariante
// 14: la sintassi dei placeholder e dei tag ha un posto solo).

import { PLACEHOLDER_RE } from "../../markerSyntax.js";
import parseMarkup, { TAG_RE } from "../compile/parseMarkup.js";
import { isIcuCandidate } from "../../icu/parse.js";
import { compareIcu } from "../compile/icu/icuSignature.js";

// `s.matchAll(re)` non lascia `lastIndex` sporco su `re` anche se `re` è `/g`: la spec lo
// clona internamente. È per questo che qui non serve mai un `RE.lastIndex = 0` a mano.
function countPlaceholders(s) {
  return [...s.matchAll(PLACEHOLDER_RE)].length;
}

function tagMultiset(s) {
  const counts = new Map();
  for (const match of s.matchAll(TAG_RE)) {
    const key = `${match[1] ? "close" : "open"}:${match[2].toLowerCase()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function sameMultiset(a, b) {
  if (a.size !== b.size) return false;
  for (const [key, count] of a) {
    if (b.get(key) !== count) return false;
  }
  return true;
}

function hasCrossedTags(candidate) {
  let crossed = false;
  parseMarkup(candidate, (_message, kind) => {
    if (kind === "mis-nested-markup") crossed = true;
  });
  return crossed;
}

// Per i messaggi ICU: l'INSIEME dei nomi di tag, non il multiset — un ramo in più per lingua
// (un plurale con più categorie di quelle del sorgente) ripete gli stessi tag, e non è un
// errore (piano 4.6.3).
function sameTagNames(source, candidate) {
  const namesOf = (s) => new Set([...s.matchAll(TAG_RE)].map((m) => `${m[1] ? "close" : "open"}:${m[2].toLowerCase()}`));
  const a = namesOf(source);
  const b = namesOf(candidate);
  if (a.size !== b.size) return false;
  for (const name of a) if (!b.has(name)) return false;
  return true;
}

// Spazio iniziale e finale del candidato allineati a quelli del sorgente: è una correzione, non
// un fallimento. Se il sorgente non ne ha, il risultato è `trim()`; se ne ha, sono identici.
function alignWhitespace(source, candidate) {
  const [, leading] = source.match(/^(\s*)/);
  const [, trailing] = source.match(/(\s*)$/);
  return `${leading}${candidate.trim()}${trailing}`;
}

/**
 * Verifica che una traduzione candidata sia sicura da scrivere.
 *
 * @param {{ key: string, source: string, candidate: unknown, targetTag?: string }} params -
 *   `targetTag` serve solo al ramo ICU (piano 4.6.3): le categorie plurali obbligatorie e i
 *   messaggi di compareIcu nominano la lingua target.
 * @returns {{ ok: true, value: string } | { ok: false, reason: string, detail: object }}
 */
export default function validateTranslation({ key, source, candidate, targetTag }) {
  if (typeof candidate !== "string" || candidate.trim() === "") {
    return { ok: false, reason: "not-a-string", detail: {} };
  }

  if (candidate.trim() === key) {
    return { ok: false, reason: "echo-key", detail: {} };
  }

  const icuSource = isIcuCandidate(source);
  if (!icuSource) {
    if (isIcuCandidate(candidate)) return { ok: false, reason: "icu-introduced", detail: {} };

    const expectedPlaceholders = countPlaceholders(source);
    const foundPlaceholders = countPlaceholders(candidate);
    if (foundPlaceholders !== expectedPlaceholders) {
      return {
        ok: false,
        reason: "placeholder-count",
        detail: { expected: expectedPlaceholders, found: foundPlaceholders },
      };
    }

    const expectedTags = tagMultiset(source);
    const foundTags = tagMultiset(candidate);
    if (!sameMultiset(expectedTags, foundTags)) {
      return {
        ok: false,
        reason: "tag-mismatch",
        detail: { expected: [...expectedTags], found: [...foundTags] },
      };
    }

    if (hasCrossedTags(candidate)) {
      return { ok: false, reason: "tag-crossed", detail: {} };
    }

    const value = alignWhitespace(source, candidate);

    const maxLength = source.length * 4 + 20;
    if (value.length > maxLength) {
      return { ok: false, reason: "too-long", detail: { length: value.length, maxLength } };
    }

    return { ok: true, value };
  }

  if (!isIcuCandidate(candidate)) return { ok: false, reason: "icu-missing", detail: {} };

  const { errors, warnings } = compareIcu(source, candidate, targetTag);
  // Per l'LLM anche un avviso (categorie plurali o chiavi select mancanti) è un rifiuto: un
  // messaggio incompleto scritto da un modello non è meglio di uno rimasto null.
  const first = errors[0] ?? warnings[0];
  if (first) return { ok: false, reason: first.code, detail: { message: first.message } };

  // Tag: l'insieme dei nomi, non il multiset — un ramo in più per lingua ripete gli stessi tag.
  if (!sameTagNames(source, candidate)) return { ok: false, reason: "tag-mismatch", detail: {} };
  if (hasCrossedTags(candidate)) return { ok: false, reason: "tag-crossed", detail: {} };

  const value = alignWhitespace(source, candidate);
  // I rami plurali crescono con la lingua (l'arabo ne ha sei): il tetto ×4 del percorso non
  // ICU sarebbe troppo stretto.
  const maxLength = source.length * 8 + 20;
  if (value.length > maxLength) {
    return { ok: false, reason: "too-long", detail: { length: value.length, maxLength } };
  }

  return { ok: true, value };
}
