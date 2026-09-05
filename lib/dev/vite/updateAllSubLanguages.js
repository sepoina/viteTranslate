// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import pathCmd from "path";
import fs from 'fs';
import splitAndSortEntries from "./uty/splitAndSortEntries.js";
import serializeLanguageFile from "./uty/serializeLanguageFile.js";
import { sameIgnoringProcessed } from "./uty/buildLanguageHeader.js";
import readLanguageFile, { readLanguageText } from "./uty/readLanguageFile.js";
import listLanguageFiles from "./uty/listLanguageFiles.js";
import { tagFromFileName } from "./uty/languageFileFormat.js";
import backupLanguageFile from "./uty/backupLanguageFile.js";
import { logError, colorize } from "../../utility.js";

/**
 * Updates all sub-languages based on a new base table.
 *
 * @param {string} sourceFile - The source file containing the main language.
 * @param {object} newBaseTable - The new base table of language updates.
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js).
 * @returns {Promise<Array<{ tag: string, missing: number, note: string|null }>>} una voce per
 *   lingua, in ordine di file. Chi chiama le raggruppa in poche righe: una per lingua, tutte
 *   uguali tranne il nome, era il modo più lungo di non dire quali hanno ancora lavoro da fare.
 */
export default async function updateAllSubLanguages(sourceFile, newBaseTable, service) {
    const sourceDir = pathCmd.dirname(sourceFile); // prendi la source directory
    const excludeFilename = pathCmd.basename(sourceFile); // prendi il nome file per escludere la lingua madre
    const listFiles = listAllNotFilename(sourceDir, excludeFilename); // prendi gli altri file
    if (!listFiles) return [];
    const esiti = [];
    for (const file of listFiles) { // cicla l'apertura/update di ognuno
        esiti.push(await updateSingleSubLanguage(sourceDir, file, newBaseTable, service));
    }
    return esiti.filter(Boolean);
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
        // Solo i FILE di lingua: una cartella chiamata "fr-FR.yml" passava di qui come una
        // lingua qualsiasi, e falliva molto più avanti (vedi uty/listLanguageFiles.js).
        const langFiles = listLanguageFiles(sourceDir).filter(file => file !== excludeFilename);
        if (langFiles.length === 0) return false;
        return (langFiles);
    } catch (err) {
        logError(`reading the locale dir: ${err.message}`);
    }
}

/**
 * Updates a single sub-language file based on a reference table.
 *
 * @param {string} sourceDir - The source directory of the language file.
 * @param {string} file - The filename of the language file to be updated.
 * @param {object} referenceTable - The source-language table to sync keys against.
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js).
 * @returns {Promise<{ tag: string, missing: number, note: string|null } | null>} null se
 *   l'aggiornamento è fallito: l'errore è già stato segnalato, e una riga inventata nel
 *   riepilogo direbbe che è andato tutto bene.
 */
async function updateSingleSubLanguage(sourceDir, file, referenceTable, service) {
    const sourceFile = pathCmd.join(sourceDir, file); // il file sorgente con il suo percorso es:en-US.yml
    const tag = tagFromFileName(file);
    let nota = null;
    // Legge il contenuto attuale. Se sta su disco ma non rientra nel formato (una riga fuori
    // posto), non lasciarlo bloccato per sempre (il vecchio comportamento si limitava a loggare
    // e saltare il file a ogni giro): si salva una copia di backup e si riparte da una tabella
    // vuota, così il file torna in uno stato valido e compilabile.
    //
    // Il file VUOTO è un'altra cosa: è il modo documentato per aggiungere una lingua, e non c'è
    // niente da mettere al sicuro. Un file con dentro qualcosa ma senza nemmeno una voce non è
    // vuoto — è svuotato — e il parser non lo distingue più da una tabella vuota (vedi sotto,
    // dopo la lettura): a deciderlo è chi chiama, confrontando col riferimento.
    //
    // E il file che non si APRE è la terza, ed è l'unica in cui non si scrive niente: vedi sotto.
    let existingJson;
    let oldText = null;
    try {
        oldText = readLanguageText(sourceFile);
        ({ table: existingJson } = readLanguageFile(sourceFile, oldText));
        // Zero voci non è più un errore del parser: distinguere "tabella legittimamente vuota" da
        // "file svuotato a mano" richiede di sapere quante chiavi ha il codice, e lo sa solo chi
        // chiama. Se il riferimento ha chiavi e il file no, il file è stato svuotato: si mette al
        // sicuro prima di ripopolarlo. Qui il backup conta davvero, perché qui si perdono traduzioni.
        if (existingJson !== undefined && Object.keys(existingJson).length === 0 && Object.keys(referenceTable).length > 0) {
            backupLanguageFile(sourceFile, file, oldText, { kind: "corrupted", reason: "no entry found: the file has content but not a single key" });
            nota = "was emptied, rebuilt";
            existingJson = {};
        }
    } catch (err) {
        if (err.unreadable) {
            // Non sappiamo cosa contenga (una cartella con quel nome, i permessi, un link
            // rotto): rigenerarlo vorrebbe dire inventarne il contenuto, e il backup sarebbe
            // una copia vuota spacciata per una copia. Si dice e si lascia dov'è.
            logError(`'${colorize("nome", file)}' ${err.message}: left untouched`);
            return null;
        }
        // Il testo è quello da cui è nato l'errore, non una seconda lettura del disco: fra le
        // due il file può cambiare, e il backup fotograferebbe qualcosa di diverso da ciò che
        // ha causato il backup.
        backupLanguageFile(sourceFile, file, err.sourceText ?? null, { kind: "corrupted", reason: err.message });
        nota = "was corrupted, rebuilt";
        existingJson = {};
        oldText = null;
    }
    if (existingJson === undefined) {
        // File creato vuoto a mano per aggiungere una lingua nuova (vedi InstallSection):
        // non è corrotto, non c'è nulla da perdere - un backup sarebbe solo rumore.
        nota = "new language, was empty";
        existingJson = {};
        oldText = null;
    }
    try {
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
                    service.notTranslated[key] = referenceTable[key]; // aggiunge alle traduzioni mancanti
                }
            }
        }
        //
        const { translated, untranslated } = splitAndSortEntries(existingJson);
        const text = serializeLanguageFile({ tag, isSource: false, translated, untranslated, now: new Date() });
        // Confronto sui byte, mascherando solo la riga del timestamp (vedi
        // uty/buildLanguageHeader.js): `oldText` è `null` in ogni ramo di guasto (illeggibile,
        // corrotto, svuotato, assente), e forza la riscrittura sotto.
        const unchanged = oldText !== null && sameIgnoringProcessed(oldText, text);
        // Sovrascrivi il file solo se il contenuto (dati o ordinamento) è cambiato
        if (!unchanged) {
            fs.writeFileSync(sourceFile, text, 'utf8');
        }

        // `untranslated` e non un flag alzato nel ciclo sopra: sono le chiavi che restano a
        // null in QUESTO file dopo il giro, ereditate comprese, cioè quelle che un traduttore
        // vedrà davvero sotto la riga separatrice.
        return { tag, missing: untranslated.length, note: nota };
    } catch (err) {
        logError(`while updating '${colorize("nome", file)}': ${err.message}`);
        return null;
    }
}
