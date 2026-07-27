import fs from "fs";
import { logEchoColored } from "../../../utility.js";

/**
 * Salva una copia del contenuto originale di un file di lingua che si è rivelato
 * illeggibile (sintassi non valida o struttura inattesa), prima che il chiamante lo
 * rigeneri da zero. Senza questo passaggio le traduzioni già fatte in un file
 * corrotto andrebbero perse in silenzio: qui restano recuperabili a mano.
 *
 * @param {string} filePath - percorso del file corrotto
 * @param {string} fileName - solo per i messaggi di log
 * @param {string | null} originalText - contenuto letto dal file, se disponibile
 * @param {Error} cause - errore di parsing/validazione che ha innescato il recupero
 */
export default function backupCorruptedFile(filePath, fileName, originalText, cause) {
  const backupPath = `${filePath}.bak-corrupted-${Date.now()}`;
  try {
    fs.writeFileSync(backupPath, originalText ?? "", "utf8");
    logEchoColored("", `WARNING: '${fileName}' is corrupted (${cause.message}). Backup saved as '${backupPath.split(/[\\/]/).pop()}', regenerating from scratch.`);
  } catch (backupError) {
    logEchoColored("", `WARNING: '${fileName}' is corrupted (${cause.message}) and backup failed (${backupError.message}); regenerating from scratch anyway.`);
  }
}
