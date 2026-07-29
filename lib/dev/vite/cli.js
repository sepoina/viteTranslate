#!/usr/bin/env node
// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 4.

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import extractMarkers from "../babel/extractMarkers.js";
import updateLanguage from "./updateLanguage.js";
import languageAutonym from "./uty/languageAutonym.js";
import guardMassErase from "./uty/guardMassErase.js";
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
    throw new Error(`vitetranslate-prepare-translation-table: cannot read srcDir "${config.srcDir}" (resolved to "${srcRoot}"): ${e.message}`);
  }

  // Bootstrap: al primo utilizzo localeDir potrebbe non esistere ancora. updateLanguage
  // si limiterebbe a fallire silenziosamente la scrittura (ENOENT), quindi la si crea qui.
  fs.mkdirSync(service.localeDir, { recursive: true });

  logEchoColored("prepare-translation-table", `Scanning ${files.length} file(s) in "${srcRoot}"`);

  // Scansione solo per il suo effetto collaterale: popolare service.sourceTable (stessa
  // tabella condivisa tra tutti i file di questa scansione). Il codice trasformato non
  // servirebbe a nessuno, quindi `rewrite: false` si ferma al parse e non lo produce
  // affatto — prima veniva generato per intero, file per file, e buttato.
  //
  // Un file illeggibile o non parsabile viene saltato con un avviso, non fa cadere l'intera
  // sincronizzazione: è un comando di "prebuild", e interromperlo su un file qualsiasi
  // lascerebbe le tabelle a metà senza dire quale file l'ha causato.
  const skipped = [];
  for (const file of files) {
    let code;
    try {
      code = fs.readFileSync(file, "utf8");
    } catch (e) {
      skipped.push(`${file}: ${e.message}`);
      continue;
    }
    if (!code.includes("_%_")) continue;
    try {
      extractMarkers(code, { filename: file, table: service.sourceTable, rewrite: false });
    } catch (e) {
      skipped.push(`${file}: ${e.message.split("\n")[0]}`);
    }
  }

  if (skipped.length) {
    logEchoColored("", `WARNING: ${skipped.length} file(s) skipped (markers not extracted):`);
    for (const line of skipped) logEchoColored("", `  - ${line}`);
  }

  // Ultimo controllo prima che updateLanguage cominci a cancellare e riscrivere: quello che
  // sta per succedere assomiglia a una pulizia normale o a una scansione andata a vuoto?
  // Nel dubbio la guardia mette al sicuro una copia di ogni file di lingua e lo segnala.
  await guardMassErase(service, skipped.length);

  await updateLanguage(service);
}

main().catch((error) => {
  console.error(`\n[vitetranslate-prepare-translation-table] ${error.message}\n`);
  process.exitCode = 1;
});
