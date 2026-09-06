// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync",
// "Empty, emptied, unreadable".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import readLanguageFile, { readLanguageText } from "./readLanguageFile.js";

/**
 * Legge un file di lingua per la sincronizzazione e ne CLASSIFICA lo stato, senza decidere
 * cosa farne. Le parole — "was corrupted, rebuilt", "cannot be read, left untouched" — restano
 * a chi chiama: la lingua sorgente e una sub-lingua dicono cose diverse degli stessi guasti, e
 * su un file illeggibile prendono decisioni opposte (la prima prosegue con la scansione del
 * codice, la seconda salta il file).
 *
 * Era scritta due volte, in updateLanguage.js e updateAllSubLanguages.js, e le due copie
 * erano già leggermente divergenti.
 *
 * **L'invariante che questa funzione esiste per garantire**: `oldText` è il testo su disco
 * SOLO quando `status === "ok"`. In ogni altro caso è `null`, e quel `null` è ciò che più a
 * valle forza la riscrittura del file (vedi writeLanguageFileIfChanged). Tenerlo a mano in due
 * posti era il modo di dimenticarselo in uno dei due.
 *
 * @param {string} filePath
 * @returns {{ status: "missing"|"unreadable"|"corrupted"|"empty"|"ok",
 *   table?: object, meta?: { tableVersion: number|null }, oldText: string|null, error?: Error }}
 *   `error` c'è solo su "unreadable" e "corrupted"; su "corrupted" porta con sé
 *   `error.sourceText`, il testo da cui l'errore è nato (serve al backup — vedi
 *   readLanguageFile.js sul perché non si rilegge il disco una seconda volta).
 */
export default function readLanguageForSync(filePath) {
  if (!fs.existsSync(filePath)) return { status: "missing", oldText: null };

  let oldText;
  try {
    oldText = readLanguageText(filePath);
  } catch (error) {
    // Non sappiamo cosa contenga (una cartella con quel nome, i permessi, un link rotto).
    return { status: "unreadable", oldText: null, error };
  }

  let table, meta;
  try {
    ({ table, meta } = readLanguageFile(filePath, oldText));
  } catch (error) {
    return { status: "corrupted", oldText: null, error };
  }

  // File vuoto: è il modo documentato per aggiungere una lingua, non un guasto.
  if (table === undefined) return { status: "empty", oldText: null };

  return { status: "ok", table, meta, oldText };
}
