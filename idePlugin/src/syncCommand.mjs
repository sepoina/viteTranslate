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

/**
 * Le azioni del pannello LLM (llmPanel.mjs): il CLI del progetto con un `--llm-*` (doc/llm.md).
 * `icon` è una codicon; `languages: true` chiede prima le lingue (per `--llm-retranslate`, che le
 * vuole).
 */
export const LLM_ACTIONS = [
  { id: "translate", icon: "sparkle", label: "Translate", detail: "Sync, then fill every missing translation (it asks before spending)", args: ["--llm-translate"] },
  { id: "dryRun", icon: "eye", label: "Estimate the cost", detail: "What a translation would cost: sends nothing", args: ["--llm-dry-run", "--llm-translate"] },
  { id: "retranslate", icon: "history", label: "Retranslate…", detail: "Redo the keys already translated too, in the languages you pick (backs them up first)", args: ["--llm-retranslate"], languages: true },
  { id: "context", icon: "book", label: "Regenerate the context", detail: "Rewrite the context abstract the model reads", args: ["--llm-context"] },
  { id: "status", icon: "info", label: "Status", detail: "Connection, key, today's spend, budget: no network call", args: ["--llm-status"] },
  { id: "ping", icon: "plug", label: "Ping", detail: "One minimal request: does the model answer?", args: ["--llm-ping"] },
  { id: "keySet", icon: "key", label: "Set the API key", detail: "Type it in the terminal, input hidden: it goes to the system keyring", args: ["--llm-key-set"] },
  { id: "keyStatus", icon: "key", label: "Key status", detail: "Is there a key in the system keyring?", args: ["--llm-key-status"] },
  { id: "keyClear", icon: "trash", label: "Clear the API key", detail: "Remove it from the system keyring", args: ["--llm-key-clear"] },
];

/**
 * Dove sta la chiamata del plugin nel testo di un vite.config: `vitetranslate(`, non l'import (che
 * non ha la parentesi). Riga e colonna da 1, o null se non c'è (un alias, un config che lo prende
 * da un altro file): allora si apre il file in cima.
 *
 * @param {string} testo
 * @returns {{ line: number, column: number } | null}
 */
export function pluginCallPosition(testo) {
  const m = /\bvitetranslate\s*\(/.exec(String(testo));
  if (!m) return null;
  const prima = testo.slice(0, m.index).split("\n");
  return { line: prima.length, column: prima.at(-1).length + 1 };
}
