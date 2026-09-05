// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync",
// "Fast verify: the two-stage check".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import path from "path";
import { leggiJson, scriviJson, pkgVersion } from "./sessionStore.js";

// Accanto a session.json, stesse regole di vita (dentro node_modules, quindi fuori da git in
// ogni progetto e cancellato da un reinstall).
const SCAN_REL = ["node_modules", ".viteTranslate", "scan.json"];
const SCHEMA_VERSION = 1;

/** Il percorso del record, senza toccare il disco. */
export function scanPath(baseDir) {
  return path.join(baseDir, ...SCAN_REL);
}

/**
 * Legge il record dell'ultima scansione veloce. Non lancia mai: JSON rotto o `version` diversa
 * da quella attesa valgono entrambi "nessun record" (vedi `leggiJson`).
 *
 * @param {string} baseDir
 * @returns {object | null}
 */
export function readScan(baseDir) {
  return leggiJson(scanPath(baseDir), SCHEMA_VERSION);
}

/**
 * Scrive il record, **sostituendo** quello precedente per intero: si rigenera a ogni sync, e un
 * merge lascerebbe in giro le voci di file cancellati. `version`, `updatedAt` e `pkgVersion` li
 * mette questa funzione, non il chiamante — vedi `buildScanRecord` in fastVerify.js per il
 * resto del contenuto.
 *
 * @param {string} baseDir
 * @param {object} record
 */
export function writeScan(baseDir, record) {
  scriviJson(baseDir, scanPath(baseDir), {
    ...record,
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    pkgVersion: pkgVersion(),
  });
}

/**
 * Toglie il record. Usata quando una scansione è andata a vuoto su qualche file (`skipped`):
 * un record vecchio lì lasciato racconterebbe uno stato non più vero, e nessun record è meglio
 * di uno falso. Non lancia mai; se il file non c'è non fa niente.
 *
 * @param {string} baseDir
 */
export function clearScan(baseDir) {
  try {
    fs.rmSync(scanPath(baseDir), { force: true });
  } catch {
    // Non lancia mai: vedi il commento sopra la funzione.
  }
}
