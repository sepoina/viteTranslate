#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { transformSync } from "@babel/core";
import babelTranslate from "../babel/babelTranslate_2.js";
import updateLanguage from "./updateLanguage.js";
import languageAutonym from "./uty/languageAutonym.js";
import { logEchoColored } from "../../utility.js";

const EXT_RE = /\.[jt]sx?$/;
// Versione dello schema dei file di lingua generati (non del pacchetto): va bumpata a mano
// solo quando cambia la forma di "__builder__", non ad ogni sync.
const BUILDER_VERSION = 260727;
const EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

function walk(dir, excludeDir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // localeDir contiene i file lingua generati (.js): non sono codice sorgente da
      // scansionare per il marcatore "_%_", ci finirebbero per coincidenza nelle stringhe
      // tradotte.
      if (full === excludeDir) continue;
      walk(full, excludeDir, results);
    }
    else if (EXT_RE.test(entry.name)) results.push(full);
  }
  return results;
}

async function loadConfig() {
  // Nessun file di config separato: la stessa config passata a vitetranslate(...)
  // in vite.config.js viene letta da qui, tramite la proprietà che il plugin
  // espone sull'oggetto restituito — una sola fonte di verità, zero duplicazione.
  const viteConfigPath = path.join(process.cwd(), "vite.config.js");
  const { default: resolved } = await import(pathToFileURL(viteConfigPath).href);
  const plugins = (resolved.plugins ?? []).flat(Infinity);
  const plugin = plugins.find((p) => p?.name === "vitetranslate");
  if (!plugin?.vitetranslateConfig) {
    throw new Error(
      'vitetranslate non trovato tra i "plugins" di vite.config.js: registralo per usare questo comando.'
    );
  }
  return plugin.vitetranslateConfig;
}

async function main() {
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

  const srcRoot = path.join(config.baseDir, config.srcDir);
  let files;
  try {
    files = walk(srcRoot, service.localeDir);
  } catch (e) {
    throw new Error(`vitetranslate-prepare-translation-table: impossibile leggere srcDir "${config.srcDir}" (risolta in "${srcRoot}"): ${e.message}`);
  }

  // Bootstrap: al primo utilizzo localeDir potrebbe non esistere ancora. updateLanguage
  // si limiterebbe a fallire silenziosamente la scrittura (ENOENT), quindi la si crea qui.
  fs.mkdirSync(service.localeDir, { recursive: true });

  logEchoColored("prepare-translation-table", `Scansione di ${files.length} file in "${srcRoot}"`);

  // Passaggio Babel solo per il suo effetto collaterale: popolare service.sourceTable
  // (stessa tabella condivisa tra tutti i file di questa scansione).
  // Il codice trasformato non viene mai scritto da nessuna parte.
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    if (!code.includes("_%_")) continue;
    transformSync(code, {
      filename: file,
      babelrc: false,
      configFile: false,
      presets: [["@babel/preset-react", { runtime: "automatic" }]],
      plugins: [[babelTranslate, { table: service.sourceTable }]],
    });
  }

  await updateLanguage(service);
}

main();
