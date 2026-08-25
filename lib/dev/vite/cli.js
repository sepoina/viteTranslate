#!/usr/bin/env node
// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 4.

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import updateLanguage from "./updateLanguage.js";
import languageAutonym from "./uty/languageAutonym.js";
import guardMassErase from "./uty/guardMassErase.js";
import migrateLegacyLanguages from "./uty/migrateLegacyLanguages.js";
import validateLanguageTag from "./uty/validateLanguageTag.js";
import { collectStatus, printStatus } from "./uty/languageStatus.js";
import shortPath from "./uty/shortPath.js";
import { languageFileName } from "./uty/languageFileFormat.js";
import { logEchoColored, logWarning, colorize } from "../../utility.js";

/**
 * Cosa dire di un pacchetto che manca. `@babel/core` ha una riga sua perché è il caso che
 * capita davvero: è una peer dependency dichiarata **opzionale** — in un progetto React+Vite
 * arriva da `@vitejs/plugin-react` e nessuno se ne accorge mai — ma senza non si estrae niente,
 * e "cannot find package" da solo non dice che basta installarla.
 */
const consiglioPacchetto = (pacchetto) => pacchetto === "@babel/core"
  ? "It is an optional peer dependency of this plugin, needed to scan your source for markers: `npm i -D @babel/core`"
  : `Install it: \`npm i -D ${pacchetto}\``;

/**
 * `extractMarkers` caricato al momento dell'uso e non in cima al file.
 *
 * Tira dentro `@babel/core`, che è una peer dependency **opzionale**: in un progetto
 * React+Vite c'è sempre (`@vitejs/plugin-react` se la porta dietro), ma dove non c'è
 * l'import statico faceva fallire il modulo prima ancora che `main()` partisse — quindi
 * prima del `catch` che formatta gli errori, e persino su un `--help`, che con Babel non
 * c'entra niente. Ne usciva lo stack trace grezzo di Node su un `ERR_MODULE_NOT_FOUND`,
 * cioè il messaggio meno utile possibile per l'unico problema che ha una cura in una riga.
 */
async function loadExtractMarkers() {
  try {
    return (await import("../babel/extractMarkers.js")).default;
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const pacchetto = /Cannot find package '([^']+)'/.exec(error.message)?.[1] ?? "@babel/core";
    throw new Error(
      `scanning the source needs "${pacchetto}", which is not installed.\n` +
      `  ${consiglioPacchetto(pacchetto)}`
    );
  }
}

const EXT_RE = /\.[jt]sx?$/;
// Versione dello schema dei file di lingua generati (non del pacchetto): va bumpata a mano
// quando cambia la forma delle tabelle (struttura di "__builder__" o formato delle chiavi),
// non ad ogni sync.
const BUILDER_VERSION = 260824;
const EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

function walk(dir, excludeDir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // localeDir contiene i file lingua generati: non sono codice sorgente da scansionare
      // per il marcatore "_%_". Dalla 4.0 non sono più .js e EXT_RE li scarterebbe comunque:
      // questo copre i residui di un progetto non ancora migrato, le cui stringhe tradotte
      // potrebbero contenere "_%_" per coincidenza.
      if (full === excludeDir) continue;
      walk(full, excludeDir, results);
    }
    else if (EXT_RE.test(entry.name)) results.push(full);
  }
  return results;
}

// Le estensioni che Vite stesso accetta per il file di config, nel suo stesso ordine di
// preferenza. Cercare solo ".js" voleva dire che un progetto TypeScript — cioè il default dei
// template `create-vite` con TS — riceveva un ERR_MODULE_NOT_FOUND su un file che non aveva
// mai scritto, senza alcun indizio che il problema fosse l'estensione.
const CONFIG_FILES = [
  "vite.config.js", "vite.config.mjs", "vite.config.ts",
  "vite.config.cjs", "vite.config.mts", "vite.config.cts",
];

async function loadConfig() {
  // Nessun file di config separato: la stessa config passata a vitetranslate(...)
  // in vite.config.* viene letta da qui, tramite la proprietà che il plugin
  // espone sull'oggetto restituito — una sola fonte di verità, zero duplicazione.
  const nome = CONFIG_FILES.find((f) => fs.existsSync(path.join(process.cwd(), f)));
  if (nome === undefined) {
    throw new Error(
      `no Vite config found in "${process.cwd()}" (looked for: ${CONFIG_FILES.join(", ")}). ` +
      "Run this command from the root of the project, where vite.config.* lives."
    );
  }

  const viteConfigPath = path.join(process.cwd(), nome);
  let resolved;
  try {
    ({ default: resolved } = await import(pathToFileURL(viteConfigPath).href));
  } catch (error) {
    // Un config TypeScript lo carica Node stesso, togliendo i tipi: dalla 22.6 dietro flag,
    // dalla 23.6 di default. Su un Node più vecchio — o con sintassi che non si limita ad
    // annotazioni (enum, namespace, decoratori) — l'import fallisce, e il messaggio grezzo non
    // dice quale delle due cose sia successa.
    const tipizzato = /\.[cm]?ts$/.test(nome);
    const aiuto = tipizzato && !process.features.typescript
      ? ` This Node (${process.version}) does not strip TypeScript types: use Node 23.6+, run with --experimental-strip-types, or keep a vite.config.js.`
      : "";
    // Caricare la config tira dentro il plugin, e con lui tutto ciò che il plugin importa: se
    // a mancare è un pacchetto, il messaggio grezzo lo nomina in mezzo a un percorso lungo e
    // sembra un problema della config. Quasi sempre è invece una peer dependency non
    // installata, e la cura è una riga.
    const pacchetto = error?.code === "ERR_MODULE_NOT_FOUND"
      ? /Cannot find package '([^']+)'/.exec(error.message)?.[1]
      : undefined;
    if (pacchetto) {
      throw new Error(
        `loading "${nome}" needs "${pacchetto}", which is not installed.\n` +
        `  ${consiglioPacchetto(pacchetto)}`
      );
    }
    throw new Error(`could not load "${nome}": ${error.message}${aiuto}`);
  }

  // `defineConfig` accetta anche una funzione di `{ command, mode }`, forma comunissima appena
  // la config deve guardare l'ambiente. Prima cadeva nel ramo "plugin non trovato", che
  // mandava a cercare un errore di registrazione che non c'era.
  if (typeof resolved === "function") {
    resolved = await resolved({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });
  }

  const plugins = (resolved?.plugins ?? []).flat(Infinity);
  const plugin = plugins.find((p) => p?.name === "vitetranslate");
  if (!plugin?.vitetranslateConfig) {
    throw new Error(
      `vitetranslate was not found among the "plugins" of ${nome}: register it to use this command.`
    );
  }
  return plugin.vitetranslateConfig;
}

/**
 * Scansione di `srcDir`: popola `service.sourceTable` con quello che c'è nel CODICE adesso.
 * Non scrive niente, e per questo la condividono la sincronizzazione e `--status` — che
 * altrimenti risponderebbe alla domanda "sono allineate?" confrontando le tabelle fra loro
 * invece che col sorgente, cioè non rispondendo affatto.
 *
 * @param {object} service - stato della sessione; `service.sourceTable` viene mutata qui
 * @param {string} srcRoot - la cartella dei sorgenti, già risolta
 * @param {{ quiet?: boolean }} [opts] - `quiet` per chi stampa un rapporto suo
 * @returns {Promise<{ files: string[], skipped: string[], warnings: string[] }>}
 */
async function scanSource(service, srcRoot, { quiet = false } = {}) {
  let files;
  try {
    files = walk(srcRoot, service.localeDir);
  } catch (e) {
    throw new Error(`cannot read srcDir "${service.srcDir}" (resolved to "${shortPath(srcRoot)}"): ${e.message}`);
  }

  // Scansione solo per il suo effetto collaterale: popolare service.sourceTable (stessa
  // tabella condivisa tra tutti i file di questa scansione). Il codice trasformato non
  // servirebbe a nessuno, quindi `rewrite: false` si ferma al parse e non lo produce
  // affatto — prima veniva generato per intero, file per file, e buttato.
  //
  // Un file illeggibile o non parsabile viene saltato con un avviso, non fa cadere l'intera
  // sincronizzazione: è un comando di "prebuild", e interromperlo su un file qualsiasi
  // lascerebbe le tabelle a metà senza dire quale file l'ha causato.
  // Marcatori annidati e collisioni di id: l'estrazione li segnalerebbe da sé sulla console,
  // col prefisso del plugin, che è la forma giusta dentro l'output di Vite ma non qui — nel
  // mezzo di una sincronizzazione uscirebbe fuori colonna, come una riga di un altro programma.
  // Passandole un canale, il messaggio entra nella colonna del comando come tutti gli altri.
  //
  // Gli avvisi si raccolgono e si stampano dopo: l'intestazione qui sotto conta le chiavi
  // trovate, quindi può uscire solo a scansione finita, e un avviso stampato mentre la
  // scansione gira comparirebbe prima della riga che dice di quale progetto si sta parlando.
  const warnings = [];
  const avviso = (message) => warnings.push(message);

  const skipped = [];
  // Caricato alla prima riga marcata trovata, non prima: un progetto in cui non c'è ancora
  // nessun marcatore non ha motivo di pretendere Babel per scoprire che non c'è niente da fare.
  let extractMarkers = null;
  for (const file of files) {
    let code;
    try {
      code = fs.readFileSync(file, "utf8");
    } catch (e) {
      skipped.push(`${shortPath(file)}: ${e.message}`);
      continue;
    }
    if (!code.includes("_%_")) continue;
    extractMarkers ??= await loadExtractMarkers();
    try {
      extractMarkers(code, { filename: file, table: service.sourceTable, rewrite: false, baseDir: service.baseDir, warn: avviso });
    } catch (e) {
      skipped.push(`${shortPath(file)}: ${e.message.split("\n")[0]}`);
    }
  }

  if (!quiet) {
    // Le due cartelle in una riga sola, con quanto c'è dentro: sono i due parametri che
    // decidono tutto il resto, e nominarle insieme toglie di mezzo l'equivoco fra "dove cerco
    // i marcatori" e "dove stanno le tabelle" — che sta lì sotto, e che la scansione salta.
    const quanti = (n, cosa) => `${n} ${cosa}${n === 1 ? "" : "s"}`;
    const chiavi = Object.keys(service.sourceTable).length - 1; // meno __builder__
    logEchoColored("viteTranslate",
      `source: "${shortPath(srcRoot)}" (${quanti(files.length, "file")}),  ` +
      `translations: "${shortPath(service.localeDir)}" (${quanti(chiavi, "key")})`);

    for (const message of warnings) logWarning(message);
    if (skipped.length) {
      logWarning(`${skipped.length} file(s) skipped (markers not extracted):`);
      for (const line of skipped) logEchoColored("", `  - ${line}`);
    }
  }

  return { files, skipped, warnings };
}

/**
 * Il riepilogo di una sincronizzazione, in tre tipi di riga invece di una per lingua.
 *
 * Prima ogni lingua aveva la sua, tutte uguali tranne il nome, e la sola che contava — chi ha
 * ancora chiavi da tradurre — era in mezzo alle altre. Le lingue a posto si raggruppano in una
 * riga sola perché "non c'è niente da fare" è la stessa notizia per tutte; quelle con del
 * lavoro restano una per riga, perché il lavoro è diverso per ciascuna.
 *
 * @param {{ file: string, action: string, written: boolean, languages: object[] }} esito
 */
function printSyncSummary({ file, action, written, languages }) {
  logEchoColored("", "");
  // "no changes detected" e file riscritto lo stesso non è una contraddizione: le chiavi sono
  // le stesse, ma può essere cambiato quali risultano tradotte altrove — e quello nel file
  // della lingua sorgente si vede, sotto la riga separatrice.
  const coda = action === "no changes detected" && written ? "no key changes, table rewritten" : action;
  logEchoColored("status", `${file} - ${coda}`);

  // Le parentesi solo quando servono a separare più nomi: su una lingua sola sarebbero
  // punteggiatura senza lavoro da fare. Il nome è quello del file, come nella riga sopra,
  // perché è la cosa che si va ad aprire.
  const elenco = (tags) => {
    const nomi = tags.map(languageFileName);
    return nomi.length === 1 ? nomi[0] : `[${nomi.join(", ")}]`;
  };

  const complete = languages.filter((l) => l.note === null && l.missing === 0);
  if (complete.length) {
    logEchoColored("", `${elenco(complete.map((l) => l.tag))} - complete translations!`);
  }
  // Il colore acceso resta a questa riga sola, ed è tutto il suo senso: in un blocco altrimenti
  // uniforme, "manca ancora del lavoro" è la sola cosa da trovare senza leggere.
  for (const l of languages.filter((x) => x.note !== null || x.missing > 0)) {
    const stato = l.missing > 0 ? colorize("warning", `${l.missing} key(s) missing`) : "complete";
    logEchoColored("", `${elenco([l.tag])} - ${l.note ? `${l.note}, ` : ""}${stato}`);
  }
  logEchoColored("", "");
}

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

/**
 * Il nome con cui il comando si presenta. Dalla 4.1 il bin è `vtranslate-cli`: si scrive dopo
 * un `npx` decine di volte al giorno, e il nome vecchio —
 * `vitetranslate-prepare-translation-table` — descriveva bene quello che fa e malissimo quanto
 * costa digitarlo. Resta registrato come alias, così un `prebuild` già scritto non si rompe;
 * qui però ne compare uno solo, perché un messaggio che si autonomina in due modi diversi è
 * peggio di uno che ne sceglie uno.
 */
const CLI_NAME = "vtranslate-cli";

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

  const config = await loadConfig();

  // Stato condiviso tra la scansione dei file e updateLanguage/updateAllSubLanguages,
  // passato esplicitamente come parametro invece che via globalThis: costruito qui da
  // un processo standalone invece che da un hook di build.
  const service = {
    ...config,
    localeDir: path.join(config.baseDir, config.localeDir),
    sourceTable: {
      __builder__: { v: BUILDER_VERSION, languageName: languageAutonym(config.sourceLanguage), incomplete: false },
    },
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
        logEchoColored("add-language", `${tag.padEnd(wTag)}  already there (${shortPath(filePath)}): left untouched`);
        continue;
      }
      fs.writeFileSync(filePath, "", "utf8");
      logEchoColored("add-language", `${colorize("ok", tag.padEnd(wTag))}  added as ${shortPath(filePath)} — ${languageAutonym(tag)}`);
    }
  }

  const srcRoot = path.join(config.baseDir, config.srcDir);
  const soloStato = process.argv.includes("--status");
  const { files, skipped, warnings } = await scanSource(service, srcRoot, { quiet: soloStato });

  // Il rapporto legge service.sourceTable, quindi va costruito dopo la scansione — e, dopo un
  // --add, dopo la sincronizzazione, altrimenti fotograferebbe le tabelle un istante prima che
  // vengano riempite.
  const rapporto = () => {
    const stato = collectStatus(service, BUILDER_VERSION);
    printStatus(stato, {
      localeDir: shortPath(service.localeDir),
      sourceLanguage: config.sourceLanguage,
      sourceKeys: Object.keys(service.sourceTable).length - 1, // meno __builder__
      scanned: files.length,
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
    logEchoColored("", "");
    rapporto();
  } else {
    printSyncSummary(esito);
  }
}

main().catch((error) => {
  // Fuori dalla colonna di proposito: qui il comando si ferma, e la riga non è una delle
  // tante di una sincronizzazione in corso. Il rosso però è lo stesso di ogni altro errore.
  console.error(`\n\x1b[1;31m[${CLI_NAME}]\x1b[0m ${error.message}\n`);
  process.exitCode = 1;
});
