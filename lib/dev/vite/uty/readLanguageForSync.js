// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync",
// "Empty, emptied, unreadable".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import readLanguageFile, { readLanguageBytes } from "./readLanguageFile.js";
import { syncIo } from "./syncIo.js";

/**
 * Legge un file di lingua per la sincronizzazione e ne CLASSIFICA lo stato, senza decidere
 * cosa farne. Le parole — "was corrupted, rebuilt", "cannot be read, left untouched" — restano
 * a chi chiama: la lingua sorgente e una sub-lingua dicono cose diverse degli stessi guasti
 * (since 4.7.1 an unreadable file, in any language, stops the sync before it writes).
 *
 * Era scritta due volte, in updateLanguage.js e updateAllSubLanguages.js, e le due copie
 * erano già leggermente divergenti.
 *
 * **L'invariante che questa funzione esiste per garantire**: `oldText` è il testo su disco
 * SOLO quando `status === "ok"`. In ogni altro caso è `null`, e quel `null` è ciò che più a
 * valle forza la riscrittura del file (vedi writeLanguageFileIfChanged). Tenerlo a mano in due
 * posti era il modo di dimenticarselo in uno dei due.
 *
 * **The snapshot** (4.7.1): along with the status, the function returns what it saw on disk —
 * `{ kind: "absent" }` if the file was not there, `{ kind: "file", bytes, realPath, mode }` with
 * the bytes of ONE single read, `null` if the file cannot be read. It is what the commit compares
 * before replacing the file (replaceFileAtomic.js) and what the backup saves. A dangling symlink
 * (lstat succeeds, the read does not) is `unreadable`, not `missing`.
 *
 * @param {string} filePath
 * @returns {{ status: "missing"|"unreadable"|"corrupted"|"empty"|"ok",
 *   table?: object, meta?: { tableVersion: number|null }, oldText: string|null, error?: Error,
 *   snapshot: { kind: "absent" } | { kind: "file", bytes: Buffer, realPath: string, mode: number } | null }}
 *   `error` c'è solo su "unreadable" e "corrupted"; su "corrupted" porta con sé
 *   `error.sourceText`, il testo da cui l'errore è nato. Since 4.7.1 the backup no longer uses
 *   it: it saves `snapshot.bytes`, the raw bytes of the same single read.
 */
export default function readLanguageForSync(filePath) {
  try {
    syncIo.lstatSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing", oldText: null, snapshot: { kind: "absent" } };
    return { status: "unreadable", oldText: null, snapshot: null, error: unreadable(error) };
  }

  let bytes, realPath, mode;
  try {
    bytes = readLanguageBytes(filePath);
    realPath = syncIo.realpathSync(filePath);
    mode = syncIo.statSync(filePath).mode & 0o7777;
  } catch (error) {
    // We do not know what it holds (a folder with that name, permissions, a dangling link).
    return { status: "unreadable", oldText: null, snapshot: null, error: error.unreadable ? error : unreadable(error) };
  }
  const snapshot = { kind: "file", bytes, realPath, mode };
  const oldText = bytes.toString("utf8");

  let table, meta;
  try {
    ({ table, meta } = readLanguageFile(filePath, oldText));
  } catch (error) {
    return { status: "corrupted", oldText: null, snapshot, error };
  }

  // File vuoto: è il modo documentato per aggiungere una lingua, non un guasto.
  if (table === undefined) return { status: "empty", oldText: null, snapshot };

  return { status: "ok", table, meta, oldText, snapshot };
}

function unreadable(cause) {
  const error = new Error(`cannot be read (${cause.code ?? cause.message})`);
  error.unreadable = true;
  error.cause = cause;
  return error;
}
