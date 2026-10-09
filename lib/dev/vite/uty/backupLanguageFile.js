// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { logEchoColored, logWarning, colorize } from "../../../utility.js";
import shortPath from "./shortPath.js";
import { syncIo } from "./syncIo.js";
import { SyncError } from "./syncError.js";
import { randomHex } from "./replaceFileAtomic.js";

/**
 * Salva una copia del contenuto di un file di lingua prima che il chiamante lo riscriva
 * perdendone il contenuto attuale. Senza questo passaggio le traduzioni già fatte
 * sparirebbero in silenzio: qui restano recuperabili a mano.
 *
 * Due motivi, distinti nel nome del backup perché sono problemi diversi:
 *  - `corrupted` — il file non è leggibile (sintassi non valida o struttura inattesa) e
 *    viene rigenerato da zero;
 *  - `erased` — il file è validissimo, ma la scansione dei sorgenti non ha più trovato le
 *    chiavi che contiene e sta per svuotarlo (vedi guardMassErase.js).
 *
 * Since 4.7.1 a backup either succeeds or throws: a failed backup that lets the caller go on is
 * a file overwritten without a net. The bytes are those of the read snapshot (the same Buffer
 * the commit compares against before writing), not a second read and not decoded text: a file in
 * an encoding other than UTF-8 — Windows Notepad's "Unicode" option, a misconfigured editor, one
 * of the reasons a file reads as "corrupted" — decoded as UTF-8 would lose every unreadable
 * byte, and that backup would be the only copy.
 *
 * @param {string} filePath - path of the file to save
 * @param {string} fileName - for log messages only
 * @param {Buffer} bytes - the read snapshot (`snapshot.bytes`)
 * @param {{ kind: "corrupted" | "erased", reason: string, detail?: boolean }} info - reason, for
 *   the log and for the backup file suffix. `detail` is for callers that already opened a warning
 *   block of their own: the guard saves one per language, and five separate WARNINGs would make
 *   one event look like five problems.
 * @returns {string} the backup path
 * @throws {SyncError} VT_BACKUP_FAILED
 * @throws {TypeError} se `bytes` non è un Buffer
 */
export default function backupLanguageFile(filePath, fileName, bytes, { kind, reason, detail = false }) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("backupLanguageFile: `bytes` must be the snapshot Buffer");
  const stamp = Date.now();
  const tail = kind === "corrupted" ? "regenerating from scratch." : "keys are about to be erased.";
  const avvisa = detail ? (testo) => logEchoColored("", testo) : logWarning;

  let backupPath = null;
  let lastError;
  for (let attempt = 1; attempt <= 5 && backupPath === null; attempt++) {
    // Two backups in the same millisecond differ by the suffix; "wx" guarantees it.
    const candidate = `${filePath}.bak-${kind}-${stamp}-${randomHex(6)}`;
    try {
      syncIo.writeFileSync(candidate, bytes, { flag: "wx" });
      backupPath = candidate;
    } catch (e) {
      lastError = e;
      if (e.code !== "EEXIST") break;
    }
  }
  if (backupPath === null) {
    throw new SyncError("VT_BACKUP_FAILED",
      `cannot back up '${fileName}' (${kind}: ${reason}): ${lastError.message}. Nothing was overwritten.`,
      { filePath, cause: lastError });
  }
  // The backup is the file one actually opens, if one opens anything: relative to the root it
  // reads short and in the VS Code terminal it becomes a link.
  avvisa(`'${colorize("nome", fileName)}' ${kind} (${reason}). Backup saved as '${colorize("nome", shortPath(backupPath))}', ${tail}`);
  return backupPath;
}
