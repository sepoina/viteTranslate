// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Confronta le chiavi di `current` con quelle di `wanted` e restituisce la tabella aggiornata
 * insieme al resoconto. Non tocca gli argomenti.
 *
 * Guarda le CHIAVI, non i valori: un testo sorgente riscritto senza cambiare id non esiste,
 * perché l'id è l'hash del testo.
 *
 * `Object.keys` e `Object.hasOwn` al posto di `for...in` e `in`: quelli guardano anche la
 * catena dei prototipi, e una chiave `toString` in un file scritto a mano non risultava mai in
 * eccesso — quindi non veniva mai tolta e restava nel file per sempre. `parseLanguageFile` le
 * rifiuta già in lettura, ma questa funzione non ha motivo di dipendere da quella difesa.
 *
 * @returns {[{changed: boolean, deleted: string[], added: string[], deletedValues: object}, object]}
 */
export default function updateKeys(current, wanted) {
  const stats = { changed: false, deleted: [], added: [], deletedValues: {} };
  const out = {};

  for (const key of Object.keys(current)) {
    if (Object.hasOwn(wanted, key)) {
      out[key] = current[key];
      continue;
    }
    stats.deletedValues[key] = current[key]; // serve al rilevamento dei rename
    stats.deleted.push(key);
    stats.changed = true;
  }

  for (const key of Object.keys(wanted)) {
    if (Object.hasOwn(current, key)) continue;
    out[key] = wanted[key];
    stats.added.push(key);
    stats.changed = true;
  }

  return [stats, out];
}
