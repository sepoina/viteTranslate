// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import path from "path";
import updateLanguage from "./updateLanguage.js";
import guardMassErase from "./uty/guardMassErase.js";
import { collectStatus, printStatus, printWarnings } from "./uty/languageStatus.js";
import shortPath from "./uty/shortPath.js";
import { logEchoColored, logRule } from "../../utility.js";
import { writeSession } from "./uty/sessionStore.js";
import { writeScan, clearScan } from "./uty/scanRecord.js";
import { buildScanRecord } from "./uty/fastVerify.js";
import { BUILDER_VERSION } from "./uty/builderVersion.js";
import scanSource from "./uty/scanSource.js";
import listLanguageFiles from "./uty/listLanguageFiles.js";
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
 * @returns {Promise<{ esito: object|null, stato: object|null, chiaviTrovate: number,
 *   files: Array, skipped: string[], warnings: Array }>}
 */
export default async function runSync({ config, motivoFast = null, soloStato = false, rapportoPieno = false, lastLanguage = null }) {
  // Stato condiviso tra la scansione dei file e updateLanguage/updateAllSubLanguages,
  // passato esplicitamente come parametro invece che via globalThis: costruito qui da
  // un processo standalone invece che da un hook di build.
  const service = {
    ...config,
    localeDir: localeDirOf(config),
    sourceTable: {},
    notTranslated: {},
  };

  const srcRoot = path.join(config.baseDir, config.srcDir);
  const { files, skipped, warnings, marked } = await scanSource(service, srcRoot);
  const chiaviTrovate = Object.keys(service.sourceTable).length;

  // Il conteggio vale solo come istantanea: al primo avvio la cartella non esiste ancora
  // (viene creata più sotto, da `mkdirSync`), quindi 0 lingue è l'unica risposta onesta.
  let languageCount = 0;
  try { languageCount = listLanguageFiles(service.localeDir).length; } catch { /* non esiste ancora */ }
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
    return { esito: null, stato: rapporto(), chiaviTrovate, files, skipped, warnings };
  }

  // Bootstrap: al primo utilizzo localeDir potrebbe non esistere ancora. updateLanguage
  // si limiterebbe a fallire silenziosamente la scrittura (ENOENT), quindi la si crea qui.
  fs.mkdirSync(service.localeDir, { recursive: true });

  // Ultimo controllo prima che updateLanguage cominci a cancellare e riscrivere: quello che
  // sta per succedere assomiglia a una pulizia normale o a una scansione andata a vuoto?
  // Nel dubbio la guardia mette al sicuro una copia di ogni file di lingua e lo segnala.
  guardMassErase(service, skipped.length);

  const esito = await updateLanguage(service);

  // Dopo un --add chiude il rapporto completo: le lingue appena aggiunte si vedono nella
  // tabella con le loro chiavi da tradurre, che è la domanda con cui uno lancia --add. Negli
  // altri casi basta il riepilogo, che dice le stesse cose in tre righe; stampare tutti e due
  // vorrebbe dire due blocchi "status" di fila, uno il riassunto dell'altro.
  if (rapportoPieno) {
    rapporto(); // mette già gli avvisi in fondo, con la traversa solo se serve (vedi printStatus)
  } else {
    printSyncSummary(esito, config.sourceLanguage);
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
  // lingua toccata dalla sync — che è anche l'ordine in cui updateAllSubLanguages le elenca.
  const ultimaLingua = lastLanguage ?? (esito.languages.at(-1)?.tag ?? config.sourceLanguage);
  writeSession(config.baseDir, { localeDir: config.localeDir, sourceLanguage: config.sourceLanguage, lastLanguage: ultimaLingua });

  // Il record per la prossima `--fastverify`, accanto alla sessione. Solo se la scansione ha
  // visto TUTTI i file: una scansione a metà (skipped.length > 0) è una tabella incompleta, e
  // benedirla come record valido vorrebbe dire congelare quello stato. Nessun record è meglio
  // di uno falso.
  if (skipped.length === 0) {
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
    }));
  } else {
    clearScan(config.baseDir);
  }

  return { esito, stato: null, chiaviTrovate, files, skipped, warnings };
}
