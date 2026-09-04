// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione" e § "Fase 3 — Il modulo virtuale e il code splitting".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 3, 4 e 5.

import pathCmd from "path";
import fs from "fs";
import extractMarkers from "../babel/extractMarkers.js";
import readLanguageFile, { readLanguageText } from "./uty/readLanguageFile.js";
import listLanguageFiles from "./uty/listLanguageFiles.js";
import splitAndSortEntries from "./uty/splitAndSortEntries.js";
import serializeLanguageFile from "./uty/serializeLanguageFile.js";
import languageAutonym from "./uty/languageAutonym.js";
import { LANG_EXT, LEGACY_LANG_EXT, languageFileName, isLanguageFileName, tagFromFileName } from "./uty/languageFileFormat.js";
import { compileLanguageModule } from "../compile/compileTable.js";
import { hash } from "../babel/markerCore.js";
import { normalizeErrorSolve, resolveErrorSolve } from "../../errorSolve.js";
import checkSetup from "./uty/checkSetup.js";
import ownPackageDir from "./uty/ownPackage.js";
import creaReporter from "./uty/devReporter.js";
import { readSession, writeSession } from "./uty/sessionStore.js";
import { logError, logWarning, logEchoColored, colorize, setLogStyle } from "../../utility.js";

// Il nome con cui il comando compare nella riga di rimando del reporter (punto 4) e nella
// "cura" di un setup mancante (punto 3): stesso letterale che usa cli.js (vedi lì CLI_NAME).
const CLI_NAME = "vtranslate-cli";

/**
 * Aspetta che quanto già scritto su stdout sia davvero uscito. Serve solo prima di un
 * `process.exit`: su un terminale la scrittura è sincrona e questa funzione ritorna subito, su
 * una pipe non lo è e senza aspettare l'ultimo messaggio si perde. Il timeout copre il caso in
 * cui la pipe sia piena e nessuno legga: meglio troncare che restare appesi.
 */
function scaricaStdout(timeoutMs = 200) {
  return new Promise((risolvi) => {
    const chiudi = setTimeout(risolvi, timeoutMs);
    chiudi.unref?.();
    process.stdout.write("", () => { clearTimeout(chiudi); risolvi(); });
  });
}

// Dove il pacchetto vive DAVVERO, per escludere il proprio runtime compilato dalla scansione
// dei marcatori (vedi il transform più sotto). Lo trova `ownPackage.js` risalendo per NOME e
// non contando le cartelle: con "file:.." (playground/, playEdge/) node_modules/@sepoina/
// vitetranslate è un SYMLINK che punta alla radice del repo, non a "lib/", e un calcolo
// relativo a quel link escluderebbe l'intero repo (playground/src e playEdge/src compresi)
// invece del solo pacchetto — ogni marcatore lì dentro smetterebbe di essere estratto, in
// silenzio, e ogni <Translate> lo vedrebbe "non marcato" a runtime.
const ownDir = ownPackageDir();
const OWN_LIB_DIR = ownDir ? pathCmd.join(ownDir, "lib").replace(/\\/g, "/") : null;

/**
 * Cosa manca e come rimediare, per ognuna delle `reason` di `checkSetup`. Restituisce pezzi
 * separati — non una frase già incollata — perché due chiamanti la rendono in due forme
 * diverse: `buildStart` la lancia com'è (un `Error`, mai colorato: potrebbe finire in un log
 * che non interpreta gli ANSI), `configureServer` la stampa nella colonna del log con i dati
 * variabili in evidenza. `ev` è il punto in cui le due forme divergono: l'identità per la
 * prima, `colorize("nome", …)` per la seconda — la frase intorno resta la stessa.
 *
 * @param {{ reason: string, detail?: any }} result
 * @param {{ localeDirLabel: string, sourceLanguage: string }} p
 * @param {(s: string) => string} [ev] - come evidenziare un valore dentro la frase
 * @returns {{ problem: string, fixIntro: string | null, fixCommand: string | null, fixText: string | null }}
 *   `fixCommand`, quando c'è, è la riga da lanciare in console, con `fixIntro` a introdurla;
 *   `fixText` è la cura quando non è un comando (il maiuscolo sbagliato si corregge in
 *   vite.config, non in un terminale) e allora `fixIntro`/`fixCommand` restano `null`.
 */
function setupErrorText({ reason, detail }, { localeDirLabel, sourceLanguage }, ev = (s) => s) {
  switch (reason) {
    case "no-locale-dir":
    case "no-language-file":
    case "source-missing":
      return {
        problem: reason === "no-locale-dir"
          ? `localeDir ${ev(`"${localeDirLabel}"`)} does not exist.`
          : reason === "no-language-file"
          ? `${ev(`"${localeDirLabel}"`)} is empty: no language file in there yet.`
          : `sourceLanguage ${ev(`"${sourceLanguage}"`)} not found (missing or invalid file) in ${ev(`"${localeDirLabel}"`)}.`,
        fixIntro: "add it with this command:",
        fixCommand: `npx ${CLI_NAME} --add ${sourceLanguage}`,
        fixText: null,
      };
    case "legacy-format":
      return {
        problem: `the language files in ${ev(`"${localeDirLabel}"`)} are still in the 3.x ${ev(`"${LEGACY_LANG_EXT}"`)} format (${detail.join(", ")}). ` +
          `From 4.0 they are data files, not JS modules — the originals are kept as .bak-migrated-*.`,
        fixIntro: "migrate with this command:",
        fixCommand: `npx ${CLI_NAME} --migrate`,
        fixText: null,
      };
    case "source-case-mismatch":
      return {
        problem: `sourceLanguage ${ev(`"${sourceLanguage}"`)} not found in ${ev(`"${localeDirLabel}"`)}. ` +
          `${ev(`"${languageFileName(detail)}"`)} is there, but language tags are case-sensitive.`,
        fixIntro: null,
        fixCommand: null,
        fixText: `write sourceLanguage as ${ev(`"${detail}"`)} in vite.config, or rename the file to ${ev(`"${languageFileName(sourceLanguage)}"`)}.`,
      };
    case "source-invalid":
    default:
      return {
        problem: `${ev(`"${languageFileName(sourceLanguage)}"`)} in ${ev(`"${localeDirLabel}"`)} is not a valid language file (${detail}).`,
        fixIntro: "check it with this command:",
        fixCommand: `npx ${CLI_NAME} --status`,
        fixText: null,
      };
  }
}

export const VIRTUAL_LANGUAGES_ID = "virtual:vitetranslate/languages";
const RESOLVED_VIRTUAL_LANGUAGES_ID = "\0" + VIRTUAL_LANGUAGES_ID;

// File vuoto = lingua nuova da inizializzare, e va tenuto distinto da qualunque altro motivo
// per cui una tabella non si legge. Un file con del contenuto ma nessuna voce NON rientra qui:
// è una lingua svuotata, e parseLanguageFile la segnala come errore apposta.
const EMPTY_FILE = "empty file";

// La sincronizzazione dei moduli di lingua NON avviene più qui: la fa il comando
// standalone "vtranslate-cli" (vedi cli.js), da
// lanciare come "prebuild" prima di "vite build" — così quando questo plugin
// espone il virtual module, i file su disco sono già aggiornati, senza dover
// dipendere dall'ordine con cui Rollup processa i propri hook in una singola build.
export default function vitetranslate(defs) {
  // Fail fast su config incompleta: senza queste due opzioni il plugin finirebbe per
  // costruire percorsi come "undefined.yml" invece di segnalare l'errore subito.
  if (typeof defs?.localeDir !== "string" || !defs.localeDir) {
    throw new Error('[vitetranslate] option "localeDir" is missing or invalid: it must be a non-empty string (e.g. "locale").');
  }
  if (typeof defs?.sourceLanguage !== "string" || !defs.sourceLanguage) {
    throw new Error('[vitetranslate] option "sourceLanguage" is missing or invalid: it must be a non-empty string holding the BCP 47 tag of the source language (e.g. "it-IT").');
  }
  const baseDir = defs.baseDir ?? process.cwd();
  const localeDir = pathCmd.join(baseDir, defs.localeDir);
  // Normalizzato a "/" per confrontarlo con gli id (posix-style) che Vite passa al transform.
  const localeDirPosix = localeDir.replace(/\\/g, "/");
  // Prima di qualunque messaggio: applicato alla costruzione del plugin, così tutto ciò che
  // stampa da qui in poi (compreso un eventuale errore di setup) è già nella forma giusta.
  //
  // "simpleLog" è l'unica opzione la cui maiuscola interna si sbaglia scrivendola a mano
  // ("simplelog", "Simplelog", ...) senza che nulla se ne accorga: un refuso su localeDir o
  // sourceLanguage produce subito un errore di validazione, uno su simpleLog non produce
  // niente — resta silenziosamente nella forma di default. Letta case-insensitive fra le
  // chiavi di defs per questo, e non per le altre opzioni.
  const simpleLogKey = Object.keys(defs).find((k) => k.toLowerCase() === "simplelog");
  const simpleLog = !!(simpleLogKey && defs[simpleLogKey]);
  setLogStyle({ simple: simpleLog });
  // La rete che impedisce il secondo e il terzo errore (vedi configureServer): se il setup
  // fallisce, load() del modulo virtuale deve uscire subito, per qualunque motivo venisse
  // richiamato prima che il processo muoia.
  let setupFallito = false;
  // Un raccoglitore per sessione di dev/build: un avviso per categoria, il resto a conteggio
  // (vedi devReporter.js). Condiviso da generateLanguagesModule e dai due transform qui sotto.
  const reporter = creaReporter({ baseDir, cliName: CLI_NAME });
  // Valore provvisorio: se defs.includeFallback non è specificato, viene risolto in
  // modo affidabile in configResolved (resolvedConfig.isProduction), invece di dedurlo
  // da process.env.NODE_ENV a tempo di definizione del plugin — NODE_ENV non riflette
  // sempre l'ambiente reale (mode custom, "vite preview", ecc.).
  let includeFallback = defs.includeFallback ?? true;
  // Le sourcemap del nostro transform seguono quelle della build invece di essere sempre
  // prodotte: costano circa l'8% del passaggio e con `build.sourcemap: false` nessuno le
  // legge. Risolto in configResolved, come includeFallback; in dev restano attive, che è
  // dove servono davvero.
  let emitSourceMaps = true;
  // Decide quali lingue sono precaricate (vedi generateLanguagesModule). Risolto in
  // configResolved come le altre due: `load` del modulo virtuale gira sempre dopo.
  let isProduction = false;
  // Il nome del file di config in uso ("vite.config.js"), per nominarlo nel blocco di un
  // setup mancante ("la sourceLanguage scritta lì è..."). Assente se Vite gira senza un file
  // di config su disco (uso puramente programmatico): il messaggio lo omette in quel caso.
  let viteConfigFile = "";
  // Diagnostica a schermo e in console. Le opzioni dell'utente si completano e si controllano
  // subito (un refuso va detto adesso, non alla prima build); la risoluzione contro l'ambiente
  // aspetta configResolved, come includeFallback. `resolvedErrorSolve` è ciò che finisce nel
  // modulo virtuale: valori già decisi, così il runtime non deve interpretare nulla.
  // `logWarning` invece del default (console.warn col prefisso "[vitetranslate]"): qui c'è
  // già una colonna di log da usare (setLogStyle è già stato applicato sopra), quindi un
  // refuso in errorSolve appare nella stessa forma colorata di ogni altro avviso, non a parte.
  const errorSolveOptions = normalizeErrorSolve(defs?.errorSolve, logWarning);
  let resolvedErrorSolve = resolveErrorSolve(errorSolveOptions, false);
  // I prefissi accesi hanno un costo che si paga nel bundle — l'elenco delle chiavi non
  // tradotte in ogni chunk di lingua, l'insieme globale nel modulo virtuale — e con i default
  // in produzione non si paga mai.
  const marksUntranslated = () => resolvedErrorSolve.untranslated !== "";
  const marksNotFullyTranslated = () => resolvedErrorSolve.notFullyTranslated !== "";

  // Gli id dei moduli di lingua che il bundler ci ha davvero chiesto di compilare. È l'elenco
  // completo per costruzione — un modulo entra nel grafo solo passando dal transform qui sotto
  // — e sostituisce la scansione di tutto `idToModuleMap` che serviva a ritrovarli: quel grafo
  // ha migliaia di voci in un'app vera, e le lingue sono una decina.
  const localeModuleIds = new Set();

  // Tabelle già lette per generare il manifest, con l'HASH DEL CONTENUTO come chiave.
  //
  // Con `🔹` acceso — il default in sviluppo — il manifest si rigenera a ogni salvataggio di
  // QUALUNQUE file di lingua, perché l'insieme delle chiavi non tradotte altrove cambia
  // traducendone una sola. Senza cache ogni salvataggio rilegge e rivaluta tutte le lingue per
  // ricalcolare un insieme che si muove di una chiave.
  //
  // La chiave è il contenuto e non l'mtime: la granularità del timestamp del filesystem è
  // grossolana (3 ms su ext4 con HZ=300, 1-2 s su exFAT/FAT), e due contenuti scritti dentro
  // lo stesso tick condividerebbero la chiave — cioè si servirebbe una tabella stantia proprio
  // nel momento in cui il traduttore ha appena salvato. Il file va letto comunque per
  // calcolare l'hash; quello che si risparmia è il parse.
  //
  // Le tabelle qui dentro sono di sola lettura per chi le riceve: `generateLanguagesModule` le
  // legge e basta, e `bootstrapSubLanguage` sostituisce la voce invece di mutarla. Il resto
  // della libreria (la sync, che le muta) passa da `readLanguageFile` e non da qui.
  const manifestTables = new Map();

  function readTableForManifest(filePath) {
    // Stessa lettura del resto della libreria: un file che non si apre affatto (una cartella
    // con il nome di un file di lingua, i permessi) esce con un messaggio che lo dice, non con
    // un errno grezzo in mezzo a una frase che parla di sintassi.
    const code = readLanguageText(filePath);
    const digest = hash(code);
    const cached = manifestTables.get(filePath);
    if (cached !== undefined && cached.digest === digest) return cached.table;

    const table = readLanguageFile(filePath, code);
    // Un file vuoto (`undefined`) non si mette in cache: è la lingua da inizializzare, e il
    // bootstrap sta per riscriverlo — la prossima lettura avrà comunque un contenuto diverso.
    if (table !== undefined) manifestTables.set(filePath, { digest, table });
    return table;
  }

  async function generateLanguagesModule() {
    // localeDir è un'opzione esplicita e validata (vedi guard sopra): se manca sul disco
    // (primo avvio su un progetto appena clonato, cartella .gitignored, ecc.) la creiamo
    // qui invece di limitarci a segnalarne l'assenza — il comando di sync la crea comunque
    // al proprio interno, quindi farlo anche qui evita solo un giro a vuoto inutile. Il
    // controllo sulla sourceLanguage subito sotto resta l'unico punto che blocca l'avvio
    // se il contenuto non è ancora stato generato.
    try {
      fs.mkdirSync(localeDir, { recursive: true });
    } catch (e) {
      // Quasi sempre: localeDir punta a un FILE. Il messaggio grezzo di Node ("EEXIST: file
      // already exists, mkdir …") suona come un problema momentaneo, e non e'.
      throw new Error(
        `[vitetranslate] localeDir "${defs.localeDir}" cannot be used as a directory (${e.code ?? e.message}): ` +
        `it must be a folder holding one file per language.`
      );
    }
    // Solo i FILE, e solo quelli direttamente dentro la cartella: una cartella chiamata
    // "fr-FR.yml" diventava una lingua a tutti gli effetti (vedi uty/listLanguageFiles.js).
    const files = listLanguageFiles(localeDir);
    const pathOf = tag => pathCmd.join(localeDir, languageFileName(tag)).replace(/\\/g, "/");

    // Un file presente ma non valido (una riga fuori formato, o nessuna voce) non deve né far
    // esplodere la build (se è la sourceLanguage o una preloadedLanguage, verrebbe importato
    // staticamente) né restare un chunk lazy silenziosamente rotto: viene escluso qui, con un
    // avviso che riporta il numero di riga, invece di lasciare che l'errore emerga più tardi
    // come uno stack trace opaco di Rollup/esbuild o come un errore di fetch nel browser.
    const tags = [];
    const tableByTag = {};
    // File vuoti (il modo documentato per aggiungere una lingua: si crea il file e si lancia
    // la sync): non sono un errore, sono la lingua nuova stessa. Vanno popolati sotto, non
    // appena la sourceTable è nota — prima non c'è nulla da scriverci.
    const toBootstrap = [];
    for (const f of files) {
      const tag = tagFromFileName(f);
      try {
        const table = readTableForManifest(pathCmd.join(localeDir, f));
        if (!table) throw new Error(EMPTY_FILE);
        tableByTag[tag] = table;
        tags.push(tag);
      } catch (e) {
        if (e.message === EMPTY_FILE && tag !== defs.sourceLanguage) {
          toBootstrap.push({ tag, filePath: pathCmd.join(localeDir, f) });
          continue;
        }
        reporter.report("invalid-language-file", `${colorize("nome", `"${f}"`)} is not a valid language file (${e.message}): language ${colorize("nome", `"${tag}"`)} ignored until it is fixed.`);
      }
    }

    if (!tags.includes(defs.sourceLanguage)) {
      // I messaggi dettagliati per questo caso (formato 3.x, maiuscolo sbagliato, sorgente
      // assente) sono ormai responsabilità di checkSetup/configureServer, che fermano il
      // processo PRIMA di arrivare qui (vedi uty/checkSetup.js). Se si arriva comunque a
      // questo punto è perché la sourceLanguage è sparita DOPO un avvio riuscito — il file è
      // stato cancellato o rinominato a sessione già in corso — e un throw qui produce
      // comunque l'errore leggibile di Vite, invece di un TypeError generico più a valle.
      throw new Error(
        `[vitetranslate] sourceLanguage "${defs.sourceLanguage}" is no longer valid in "${defs.localeDir}": ` +
        `run "npx ${CLI_NAME} --status" to see what changed.`
      );
    }
    const sourceTable = tableByTag[defs.sourceLanguage];

    // Scrive un file di lingua nuovo con le stesse chiavi della sourceLanguage a null (stessa
    // struttura che produce il comando di sync per una lingua nuova): usata sia qui sotto per
    // i file vuoti trovati nello scan, sia più avanti per una preloadedLanguages il cui file
    // manca del tutto.
    function bootstrapSubLanguage(tag, filePath) {
      const subData = {};
      for (const key in sourceTable) {
        // "languageName" è specifico di questo tag, non va copiato dalla sourceLanguage;
        // "incomplete" è sempre true qui: ogni altra chiave parte a null.
        subData[key] = key === "__builder__"
          ? { v: sourceTable["__builder__"].v, languageName: languageAutonym(tag), incomplete: true }
          : null;
      }
      const { translated, untranslated } = splitAndSortEntries(subData);
      const text = serializeLanguageFile({ tag, isSource: false, translated, untranslated, now: new Date() });
      fs.writeFileSync(filePath, text, "utf8");
      tableByTag[tag] = subData;
      tags.push(tag);
      return untranslated.length;
    }

    for (const { tag, filePath } of toBootstrap) {
      const missingCount = bootstrapSubLanguage(tag, filePath);
      reporter.report("bootstrapped", `${colorize("nome", `"${languageFileName(tag)}"`)} is empty: populated on the fly with ${missingCount} keys to translate (null value)`);
    }

    // Lingue precaricate (eager) nel bundle iniziale, importate staticamente. Tutte le altre
    // restano chunk lazy.
    //
    //   dev    -> sempre la sourceLanguage, più le eventuali preloadedLanguages
    //   build  -> le preloadedLanguages se ce ne sono, altrimenti la sourceLanguage
    //
    // In build la sourceLanguage smette di essere obbligatoria perché ogni tabella compilata è
    // ora autonoma: le chiavi non tradotte portano già dentro di sé il testo della sorgente
    // (vedi compileLanguageModule). Chi dichiara `preloadedLanguages: ["en-US"]` e parte da
    // en-US non ha più motivo di spedire anche la tabella italiana: sarebbe una seconda copia
    // degli stessi contenuti.
    //
    // In dev resta sempre inclusa, ed è voluto: è la lingua che si sta scrivendo, quella che
    // cambia a ogni salvataggio, e averla sincrona evita una sospensione a ogni ricarica.
    // L'ordine conta: la prima precaricata è la lingua iniziale di default di
    // <TranslateContainer>, e deve essere la STESSA in dev e in build. Mettendo la
    // sourceLanguage in coda invece che in testa, "la prima precaricata" vale
    // `preloadedLanguages[0] ?? sourceLanguage` in entrambi gli ambienti — altrimenti
    // un'app che non passa `initialLanguage` partirebbe in una lingua durante lo sviluppo
    // e in un'altra una volta pubblicata.
    const explicitPreloads = defs.preloadedLanguages ?? [];
    const requested = !isProduction || explicitPreloads.length === 0
      ? [...explicitPreloads, defs.sourceLanguage]
      : [...explicitPreloads];
    const preloadedTags = [];
    for (const tag of requested) {
      if (preloadedTags.includes(tag)) continue; // dedup (source + eventuali duplicati)
      if (!tags.includes(tag)) {
        const filePath = pathCmd.join(localeDir, languageFileName(tag));
        if (fs.existsSync(filePath)) {
          // File presente ma escluso da "tags" nel giro sopra perché non valido: l'errore
          // è già stato loggato lì. Non va sovrascritto alla cieca (si perderebbe contenuto
          // magari recuperabile), quindi resta ignorata finché non viene corretta a mano.
          reporter.report("preload-invalid", `preloadedLanguages: ${colorize("nome", `"${tag}"`)} is not a valid language file in ${colorize("nome", `"${defs.localeDir}"`)}, ignored`);
          continue;
        }
        // A differenza di una lingua lazy scoperta dal semplice scan della cartella,
        // preloadedLanguages è una dichiarazione esplicita in vite.config.js: se il file
        // manca del tutto non ha senso ignorarla silenziosamente, la creiamo al volo così
        // l'app parte già pronta per essere tradotta invece di dover lanciare un comando a
        // parte prima del primo avvio.
        const missingCount = bootstrapSubLanguage(tag, filePath);
        reporter.report("preload-missing", `preloadedLanguages: ${colorize("nome", `"${tag}"`)} not found in ${colorize("nome", `"${defs.localeDir}"`)}, created on the fly with ${missingCount} keys to translate (null value)`);
      }
      preloadedTags.push(tag);
    }

    // Ogni preloadedLanguages dichiarata era invalida: senza questa rete il bundle resterebbe
    // senza NESSUNA tabella eager, e il primo render sospenderebbe sempre. La sourceLanguage
    // è già stata validata sopra (è la condizione senza la quale il plugin non parte).
    if (preloadedTags.length === 0) {
      console.warn(`[vitetranslate] no valid language in preloadedLanguages: falling back to the source language "${defs.sourceLanguage}"`);
      preloadedTags.push(defs.sourceLanguage);
    }

    // tag -> binding statico, riusato sia negli export delle tabelle sia nel loader "lazy"
    // di quel tag: evita un dynamic import ridondante (finirebbe comunque nel bundle
    // iniziale -> warning INEFFECTIVE_DYNAMIC_IMPORT di Rollup).
    const binding = {};
    preloadedTags.forEach((tag, i) => { binding[tag] = `__vt_pre_${i}`; });

    const eagerImports = preloadedTags.map(
      tag => `import ${binding[tag]} from ${JSON.stringify(pathOf(tag))};`
    );

    // Una voce per lingua, con tutto ciò che il runtime deve sapere. Erano tre mappe parallele
    // (loader, tabelle precaricate, nomi) da tenere allineate a mano; qui una lingua è una
    // riga sola, e `preloaded` viaggia nel bundle come gli altri campi. È ciò che permette di
    // verificare anche IN PRODUZIONE se la lingua iniziale è davvero precaricata: in dev il
    // controllo direbbe sempre di sì, perché lì la sourceLanguage è precaricata comunque.
    //
    //   name      autonimo, calcolato a sync-time e salvato in __builder__ (niente
    //             Intl.DisplayNames lato client). Ricalcolato qui se il file non l'ha ancora.
    //   preloaded importata staticamente: tabella disponibile sincrona, nessuna sospensione
    //   table     presente solo se preloaded, è il binding statico
    //   load      firma unica { default } — Promise già risolta se preloaded, import() se no
    //
    // Le precaricate vengono per prime, nell'ordine in cui il bundle le importa: la prima è la
    // lingua iniziale di default di <TranslateContainer>.
    const lazyTags = tags.filter(tag => !binding[tag]);
    const entries = [...preloadedTags, ...lazyTags].map(tag => {
      const name = JSON.stringify(tableByTag[tag]["__builder__"]?.languageName ?? languageAutonym(tag));
      return binding[tag]
        ? `  ${JSON.stringify(tag)}: { name: ${name}, preloaded: true, table: ${binding[tag]}, load: () => Promise.resolve({ default: ${binding[tag]} }) }`
        : `  ${JSON.stringify(tag)}: { name: ${name}, preloaded: false, load: () => import(${JSON.stringify(pathOf(tag))}) }`;
    });

    // La tabella che il runtime ha SEMPRE sotto mano, senza caricare nulla. Era per forza
    // quella della sourceLanguage; ora che in build la sorgente può non essere precaricata, è
    // la prima delle eager. Il runtime non le chiedeva comunque di essere "la sorgente" — le
    // chiedeva di esserci — e da quando ogni tabella compilata è autonoma una vale l'altra.
    const fallbackTag = preloadedTags[0];

    // Nessun flush qui. Gli avvisi raccolti sopra escono col resto del giro, chiuso dal
    // reporter stesso quando la raffica si esaurisce (vedi devReporter.js): forzarlo alla fine
    // di questa funzione spezzerebbe in due blocchi un caricamento di pagina, perché i
    // transform dei sorgenti girano prima e dopo il `load` del modulo virtuale.

    return (
      `${eagerImports.join("\n")}\n` +
      `export const languages = {\n${entries.join(",\n")}\n};\n` +
      `export const sourceLanguage = ${JSON.stringify(defs.sourceLanguage)};\n` +
      `export const fallbackTable = ${binding[fallbackTag]};\n` +
      `export const errorSolve = ${JSON.stringify(resolvedErrorSolve)};\n` +
      `export const partiallyTranslated = ${JSON.stringify(partiallyTranslated(tableByTag, tags))};\n`
    );
  }

  /**
   * Le chiavi che almeno una lingua del progetto non ha ancora tradotto — l'informazione
   * dietro il prefisso `errorSolve.mark.notFullyTranslated`.
   *
   * È l'unico punto in cui esiste: una tabella compilata sa dire cosa manca a SE STESSA
   * (`__untranslated__`), ma la domanda qui è un'altra — "questo testo è a posto ovunque?" —
   * e per rispondere servono tutte le lingue insieme. Qui ci sono già, lette poco sopra per
   * costruire il manifest, quindi non costa nessun accesso al disco in più.
   *
   * Si parte dalle chiavi della lingua sorgente: sono l'insieme di riferimento, e una chiave
   * che vive solo in una lingua tradotta è un residuo che la prossima sincronizzazione toglie.
   */
  function partiallyTranslated(tableByTag, tags) {
    const keys = {};
    if (!marksNotFullyTranslated()) return keys;

    const others = tags.filter((tag) => tag !== defs.sourceLanguage);
    if (others.length === 0) return keys; // progetto a una lingua sola: non c'è un "altrove"

    for (const key of Object.keys(tableByTag[defs.sourceLanguage])) {
      if (key === "__builder__") continue;
      for (const tag of others) {
        const value = tableByTag[tag][key];
        if (value === null || value === undefined) { keys[key] = 1; break; }
      }
    }
    return keys;
  }

  // Compila i file lingua da tabella di stringhe a modulo di valori già pronti (stringhe,
  // elementi React costruiti una volta sola, funzioni per le voci con segnaposto). Deve
  // essere un plugin a sé e non un ramo del transform qui sotto: quello ha
  // `filter: { code: "_%_" }`, un pre-scarto eseguito in Rust che i file lingua non
  // superano — contengono testo tradotto, non marcatori.
  //
  // Il file su disco non viene mai toccato: resta la tabella di stringhe che il traduttore
  // edita e che il comando di sincronizzazione scrive. La compilazione vive solo nel grafo
  // dei moduli del bundler, quindi il lato Node (readLanguageFile -> logica di sync)
  // continua a leggere le stringhe di cui ha bisogno.
  const localeCompiler = {
    name: "vitetranslate:compile-locale",
    enforce: "pre",
    transform: {
      filter: { id: localeFileRe(localeDirPosix) },
      handler(code, id) {
        const filePath = id.replace(/\\/g, "/").split("?")[0];
        if (!filePath.startsWith(`${localeDirPosix}/`) || !isLanguageFileName(filePath)) return null;

        // Registrato qui, che è il solo punto da cui un modulo di lingua può entrare nel grafo:
        // l'insieme è completo per costruzione, e serve al watcher per invalidarli senza
        // scandire tutto il grafo (vedi localeModuleIds).
        localeModuleIds.add(id);

        // Il contenuto arriva già letto da Vite: la tabella si ricava da lì, senza tornare sul
        // disco. Il parse è sincrono e non lascia niente dietro di sé — era il ripiego su
        // `import()` la voce che, a ogni salvataggio di un file lingua in una sessione di dev,
        // lasciava un modulo irrecuperabile nella cache ESM di Node.
        let table;
        try {
          table = readLanguageFile(filePath, code);
        } catch (error) {
          reporter.report("invalid-language-file", `${colorize("nome", `"${pathCmd.basename(filePath)}"`)} is not a valid language file, left as is: ${error.message}`);
          return null;
        }
        // File vuoto: è la lingua nuova che generateLanguagesModule sta per popolare, non c'è
        // ancora niente da compilare.
        if (table === undefined) {
          reporter.report("empty-language-file", `${colorize("nome", `"${pathCmd.basename(filePath)}"`)} is empty, left as is`);
          return null;
        }

        const tag = tagFromFileName(pathCmd.basename(filePath));

        // Tabella sorgente, per riempire le chiavi non ancora tradotte: è ciò che rende il
        // modulo prodotto autonomo (vedi compileLanguageModule). Per la lingua sorgente stessa
        // non serve — sarebbe il fallback di se stessa.
        let sourceTable = null;
        if (tag !== defs.sourceLanguage) {
          const sourcePath = `${localeDirPosix}/${languageFileName(defs.sourceLanguage)}`;
          // Il modulo compilato dipende ora anche dal file della lingua sorgente: dichiararlo
          // fa sì che una sua modifica invalidi questo modulo, invece di lasciarlo servire da
          // una cache che non sa di essere scaduta.
          this.addWatchFile?.(sourcePath);
          try {
            sourceTable = readLanguageFile(sourcePath) ?? null;
          } catch (error) {
            // Senza sorgente si compila comunque: i null restano, e la catena di runtime
            // continua a coprirli come prima.
            reporter.report("source-unreadable", `${colorize("nome", `"${languageFileName(defs.sourceLanguage)}"`)} not readable, ${colorize("nome", `"${tag}"`)} compiled without embedded fallback: ${error.message}`);
          }
        }

        // Nessuna sourcemap: il modulo emesso non ha più corrispondenza riga-a-riga con il
        // file su disco, ed è codice generato che nessuno debugga a quel livello.
        //
        // `emitUntranslated` solo per le lingue diverse dalla sorgente: lì una voce non
        // tradotta non esiste per definizione, ed è la lingua in cui il testo è scritto.
        return {
          code: compileLanguageModule(table, tag, sourceTable, {
            missingArg: resolvedErrorSolve.absentDataInArray,
            emitUntranslated: marksUntranslated() && tag !== defs.sourceLanguage,
            // Stesso raccoglitore dei marcatori (vedi "warn" nel transform qui sopra): senza
            // questo canale i tag incrociati stampavano per conto loro, fuori dalla colonna e
            // senza il conteggio/dedup che ha tutto il resto — vedi devReporter.js.
            warn: (msg, kind) => reporter.report(kind ?? "mis-nested-markup", msg),
          }),
          map: null,
          // Il file su disco non è più un .js: su Rolldown/Vite 8 il tipo del modulo si
          // dedurrebbe dall'estensione dell'id, ed è quella del file di lingua, non quella di
          // ciò che stiamo restituendo. Dichiararlo toglie di mezzo la deduzione. Ignorato su
          // Rollup/Vite 7 (proprietà extra non riconosciuta).
          moduleType: "js",
        };
      },
    },
  };

  const plugin = {
    name: "vitetranslate",
    // esposta così com'è (con baseDir/srcDir già risolti) per il comando standalone
    // "vtranslate-cli": legge la config direttamente
    // da qui invece di richiedere un file di config separato da mantenere in sync.
    // srcDir di default "src": la convenzione quasi universale nei progetti Vite.
    vitetranslateConfig: { ...defs, baseDir, srcDir: defs.srcDir ?? "src", simpleLog },
    // Gira prima del plugin React del progetto, così è l'estrazione a vedere il JSX
    // originale. Il marcatore compilato contiene un "<" letterale, che in un nodo di testo
    // JSX non sarebbe sintassi valida: per questo l'estrazione lo emette sempre dentro
    // un'espressione ({"..."}), lasciando il JSX intatto per chi viene dopo.
    enforce: "pre",
    // Il runtime importa `virtual:vitetranslate/languages`, che esiste solo attraverso
    // questo plugin: esbuild, che pre-bundla le dipendenze in un processo tutto suo, non lo
    // può risolvere e su Vite <= 7 il dev server muore in partenza con
    // "Could not resolve virtual:vitetranslate/languages". Non si vede finché la libreria è
    // linkata (`file:`/`npm link`): i pacchetti linkati non vengono pre-bundlati. Si vede
    // eccome appena la si installa da npm — cioè su ogni progetto vero.
    // L'esclusione la dichiara il plugin, non il consumer: è una conseguenza di come è fatta
    // la libreria, non una scelta di chi la usa. Il prefisso copre anche il sottopercorso
    // "/react", che è poi l'unico che finisce nel grafo del browser.
    config() {
      return { optimizeDeps: { exclude: ["@sepoina/vitetranslate"] } };
    },
    configResolved(resolvedConfig) {
      isProduction = !!resolvedConfig.isProduction;
      resolvedErrorSolve = resolveErrorSolve(errorSolveOptions, isProduction);
      if (defs.includeFallback === undefined) includeFallback = !isProduction;
      // In dev la sourcemap serve sempre; in build solo se la build stessa le vuole.
      emitSourceMaps = !isProduction || !!resolvedConfig.build?.sourcemap;
      if (resolvedConfig.configFile) viteConfigFile = pathCmd.basename(resolvedConfig.configFile);
    },
    //
    // compila _%_..._%_ e <Translate> via Babel in un unico passaggio
    //
    // "filter" pre-scarta in Rust i file senza il marcatore su Rolldown/Rollup>=4.38/Vite>=6.3
    // (ignorato sui bundler più vecchi); il guard imperativo in handler resta la fonte di
    // verità e copre anche quei bundler più vecchi.
    transform: {
      filter: { code: "_%_" },
      handler(code, id) {
        if (!/\.[jt]sx?$/.test(id)) return null;
        if (id.includes("node_modules")) return null;
        // Copre il caso symlink (vedi OWN_LIB_DIR sopra): il runtime compilato del pacchetto
        // stesso (lib/dist/*, lib/react/*) contiene "_%_" come stringa letterale — i
        // delimitatori, definiti come costanti in errorSolve.js/interpolate.js — e senza
        // questo guard veniva scansionato come sorgente utente, producendo falsi "malformed
        // marker" per un testo che non è mai passato da Babel/JSX.
        if (OWN_LIB_DIR && id.replace(/\\/g, "/").startsWith(`${OWN_LIB_DIR}/`)) return null;
        // I file lingua sono dati, non sorgente da compilare: anche se una stringa tradotta
        // contenesse "_%_" per coincidenza non deve finire nella pipeline Babel. Dalla 4.0
        // non sono più .js e il guard sull'estensione qui sopra basterebbe: questo copre i
        // residui di un progetto non ancora migrato, che altrimenti verrebbero scansionati.
        if (id.replace(/\\/g, "/").startsWith(`${localeDirPosix}/`)) return null;
        if (!code.includes("_%_")) return null;
        // Un file che non si riesce a parsare non deve far fallire la build a causa
        // *nostra*: se è davvero rotto lo segnalerà il transform successivo, con un
        // messaggio pertinente al suo linguaggio. Qui si lascia passare invariato,
        // avvisando che le sue stringhe marcate non sono state estratte.
        try {
          // Parse + splice, non un transform completo: il codice non marcato esce
          // esattamente com'era entrato. Vedi extractMarkers.js per il perché.
          return extractMarkers(code, {
            filename: id,
            table: {},
            includeFallback,
            sourceMaps: emitSourceMaps,
            baseDir,
            // Annidati, collisioni e marcatori malformati entrano nel raccoglitore come tutto
            // il resto (vedi devReporter.js): senza questo canale stampano per conto loro, e
            // sono i più ripetitivi di tutti (uno per file, a ogni salvataggio).
            warn: (msg, kind) => reporter.report(kind, msg),
          });
        } catch (error) {
          reporter.report("parse-failed", `${colorize("nome", `"${id}"`)} could not be parsed, markers not extracted: ${error.message}`);
          return null;
        }
      },
    },
    //
    // modulo virtuale: elenco lingue trovate in localeDir, ciascuna caricabile
    // pigramente via import() -> Rollup/Vite ne fa un chunk separato per lingua
    //
    resolveId(id) {
      if (id === VIRTUAL_LANGUAGES_ID) return RESOLVED_VIRTUAL_LANGUAGES_ID;
    },
    async load(id) {
      if (id === RESOLVED_VIRTUAL_LANGUAGES_ID) {
        // La rete: il setup è già stato segnalato e il processo sta per morire (vedi
        // configureServer). Se load() viene comunque richiamato nel frattempo — più moduli in
        // coda nello stesso giro — non deve produrre un secondo o un terzo errore.
        if (setupFallito) return;
        // moduleType: 'js' forza l'interpretazione JS su Rolldown/Vite 8, dove il tipo
        // sarebbe altrimenti dedotto dall'estensione dell'id (qui assente, essendo virtuale).
        // Ignorato su Rollup/Vite 7 (proprietà extra non riconosciuta).
        return { code: await generateLanguagesModule(), moduleType: "js" };
      }
    },
    // build: stesso controllo di configureServer (vedi sotto), ma un throw è già la cosa
    // giusta qui — la build fallisce con codice non zero, e uccidere il processo toglierebbe
    // a Vite la possibilità di stampare il proprio riepilogo.
    buildStart() {
      // In dev il problema è già stato detto — per esteso, nella colonna del log — e il
      // processo sta uscendo: rilanciarlo da qui sostituirebbe quel blocco con lo stack trace
      // di un hook di Vite, che è la forma peggiore della stessa notizia.
      if (setupFallito) return;
      const result = checkSetup({ localeDir, localeDirLabel: defs.localeDir, sourceLanguage: defs.sourceLanguage });
      if (result.ok) return;
      // Mai colorato: un Error lanciato può finire in un log che non interpreta gli ANSI.
      const { problem, fixCommand, fixText } = setupErrorText(result, { localeDirLabel: defs.localeDir, sourceLanguage: defs.sourceLanguage });
      throw new Error(`[vitetranslate] ${problem} ${fixCommand ?? fixText}`);
    },
    // In build il giro ha una fine dichiarata, e conviene usarla: un flush qui è sincrono con
    // il resto dell'output di Vite, invece di arrivare dopo, a timer scaduto.
    buildEnd() {
      reporter.flush();
    },
    //
    // dev: rigenera il modulo virtuale non appena un file lingua viene aggiunto/rimosso
    //
    async configureServer(server) {
      // Un controllo unico, eseguito PRIMA che il server cominci a servire — non alla prima
      // richiesta del browser (vedi uty/checkSetup.js): altrimenti il server parte, dice di
      // essere pronto, e il primo errore vero arriva come fallimento di un modulo, uno per
      // ogni richiesta successiva.
      const result = checkSetup({ localeDir, localeDirLabel: defs.localeDir, sourceLanguage: defs.sourceLanguage });
      if (!result.ok) {
        setupFallito = true;
        // I valori variabili dentro la frase si evidenziano con lo stesso stile del codice di
        // lingua in --status: non è un'etichetta (non dice quale parte del comando parla), è
        // un dato dentro il testo.
        const ev = (s) => colorize("nome", s);
        const { problem, fixIntro, fixCommand, fixText } = setupErrorText(
          result, { localeDirLabel: defs.localeDir, sourceLanguage: defs.sourceLanguage }, ev
        );
        logError(problem);
        // Dove si trovavano le tabelle l'ultima volta che una sessione le ha viste: utile
        // anche quando non è la stessa localeDir di adesso — è la prima cosa a controllare se
        // la cartella "giusta" è un'altra e vite.config sta puntando altrove per sbaglio.
        const sessione = readSession(baseDir);
        if (sessione?.localeDir) {
          logEchoColored("", `previous yml tables position is: ${ev(`"${sessione.localeDir}"`)}`);
        }
        logEchoColored("", viteConfigFile
          ? `your sourceLanguage in ${ev(`"${viteConfigFile}"`)} is ${ev(`"${defs.sourceLanguage}"`)}`
          : `your sourceLanguage is ${ev(`"${defs.sourceLanguage}"`)}`);
        if (fixCommand) {
          logEchoColored("", fixIntro);
          logEchoColored("", colorize("ok", fixCommand));
        } else {
          logEchoColored("", fixText);
        }
        logEchoColored("", "");
        // Un throw da configureServer non basta: su Vite viene riportato come errore di
        // plugin e in più di una versione il processo resta vivo. Nemmeno chiudere il server e
        // lasciar morire il loop basta: `buildStart` gira DOPO (Vite lo chiama da
        // `httpServer.listen`), e senza l'uscita di qui il suo throw coprirebbe il blocco
        // appena stampato con uno stack trace — il guard su `setupFallito` lì lo evita, ma
        // resterebbe comunque un server che ha cominciato ad ascoltare su un progetto che non
        // può funzionare. Quindi si esce, davvero.
        await server.close();
        // Prima di uscire, però, si aspetta che stdout si svuoti: su una pipe (un log di CI,
        // un `| tee`) la scrittura è asincrona, e `process.exit` taglierebbe esattamente il
        // messaggio per cui questo controllo esiste. Il timeout è la via d'uscita nel caso in
        // cui a valle non legga nessuno.
        await scaricaStdout();
        process.exitCode = 1;
        process.exit(1);
        return;
      }
      writeSession(baseDir, { localeDir: defs.localeDir, sourceLanguage: defs.sourceLanguage });

      server.watcher.add(localeDir);

      // Solo i file di lingua diretti dentro localeDir. Senza il filtro sull'estensione anche
      // i backup che il comando di sync lascia lì accanto (".bak-corrupted-*",
      // ".bak-erased-*", ".bak-migrated-*") facevano ricaricare la pagina.
      const isLanguageFile = (file) =>
        pathCmd.dirname(file) === localeDir && isLanguageFileName(file);

      // Il contenuto del modulo virtuale dipende dall'INSIEME dei file lingua e dal nome di
      // ciascuna lingua, non dalle traduzioni: rigenerarlo (cioè rileggere tutte le lingue)
      // a ogni modifica di testo era lavoro buttato.
      const invalidateManifestModule = () => {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_LANGUAGES_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      const invalidateManifest = (file) => {
        if (!isLanguageFile(file)) return;
        invalidateManifestModule();
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", invalidateManifest);
      server.watcher.on("unlink", invalidateManifest);

      // Modifica di contenuto: il manifest resta valido, ma ricaricare serve comunque. Le
      // tabelle vivono in una cache a livello di modulo lato client (react/languageResource.js),
      // che un semplice hot update del modulo di lingua non svuoterebbe: la pagina
      // continuerebbe a mostrare la traduzione vecchia. Copre anche il file corretto a mano
      // dopo essere stato segnalato come non valido.
      server.watcher.on("change", (file) => {
        if (!isLanguageFile(file)) return;

        // `🔹` dice quali chiavi restano non tradotte in QUALCHE lingua: è un insieme calcolato
        // leggendole tutte, e tradurne una lo cambia. Il manifest va quindi rigenerato anche
        // quando cambia solo il contenuto di un file — che è l'eccezione alla regola qui
        // sopra, e vale solo con quel prefisso acceso. Spento (ogni build di produzione con i
        // default) la rilettura non avviene e la regola resta quella di prima.
        if (marksNotFullyTranslated()) invalidateManifestModule();

        // Ogni lingua incorpora il testo della sorgente per le chiavi non ancora tradotte,
        // quindi una modifica alla sorgente rende stantii TUTTI gli altri moduli compilati,
        // non solo il proprio. Vite non può dedurlo dal grafo — quel testo entra nel modulo
        // durante il transform, non attraverso un import — e senza questa invalidazione la
        // pagina ricaricata continuerebbe a ricevere i moduli compilati prima della modifica.
        if (tagFromFileName(pathCmd.basename(file)) === defs.sourceLanguage) {
          for (const id of localeModuleIds) {
            const mod = server.moduleGraph.getModuleById(id);
            // Sparito dal grafo (file rimosso, grafo ricostruito): la voce non serve più.
            if (mod) server.moduleGraph.invalidateModule(mod);
            else localeModuleIds.delete(id);
          }
        }

        server.ws.send({ type: "full-reload" });
      });
    },
  };

  // cli.js cerca il plugin per nome dopo un flat(Infinity), quindi l'array non lo disturba.
  return [localeCompiler, plugin];
}

// I file lingua sono quelli diretti dentro localeDir (niente sottocartelle: è la stessa
// convenzione con cui il plugin li scopre). Serve come pre-filtro del transform; il controllo
// imperativo nell'handler resta la fonte di verità, come per l'altro transform.
function localeFileRe(dirPosix) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escape(dirPosix)}/[^/]+${escape(LANG_EXT)}(\\?|$)`);
}
