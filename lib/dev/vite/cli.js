#!/usr/bin/env node
// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 4.

import fs from "fs";
import path from "path";
import updateLanguage from "./updateLanguage.js";
import languageAutonym from "./uty/languageAutonym.js";
import guardMassErase from "./uty/guardMassErase.js";
import migrateLegacyLanguages from "./uty/migrateLegacyLanguages.js";
import validateLanguageTag from "./uty/validateLanguageTag.js";
import { collectStatus, printStatus, printWarnings } from "./uty/languageStatus.js";
import shortPath from "./uty/shortPath.js";
import { languageFileName } from "./uty/languageFileFormat.js";
import { logEchoColored, logRule, logCommand, colorize, setLogStyle } from "../../utility.js";
import { writeSession } from "./uty/sessionStore.js";
import { writeScan, clearScan } from "./uty/scanRecord.js";
import fastVerify, { buildScanRecord } from "./uty/fastVerify.js";
import { BUILDER_VERSION } from "./uty/builderVersion.js";
import { CLI_NAME } from "./uty/cliName.js";
import loadConfig from "./uty/loadConfig.js";
import scanSource from "./uty/scanSource.js";
import { printHeader, testoMotivo, printSyncSummary } from "./uty/syncReport.js";

/**
 * I tag che seguono `--add`, fino al prossimo argomento che comincia per "-". Più tag in un
 * colpo solo (`--add fr-FR de-DE`) perché aggiungere una lingua alla volta e rilanciare la
 * sincronizzazione ogni volta è esattamente il lavoro che questo flag esiste per togliere.
 *
 * `null` quando il flag non c'è: è diverso da `[]`, cioè "--add" scritto senza tag, che è un
 * errore da segnalare e non un comando senza effetti.
 */
function collectAddTags(argv) {
  const inizio = argv.findIndex((a) => a === "--add" || a === "-add");
  if (inizio === -1) return null;
  const tags = [];
  for (let i = inizio + 1; i < argv.length && !argv[i].startsWith("-"); i++) tags.push(argv[i]);
  return tags;
}

// L'elenco dei tag supportati vive in doc/bcp47.md, che NON viene spedito col pacchetto
// ("files": ["lib"] in package.json): a chi ha installato da npm un percorso relativo indica
// un file che sul suo disco non esiste. Nei messaggi ci va l'URL, e una volta sola: comparendo
// sia nell'aiuto sia nell'errore di --add, due copie divergerebbero al primo rinominare.
const BCP47_URL = "https://github.com/sepoina/viteTranslate/blob/main/doc/bcp47.md";

const HELP = `
${CLI_NAME} — sync the translation tables with your source

Usage:
  npx ${CLI_NAME} [options]

Reads the "vitetranslate" config from vite.config.* in the current directory, scans
srcDir for _%_..._%_ markers, and syncs every language file in localeDir: adds new
keys, removes stale ones (carrying over translations when a key was only renamed),
and reports what is left untranslated. Intended to run as a "prebuild" step.

Options:
  --add <tag>...  Add one or more languages, then sync as usual, so the new files
                  come out already filled with every key to translate (null), and
                  finish with the --status report. Tags must be in the
                  <language>-<REGION> form ("fr-FR", "pt-BR") and name a real
                  language and region (see the tag list below); a language already
                  there is left untouched.
  --status        Report every translation table — keys, missing translations,
                  errors, tables out of sync with the source code — and exit
                  without writing anything. Exit code is 1 on errors only, so it
                  can be used as a check in CI; incomplete tables are not errors.
  --migrate       One-off conversion of 3.x language files (<tag>.js) to the 4.0
                  format (<tag>.yml). Originals are kept as .bak-migrated-*.
                  It only converts and exits; nothing else runs.
  --fastverify    Skip the whole sync when nothing relevant changed since the last
                  one: compares source mtimes against the last scan and only reads
                  the files that moved. Meant for "predev", where the full scan is
                  paid at every dev server start. It writes nothing and reads no
                  vite.config; anything unexpected falls back to the full sync.
  --simpleLog     Plain, un-boxed output: no label column, no rules. Same colors.
  --help, -h      Show this message.

Examples:
  npx ${CLI_NAME} --add fr-FR
  npx ${CLI_NAME} --add fr-FR de-DE pt-BR
  npx ${CLI_NAME} --status

Run it from the root of the project, where vite.config.* lives.

Supported language tags: ${BCP47_URL}
Docs:                    https://github.com/sepoina/viteTranslate#readme
`;

async function main() {
  // Prima di loadConfig(), non dopo: chi chiede l'aiuto molto spesso lo chiede proprio
  // perché il comando è appena fallito, magari lanciato dalla cartella sbagliata. Rispondere
  // "no Vite config found" a un --help sarebbe il momento peggiore per essere pedanti.
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP);
    return;
  }

  // Prima di loadConfig(): se la config non si carica il messaggio d'errore esce comunque
  // (vedi main().catch, fuori dalla colonna di proposito), ma tutto ciò che si stampa da qui
  // in poi deve già essere nella forma giusta.
  //
  // Case-insensitive: è l'unico flag scritto con una maiuscola interna (gli altri sono un
  // blocco solo — --add, --status, --migrate), quindi l'unico che si sbaglia a scrivere
  // ("--simplelog") senza che l'errore si veda — non è un tag da validare, resta solo
  // silenziosamente nella forma di default.
  const simpleLogFlag = process.argv.some((a) => a.toLowerCase() === "--simplelog");
  setLogStyle({ simple: simpleLogFlag });

  // Case-insensitive per lo stesso motivo di --simpleLog: è un flag con una maiuscola interna
  // possibile ("--fastVerify"), e un refuso su un flag booleano non produce nessun errore,
  // solo il comportamento di prima.
  const fastVerifyFlag = process.argv.some((a) => a.toLowerCase() === "--fastverify");
  if (fastVerifyFlag && (collectAddTags(process.argv) !== null || process.argv.includes("--status") || process.argv.includes("--migrate"))) {
    throw new Error(
      "--fastverify cannot be combined with --add, --status or --migrate: those commands are asked for on purpose, and 'maybe nothing' is not one of their outcomes."
    );
  }

  // Il percorso veloce: subito, prima di loadConfig(), che è tutto il punto — qui non si è
  // ancora importato niente. `motivoFast` resta `null` quando --fastverify non è passato, o
  // quando è passato ma non ha trovato nulla di riusabile: in quel caso si prosegue col giro
  // tradizionale, e la riga sotto l'intestazione dirà perché.
  let motivoFast = null;
  if (fastVerifyFlag) {
    const esito = fastVerify({ baseDir: process.cwd() });
    if (esito.fresh) {
      setLogStyle({ simple: simpleLogFlag || esito.simpleLog === true });
      printHeader({ srcLabel: esito.srcDir, fileCount: esito.checked, keyCount: esito.keys, localeLabel: esito.localeDir });
      logEchoColored("", "fastverify: nothing changed.");
      if (esito.warnings > 0) {
        logEchoColored("", `${esito.warnings} marker warning(s), to see them terminal:`);
        logCommand(`npx ${CLI_NAME} --status`);
      }
      logRule();
      return; // niente scritture, nemmeno la sessione
    }
    motivoFast = esito;
  }

  const config = await loadConfig();
  // Il flag vince sempre sull'opzione di config: si scrive sulla riga di comando proprio
  // quando si vuole una forma diversa da quella scritta in vite.config.*.
  setLogStyle({ simple: simpleLogFlag || config.simpleLog === true });

  // Stato condiviso tra la scansione dei file e updateLanguage/updateAllSubLanguages,
  // passato esplicitamente come parametro invece che via globalThis: costruito qui da
  // un processo standalone invece che da un hook di build.
  const service = {
    ...config,
    localeDir: path.join(config.baseDir, config.localeDir),
    sourceTable: {},
    notTranslated: {},
  };

  // Conversione una tantum dei file di lingua della 3.x. Sta prima di tutto il resto e ha
  // un flag esplicito perché riscrive dei file: farlo da solo, dentro una "prebuild" che
  // nessuno sta guardando, sarebbe la cosa sbagliata da fare senza che nessuno l'abbia chiesto.
  if (process.argv.includes("--migrate")) {
    fs.mkdirSync(service.localeDir, { recursive: true });
    migrateLegacyLanguages(service.localeDir, config.sourceLanguage);
    return;
  }

  // Aggiunta di nuove lingue. Il file nasce VUOTO di proposito: è il modo documentato di
  // aggiungere una lingua (vedi updateAllSubLanguages, ramo "empty file"), e la sincronizzazione
  // che segue qui sotto — nella stessa esecuzione — lo riempie con le chiavi a `null`. Nessun
  // secondo comando da ricordarsi, e nessun formato di file scritto in due punti diversi.
  const daAggiungere = collectAddTags(process.argv);
  if (daAggiungere !== null) {
    if (daAggiungere.length === 0) {
      throw new Error(
        "--add needs at least one language tag, e.g. --add fr-FR\n" +
        `  Supported <language>-<REGION> tags: ${BCP47_URL}`
      );
    }

    // Tutti i tag validati PRIMA di scrivere il primo file: con "--add fr-FR xy-AB" creare la
    // lingua buona e poi fermarsi sulla seconda lascerebbe il lavoro a metà, per un errore di
    // battitura che si vede benissimo senza toccare il disco.
    const invalidi = daAggiungere
      .map((tag) => validateLanguageTag(tag))
      .filter((esito) => !esito.ok);
    if (invalidi.length) {
      throw new Error(
        `--add: ${invalidi.map((e) => e.reason).join("; ")}\n` +
        `  Supported <language>-<REGION> tags: ${BCP47_URL}`
      );
    }

    fs.mkdirSync(service.localeDir, { recursive: true });
    // I tag incolonnati fra loro: sono ASCII per costruzione (li ha appena validati la guardia
    // sopra), quindi qui basta padEnd, senza scomodare il conteggio per colonne di terminale.
    const wTag = Math.max(...daAggiungere.map((t) => t.length));
    for (const tag of daAggiungere) {
      const fileName = languageFileName(tag);
      const filePath = path.join(service.localeDir, fileName);
      // Una lingua già presente viene lasciata dov'è, non è un errore: il comando resta
      // idempotente, e riaggiungere per sbaglio una lingua tradotta non ne azzera il file.
      if (fs.existsSync(filePath)) {
        logEchoColored("add-language", `${tag.padEnd(wTag)}  already there (${colorize("nome", shortPath(filePath))}): left untouched`);
        continue;
      }
      fs.writeFileSync(filePath, "", "utf8");
      logEchoColored("add-language", `${colorize("ok", tag.padEnd(wTag))}  added as ${colorize("nome", shortPath(filePath))} — ${languageAutonym(tag)}`);
    }
  }

  const srcRoot = path.join(config.baseDir, config.srcDir);
  const soloStato = process.argv.includes("--status");
  const { files, skipped, warnings, marked } = await scanSource(service, srcRoot);
  const chiaviTrovate = Object.keys(service.sourceTable).length;

  printHeader({ srcLabel: shortPath(srcRoot), fileCount: files.length, keyCount: chiaviTrovate, localeLabel: shortPath(service.localeDir) });
  // La riga che dice PERCHÉ si sta facendo il giro lungo, dopo l'intestazione e non prima: in
  // modalità ricca l'intestazione apre il blocco, e una riga sopra di essa sarebbe fuori da
  // qualunque blocco.
  if (motivoFast) logEchoColored("", `skip fastverify: ${testoMotivo(motivoFast)}.`);

  // Il rapporto legge service.sourceTable, quindi va costruito dopo la scansione — e, dopo un
  // --add, dopo la sincronizzazione, altrimenti fotograferebbe le tabelle un istante prima che
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
    // Uscita non nulla sui soli errori veri, così il comando si può mettere in CI. Una
    // tabella incompleta non è un errore: è lo stato normale di un progetto in cui si sta
    // ancora traducendo, e farlo fallire vorrebbe dire spegnere il controllo il primo giorno.
    if (rapporto().level === "error") process.exitCode = 1;
    return;
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
  if (daAggiungere !== null) {
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
  // uty/sessionStore.js). "lastLanguage" è l'ultima --add se c'è stata, altrimenti l'ultima
  // lingua toccata dalla sync — che è anche l'ordine in cui updateAllSubLanguages le elenca.
  const lastLanguage = daAggiungere?.length
    ? daAggiungere[daAggiungere.length - 1]
    : (esito.languages.at(-1)?.tag ?? config.sourceLanguage);
  writeSession(config.baseDir, { localeDir: config.localeDir, sourceLanguage: config.sourceLanguage, lastLanguage });

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
}

main().catch((error) => {
  // Fuori dalla colonna di proposito: qui il comando si ferma, e la riga non è una delle
  // tante di una sincronizzazione in corso. Il rosso però è lo stesso di ogni altro errore.
  console.error(`\n\x1b[1;31m[${CLI_NAME}]\x1b[0m ${error.message}\n`);
  process.exitCode = 1;
});
