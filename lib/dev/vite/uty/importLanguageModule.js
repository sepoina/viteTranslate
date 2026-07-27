import fs from "fs";
import { pathToFileURL } from "url";

/**
 * Importa il modulo JS di un file lingua e ne restituisce il default export.
 * Query string di cache-busting basata su mtime: senza, la cache dei moduli ESM di
 * Node restituirebbe il contenuto stantio se lo stesso path viene re-importato più
 * volte nello stesso processo (es. il dev server di Vite che rivalida il file lingua
 * dopo una modifica a mano, senza mai riavviare il processo Node). Si usa l'mtime del
 * file, non Date.now(): un timestamp "ora" creerebbe una entry di cache nuova a ogni
 * chiamata anche se il file non è cambiato, e la cache dei moduli ESM di Node non
 * viene mai rilasciata per la vita del processo — su un dev server a lunga durata
 * significherebbe una crescita illimitata. Con l'mtime, letture ripetute dello stesso
 * contenuto riusano la stessa entry.
 *
 * @param {string} filePath
 * @returns {Promise<any>} il default export (l'oggetto lingua)
 */
export default async function importLanguageModule(filePath) {
  const { mtimeMs } = fs.statSync(filePath);
  const url = `${pathToFileURL(filePath).href}?t=${mtimeMs}`;
  const mod = await import(url);
  const table = mod.default;
  // "incomplete: false" viene omesso dal file su disco (vedi serializeLanguageModule.js):
  // qui si ripristina il valore di default, così ogni chiamante vede sempre il campo
  // valorizzato a booleano, sia che il file lo dichiari esplicitamente sia che lo ometta.
  if (table?.__builder__ && table.__builder__.incomplete === undefined) {
    table.__builder__.incomplete = false;
  }
  return table;
}
