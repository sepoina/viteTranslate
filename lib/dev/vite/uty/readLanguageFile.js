// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 6.

import fs from "fs";
import parseLanguageFile, { normalizeBuilder } from "./parseLanguageFile.js";

/**
 * Il testo di un file di lingua, o un errore che dice che il file non si legge AFFATTO.
 *
 * È una distinzione, non un dettaglio: "non rientra nel formato" e "non si apre" portano a due
 * decisioni opposte. Un file fuori formato si mette da parte e si rigenera — il contenuto c'è,
 * ed è recuperabile dal backup. Un file che non si apre — una cartella con il nome di un file
 * di lingua, i permessi, un link rotto — non si sa cosa contenga, quindi non lo si può né
 * copiare né sostituire: l'unica mossa corretta è lasciarlo dov'è e dirlo. Chi chiama riconosce
 * il caso dal flag `unreadable`, senza dover interpretare un codice errno.
 *
 * @param {string} filePath
 * @returns {string}
 * @throws {Error & { unreadable: true, cause: Error }}
 */
export function readLanguageText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    const error = new Error(`cannot be read (${e.code ?? e.message})`);
    error.unreadable = true;
    error.cause = e;
    throw error;
  }
}

/**
 * Legge la tabella di un file di lingua dal disco.
 *
 * Era `importLanguageModule`, ed era asincrona e complicata perché il file era un modulo JS:
 * andava eseguito per essere letto. Ne venivano un contesto `vm` senza globali per la forma
 * piatta, un ripiego su `import()` per tutto il resto, e con quello la cache dei moduli ESM di
 * Node — che non si svuota mai, non ha API di sfratto e tratteneva 24 kB per ogni salvataggio
 * del traduttore (7 MB dopo 300) — più una query di cache-busting che doveva essere un hash
 * del contenuto e non l'mtime, perché due scritture nello stesso tick del filesystem
 * condividevano la chiave e Node serviva in silenzio la versione precedente.
 *
 * Adesso il file è un dato e non un modulo: si legge e si parsa. Tutto quel ramo non esiste
 * più, e con esso la classe di bug che ci viveva dentro.
 *
 * L'errore di formato porta con sé il testo da cui è nato (`error.sourceText`). Il chiamante
 * che deve farne un backup lo ha già in mano: prima lo rileggeva dal disco, e fra le due
 * letture c'era il tempo perché il file cambiasse — cioè perché il backup fotografasse
 * qualcosa di diverso da ciò che aveva causato l'errore.
 *
 * @param {string} filePath
 * @param {string} [text] - il contenuto già letto, per chi lo ha in mano (il generatore del
 *   manifest lo legge per calcolarne l'hash): evita di leggere lo stesso file due volte.
 * @returns {object | undefined} la tabella, o `undefined` se il file è vuoto (lingua nuova)
 * @throws {Error & { sourceText?: string, unreadable?: true }} se il file non si apre
 *   (`unreadable`) o non rientra nel formato: lì il messaggio porta il numero di riga.
 */
export default function readLanguageFile(filePath, text) {
  const contenuto = text ?? readLanguageText(filePath);
  let table;
  try {
    table = parseLanguageFile(contenuto, filePath);
  } catch (error) {
    error.sourceText = contenuto;
    throw error;
  }
  return table === undefined ? undefined : normalizeBuilder(table);
}
