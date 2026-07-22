import pathCmd from "path";
import fs from 'fs';
import updateAllSubLanguages from './updateAllSubLanguages.js';
import updateKeys from "./uty/updateKeys.js";
import sortObjectByKey from "./uty/sortObjectByKey.js";
import { logEchoColored } from "../../utility.js";
/**
 * Aggiorna un file di lingua JSON con dati di traduzione. Se il file non esiste, crea un nuovo file
 * utilizzando i dati di traduzione di base forniti. La funzione confronta e aggiorna i dati presenti
 * nel file con i nuovi dati di traduzione, salvando le modifiche solo se sono state apportate variazioni.
 *
 * @function
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js):
 *   { localeDir, defaultLanguage, baseLng, notTranslated, notTranslatedString, renamedKeys }
 * @returns {void}
 *
 * @description
 * Questa funzione legge il contenuto di un file JSON di lingua e lo confronta con i dati di traduzione
 * di base forniti. Se il file non esiste, viene creato utilizzando i dati di traduzione di base. Se ci
 * sono variazioni nei dati di traduzione, le modifiche vengono salvate nel file. La funzione fornisce
 * messaggi di log dettagliati durante il processo.
 *
 */
export default function updateLanguage(service) {
  const { localeDir, defaultLanguage } = service;
  const fileName = `${defaultLanguage}.json`;
  const filePath = pathCmd.join(localeDir, fileName);
  logEchoColored('updateLanguage', `Vite-Translate translation table from "${fileName}"`);
  //
  // variabili comuni
  //
  let state = { newest: true, changed: true }, baseData = null, originalText = null;
  //
  // prova a leggere la lingua principale
  //
  // chiave decaduta -> chiave emergente con lo stesso valore: permette alle sub-lingue
  // di ereditare la traduzione già fatta invece di perderla e ripartire da null
  // (vedi uso in updateAllSubLanguages.js)
  service.renamedKeys = {};
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    originalText = data;
    baseData = JSON.parse(data); // dati vecchi
    if (!baseData["__lngVersion__"]) throw ("Incorrect structure of json file");
    const newData = service.baseLng; // dati nuovi
    [state, baseData] = updateKeys(baseData, newData); // se ci sono variazioni mettile nello state
    service.renamedKeys = matchRenamedKeys(state, newData);
    logEchoColored("", `Base language loaded.`);
  } catch (e) {
    logEchoColored("", `The file ${fileName} not exist, i make new one.`);
    baseData = service.baseLng; // i dati nuovi sono la base reale
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
  updateAllSubLanguages(filePath, service.baseLng, service);
  //
  // prende le chiavi non ancora tradotte delle sublingue
  const notTranslated = service.notTranslated;
  //
  // updata la lingua principale, esistono chiavi non ancora tradotte?
  if (Object.keys(notTranslated).length > 0) {
    const translated = {};
    for (const key in baseData) {
      // elenca tutte le chiavi
      if (!notTranslated?.[key]) translated[key] = baseData[key]; // se non è nell'elenco delle non tradotte è tradotta
    }
    // aggiunge un separatore che dice le chiavi non tradotte
    translated[service.notTranslatedString.key] = service.notTranslatedString.value;
    //
    // ricompone l'oggetto e ne riordina le due parti
    baseData = {
      ...sortObjectByKey(translated, service),
      ...sortObjectByKey(notTranslated, service),
    }
  } else {
    //
    // riordina l'oggetto esistente
    baseData = sortObjectByKey(baseData, service);
  }
  //
  // scrivi la lingua principale
  //
  try {
    //
    const jsonText = JSON.stringify(baseData, null, 2);
    if (jsonText === originalText) {
      logEchoColored("", `No changes to write in '${fileName}'.`);
    } else {
      fs.writeFileSync(filePath, jsonText, 'utf8');
      logEchoColored("", `Overwriting primary language in '${fileName}'`);
    }
  } catch (e) {
    logEchoColored("", `Error writing in '${fileName}'`);
  }
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
