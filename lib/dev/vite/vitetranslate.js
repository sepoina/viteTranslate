import pathCmd from "path";
import fs from "fs";
import { transformSync } from "@babel/core";
import babelTranslate from "../babel/babelTranslate_2.js";

export const VIRTUAL_LANGUAGES_ID = "virtual:vitetranslate/languages";
const RESOLVED_VIRTUAL_LANGUAGES_ID = "\0" + VIRTUAL_LANGUAGES_ID;

// La sincronizzazione dei JSON di lingua NON avviene più qui: la fa il comando
// standalone "vitetranslate-prepare-translation-table" (vedi cli.js), da
// lanciare come "prebuild" prima di "vite build" — così quando questo plugin
// espone il virtual module, i JSON su disco sono già aggiornati, senza dover
// dipendere dall'ordine con cui Rollup processa i propri hook in una singola build.
export default function vitetranslate(defs) {
  const baseDir = defs.baseDir ?? process.cwd();
  const localeDir = pathCmd.join(baseDir, defs.localeDir);
  // Valore provvisorio: se defs.includeFallback non è specificato, viene risolto in
  // modo affidabile in configResolved (resolvedConfig.isProduction), invece di dedurlo
  // da process.env.NODE_ENV a tempo di definizione del plugin — NODE_ENV non riflette
  // sempre l'ambiente reale (mode custom, "vite preview", ecc.).
  let includeFallback = defs.includeFallback ?? true;

  function generateLanguagesModule() {
    const files = fs.readdirSync(localeDir).filter(f => f.endsWith(".json"));
    const entries = files.map(f => {
      const tag = f.replace(/\.json$/, "");
      const importPath = pathCmd.join(localeDir, f).replace(/\\/g, "/");
      return `  ${JSON.stringify(tag)}: () => import(${JSON.stringify(importPath)})`;
    });
    return (
      `export const languages = {\n${entries.join(",\n")}\n};\n` +
      `export const defaultLanguage = ${JSON.stringify(defs.defaultLanguage)};\n`
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
    load(id) {
      if (id === RESOLVED_VIRTUAL_LANGUAGES_ID) {
        // moduleType: 'js' forza l'interpretazione JS su Rolldown/Vite 8, dove il tipo
        // sarebbe altrimenti dedotto dall'estensione dell'id (qui assente, essendo virtuale).
        // Ignorato su Rollup/Vite 7 (proprietà extra non riconosciuta).
        return { code: generateLanguagesModule(), moduleType: "js" };
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
    },
  };
}
