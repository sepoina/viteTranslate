// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Come JSON.stringify, ma con le chiavi degli oggetti in ordine alfabetico, a ogni livello.
 *
 * Serve a confrontare due tabelle di lingua per deciderne la riscrittura. Con JSON.stringify
 * il confronto è sensibile all'ordine delle chiavi, e `__builder__` attraversa un round-trip
 * che l'ordine lo cambia: viene costruito in memoria, serializzato senza `incomplete` quando
 * è false, e riletto da readLanguageFile che quel campo lo riappende in coda. Bastava
 * quello per far risultare "cambiato" un file identico, e riscriverlo a ogni sync.
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
