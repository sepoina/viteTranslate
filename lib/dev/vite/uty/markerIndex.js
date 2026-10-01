// Architettura d'insieme: doc/structure.md § "The cross-session cache", e la sezione
// dell'estensione per l'editor ("The editor extension: `idePlugin/`").
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// L'indice delle voci: dove sta ogni voce marcata, file per file, come l'ha vista l'ultima
// sync. Lo scrive solo la sync (syncCore.js); lo legge l'estensione per l'editor
// (idePlugin/src/markedScan.mjs), che così non ricarica Babel per i file che non sono cambiati.
//
// Non è `scan.json` e non ne prende il posto: `scan.json` dice "le tabelle sono allineate a
// questi sorgenti", ed è su questo che `fastVerify` decide di non fare niente. L'indice dice
// solo dove stanno le voci — nessuno ne trae conclusioni sulle tabelle — e per questo si scrive
// anche quando la sync ha saltato qualche file: quei file mancano, e chi legge li rilegge da sé.

import path from "path";
import { leggiJson, scriviJson, pkgVersion } from "./sessionStore.js";

// Accanto a session.json e scan.json, stesse regole di vita.
const INDEX_REL = ["node_modules", ".viteTranslate", "markers.json"];
const SCHEMA_VERSION = 1;

/** Il percorso dell'indice, senza toccare il disco. */
export function markerIndexPath(baseDir) {
  return path.join(baseDir, ...INDEX_REL);
}

/**
 * `autoWrap` come valore confrontabile: cambia quali voci si estraggono e in che forma, quindi un
 * indice scritto con un altro `autoWrap` non vale. `false`, `true`, o la RegExp come stringa
 * ("/^p$/i").
 *
 * @param {boolean|RegExp} autoWrap
 * @returns {boolean|string}
 */
export function autoWrapKey(autoWrap) {
  return autoWrap instanceof RegExp ? String(autoWrap) : autoWrap === true;
}

/**
 * Legge l'indice. Non lancia mai: JSON rotto o schema diverso valgono "nessun indice".
 *
 * @param {string} baseDir
 * @returns {object | null}
 */
export function readMarkerIndex(baseDir) {
  return leggiJson(markerIndexPath(baseDir), SCHEMA_VERSION);
}

/**
 * Scrive l'indice, sostituendo il precedente. `version`, `updatedAt` e `pkgVersion` li mette
 * questa funzione. Non lancia mai, e senza `node_modules` non scrive (vedi `scriviJson`).
 *
 * @param {string} baseDir
 * @param {object} p
 * @param {string} p.srcDir - come scritto in vite.config, non risolto
 * @param {string} p.localeDir - come scritto in vite.config, non risolto
 * @param {boolean|RegExp} p.autoWrap
 * @param {Record<string, [number, number]>} p.files - percorso relativo -> [mtimeMs, size] di
 *   ogni file letto dalla scansione, marcato o no
 * @param {Record<string, { hash: number, entries: object[], warnings: object[] }>} p.marked -
 *   i file che potevano contenere marcatori e che si sono parsati: le voci di `onMarker`
 *   (`id, text, line, column, form`) e gli avvisi `{ kind, message }` dell'estrazione
 */
export function writeMarkerIndex(baseDir, { srcDir, localeDir, autoWrap, files, marked }) {
  scriviJson(baseDir, markerIndexPath(baseDir), {
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    pkgVersion: pkgVersion(),
    srcDir,
    localeDir,
    autoWrap: autoWrapKey(autoWrap),
    files,
    marked,
  });
}
