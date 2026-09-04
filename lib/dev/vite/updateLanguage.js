// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import pathCmd from "path";
import fs from 'fs';
import updateAllSubLanguages from './updateAllSubLanguages.js';
import updateKeys from "./uty/updateKeys.js";
import splitAndSortEntries from "./uty/splitAndSortEntries.js";
import serializeLanguageFile from "./uty/serializeLanguageFile.js";
import stableStringify from "./uty/stableStringify.js";
import readLanguageFile from "./uty/readLanguageFile.js";
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
  let state = { newest: true, changed: true }, baseData = null, oldBaseData = null;
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
  if (!fs.existsSync(filePath)) {
    nota = "created";
    baseData = service.sourceTable;
  } else {
    let imported;
    let guasto = null; // perché il file non è utilizzabile, se non lo è
    try {
      imported = readLanguageFile(filePath);
      if (imported !== undefined && !imported["__builder__"]) {
        throw new Error("no \"__builder__\" entry: not a language table");
      }
    } catch (e) {
      guasto = e;
    }

    if (guasto?.unreadable) {
      // Non è un file corrotto da rigenerare: è un file di cui non sappiamo NIENTE (una
      // cartella con quel nome, i permessi, un link rotto). Riscriverlo vorrebbe dire
      // inventarne il contenuto, e il backup sarebbe una copia vuota spacciata per una copia.
      // Le sub-lingue si sincronizzano lo stesso: il loro riferimento è la scansione del
      // codice, non questo file.
      logError(`'${colorize("nome", fileName)}' ${guasto.message}: left untouched`);
      illeggibile = true;
      nota = "cannot be read, left untouched";
      baseData = service.sourceTable;
    } else if (guasto) {
      // Il file si legge ma non rientra nel formato (una riga fuori posto, o una struttura
      // inattesa): non va sovrascritto alla cieca, altrimenti tutte le traduzioni già fatte
      // andrebbero perse in silenzio. Si salva prima una copia di backup, poi si riparte da
      // zero. Il testo è quello da cui è nato l'errore, non una seconda lettura del disco.
      backupLanguageFile(filePath, fileName, guasto.sourceText ?? null, { kind: "corrupted", reason: guasto.message });
      nota = "was corrupted, rebuilt from the source code";
      baseData = service.sourceTable;
    } else if (imported === undefined) {
      // File creato vuoto a mano (bootstrap iniziale, prima di aver mai lanciato il
      // comando di sync): non è corrotto, non c'è nulla da perdere - un backup sarebbe
      // solo rumore.
      nota = "was empty, generated from scratch";
      baseData = service.sourceTable;
    } else {
      oldBaseData = { ...imported }; // clone: updateKeys muta l'oggetto passato in place
      const newData = service.sourceTable; // dati nuovi
      [state, baseData] = updateKeys(imported, newData); // se ci sono variazioni mettile nello state
      service.renamedKeys = matchRenamedKeys(state, newData);
    }
    // oldBaseData resta null in ogni ramo di guasto: forza la scrittura sotto, perché il
    // contenuto letto era corrotto o assente.
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
  // __builder__ va sempre riallineato a quello appena scansionato (v/languageName correnti),
  // indipendentemente da state.changed: updateKeys non lo tocca più (vedi uty/updateKeys.js).
  baseData["__builder__"] = service.sourceTable["__builder__"];
  const { translated, untranslated } = splitAndSortEntries(baseData, isUntranslated);
  // "incomplete" riflette se resta almeno una chiave da tradurre altrove: i dati della
  // lingua sorgente possono restare identici da una sync all'altra mentre solo la loro
  // classificazione tradotta/da tradurre cambia (una sub-lingua si completa o si
  // scompleta). Senza questo campo il confronto sotto, che riclassifica oldBaseData con
  // il criterio ATTUALE invece di quello in vigore quando il file è stato scritto, non
  // vedrebbe alcuna differenza: il file resterebbe bloccato per sempre con la sezione
  // "to be translated" e l'header non più aggiornati.
  const versionEntry = translated.find(([key]) => key === "__builder__");
  versionEntry[1] = { ...versionEntry[1], incomplete: untranslated.length > 0 };
  const unchanged = oldBaseData != null && isSameSplit(
    splitAndSortEntries(oldBaseData, isUntranslated),
    { translated, untranslated }
  );
  let written = false;
  // `illeggibile`: il file c'è, non si è potuto leggere, e quindi non si tocca. Senza questa
  // condizione la scrittura partirebbe comunque (oldBaseData è null, quindi `unchanged` è
  // false) e sostituirebbe un contenuto sconosciuto con la sola scansione del codice.
  if (!unchanged && !illeggibile) {
    const text = serializeLanguageFile({
      tag: sourceLanguage,
      isSource: true,
      translated,
      untranslated,
      now: new Date(),
    });
    try {
      fs.writeFileSync(filePath, text, 'utf8');
      written = true;
    } catch (e) {
      logError(`writing in '${colorize("nome", fileName)}': ${e.message}`);
    }
  }

  return { file: fileName, action, written, languages };
}

function isSameSplit(a, b) {
  return stableStringify(a.translated) === stableStringify(b.translated)
    && stableStringify(a.untranslated) === stableStringify(b.untranslated);
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
