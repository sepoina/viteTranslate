// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import path from "path";
import updateLanguage from "./updateLanguage.js";
import { SyncError } from "./uty/syncError.js";
import { collectStatus, printStatus, printWarnings } from "./uty/languageStatus.js";
import shortPath from "./uty/shortPath.js";
import { logEchoColored, logRule } from "../../utility.js";
import { writeSession } from "./uty/sessionStore.js";
import { writeScan, clearScan } from "./uty/scanRecord.js";
import { writeMarkerIndex } from "./uty/markerIndex.js";
import { buildScanRecord } from "./uty/fastVerify.js";
import { BUILDER_VERSION } from "./uty/builderVersion.js";
import scanSource from "./uty/scanSource.js";
import listLanguageFiles from "./uty/listLanguageFiles.js";
import { languageFileName } from "./uty/languageFileFormat.js";
import { DEFAULT_MARKERS } from "../../markerSyntax.js";
import { printHeader, testoMotivo, printSyncSummary } from "./uty/syncReport.js";

/** Il percorso assoluto della cartella delle tabelle, dalla config. Un solo posto in cui
 *  si fa questo join: lo fanno la sync, --add e --migrate, e tre copie della stessa riga
 *  sono tre posti in cui sbagliarla. */
export const localeDirOf = (config) => path.join(config.baseDir, config.localeDir);

/**
 * La sincronizzazione vera: scansiona `srcDir`, aggiorna ogni file di lingua in `localeDir`,
 * e riferisce cosa ha fatto. Due chiamanti: `cli.js` (dalla riga di comando) e `autoSync.js`
 * (dal plugin, dentro l'hook `config`).
 *
 * @param {object} p
 * @param {object} p.config - l'oggetto già risolto: { baseDir, srcDir, localeDir,
 *   sourceLanguage, simpleLog, ... }. Dalla CLI arriva da `loadConfig()`; dal plugin arriva da
 *   `vitetranslateConfig`, che è lo stesso oggetto (vedi doc/structure.md, "No separate config
 *   file").
 * @param {object|null} [p.motivoFast] - il risultato non-`fresh` di `fastVerify`, o `null`.
 *   Serve solo per la riga "skip fastverify: …" sotto l'intestazione.
 * @param {boolean} [p.soloStato] - `true` per `--status`. Esce prima della `mkdirSync` e di
 *   qualunque scrittura.
 * @param {boolean} [p.rapportoPieno] - `true` dopo un `--add`. Chiude col rapporto completo
 *   invece che col riepilogo.
 * @param {string|null} [p.lastLanguage] - cosa scrivere in `session.json` come ultima lingua
 *   toccata. `null` significa "deducila dall'esito", che è il caso normale.
 * @param {boolean} [p.showTranslateHint] - `false` quando la sync gira dentro un run LLM
 *   (`translatePass`): lì il suggerimento `npx … --llm-translate` sarebbe ridondante, sei già in
 *   quel comando. La riga "N string(s) still untranslated" resta.
 * @returns {Promise<{ esito: object|null, stato: object|null, chiaviTrovate: number,
 *   files: Array, skipped: string[], warnings: Array, hints: Record<string, object> }>} `hints`
 *   (4.6.4): per ogni chiave di una macro, cosa sono i suoi `{n}` e `<n>` — lo legge l'LLM
 *   (translatePass.js), mai scritto su disco
 * @throws {import("./uty/syncError.js").SyncError} `VT_SCAN_INCOMPLETE` (file marcati saltati),
 *   `VT_LANGUAGE_UNREADABLE`, `VT_BACKUP_FAILED`, `VT_FILE_CHANGED`, `VT_WRITE_FAILED`: la sync
 *   non stampa gli errori, li lancia (li stampa chi sta al confine).
 */
export default async function runSync({ config, motivoFast = null, soloStato = false, rapportoPieno = false, lastLanguage = null, showTranslateHint = true }) {
  // Stato condiviso tra la scansione dei file e updateLanguage/updateAllSubLanguages,
  // passato esplicitamente come parametro invece che via globalThis: costruito qui da
  // un processo standalone invece che da un hook di build.
  const service = {
    ...config,
    localeDir: localeDirOf(config),
    sourceTable: {},
    notTranslated: {},
    sourceHints: {},
    // I delimitatori del progetto (4.7.0): una config senza (test, libreria più vecchia) vale `_%_`.
    markers: config.markers ?? DEFAULT_MARKERS,
  };

  const srcRoot = path.join(config.baseDir, config.srcDir);
  const { files, skipped, warnings, marked, index } = await scanSource(service, srcRoot);
  const chiaviTrovate = Object.keys(service.sourceTable).length;

  // Il conteggio vale solo come istantanea: al primo avvio la cartella non esiste ancora
  // (viene creata più sotto, da `mkdirSync`), quindi 0 lingue è l'unica risposta onesta.
  // Tranne che per la sorgente: un sync (non `--status`) la scrive comunque, e senza contarla
  // un `--add` su una cartella vuota intestava "only source language" sopra una tabella di due.
  const fileLingue = new Set();
  try { for (const f of listLanguageFiles(service.localeDir)) fileLingue.add(f); } catch { /* non esiste ancora */ }
  if (!soloStato) fileLingue.add(languageFileName(config.sourceLanguage));
  const languageCount = fileLingue.size;
  printHeader({
    srcLabel: shortPath(srcRoot), fileCount: files.length, keyCount: chiaviTrovate,
    localeLabel: shortPath(service.localeDir), languageCount,
  });
  // La riga che dice PERCHÉ si sta facendo il giro lungo, dopo l'intestazione e non prima: in
  // modalità ricca l'intestazione apre il blocco, e una riga sopra di essa sarebbe fuori da
  // qualunque blocco.
  if (motivoFast) logEchoColored("", `skip fastverify: ${testoMotivo(motivoFast)}.`);

  // Il rapporto legge service.sourceTable, quindi va costruito dopo la scansione — e, dopo un
  // --add, dopo updateLanguage, altrimenti fotograferebbe le tabelle un istante prima che
  // vengano riempite.
  const rapporto = () => {
    const stato = collectStatus(service, BUILDER_VERSION);
    printStatus(stato, {
      localeDir: shortPath(service.localeDir),
      sourceLanguage: config.sourceLanguage,
      skipped,
      warnings,
    });
    return stato;
  };

  // Fotografia e basta: --status esce QUI, prima della mkdirSync qui sotto e di qualsiasi
  // altra scrittura. Un comando che serve a capire in che stato sono le cose non può essere
  // anche il comando che quello stato lo cambia — nemmeno creando una cartella vuota.
  if (soloStato) {
    return { esito: null, stato: rapporto(), chiaviTrovate, files, skipped, warnings, hints: service.sourceHints };
  }

  // Incomplete scan (4.7.1): if even one marked file could not be read or parsed, the key table
  // is half a table, and syncing it would erase that file's keys from every language. No table
  // is touched. The scan record is cleared (a failed run must never pass for a successful one);
  // the marker index lives under node_modules and is not a table, so it is written anyway: it
  // keeps the editor extension accurate, and the skipped files are simply missing from it.
  if (skipped.length > 0) {
    clearScan(config.baseDir);
    writeMarkerIndex(config.baseDir, { srcDir: config.srcDir, localeDir: config.localeDir, autoWrap: config.autoWrap, markers: service.markers, ...index });
    throw new SyncError("VT_SCAN_INCOMPLETE",
      `The scan of ${shortPath(srcRoot)} is incomplete: ${skipped.length} file(s) could not be read or parsed (` +
      `${skipped.join("; ")}). No language table was touched. Fix the file(s) and run again.`,
      { paths: skipped });
  }

  // Bootstrap: on first use localeDir may not exist yet; create it here.
  fs.mkdirSync(service.localeDir, { recursive: true });

  // The mass-erase check (detectMassErase) and the backups live inside updateLanguage:
  // read, plan, back up, and only then write.
  let esito;
  try {
    esito = await updateLanguage(service);
  } catch (errore) {
    // A failed run must not leave a scan record that makes it look successful.
    clearScan(config.baseDir);
    throw errore;
  }

  // Dopo un --add chiude il rapporto completo: le lingue appena aggiunte si vedono nella
  // tabella con le loro chiavi da tradurre, che è la domanda con cui uno lancia --add. Negli
  // altri casi basta il riepilogo, che dice le stesse cose in tre righe; stampare tutti e due
  // vorrebbe dire due blocchi "status" di fila, uno il riassunto dell'altro.
  if (rapportoPieno) {
    rapporto(); // mette già gli avvisi in fondo, con la traversa solo se serve (vedi printStatus)
  } else {
    printSyncSummary(esito, config.sourceLanguage, config.llm ?? null, { showTranslateHint });
    // Gli avvisi sul sorgente DOPO il riepilogo, non prima — lo stesso ordine con cui
    // printStatus li mette in coda al rapporto di --status, per lo stesso motivo: il risultato
    // del lavoro si legge per primo, "cosa non torna nel codice" è la nota a piè di pagina, non
    // l'apertura. La traversa si apre solo se sotto c'è davvero qualcosa da mostrare.
    if (warnings.length > 0 || skipped.length > 0) {
      logRule();
      printWarnings({ warnings, skipped });
    }
    logRule();
  }

  // Sincronizzazione riuscita: annota il contesto per la prossima sessione (vedi
  // uty/sessionStore.js). `lastLanguage` è l'ultima --add se c'è stata, altrimenti l'ultima
  // lingua toccata dalla sync — che è anche l'ordine in cui updateLanguage le elenca.
  const ultimaLingua = lastLanguage ?? (esito.languages.at(-1)?.tag ?? config.sourceLanguage);
  writeSession(config.baseDir, { localeDir: config.localeDir, sourceLanguage: config.sourceLanguage, lastLanguage: ultimaLingua });

  // The record for the next `--fastverify`, next to the session. Here the scan saw EVERY file
  // (a partial scan stopped the sync above) and the sync succeeded, so the record is true.
  writeScan(config.baseDir, buildScanRecord({
    baseDir: config.baseDir,
    srcDir: config.srcDir,
    localeDir: config.localeDir,
    sourceLanguage: config.sourceLanguage,
    simpleLog: config.simpleLog === true,
    keys: chiaviTrovate,
    warnings: warnings.length,
    entries: files,
    marked,
    markers: service.markers,
  }));

  // L'indice delle voci per l'estensione dell'editor (vedi uty/markerIndex.js), anche con file
  // saltati: non dice niente sulle tabelle, e i file saltati semplicemente non ci sono.
  writeMarkerIndex(config.baseDir, { srcDir: config.srcDir, localeDir: config.localeDir, autoWrap: config.autoWrap, markers: service.markers, ...index });

  return { esito, stato: null, chiaviTrovate, files, skipped, warnings, hints: service.sourceHints };
}
