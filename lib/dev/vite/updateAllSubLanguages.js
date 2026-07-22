import pathCmd from "path";
import fs from 'fs';
import sortObjectByKey from "./uty/sortObjectByKey.js";
import { logEchoColored } from "../../utility.js";

/**
 * Updates all sub-languages based on a new base table.
 *
 * @param {string} sourceFile - The source file containing the main language.
 * @param {object} newBaseTable - The new base table of language updates.
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js).
 */
export default function updateAllSubLanguages(sourceFile, newBaseTable, service) {
    const sourceDir = pathCmd.dirname(sourceFile); // prendi la source directory
    const excludeFilename = pathCmd.basename(sourceFile); // prendi il nome file per escludere la lingua madre
    const listFiles = listAllNotFilename(sourceDir, excludeFilename); // prendi gli altri file
    if (listFiles) {
        logEchoColored("", `Update ${listFiles.length} subLanguages`);
        for (const file of listFiles) { // cicla l'apertura/update di ognuno
            updateSingleSubLanguage(sourceDir, file, newBaseTable, service);
        }
    } else {
        logEchoColored("", `Not present other language file (es: xx-XX.json) in locale dir`);
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
        // Filtra i file con estensione .json e escludi il file specificato
        const jsonFiles = files.filter(file => pathCmd.extname(file) === '.json' && file !== excludeFilename);
        if (jsonFiles.length === 0) return false;
        return (jsonFiles);
    } catch (err) {
        logEchoColored("", `Error reading dir: ${err.message}`);
    }
}

/**
 * Updates a single sub-language file based on a reference JSON.
 *
 * @param {string} sourceDir - The source directory of the language file.
 * @param {string} file - The filename of the language file to be updated.
 * @param {object} referenceJson - The reference JSON for language updates.
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js).
 */
function updateSingleSubLanguage(sourceDir, file, referenceJson, service) {
    try {
        let notCompleted = false;
        const sourceFile = pathCmd.join(sourceDir, file); // il file sorgente con il suo percorso es:en-US.json
        // Leggi il contenuto del file
        const fileContent = fs.readFileSync(sourceFile, 'utf8');
        // Parsa il JSON dal contenuto del file
        const existingJson = JSON.parse(fileContent);
        // Chiave decaduta -> chiave emergente con lo stesso valore in lingua principale (rename, non testo nuovo):
        // salva la traduzione già fatta per la chiave decaduta prima che il ciclo sotto la elimini
        const renamedKeys = service.renamedKeys ?? {};
        const inheritedValues = {};
        for (const [oldKey, newKey] of Object.entries(renamedKeys)) {
            if (existingJson[oldKey] != null) inheritedValues[newKey] = existingJson[oldKey];
        }
        // Togli dalla lingua non principale le chiavi che non ci sono in quella principale
        for (const key in existingJson) {
            if (!(key in referenceJson)) {
                delete existingJson[key];
            }
        }
        // Aggiungi in coda alla lingua non principale le chiavi che ci sono in quella principale ma mettile nulle
        // (a meno che non ereditino la traduzione da una chiave decaduta con lo stesso valore)
        for (const key in referenceJson) {
            if (!(key in existingJson) || existingJson[key] === null) {
                if (inheritedValues[key] !== undefined) {
                    existingJson[key] = inheritedValues[key];
                } else {
                    existingJson[key] = null;
                    notCompleted = true;
                    service.notTranslated[key] = referenceJson[key]; // aggiunge alle traduzioni mancanti
                }
            }
        }
        // è uguale non c'è niente da fare
        existingJson["__lngVersion__"] = referenceJson["__lngVersion__"]; // updata la versione
        // Converte il JSON risultante in una stringa
        const updatedJsonString = JSON.stringify(
            sortObjectByKey(existingJson, service), null, 2
        );
        // Sovrascrivi il file solo se il contenuto (dati o ordinamento) è cambiato
        if (updatedJsonString !== fileContent) {
            fs.writeFileSync(sourceFile, updatedJsonString, 'utf8');
        }

        logEchoColored("", `Language file ${file} ${notCompleted ? "not complete translation table, edit them and add" : "has complete table translation!"}`);
        return;
    } catch (err) {
        logEchoColored("", `Error in update ${err.message}`);
    }
}
