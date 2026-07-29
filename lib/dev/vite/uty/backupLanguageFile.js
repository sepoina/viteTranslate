// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import { logEchoColored } from "../../../utility.js";

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
 * @param {string} filePath - percorso del file da salvare
 * @param {string} fileName - solo per i messaggi di log
 * @param {string | null} originalText - contenuto letto dal file, se disponibile
 * @param {{ kind: "corrupted" | "erased", reason: string }} info - motivo, per il log e per
 *   il suffisso del file di backup
 * @returns {string | null} il percorso del backup, o null se non è stato possibile scriverlo
 */
export default function backupLanguageFile(filePath, fileName, originalText, { kind, reason }) {
  const backupPath = `${filePath}.bak-${kind}-${Date.now()}`;
  const shortName = backupPath.split(/[\\/]/).pop();
  const tail = kind === "corrupted" ? "regenerating from scratch." : "keys are about to be erased.";
  try {
    fs.writeFileSync(backupPath, originalText ?? "", "utf8");
    logEchoColored("", `WARNING: '${fileName}' ${kind} (${reason}). Backup saved as '${shortName}', ${tail}`);
    return backupPath;
  } catch (backupError) {
    logEchoColored("", `WARNING: '${fileName}' ${kind} (${reason}) and backup failed (${backupError.message}); ${tail}`);
    return null;
  }
}
