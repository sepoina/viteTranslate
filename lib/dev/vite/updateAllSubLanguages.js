import pathCmd from "path";
import fs from 'fs';
import splitAndSortEntries from "./uty/splitAndSortEntries.js";
import serializeLanguageModule from "./uty/serializeLanguageModule.js";
import importLanguageModule from "./uty/importLanguageModule.js";
import backupCorruptedFile from "./uty/backupCorruptedFile.js";
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
        logEchoColored("", `Update ${listFiles.length} subLanguages`);
        for (const file of listFiles) { // cicla l'apertura/update di ognuno
            await updateSingleSubLanguage(sourceDir, file, newBaseTable, service);
        }
    } else {
        logEchoColored("", `Not present other language file (es: xx-XX.js) in locale dir`);
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
        logEchoColored("", `Error reading dir: ${err.message}`);
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
        backupCorruptedFile(sourceFile, file, fileContent, err);
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
        // è uguale non c'è niente da fare
        existingJson["__lngVersion__"] = referenceTable["__lngVersion__"]; // updata la versione
        //
        const { translated, untranslated } = splitAndSortEntries(existingJson);
        const oldSplit = splitAndSortEntries(oldExistingJson);
        const unchanged = isSameSplit(oldSplit, { translated, untranslated });
        // Sovrascrivi il file solo se il contenuto (dati o ordinamento) è cambiato
        if (!unchanged) {
            const jsText = serializeLanguageModule({ tag, isSource: false, translated, untranslated, now: new Date() });
            fs.writeFileSync(sourceFile, jsText, 'utf8');
        }

        logEchoColored("", `Language file ${file} ${notCompleted ? "not complete translation table, edit them and add" : "has complete table translation!"}`);
        return;
    } catch (err) {
        logEchoColored("", `Error in update ${err.message}`);
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
