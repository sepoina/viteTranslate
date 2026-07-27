import pathCmd from "path";
import fs from 'fs';
import updateAllSubLanguages from './updateAllSubLanguages.js';
import updateKeys from "./uty/updateKeys.js";
import splitAndSortEntries from "./uty/splitAndSortEntries.js";
import serializeLanguageModule from "./uty/serializeLanguageModule.js";
import importLanguageModule from "./uty/importLanguageModule.js";
import backupCorruptedFile from "./uty/backupCorruptedFile.js";
import { logEchoColored } from "../../utility.js";
/**
 * Aggiorna un file di lingua JS con dati di traduzione. Se il file non esiste, crea un nuovo file
 * utilizzando i dati di traduzione di base forniti. La funzione confronta e aggiorna i dati presenti
 * nel file con i nuovi dati di traduzione, salvando le modifiche solo se sono state apportate variazioni.
 *
 * @function
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js):
 *   { localeDir, sourceLanguage, sourceTable, notTranslated, renamedKeys }
 * @returns {Promise<void>}
 *
 * @description
 * Questa funzione importa il modulo JS di lingua e lo confronta con i dati di traduzione
 * di base forniti. Se il file non esiste, viene creato utilizzando i dati di traduzione di base. Se ci
 * sono variazioni nei dati di traduzione, le modifiche vengono salvate nel file. La funzione fornisce
 * messaggi di log dettagliati durante il processo.
 *
 */
export default async function updateLanguage(service) {
  const { localeDir, sourceLanguage } = service;
  const fileName = `${sourceLanguage}.js`;
  const filePath = pathCmd.join(localeDir, fileName);
  logEchoColored('updateLanguage', `Vite-Translate translation table from "${fileName}"`);
  //
  // variabili comuni
  //
  let state = { newest: true, changed: true }, baseData = null, oldBaseData = null;
  //
  // prova a leggere la lingua principale
  //
  // chiave decaduta -> chiave emergente con lo stesso valore: permette alle sub-lingue
  // di ereditare la traduzione già fatta invece di perderla e ripartire da null
  // (vedi uso in updateAllSubLanguages.js)
  service.renamedKeys = {};
  if (!fs.existsSync(filePath)) {
    logEchoColored("", `The file ${fileName} not exist, i make new one.`);
    baseData = service.sourceTable;
  } else {
    try {
      const imported = await importLanguageModule(filePath);
      if (!imported || !imported["__lngVersion__"]) throw new Error("Incorrect structure of js module");
      oldBaseData = { ...imported }; // clone: updateKeys muta l'oggetto passato in place
      const newData = service.sourceTable; // dati nuovi
      [state, baseData] = updateKeys(imported, newData); // se ci sono variazioni mettile nello state
      service.renamedKeys = matchRenamedKeys(state, newData);
      logEchoColored("", `Source language loaded.`);
    } catch (e) {
      const originalText = safeReadText(filePath);
      if (originalText != null && originalText.trim() === "") {
        // File creato vuoto a mano (bootstrap iniziale, prima di aver mai lanciato il
        // comando di sync): non è corrotto, non c'è nulla da perdere - un backup sarebbe
        // solo rumore.
        logEchoColored("", `The file ${fileName} is empty: generating it from scratch.`);
      } else {
        // Il file esiste ma non è leggibile (sintassi non valida o struttura inattesa): non va
        // sovrascritto alla cieca, altrimenti tutte le traduzioni già fatte andrebbero perse
        // in silenzio. Si salva prima una copia di backup, poi si riparte da zero.
        backupCorruptedFile(filePath, fileName, originalText, e);
      }
      baseData = service.sourceTable; // i dati nuovi sono la base reale
      oldBaseData = null; // forza la scrittura sotto: il contenuto letto era corrotto/assente
    }
  }
  //
  //
  //
  //
  if (state.changed) logEchoColored("", state.newest
    ? "Create new file."
    : `Update: (${state.added.length} added, ${state.deleted.length} removed)`);
  else logEchoColored("", "No changes detected; checking translations.");
  //
  //  intervieni su tutti i file di lingua presenti
  await updateAllSubLanguages(filePath, service.sourceTable, service);
  //
  // prende le chiavi non ancora tradotte delle sublingue
  const notTranslated = service.notTranslated;
  // Presenza della chiave, non verità del valore: un testo sorgente "" (stringa vuota)
  // è comunque una chiave da segnalare come mancante altrove, se lo è.
  const isUntranslated = (key) => notTranslated != null && key in notTranslated;
  //
  // scrivi la lingua principale, solo se qualcosa è davvero cambiato
  //
  const { translated, untranslated } = splitAndSortEntries(baseData, isUntranslated);
  // "(incomplete)" in coda a __lngVersion__ quando resta almeno una chiave da tradurre
  // altrove: i dati della lingua sorgente possono restare identici da una sync all'altra
  // mentre solo la loro classificazione tradotta/da tradurre cambia (una sub-lingua si
  // completa o si scompleta). Senza questo marcatore il confronto sotto, che riclassifica
  // oldBaseData con il criterio ATTUALE invece di quello in vigore quando il file è stato
  // scritto, non vedrebbe alcuna differenza: il file resterebbe bloccato per sempre con la
  // sezione "to be translated" e l'header non più aggiornati.
  const versionEntry = translated.find(([key]) => key === "__lngVersion__");
  versionEntry[1] = service.sourceTable["__lngVersion__"] + (untranslated.length ? " (incomplete)" : "");
  const unchanged = oldBaseData != null && isSameSplit(
    splitAndSortEntries(oldBaseData, isUntranslated),
    { translated, untranslated }
  );
  if (unchanged) {
    logEchoColored("", `No changes to write in '${fileName}'.`);
  } else {
    const jsText = serializeLanguageModule({
      tag: sourceLanguage,
      isSource: true,
      translated,
      untranslated,
      now: new Date(),
    });
    try {
      fs.writeFileSync(filePath, jsText, 'utf8');
      logEchoColored("", `Overwriting primary language in '${fileName}'`);
    } catch (e) {
      logEchoColored("", `Error writing in '${fileName}': ${e.message}`);
    }
  }
}

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function isSameSplit(a, b) {
  return JSON.stringify(a.translated) === JSON.stringify(b.translated)
    && JSON.stringify(a.untranslated) === JSON.stringify(b.untranslated);
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
