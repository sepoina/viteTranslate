// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione" e § "Fase 3 — Il modulo virtuale e il code splitting".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 3, 4 e 5.

import pathCmd from "path";
import fs from "fs";
import extractMarkers from "../babel/extractMarkers.js";
import importLanguageModule from "./uty/importLanguageModule.js";
import readLanguageTable, { normalizeBuilder } from "./uty/readLanguageTable.js";
import splitAndSortEntries from "./uty/splitAndSortEntries.js";
import serializeLanguageModule from "./uty/serializeLanguageModule.js";
import languageAutonym from "./uty/languageAutonym.js";
import { compileLanguageModule } from "../compile/compileTable.js";
import { hash } from "../babel/markerCore.js";
import { normalizeErrorSolve, resolveErrorSolve } from "../../errorSolve.js";

export const VIRTUAL_LANGUAGES_ID = "virtual:vitetranslate/languages";
const RESOLVED_VIRTUAL_LANGUAGES_ID = "\0" + VIRTUAL_LANGUAGES_ID;

// La sincronizzazione dei moduli di lingua NON avviene più qui: la fa il comando
// standalone "vitetranslate-prepare-translation-table" (vedi cli.js), da
// lanciare come "prebuild" prima di "vite build" — così quando questo plugin
// espone il virtual module, i file su disco sono già aggiornati, senza dover
// dipendere dall'ordine con cui Rollup processa i propri hook in una singola build.
export default function vitetranslate(defs) {
  // Fail fast su config incompleta: senza queste due opzioni il plugin finirebbe per
  // costruire percorsi come "undefined.js" invece di segnalare l'errore subito.
  if (typeof defs?.localeDir !== "string" || !defs.localeDir) {
    throw new Error('[vitetranslate] option "localeDir" is missing or invalid: it must be a non-empty string (e.g. "src/locale").');
  }
  if (typeof defs?.sourceLanguage !== "string" || !defs.sourceLanguage) {
    throw new Error('[vitetranslate] option "sourceLanguage" is missing or invalid: it must be a non-empty string holding the BCP 47 tag of the source language (e.g. "it-IT").');
  }
  const baseDir = defs.baseDir ?? process.cwd();
  const localeDir = pathCmd.join(baseDir, defs.localeDir);
  // Normalizzato a "/" per confrontarlo con gli id (posix-style) che Vite passa al transform.
  const localeDirPosix = localeDir.replace(/\\/g, "/");
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
  // Diagnostica a schermo e in console. Le opzioni dell'utente si completano e si controllano
  // subito (un refuso va detto adesso, non alla prima build); la risoluzione contro l'ambiente
  // aspetta configResolved, come includeFallback. `resolvedErrorSolve` è ciò che finisce nel
  // modulo virtuale: valori già decisi, così il runtime non deve interpretare nulla.
  const errorSolveOptions = normalizeErrorSolve(defs?.errorSolve);
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
  // Con `∴` acceso — il default in sviluppo — il manifest si rigenera a ogni salvataggio di
  // QUALUNQUE file di lingua, perché l'insieme delle chiavi non tradotte altrove cambia
  // traducendone una sola. Senza cache ogni salvataggio rilegge e rivaluta tutte le lingue per
  // ricalcolare un insieme che si muove di una chiave.
  //
  // La chiave è il contenuto e non l'mtime, per la ragione già documentata in
  // importLanguageModule.js: la granularità del timestamp è grossolana, e due contenuti scritti
  // dentro lo stesso tick condividerebbero la chiave — cioè si servirebbe una tabella stantia
  // proprio nel momento in cui il traduttore ha appena salvato. Il file va letto comunque per
  // calcolare l'hash; quello che si risparmia è la valutazione, che è la parte cara.
  //
  // Le tabelle qui dentro sono di sola lettura per chi le riceve: `generateLanguagesModule` le
  // legge e basta, e `bootstrapSubLanguage` sostituisce la voce invece di mutarla. Il resto
  // della libreria (la sync, che le muta) passa da `importLanguageModule` e non da qui.
  const manifestTables = new Map();

  async function readTableForManifest(filePath) {
    const code = fs.readFileSync(filePath, "utf8");
    const digest = hash(code);
    const cached = manifestTables.get(filePath);
    if (cached !== undefined && cached.digest === digest) return cached.table;

    const table = await importLanguageModule(filePath, code);
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
    fs.mkdirSync(localeDir, { recursive: true });
    const files = fs.readdirSync(localeDir).filter(f => f.endsWith(".js"));
    const pathOf = tag => pathCmd.join(localeDir, `${tag}.js`).replace(/\\/g, "/");

    // Un file .js presente ma non valido (sintassi rotta, o senza default export) non deve
    // né far esplodere la build (se è la sourceLanguage o una preloadedLanguage, verrebbe
    // importato staticamente) né restare un chunk lazy silenziosamente rotto: viene escluso
    // qui, con un avviso chiaro, invece di lasciare che l'errore emerga più tardi come uno
    // stack trace opaco di Rollup/esbuild o come un errore di fetch nel browser.
    const tags = [];
    const tableByTag = {};
    // File presenti ma senza default export (tipicamente un file creato vuoto a mano, come
    // suggerito nei testi della lingua sorgente per aggiungere una lingua nuova senza dover
    // scrivere "export default {}"): non sono un errore, sono la lingua nuova stessa. Vanno
    // popolati sotto, non appena la sourceTable è nota — prima non c'è nulla da scriverci.
    const toBootstrap = [];
    for (const f of files) {
      const tag = f.replace(/\.js$/, "");
      try {
        const table = await readTableForManifest(pathCmd.join(localeDir, f));
        if (!table) throw new Error("no default export");
        tableByTag[tag] = table;
        tags.push(tag);
      } catch (e) {
        if (e.message === "no default export" && tag !== defs.sourceLanguage) {
          toBootstrap.push({ tag, filePath: pathCmd.join(localeDir, f) });
          continue;
        }
        console.error(`[vitetranslate] "${f}" is not a valid language module (${e.message}): language "${tag}" ignored until it is fixed.`);
      }
    }

    if (!tags.includes(defs.sourceLanguage)) {
      throw new Error(
        `[vitetranslate] sourceLanguage "${defs.sourceLanguage}" not found (missing file or invalid module) in "${defs.localeDir}". ` +
        `Check that "${defs.sourceLanguage}.js" exists and is a valid module: it is the universal fallback, without it the app cannot work.`
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
      const jsText = serializeLanguageModule({ tag, isSource: false, translated, untranslated, now: new Date() });
      fs.writeFileSync(filePath, jsText, "utf8");
      tableByTag[tag] = subData;
      tags.push(tag);
      return untranslated.length;
    }

    for (const { tag, filePath } of toBootstrap) {
      const missingCount = bootstrapSubLanguage(tag, filePath);
      console.warn(`[vitetranslate] "${tag}.js" is empty: populated on the fly with ${missingCount} keys to translate (null value)`);
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
        const filePath = pathCmd.join(localeDir, `${tag}.js`);
        if (fs.existsSync(filePath)) {
          // File presente ma escluso da "tags" nel giro sopra perché non valido: l'errore
          // è già stato loggato lì. Non va sovrascritto alla cieca (si perderebbe contenuto
          // magari recuperabile), quindi resta ignorata finché non viene corretta a mano.
          console.warn(`[vitetranslate] preloadedLanguages: "${tag}" is not a valid language module in "${defs.localeDir}", ignored`);
          continue;
        }
        // A differenza di una lingua lazy scoperta dal semplice scan della cartella,
        // preloadedLanguages è una dichiarazione esplicita in vite.config.js: se il file
        // manca del tutto non ha senso ignorarla silenziosamente, la creiamo al volo così
        // l'app parte già pronta per essere tradotta invece di dover lanciare un comando a
        // parte prima del primo avvio.
        const missingCount = bootstrapSubLanguage(tag, filePath);
        console.warn(`[vitetranslate] preloadedLanguages: "${tag}" not found in "${defs.localeDir}", created on the fly with ${missingCount} keys to translate (null value)`);
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
   * dietro il prefisso `errorSolve.beginCharNotFullyTranslated`.
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
  // dei moduli del bundler, quindi il lato Node (importLanguageModule -> logica di sync)
  // continua a leggere le stringhe di cui ha bisogno.
  const localeCompiler = {
    name: "vitetranslate:compile-locale",
    enforce: "pre",
    transform: {
      filter: { id: localeFileRe(localeDirPosix) },
      async handler(code, id) {
        const filePath = id.replace(/\\/g, "/").split("?")[0];
        if (!filePath.startsWith(`${localeDirPosix}/`) || !filePath.endsWith(".js")) return null;

        // Registrato qui, che è il solo punto da cui un modulo di lingua può entrare nel grafo:
        // l'insieme è completo per costruzione, e serve al watcher per invalidarli senza
        // scandire tutto il grafo (vedi localeModuleIds).
        localeModuleIds.add(id);

        // Il sorgente arriva già letto da Vite: la tabella si ricava da lì, senza tornare sul
        // disco e senza `import()`. Quest'ultimo era la voce che, a ogni salvataggio di un
        // file lingua in una sessione di dev, lasciava un modulo irrecuperabile nella cache
        // ESM di Node (vedi readLanguageTable.js).
        let table = readLanguageTable(code, filePath);
        if (table === undefined) {
          // Forma non piatta (o file rotto): si ricade sul caricamento vero, che sa dire
          // perché.
          try {
            table = await importLanguageModule(filePath);
          } catch (error) {
            console.warn(`[vitetranslate] "${pathCmd.basename(filePath)}" could not be imported, left as is: ${error.message}`);
            return null;
          }
        } else {
          normalizeBuilder(table);
        }
        if (table === null || typeof table !== "object" || Array.isArray(table)) {
          console.warn(`[vitetranslate] "${pathCmd.basename(filePath)}" does not export a table: left as is`);
          return null;
        }

        const tag = pathCmd.basename(filePath, ".js");

        // Tabella sorgente, per riempire le chiavi non ancora tradotte: è ciò che rende il
        // modulo prodotto autonomo (vedi compileLanguageModule). Per la lingua sorgente stessa
        // non serve — sarebbe il fallback di se stessa.
        let sourceTable = null;
        if (tag !== defs.sourceLanguage) {
          const sourcePath = `${localeDirPosix}/${defs.sourceLanguage}.js`;
          // Il modulo compilato dipende ora anche dal file della lingua sorgente: dichiararlo
          // fa sì che una sua modifica invalidi questo modulo, invece di lasciarlo servire da
          // una cache che non sa di essere scaduta.
          this.addWatchFile?.(sourcePath);
          try {
            sourceTable = readLanguageTable(fs.readFileSync(sourcePath, "utf8"), sourcePath)
              ?? await importLanguageModule(sourcePath);
          } catch (error) {
            // Senza sorgente si compila comunque: i null restano, e la catena di runtime
            // continua a coprirli come prima.
            console.warn(`[vitetranslate] "${defs.sourceLanguage}.js" not readable, "${tag}" compiled without embedded fallback: ${error.message}`);
          }
        }

        // Nessuna sourcemap: il modulo emesso non ha più corrispondenza riga-a-riga con il
        // file su disco, ed è codice generato che nessuno debugga a quel livello.
        //
        // `emitUntranslated` solo per le lingue diverse dalla sorgente: lì una voce non
        // tradotta non esiste per definizione, ed è la lingua in cui il testo è scritto.
        return {
          code: compileLanguageModule(table, tag, sourceTable, {
            missingArg: resolvedErrorSolve.noArg,
            emitUntranslated: marksUntranslated() && tag !== defs.sourceLanguage,
          }),
          map: null,
        };
      },
    },
  };

  const plugin = {
    name: "vitetranslate",
    // esposta così com'è (con baseDir/srcDir già risolti) per il comando standalone
    // "vitetranslate-prepare-translation-table": legge la config direttamente
    // da qui invece di richiedere un file di config separato da mantenere in sync.
    // srcDir di default "src": la convenzione quasi universale nei progetti Vite.
    vitetranslateConfig: { ...defs, baseDir, srcDir: defs.srcDir ?? "src" },
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
        // I file lingua generati sono .js e vivono sotto localeDir: sono dati, non
        // sorgente da compilare — anche se una stringa tradotta contenesse "_%_" per
        // coincidenza non deve finire nella pipeline Babel.
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
          });
        } catch (error) {
          console.warn(`[vitetranslate] "${id}" could not be parsed, markers not extracted: ${error.message}`);
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
        // moduleType: 'js' forza l'interpretazione JS su Rolldown/Vite 8, dove il tipo
        // sarebbe altrimenti dedotto dall'estensione dell'id (qui assente, essendo virtuale).
        // Ignorato su Rollup/Vite 7 (proprietà extra non riconosciuta).
        return { code: await generateLanguagesModule(), moduleType: "js" };
      }
    },
    //
    // dev: rigenera il modulo virtuale non appena un file lingua viene aggiunto/rimosso
    //
    configureServer(server) {
      server.watcher.add(localeDir);

      // Solo i .js diretti dentro localeDir sono file lingua. Senza il filtro
      // sull'estensione anche i backup che il comando di sync lascia lì accanto
      // (".bak-corrupted-*", ".bak-erased-*") facevano ricaricare la pagina.
      const isLanguageFile = (file) =>
        pathCmd.dirname(file) === localeDir && file.endsWith(".js");

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

        // `∴` dice quali chiavi restano non tradotte in QUALCHE lingua: è un insieme calcolato
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
        if (pathCmd.basename(file, ".js") === defs.sourceLanguage) {
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

// I file lingua sono i .js diretti dentro localeDir (niente sottocartelle: è la stessa
// convenzione con cui il plugin li scopre). Serve come pre-filtro del transform; il controllo
// imperativo nell'handler resta la fonte di verità, come per l'altro transform.
function localeFileRe(dirPosix) {
  const escaped = dirPosix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}/[^/]+\\.js(\\?|$)`);
}
