// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { logEchoColored, logWarning } from "../../../utility.js";

/**
 * La tabella estratta dalla scansione è la SOLA fonte di verità per la cancellazione: ogni
 * chiave che non compare lì viene eliminata da ogni file di lingua, e i file vengono
 * riscritti. È il comportamento voluto — è così che le stringhe rimosse dal codice smettono
 * di ingombrare le traduzioni — ma dà per scontato che la scansione abbia funzionato.
 *
 * Quando non ha funzionato la cancellazione diventa un azzeramento completo, in un comando
 * che gira come "prebuild", non interattivo, dove nessuno sta guardando:
 *  - `srcDir` che punta alla cartella sbagliata (o rinominata) -> zero marcatori trovati;
 *  - sintassi nuova che i parser plugin non riconoscono ancora dopo un aggiornamento.
 *
 * (Since 4.7.1 unparsable files are no longer among the causes: an incomplete scan stops the
 * sync with VT_SCAN_INCOMPLETE before it gets here, see syncCore.js.)
 *
 * In both cases the language files are valid and readable — so the backup for corrupted files
 * does not fire — and they are simply emptied.
 *
 * This check is PURE: it recognizes the suspicion and says so. The backups of EVERY language
 * file are made by updateLanguage in its phase P3, from the snapshot bytes, before any write.
 */

// Sopra questa quota di chiavi perse la cancellazione smette di somigliare a una pulizia
// normale. Una rimozione di codice reale tocca una manciata di stringhe alla volta; metà
// della tabella in un colpo solo è quasi sempre una scansione andata a vuoto.
const ERASE_RATIO = 0.5;

const contentKeys = (table) => Object.keys(table ?? {});

/**
 * @param {{ previousTable: object | null, sourceTable: object }} p - the current table of the
 *   source language (`null` if absent, empty or unreadable: first run, nothing to lose) and the
 *   one just extracted from the code
 * @returns {{ erased: string[], cause: string } | null} null if nothing looks suspicious;
 *   otherwise the keys about to be erased and the cause
 */
export function detectMassErase({ previousTable, sourceTable }) {
  const before = contentKeys(previousTable);
  if (before.length === 0) return null;

  const found = new Set(contentKeys(sourceTable));
  const erased = before.filter((key) => !found.has(key));
  if (erased.length === 0) return null;

  // An erasure is normal while the scan is reliable and the loss is contained.
  // One of the two signals being on is enough for it not to be.
  const nothingFound = found.size === 0;
  const tooMuch = erased.length / before.length >= ERASE_RATIO;
  if (!nothingFound && !tooMuch) return null;

  const cause = nothingFound
    ? "the scan found no marked string at all"
    : `${erased.length} of ${before.length} keys would be removed at once`;

  logWarning(`ERASED translations detected — ${cause}.`);
  logEchoColored("", `${erased.length} key(s) are about to be removed from every language file.`);
  logEchoColored("", `e.g. ${erased.slice(0, 3).map((key) => `"${key}"`).join(", ")}${erased.length > 3 ? ", …" : ""}`);
  return { erased, cause };
}
