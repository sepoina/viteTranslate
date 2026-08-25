// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import { logEchoColored, logWarning } from "../../../utility.js";
import shortPath from "./shortPath.js";

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
 * @param {string | null} originalText - contenuto letto dal file, se disponibile: è solo il
 *   ripiego se la copia diretta non riesce (vedi `salva`)
 * @param {{ kind: "corrupted" | "erased", reason: string, detail?: boolean }} info - motivo,
 *   per il log e per il suffisso del file di backup. `detail` per chi ha già aperto un blocco
 *   di avviso suo: la guardia ne salva uno per lingua, e cinque WARNING staccati farebbero
 *   sembrare cinque problemi diversi quello che è un evento solo.
 * @returns {string | null} il percorso del backup, o null se non è stato possibile scriverlo
 */
export default function backupLanguageFile(filePath, fileName, originalText, { kind, reason, detail = false }) {
  const backupPath = `${filePath}.bak-${kind}-${Date.now()}`;
  // Il backup è il file che si va ad aprire davvero, se si va ad aprire qualcosa: relativo
  // alla radice si legge corto e nel terminale di VS Code diventa un link.
  const shortName = shortPath(backupPath);
  const tail = kind === "corrupted" ? "regenerating from scratch." : "keys are about to be erased.";
  const avvisa = detail ? (testo) => logEchoColored("", testo) : logWarning;
  try {
    salva(filePath, backupPath, originalText);
    avvisa(`'${fileName}' ${kind} (${reason}). Backup saved as '${shortName}', ${tail}`);
    return backupPath;
  } catch (backupError) {
    avvisa(`'${fileName}' ${kind} (${reason}) and backup failed (${backupError.message}); ${tail}`);
    return null;
  }
}

/**
 * I BYTE del file, non il testo che ne era stato decodificato.
 *
 * Il chiamante sta per sovrascrivere l'originale, quindi questa copia è l'unica che resta. Un
 * file salvato in una codifica diversa da UTF-8 — il Blocco note di Windows alla voce
 * "Unicode", un editor configurato male, ed è anche uno dei motivi per cui il file risulta
 * "corrotto" — letto come UTF-8 e riscritto NON torna quello di prima: ogni byte che la
 * decodifica non ha saputo leggere è diventato un carattere di sostituzione, e quel carattere
 * è tutto ciò che il backup conserva. `copyFileSync` non decodifica niente, quindi si porta
 * dietro anche ciò che non sappiamo leggere — che è precisamente il contenuto da salvare.
 *
 * Il testo già in mano resta il ripiego per quando la copia non riesce (il file può essere
 * sparito nel frattempo). Se non c'è nemmeno quello non si scrive un backup vuoto: sarebbe una
 * copia solo di nome, e chi chiama deve poter sapere che non ne esiste una.
 */
function salva(filePath, backupPath, originalText) {
  try {
    fs.copyFileSync(filePath, backupPath);
    return;
  } catch (copyError) {
    if (originalText == null) throw copyError;
  }
  fs.writeFileSync(backupPath, originalText, "utf8");
}
