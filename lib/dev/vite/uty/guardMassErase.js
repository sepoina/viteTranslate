// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import pathCmd from "path";
import importLanguageModule from "./importLanguageModule.js";
import backupLanguageFile from "./backupLanguageFile.js";
import { logEchoColored } from "../../../utility.js";

/**
 * La tabella estratta dalla scansione è la SOLA fonte di verità per la cancellazione: ogni
 * chiave che non compare lì viene eliminata da ogni file di lingua, e i file vengono
 * riscritti. È il comportamento voluto — è così che le stringhe rimosse dal codice smettono
 * di ingombrare le traduzioni — ma dà per scontato che la scansione abbia funzionato.
 *
 * Quando non ha funzionato la cancellazione diventa un azzeramento completo, in un comando
 * che gira come "prebuild", non interattivo, dove nessuno sta guardando:
 *  - `srcDir` che punta alla cartella sbagliata (o rinominata) -> zero marcatori trovati;
 *  - file non parsabili: sono un avviso, non un errore, e la sincronizzazione prosegue
 *    senza le loro chiavi (vedi lo `skipped` di cli.js);
 *  - sintassi nuova che i parser plugin non riconoscono ancora dopo un aggiornamento.
 *
 * In tutti e tre i casi i file di lingua sono validi e leggibili — quindi il backup per
 * file corrotto non scatta — e vengono semplicemente svuotati.
 *
 * Questa guardia non blocca la sincronizzazione: la fotografa prima che avvenga. Se la
 * perdita è sospetta salva una copia di OGNI file di lingua e lo dice a chiare lettere,
 * così il contenuto resta recuperabile anche se il comando gira dentro una pipeline.
 */

// Sopra questa quota di chiavi perse la cancellazione smette di somigliare a una pulizia
// normale. Una rimozione di codice reale tocca una manciata di stringhe alla volta; metà
// della tabella in un colpo solo è quasi sempre una scansione andata a vuoto.
const ERASE_RATIO = 0.5;

const METADATA_KEY = "__builder__";
const contentKeys = (table) => Object.keys(table ?? {}).filter((key) => key !== METADATA_KEY);

/**
 * @param {object} service - stato condiviso della sincronizzazione (vedi cli.js)
 * @param {number} skippedCount - file saltati dalla scansione (illeggibili o non parsabili)
 * @returns {Promise<{ erased: string[], backups: string[] } | null>} null se non c'è nulla
 *   di sospetto; altrimenti le chiavi in via di cancellazione e i backup effettuati
 */
export default async function guardMassErase(service, skippedCount) {
  const { localeDir, sourceLanguage, sourceTable } = service;
  const sourcePath = pathCmd.join(localeDir, `${sourceLanguage}.js`);

  // Primo giro su un progetto nuovo: non esiste ancora nulla da perdere.
  if (!fs.existsSync(sourcePath)) return null;

  let previous;
  try {
    previous = await importLanguageModule(sourcePath);
  } catch {
    // File illeggibile: non è questo il problema di cui si occupa la guardia, e il backup
    // per file corrotto lo fa già updateLanguage con il suo `kind`.
    return null;
  }

  const before = contentKeys(previous);
  if (before.length === 0) return null;

  const found = new Set(contentKeys(sourceTable));
  const erased = before.filter((key) => !found.has(key));
  if (erased.length === 0) return null;

  // Una cancellazione è normale finché la scansione è affidabile e la perdita è contenuta.
  // Basta che uno dei tre segnali sia acceso perché non lo sia più.
  const nothingFound = found.size === 0;
  const scanIncomplete = skippedCount > 0;
  const tooMuch = erased.length / before.length >= ERASE_RATIO;
  if (!nothingFound && !scanIncomplete && !tooMuch) return null;

  const cause = nothingFound
    ? "the scan found no marked string at all"
    : scanIncomplete
      ? `${skippedCount} file(s) were skipped by the scan`
      : `${erased.length} of ${before.length} keys would be removed at once`;

  logEchoColored("", `WARNING: ERASED translations detected — ${cause}.`);
  logEchoColored("", `${erased.length} key(s) are about to be removed from every language file.`);
  logEchoColored("", `e.g. ${erased.slice(0, 3).map((key) => `"${key}"`).join(", ")}${erased.length > 3 ? ", …" : ""}`);

  // Backup di TUTTI i file di lingua, non solo di quello sorgente: le sub-lingue perdono le
  // stesse chiavi, e lì il valore perso è la traduzione vera, quella costata lavoro.
  const backups = [];
  for (const file of languageFiles(localeDir)) {
    const filePath = pathCmd.join(localeDir, file);
    const text = safeReadText(filePath);
    if (text === null) continue;
    const saved = backupLanguageFile(filePath, file, text, { kind: "erased", reason: cause });
    if (saved !== null) backups.push(saved);
  }

  logEchoColored("", `If this was not intended, restore the '.bak-erased-*' files and check srcDir / the skipped files above.`);
  return { erased, backups };
}

function languageFiles(localeDir) {
  try {
    return fs.readdirSync(localeDir).filter((file) => file.endsWith(".js"));
  } catch {
    return [];
  }
}

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}
