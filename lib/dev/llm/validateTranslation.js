// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Il pezzo che vale di più di tutta la funzione LLM. Puro: niente I/O, niente config, si prova
// con due stringhe e basta. Nessun import oltre a markerSyntax.js e parseMarkup.js (invariante
// 14: la sintassi dei placeholder e dei tag ha un posto solo).

import { PLACEHOLDER_RE } from "../../markerSyntax.js";
import parseMarkup, { TAG_RE } from "../compile/parseMarkup.js";

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
 * @param {{ key: string, source: string, candidate: unknown }} params
 * @returns {{ ok: true, value: string } | { ok: false, reason: string, detail: object }}
 */
export default function validateTranslation({ key, source, candidate }) {
  if (typeof candidate !== "string" || candidate.trim() === "") {
    return { ok: false, reason: "not-a-string", detail: {} };
  }

  if (candidate.trim() === key) {
    return { ok: false, reason: "echo-key", detail: {} };
  }

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
