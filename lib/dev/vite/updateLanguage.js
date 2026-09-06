// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import pathCmd from "path";
import updateAllSubLanguages from './updateAllSubLanguages.js';
import updateKeys from "./uty/updateKeys.js";
import readLanguageForSync from "./uty/readLanguageForSync.js";
import writeLanguageFileIfChanged from "./uty/writeLanguageFile.js";
import { languageFileName } from "./uty/languageFileFormat.js";
import backupLanguageFile from "./uty/backupLanguageFile.js";
import { logError, colorize } from "../../utility.js";
/**
 * Aggiorna un file di lingua con dati di traduzione. Se il file non esiste, crea un nuovo file
 * utilizzando i dati di traduzione di base forniti. La funzione confronta e aggiorna i dati presenti
 * nel file con i nuovi dati di traduzione, salvando le modifiche solo se sono state apportate variazioni.
 *
 * @function
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js):
 *   { localeDir, sourceLanguage, sourceTable, notTranslated, renamedKeys }
 * @returns {Promise<{ file: string, action: string, written: boolean, languages: object[] }>}
 *   il resoconto di cosa è successo — vedi il commento qui sotto sul perché non lo stampa.
 *
 * @description
 * Questa funzione legge il file di lingua e lo confronta con i dati di traduzione
 * di base forniti. Se il file non esiste, viene creato utilizzando i dati di traduzione di base. Se ci
 * sono variazioni nei dati di traduzione, le modifiche vengono salvate nel file.
 *
 * Non racconta i propri passi mentre li fa: RESTITUISCE cosa ha fatto, e chi l'ha chiamata
 * decide come dirlo. Prima erano una decina di righe di log — una per lingua, più le
 * intermedie — che a schermo dicevano quasi sempre la stessa cosa e nascondevano l'unica che
 * conta: quali lingue hanno ancora chiavi da tradurre. Gli avvisi e gli errori restano invece
 * immediati, perché non sono il resoconto di un lavoro riuscito.
 */
export default async function updateLanguage(service) {
  const { localeDir, sourceLanguage } = service;
  const fileName = languageFileName(sourceLanguage);
  const filePath = pathCmd.join(localeDir, fileName);
  //
  // variabili comuni
  //
  let state = { newest: true, changed: true }, baseData = null;
  //
  // prova a leggere la lingua principale
  //
  // chiave decaduta -> chiave emergente con lo stesso valore: permette alle sub-lingue
  // di ereditare la traduzione già fatta invece di perderla e ripartire da null
  // (vedi uso in updateAllSubLanguages.js)
  service.renamedKeys = {};
  let nota = null; // cosa dire della lingua sorgente, se non è il solito confronto
  // Il file c'è ma non si apre: si segnala e si lascia stare, senza riscriverlo (vedi sotto).
  let illeggibile = false;

  const letto = readLanguageForSync(filePath);
  let oldText = letto.oldText;

  if (letto.status === "missing") {
    nota = "created";
    baseData = service.sourceTable;
  } else if (letto.status === "unreadable") {
    // Non è un file corrotto da rigenerare: è un file di cui non sappiamo NIENTE. Riscriverlo
    // vorrebbe dire inventarne il contenuto, e il backup sarebbe una copia vuota spacciata per
    // una copia. Le sub-lingue si sincronizzano lo stesso: il loro riferimento è la scansione
    // del codice, non questo file.
    logError(`'${colorize("nome", fileName)}' ${letto.error.message}: left untouched`);
    illeggibile = true;
    nota = "cannot be read, left untouched";
    baseData = service.sourceTable;
  } else if (letto.status === "corrupted") {
    backupLanguageFile(filePath, fileName, letto.error.sourceText ?? null,
      { kind: "corrupted", reason: letto.error.message });
    nota = "was corrupted, rebuilt from the source code";
    baseData = service.sourceTable;
  } else if (letto.status === "empty") {
    // File creato vuoto a mano (bootstrap iniziale): non è corrotto, non c'è nulla da
    // perdere — un backup sarebbe solo rumore.
    nota = "was empty, generated from scratch";
    baseData = service.sourceTable;
  } else if (letto.meta.tableVersion === null) {
    // Un file che si legge ma non porta l'intestazione TableVersion non è una tabella nostra:
    // vale quanto un file corrotto. Il controllo sta QUI e non nel lettore condiviso perché
    // riguarda solo la lingua sorgente — vedi updateAllSubLanguages.js, che non lo fa.
    backupLanguageFile(filePath, fileName, oldText,
      { kind: "corrupted", reason: "no TableVersion header: not a language table" });
    nota = "was corrupted, rebuilt from the source code";
    baseData = service.sourceTable;
    oldText = null; // forza la riscrittura
  } else {
    const newData = service.sourceTable;
    [state, baseData] = updateKeys(letto.table, newData);
    service.renamedKeys = matchRenamedKeys(state, newData);
  }
  //
  //
  //
  //
  // Cosa dire della lingua sorgente, in una riga: quello che è successo di diverso dal solito
  // (creata, vuota, corrotta) batte il conteggio delle chiavi, che nel caso normale è la
  // notizia.
  const action = nota ?? (state.changed
    ? `${state.added.length} key(s) added, ${state.deleted.length} removed`
    : "no changes detected");
  //
  //  intervieni su tutti i file di lingua presenti
  const languages = await updateAllSubLanguages(filePath, service.sourceTable, service);
  //
  // prende le chiavi non ancora tradotte delle sublingue
  const notTranslated = service.notTranslated;
  // Presenza della chiave, non verità del valore: un testo sorgente "" (stringa vuota)
  // è comunque una chiave da segnalare come mancante altrove, se lo è.
  const isUntranslated = (key) => notTranslated != null && key in notTranslated;
  //
  // scrivi la lingua principale, solo se qualcosa è davvero cambiato
  //
  let written = false;
  // `illeggibile`: il file c'è, non si è potuto leggere, e quindi non si tocca. Senza questa
  // condizione la scrittura partirebbe comunque (oldText è null) e sostituirebbe un contenuto
  // sconosciuto con la sola scansione del codice.
  if (!illeggibile) {
    try {
      ({ written } = writeLanguageFileIfChanged({
        filePath, tag: sourceLanguage, isSource: true, table: baseData, oldText, isUntranslated,
      }));
    } catch (e) {
      logError(`writing in '${colorize("nome", fileName)}': ${e.message}`);
    }
  }

  return { file: fileName, action, written, languages };
}

/**
 * Abbina le chiavi decadute a quelle emergenti con lo stesso valore in lingua
 * principale: stesso testo, id diverso (es. spostamento del marcatore in un
 * altro file/componente) -> è un rename, non un testo nuovo da tradurre.
 *
 * @param {{ deleted: string[], added: string[], deletedValues: Record<string,string> }} state
 * @param {Record<string,string>} newData - tabella base aggiornata (chiave emergente -> valore)
 * @returns {Record<string,string>} chiave decaduta -> chiave emergente
 */
function matchRenamedKeys(state, newData) {
  const addedByValue = new Map();
  for (const newKey of state.added) {
    const value = newData[newKey];
    if (!addedByValue.has(value)) addedByValue.set(value, []);
    addedByValue.get(value).push(newKey);
  }
  const renamedKeys = {};
  for (const oldKey of state.deleted) {
    const candidates = addedByValue.get(state.deletedValues[oldKey]);
    if (candidates?.length) renamedKeys[oldKey] = candidates.shift(); // un solo abbinamento per chiave emergente
  }
  return renamedKeys;
}
