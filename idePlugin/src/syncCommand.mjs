// Il comando di sync del progetto: il CLI della libreria installata lì, come lo trova il launcher
// (launcher/vitetranslate.js). Mai un CLI dell'estensione: il comando e il plugin dentro
// vite.config devono essere la stessa versione, quella del progetto, perché scrivono gli stessi file.
// Nessun import di `vscode`: chi lo lancia (extension.mjs, un task) usa solo il percorso trovato qui.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Gli stessi nomi, nello stesso ordine, di NOMI_COMANDO nel launcher: il primo che il pacchetto
// dichiara. Ogni release dalla 2.0 ne ha uno.
const NOMI_COMANDO = ["vitetranslate", "vtranslate-cli", "vitetranslate-prepare-translation-table"];

/**
 * Il file del CLI di `@sepoina/vitetranslate` risolto dalla cartella del progetto.
 *
 * @param {string} dir - cartella del progetto
 * @returns {{ ok: true, cli: string, name: string, version: string } | { ok: false, error: string }}
 */
export function findCli(dir) {
  let pkgFile;
  try {
    pkgFile = createRequire(path.join(dir, "package.json")).resolve("@sepoina/vitetranslate/package.json");
  } catch {
    return { ok: false, error: "@sepoina/vitetranslate is not installed in this project: run npm install" };
  }
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  } catch (error) {
    return { ok: false, error: `cannot read ${pkgFile}: ${error.message}` };
  }
  const name = NOMI_COMANDO.find((n) => typeof pkg.bin?.[n] === "string");
  if (!name) return { ok: false, error: `@sepoina/vitetranslate ${pkg.version ?? ""} declares no command` };
  return { ok: true, cli: path.join(path.dirname(pkgFile), pkg.bin[name]), name, version: pkg.version };
}
