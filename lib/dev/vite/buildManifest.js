// Architettura d'insieme: doc/structure.md § "Fase 3 — Il modulo virtuale e il code splitting".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import pathCmd from "path";
import fs from "fs";
import readLanguageFile, { readLanguageText } from "./uty/readLanguageFile.js";
import listLanguageFiles from "./uty/listLanguageFiles.js";
import writeLanguageFileIfChanged from "./uty/writeLanguageFile.js";
import languageAutonym from "./uty/languageAutonym.js";
import { languageFileName, tagFromFileName } from "./uty/languageFileFormat.js";
import { hash } from "../babel/markerCore.js";
import { CLI_NAME } from "./uty/cliName.js";
import { colorize } from "../../utility.js";
import { toPosix } from "./uty/posix.js";

// File vuoto = lingua nuova da inizializzare, e va tenuto distinto da qualunque altro motivo
// per cui una tabella non si legge. Un file con del contenuto ma nessuna voce NON rientra qui:
// è una lingua svuotata, e parseLanguageFile la segnala come errore apposta.
const EMPTY_FILE = "empty file";

/**
 * @param {object} p
 * @param {object} p.defs - le opzioni del plugin così come le ha scritte l'utente
 * @param {string} p.localeDir - percorso assoluto già risolto
 * @param {object} p.reporter - il raccoglitore di avvisi (vedi uty/devReporter.js)
 * @param {() => { isProduction: boolean, errorSolve: object }} p.leggiStato - lo stato che si
 *   risolve solo in configResolved. Una funzione e non due valori: `generate` gira dopo
 *   `configResolved`, ma la fabbrica viene chiamata prima, e catturare i valori adesso
 *   vorrebbe dire catturare quelli provvisori.
 * @returns {{ generate: () => Promise<string> }}
 */
export default function creaManifest({ defs, localeDir, reporter, leggiStato }) {
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

    const { table } = readLanguageFile(filePath, code);
    // Un file vuoto (`undefined`) non si mette in cache: è la lingua da inizializzare, e il
    // bootstrap sta per riscriverlo — la prossima lettura avrà comunque un contenuto diverso.
    if (table !== undefined) manifestTables.set(filePath, { digest, table });
    return table;
  }

  async function generate() {
    const { isProduction, errorSolve } = leggiStato();

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
    const pathOf = tag => toPosix(pathCmd.join(localeDir, languageFileName(tag)));

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
        subData[key] = null;
      }
      const { untranslated } = writeLanguageFileIfChanged({
        filePath, tag, isSource: false, table: subData,
      });
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
    //   name      autonimo, calcolato qui con Intl.DisplayNames (vedi languageAutonym).
    //   preloaded importata staticamente: tabella disponibile sincrona, nessuna sospensione
    //   table     presente solo se preloaded, è il binding statico
    //   load      firma unica { default } — Promise già risolta se preloaded, import() se no
    //
    // Le precaricate vengono per prime, nell'ordine in cui il bundle le importa: la prima è la
    // lingua iniziale di default di <TranslateContainer>.
    const lazyTags = tags.filter(tag => !binding[tag]);
    const entries = [...preloadedTags, ...lazyTags].map(tag => {
      const name = JSON.stringify(languageAutonym(tag));
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
      `export const errorSolve = ${JSON.stringify(errorSolve)};\n` +
      `export const partiallyTranslated = ${JSON.stringify(partiallyTranslated(tableByTag, tags, errorSolve))};\n`
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
  function partiallyTranslated(tableByTag, tags, errorSolve) {
    const keys = {};
    if (errorSolve.notFullyTranslated === "") return keys;

    const others = tags.filter((tag) => tag !== defs.sourceLanguage);
    if (others.length === 0) return keys; // progetto a una lingua sola: non c'è un "altrove"

    for (const key of Object.keys(tableByTag[defs.sourceLanguage])) {
      for (const tag of others) {
        const value = tableByTag[tag][key];
        if (value === null || value === undefined) { keys[key] = 1; break; }
      }
    }
    return keys;
  }

  return { generate };
}
