import pathCmd from "path";
import fs from "fs";
import { transformSync } from "@babel/core";
import babelTranslate from "../babel/babelTranslate_2.js";
import importLanguageModule from "./uty/importLanguageModule.js";
import splitAndSortEntries from "./uty/splitAndSortEntries.js";
import serializeLanguageModule from "./uty/serializeLanguageModule.js";
import languageAutonym from "./uty/languageAutonym.js";
import { compileLanguageModule } from "../compile/compileTable.js";

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
    throw new Error('[vitetranslate] opzione "localeDir" mancante o non valida: deve essere una stringa non vuota (es. "src/locale").');
  }
  if (typeof defs?.sourceLanguage !== "string" || !defs.sourceLanguage) {
    throw new Error('[vitetranslate] opzione "sourceLanguage" mancante o non valida: deve essere una stringa non vuota col tag BCP 47 della lingua sorgente (es. "it-IT").');
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
        const table = await importLanguageModule(pathCmd.join(localeDir, f));
        if (!table) throw new Error("nessun default export");
        tableByTag[tag] = table;
        tags.push(tag);
      } catch (e) {
        if (e.message === "nessun default export" && tag !== defs.sourceLanguage) {
          toBootstrap.push({ tag, filePath: pathCmd.join(localeDir, f) });
          continue;
        }
        console.error(`[vitetranslate] "${f}" non è un modulo lingua valido (${e.message}): lingua "${tag}" ignorata finché non viene corretta.`);
      }
    }

    if (!tags.includes(defs.sourceLanguage)) {
      throw new Error(
        `[vitetranslate] sourceLanguage "${defs.sourceLanguage}" non trovata (file assente o modulo non valido) in "${defs.localeDir}". ` +
        `Verifica che "${defs.sourceLanguage}.js" esista e sia un modulo valido: è il fallback universale, senza di essa l'app non può funzionare.`
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
      console.warn(`[vitetranslate] "${tag}.js" è vuoto: popolato al volo con ${missingCount} chiavi da tradurre (valore null)`);
    }

    // Lingue precaricate (eager) nel bundle iniziale, importate staticamente. La
    // sourceLanguage è SEMPRE inclusa: serve come fallback universale a runtime (in
    // produzione il fallback non è più embeddato nel marcatore compilato, quindi senza
    // di essa la chiave grezza resterebbe visibile). Le altre, elencate nell'opzione
    // opzionale `preloadedLanguages`, servono a evitare il flash quando il prop `initialLanguage`
    // è una di esse: la tabella è disponibile sincrona al primo render, senza il
    // caricamento async post-paint. Tutte le lingue non precaricate restano chunk lazy.
    const requested = [defs.sourceLanguage, ...(defs.preloadedLanguages ?? [])];
    const preloadedTags = [];
    for (const tag of requested) {
      if (preloadedTags.includes(tag)) continue; // dedup (source + eventuali duplicati)
      if (!tags.includes(tag)) {
        const filePath = pathCmd.join(localeDir, `${tag}.js`);
        if (fs.existsSync(filePath)) {
          // File presente ma escluso da "tags" nel giro sopra perché non valido: l'errore
          // è già stato loggato lì. Non va sovrascritto alla cieca (si perderebbe contenuto
          // magari recuperabile), quindi resta ignorata finché non viene corretta a mano.
          console.warn(`[vitetranslate] preloadedLanguages: "${tag}" non è un modulo lingua valido in "${defs.localeDir}", ignorata`);
          continue;
        }
        // A differenza di una lingua lazy scoperta dal semplice scan della cartella,
        // preloadedLanguages è una dichiarazione esplicita in vite.config.js: se il file
        // manca del tutto non ha senso ignorarla silenziosamente, la creiamo al volo così
        // l'app parte già pronta per essere tradotta invece di dover lanciare un comando a
        // parte prima del primo avvio.
        const missingCount = bootstrapSubLanguage(tag, filePath);
        console.warn(`[vitetranslate] preloadedLanguages: "${tag}" non trovata in "${defs.localeDir}", creata al volo con ${missingCount} chiavi da tradurre (valore null)`);
      }
      preloadedTags.push(tag);
    }

    // tag -> binding statico, riusato sia negli export delle tabelle sia nel loader "lazy"
    // di quel tag: evita un dynamic import ridondante (finirebbe comunque nel bundle
    // iniziale -> warning INEFFECTIVE_DYNAMIC_IMPORT di Rollup).
    const binding = {};
    preloadedTags.forEach((tag, i) => { binding[tag] = `__vt_pre_${i}`; });

    const eagerImports = preloadedTags.map(
      tag => `import ${binding[tag]} from ${JSON.stringify(pathOf(tag))};`
    );

    // Il loader di una lingua precaricata restituisce la tabella in bundle (Promise
    // risolta), stessa firma { default } del dynamic import; le altre restano lazy.
    const entries = tags.map(tag =>
      binding[tag]
        ? `  ${JSON.stringify(tag)}: () => Promise.resolve({ default: ${binding[tag]} })`
        : `  ${JSON.stringify(tag)}: () => import(${JSON.stringify(pathOf(tag))})`
    );

    // Mappa tag -> tabella per le sole lingue precaricate: TranslateContainer la consulta
    // per inizializzare il context in modo sincrono quando `initialLanguage` è precaricata.
    const preloadedEntries = preloadedTags.map(tag => `  ${JSON.stringify(tag)}: ${binding[tag]}`);
    const sourceTableExpr = binding[defs.sourceLanguage] ?? "null";

    // Mappa tag -> nome (autonimo, calcolato una volta a sync-time e salvato in __builder__):
    // useTranslateLanguage() la consulta per costruire `languages` senza dover ricorrere a
    // Intl.DisplayNames lato client per ogni lingua a ogni render. Fallback a runtime (qui,
    // lato Node) per un file senza __builder__ (es. non ancora passato dal comando di sync).
    const languageNameEntries = tags.map(tag => {
      const languageName = tableByTag[tag]["__builder__"]?.languageName ?? languageAutonym(tag);
      return `  ${JSON.stringify(tag)}: ${JSON.stringify(languageName)}`;
    });

    return (
      `${eagerImports.join("\n")}\n` +
      `export const languages = {\n${entries.join(",\n")}\n};\n` +
      `export const sourceLanguage = ${JSON.stringify(defs.sourceLanguage)};\n` +
      `export const sourceTable = ${sourceTableExpr};\n` +
      `export const preloadedTables = {\n${preloadedEntries.join(",\n")}\n};\n` +
      `export const languageNames = {\n${languageNameEntries.join(",\n")}\n};\n`
    );
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
      async handler(_code, id) {
        const filePath = id.replace(/\\/g, "/").split("?")[0];
        if (!filePath.startsWith(`${localeDirPosix}/`) || !filePath.endsWith(".js")) return null;

        let table;
        try {
          table = await importLanguageModule(filePath);
        } catch (error) {
          console.warn(`[vitetranslate] "${pathCmd.basename(filePath)}" non importabile, lasciato così com'è: ${error.message}`);
          return null;
        }
        if (table === null || typeof table !== "object" || Array.isArray(table)) {
          console.warn(`[vitetranslate] "${pathCmd.basename(filePath)}" non esporta una tabella: lasciato così com'è`);
          return null;
        }

        // Nessuna sourcemap: il modulo emesso non ha più corrispondenza riga-a-riga con il
        // file su disco, ed è codice generato che nessuno debugga a quel livello.
        return { code: compileLanguageModule(table, pathCmd.basename(filePath, ".js")), map: null };
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
    // deve girare prima che Vite/esbuild rianalizzi il file: il marcatore
    // compilato _<_id_/_fallback_>_ contiene un "<" letterale che il parser
    // JSX di esbuild non accetta se lasciato in un nodo JSXText grezzo.
    enforce: "pre",
    configResolved(resolvedConfig) {
      if (defs.includeFallback === undefined) includeFallback = !resolvedConfig.isProduction;
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
        const result = transformSync(code, {
          filename: id,
          babelrc: false,
          configFile: false,
          presets: [["@babel/preset-react", { runtime: "automatic" }]],
          plugins: [[babelTranslate, { includeFallback }]],
          sourceMaps: true,
        });
        return result ? { code: result.code, map: result.map } : null;
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
      const invalidate = (file) => {
        if (pathCmd.dirname(file) !== localeDir) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_LANGUAGES_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", invalidate);
      server.watcher.on("unlink", invalidate);
      // "change": copre anche il caso in cui un file lingua venga corretto a mano dopo
      // essere stato segnalato come modulo non valido — senza questo listener il dev
      // server continuerebbe a servire il modulo virtuale generato prima della modifica
      // finché non si riavvia.
      server.watcher.on("change", invalidate);
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
