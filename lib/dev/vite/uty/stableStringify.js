// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Come JSON.stringify, ma con le chiavi degli oggetti in ordine alfabetico, a ogni livello.
 *
 * La sincronizzazione decide se riscrivere un file confrontando i BYTE (vedi
 * uty/buildLanguageHeader.js, `sameIgnoringProcessed`), non più le tabelle in memoria: qui resta
 * per la parità con js-yaml in `languageFileIO.test.mjs`, dove il confronto è insensibile
 * all'ordine delle chiavi ed è ciò che serve a un test che verifica il CONTENUTO, non il layout
 * del file.
 *
 * @param {any} value
 * @returns {string}
 */
export default function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const body = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",");
  return `{${body}}`;
}
