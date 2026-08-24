// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 6.

import fs from "fs";
import parseLanguageFile, { normalizeBuilder } from "./parseLanguageFile.js";

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
 * @param {string} filePath
 * @param {string} [text] - il contenuto già letto, per chi lo ha in mano (il generatore del
 *   manifest lo legge per calcolarne l'hash): evita di leggere lo stesso file due volte.
 * @returns {object | undefined} la tabella, o `undefined` se il file è vuoto (lingua nuova)
 * @throws {Error} se il file non rientra nel formato: il messaggio porta il numero di riga
 */
export default function readLanguageFile(filePath, text = fs.readFileSync(filePath, "utf8")) {
  const table = parseLanguageFile(text, filePath);
  return table === undefined ? undefined : normalizeBuilder(table);
}
