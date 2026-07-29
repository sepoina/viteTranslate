// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import pathCmd from "path";
import fs from 'fs';
import splitAndSortEntries from "./uty/splitAndSortEntries.js";
import serializeLanguageModule from "./uty/serializeLanguageModule.js";
import stableStringify from "./uty/stableStringify.js";
import importLanguageModule from "./uty/importLanguageModule.js";
import backupLanguageFile from "./uty/backupLanguageFile.js";
import languageAutonym from "./uty/languageAutonym.js";
import { logEchoColored } from "../../utility.js";

/**
 * Updates all sub-languages based on a new base table.
 *
 * @param {string} sourceFile - The source file containing the main language.
 * @param {object} newBaseTable - The new base table of language updates.
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js).
 * @returns {Promise<void>}
 */
export default async function updateAllSubLanguages(sourceFile, newBaseTable, service) {
    const sourceDir = pathCmd.dirname(sourceFile); // prendi la source directory
    const excludeFilename = pathCmd.basename(sourceFile); // prendi il nome file per escludere la lingua madre
    const listFiles = listAllNotFilename(sourceDir, excludeFilename); // prendi gli altri file
    if (listFiles) {
        logEchoColored("", `Updating ${listFiles.length} sub-language file(s)`);
        for (const file of listFiles) { // cicla l'apertura/update di ognuno
            await updateSingleSubLanguage(sourceDir, file, newBaseTable, service);
        }
    } else {
        logEchoColored("", `No other language file (e.g. xx-XX.js) found in the locale dir`);
    }
}

/**
 * Lists all files in the source directory excluding a specified filename.
 *
 * @param {string} sourceDir - The source directory to list files from.
 * @param {string} excludeFilename - The filename to be excluded from the list.
 * @returns {string[] | false} - An array of filenames or false if an error occurs.
 */
function listAllNotFilename(sourceDir, excludeFilename) {
    try {
        // Leggi la directory sincronamente
        const files = fs.readdirSync(sourceDir);
        // Filtra i file con estensione .js e escludi il file specificato
        const jsFiles = files.filter(file => pathCmd.extname(file) === '.js' && file !== excludeFilename);
        if (jsFiles.length === 0) return false;
        return (jsFiles);
    } catch (err) {
        logEchoColored("", `Error reading the locale dir: ${err.message}`);
    }
}

/**
 * Updates a single sub-language file based on a reference table.
 *
 * @param {string} sourceDir - The source directory of the language file.
 * @param {string} file - The filename of the language file to be updated.
 * @param {object} referenceTable - The source-language table to sync keys against.
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js).
 * @returns {Promise<void>}
 */
async function updateSingleSubLanguage(sourceDir, file, referenceTable, service) {
    const sourceFile = pathCmd.join(sourceDir, file); // il file sorgente con il suo percorso es:en-US.js
    const tag = file.replace(/\.js$/, "");
    // Importa il modulo JS del contenuto attuale. Se è corrotto (sintassi non valida), non
    // lasciarlo bloccato per sempre (il vecchio comportamento si limitava a loggare e saltare
    // il file a ogni giro): si salva una copia di backup e si riparte da una tabella vuota,
    // così il file torna in uno stato valido e compilabile.
    let existingJson;
    try {
        existingJson = await importLanguageModule(sourceFile);
        if (!existingJson) throw new Error("Empty default export");
    } catch (err) {
        const fileContent = safeReadText(sourceFile);
        if (fileContent != null && fileContent.trim() === "") {
            // File creato vuoto a mano per aggiungere una lingua nuova (vedi InstallSection):
            // non è corrotto, non c'è nulla da perdere - un backup sarebbe solo rumore.
            logEchoColored("", `Language file ${file} is empty: treating it as a new language.`);
        } else {
            backupLanguageFile(sourceFile, file, fileContent, { kind: "corrupted", reason: err.message });
        }
        existingJson = {};
    }
    const oldExistingJson = { ...existingJson }; // clone: il ciclo sotto muta existingJson in place
    try {
        let notCompleted = false;
        // Chiave decaduta -> chiave emergente con lo stesso valore in lingua principale (rename, non testo nuovo):
        // salva la traduzione già fatta per la chiave decaduta prima che il ciclo sotto la elimini
        const renamedKeys = service.renamedKeys ?? {};
        const inheritedValues = {};
        for (const [oldKey, newKey] of Object.entries(renamedKeys)) {
            if (existingJson[oldKey] != null) inheritedValues[newKey] = existingJson[oldKey];
        }
        // Togli dalla lingua non principale le chiavi che non ci sono in quella principale
        for (const key in existingJson) {
            if (!(key in referenceTable)) {
                delete existingJson[key];
            }
        }
        // Aggiorna subito il builder: non è una chiave di contenuto da tradurre, va esclusa
        // dal ciclo sotto, altrimenti su una lingua nuova (file vuoto) verrebbe trattata come
        // chiave mancante e finirebbe in service.notTranslated, comparendo per errore sotto
        // "to be translated" anche nel file della lingua sorgente. "v" segue la lingua
        // sorgente, "languageName" è invece specifico di questo tag (non quello sorgente);
        // "incomplete" è provvisorio qui, ricalcolato sotto una volta note le chiavi mancanti.
        existingJson["__builder__"] = { v: referenceTable["__builder__"].v, languageName: languageAutonym(tag), incomplete: false };
        // Aggiungi in coda alla lingua non principale le chiavi che ci sono in quella principale ma mettile nulle
        // (a meno che non ereditino la traduzione da una chiave decaduta con lo stesso valore)
        for (const key in referenceTable) {
            if (!(key in existingJson) || existingJson[key] === null) {
                if (inheritedValues[key] !== undefined) {
                    existingJson[key] = inheritedValues[key];
                } else {
                    existingJson[key] = null;
                    notCompleted = true;
                    service.notTranslated[key] = referenceTable[key]; // aggiunge alle traduzioni mancanti
                }
            }
        }
        //
        const { translated, untranslated } = splitAndSortEntries(existingJson);
        // "incomplete" riflette se restano chiavi null in questo file: se l'utente traduce le
        // chiavi a mano fuori da questo comando (sostituendo i null col testo, senza toccare
        // la riga separatrice), i dati letti da disco risultano già completi sia "prima" che
        // "dopo" agli occhi di questo giro, quindi il confronto sotto non vedrebbe alcuna
        // differenza e la sezione "to be translated" resterebbe bloccata nel file anche a
        // traduzione conclusa.
        const versionEntry = translated.find(([key]) => key === "__builder__");
        versionEntry[1].incomplete = untranslated.length > 0;
        const oldSplit = splitAndSortEntries(oldExistingJson);
        const unchanged = isSameSplit(oldSplit, { translated, untranslated });
        // Sovrascrivi il file solo se il contenuto (dati o ordinamento) è cambiato
        if (!unchanged) {
            const jsText = serializeLanguageModule({ tag, isSource: false, translated, untranslated, now: new Date() });
            fs.writeFileSync(sourceFile, jsText, 'utf8');
        }

        logEchoColored("", `Language file ${file} ${notCompleted ? "has missing translations: edit the keys listed under the separator" : "has a complete translation table!"}`);
        return;
    } catch (err) {
        logEchoColored("", `Error while updating: ${err.message}`);
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
    return stableStringify(a.translated) === stableStringify(b.translated)
        && stableStringify(a.untranslated) === stableStringify(b.untranslated);
}
