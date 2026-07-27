import pathCmd from "path";
import fs from "fs";
import { transformSync } from "@babel/core";
import babelTranslate from "../babel/babelTranslate_2.js";
import importLanguageModule from "./uty/importLanguageModule.js";

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
    let files;
    try {
      files = fs.readdirSync(localeDir).filter(f => f.endsWith(".js"));
    } catch (e) {
      throw new Error(
        `[vitetranslate] impossibile leggere localeDir "${defs.localeDir}" (risolta in "${localeDir}"): ${e.message}. ` +
        `La cartella deve esistere e contenere il file della sourceLanguage ("${defs.sourceLanguage}.js") — ` +
        `lancia il comando "vitetranslate-prepare-translation-table" per generarla.`
      );
    }
    const pathOf = tag => pathCmd.join(localeDir, `${tag}.js`).replace(/\\/g, "/");

    // Un file .js presente ma non valido (sintassi rotta, o senza default export) non deve
    // né far esplodere la build (se è la sourceLanguage o una preloadedLanguage, verrebbe
    // importato staticamente) né restare un chunk lazy silenziosamente rotto: viene escluso
    // qui, con un avviso chiaro, invece di lasciare che l'errore emerga più tardi come uno
    // stack trace opaco di Rollup/esbuild o come un errore di fetch nel browser.
    const tags = [];
    for (const f of files) {
      const tag = f.replace(/\.js$/, "");
      try {
        const table = await importLanguageModule(pathCmd.join(localeDir, f));
        if (!table) throw new Error("nessun default export");
        tags.push(tag);
      } catch (e) {
        console.error(`[vitetranslate] "${f}" non è un modulo lingua valido (${e.message}): lingua "${tag}" ignorata finché non viene corretta.`);
      }
    }

    if (!tags.includes(defs.sourceLanguage)) {
      throw new Error(
        `[vitetranslate] sourceLanguage "${defs.sourceLanguage}" non trovata (file assente o modulo non valido) in "${defs.localeDir}". ` +
        `Verifica che "${defs.sourceLanguage}.js" esista e sia un modulo valido: è il fallback universale, senza di essa l'app non può funzionare.`
      );
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
        if (tag !== defs.sourceLanguage) {
          console.warn(`[vitetranslate] preloadedLanguages: "${tag}" non trovata in "${defs.localeDir}", ignorata`);
        }
        continue;
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

    return (
      `${eagerImports.join("\n")}\n` +
      `export const languages = {\n${entries.join(",\n")}\n};\n` +
      `export const sourceLanguage = ${JSON.stringify(defs.sourceLanguage)};\n` +
      `export const sourceTable = ${sourceTableExpr};\n` +
      `export const preloadedTables = {\n${preloadedEntries.join(",\n")}\n};\n`
    );
  }

  return {
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
}
