// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { tagFromFileName } from "./uty/languageFileFormat.js";
import { compareIcu } from "../compile/icu/icuSignature.js";
import { convertPlaceholders } from "./uty/placeholderShape.js";

// Since 4.7.1 this file is the sub-language PLANNER: no I/O, no logging. updateLanguage.js reads
// and writes the disk in four phases (read everything, plan, back up, write): a file that cannot
// be opened or a failed backup stops the sync before any table changes.

/**
 * Plans the update of one sub-language file against a reference table. Pure: it neither reads
 * nor writes the disk.
 *
 * @param {ReturnType<typeof import("./uty/readLanguageForSync.js").default>} letto - the read
 *   already done (never `unreadable`: phase P1 of updateLanguage stops that)
 * @param {string} sourceFile - the file path, e.g. /…/en-US.yml
 * @param {string} file - the file name
 * @param {object} referenceTable - The source-language table to sync keys against.
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js).
 * @returns {{ filePath: string, file: string, tag: string, table: object, oldText: string|null,
 *   expected: object, backup: { kind: "corrupted", reason: string } | null, note: string|null }}
 *   `backup` is the backup to make BEFORE writing (with the bytes of `expected`), not one already made.
 */
export function planSubLanguage(letto, sourceFile, file, referenceTable, service) {
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
    // A file that cannot be OPENED never gets here: updateLanguage stops before writing any
    // table (VT_LANGUAGE_UNREADABLE).
    let oldText = letto.oldText;
    let existingJson;
    let backup = null;

    if (letto.status === "corrupted") {
        backup = { kind: "corrupted", reason: letto.error.message };
        nota = "was corrupted, rebuilt";
        existingJson = {};
    } else if (letto.status === "missing" || letto.status === "empty") {
        // File creato vuoto a mano per aggiungere una lingua nuova: non è corrotto, non c'è
        // nulla da perdere — un backup sarebbe solo rumore.
        nota = "new language, was empty";
        existingJson = {};
    } else {
        existingJson = letto.table;
        // Zero voci non è un errore del parser: distinguere "tabella legittimamente vuota" da
        // "file svuotato a mano" richiede di sapere quante chiavi ha il codice, e lo sa solo chi
        // chiama. Se il riferimento ha chiavi e il file no, il file è stato svuotato: si mette
        // al sicuro prima di ripopolarlo. Qui il backup conta davvero, perché qui si perdono
        // traduzioni.
        if (Object.keys(existingJson).length === 0 && Object.keys(referenceTable).length > 0) {
            backup = { kind: "corrupted", reason: "no entry found: the file has content but not a single key" };
            nota = "was emptied, rebuilt";
            existingJson = {};
            oldText = null; // forza la riscrittura
        }
    }
    // Chiave decaduta -> chiave emergente con lo stesso valore in lingua principale (rename, non testo nuovo):
    // salva la traduzione già fatta per la chiave decaduta prima che il ciclo sotto la elimini
    const renamedKeys = service.renamedKeys ?? {};
    const inheritedValues = {};
    for (const [oldKey, newKey] of Object.entries(renamedKeys)) {
        if (existingJson[oldKey] == null) continue;
        // 4.6.4: una chiave abbinata per forma porta la traduzione CONVERTITA ai segnaposto nuovi. Se
        // la conversione non è sicura (un "%s" in più o in meno) la traduzione non si eredita: meglio
        // una voce a null che una che mostra l'argomento sbagliato.
        const conversione = service.renamedConversions?.[oldKey];
        const valore = conversione ? convertPlaceholders(existingJson[oldKey], conversione) : existingJson[oldKey];
        if (valore != null) inheritedValues[newKey] = valore;
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
    return { filePath: sourceFile, file, tag, table: existingJson, oldText, expected: letto.snapshot, backup, note: nota };
}

/**
 * `icuMismatch`: ICU translations whose arguments or syntax differ from the source (and slots,
 * since 4.6.4). They are not missing, but the compiler discards them and shows the source
 * (invariant 21): the summary cannot say "all ok!" for a language that has some.
 */
export function countIcuMismatch(referenceTable, table, tag) {
    let icuMismatch = 0;
    for (const key in referenceTable) {
        const value = table[key];
        if (typeof value === "string" && typeof referenceTable[key] === "string"
            && compareIcu(referenceTable[key], value, tag).errors.length > 0) icuMismatch++;
    }
    return icuMismatch;
}
