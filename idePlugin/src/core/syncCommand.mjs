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
 * Il node.exe del PATH, o null. Solo .exe: un node.cmd passerebbe da cmd.exe, e le virgolette
 * degli argomenti non sopravvivono.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
export function nodeOnPath(env) {
  // In un oggetto qualunque (non process.env) la chiave può essere Path o PATH.
  const chiave = Object.keys(env).find((k) => k.toUpperCase() === "PATH");
  for (const voce of ((chiave && env[chiave]) || "").split(";")) {
    const dir = voce.trim().replace(/^"(.*)"$/, "$1");
    if (dir && fs.existsSync(path.join(dir, "node.exe"))) return path.join(dir, "node.exe");
  }
  return null;
}

/**
 * Con cosa lanciare il CLI nel terminale di un task.
 *   - macOS e Linux: il binario dell'editor in modalità Node (ELECTRON_RUN_AS_NODE), come le
 *     sonde: nessun node richiesto nel PATH.
 *   - Windows: lì l'editor è un'app grafica, e dentro il terminale (un ConPTY) non trova una
 *     console a cui agganciarsi: il CLI gira, ma l'output si perde e il codice d'uscita a volte
 *     non arriva. Quindi il node.exe del PATH, che c'è dove c'è Vite: output, colori, e l'input
 *     di --llm-translate (la conferma) e --llm-key-set (la chiave nascosta).
 *   - Windows senza node nel PATH: l'editor lanciato da runAsNode.cmd, che gli dà la console di
 *     cmd.exe. Output e codice d'uscita sì; stdin però non è un terminale, e quelle due domande
 *     non si possono fare (`interactive: false`).
 * Nei primi due casi il CLI passa da cliRunner.mjs (`runner`), che scrive l'intestazione
 * (cliHeader.mjs) e a fine corsa fa il conto alla rovescia e chiude il terminale. Nel terzo
 * (`runner: null`) non si può leggere un tasto: restano la riga "Executing task" e il "press any
 * key" di VS Code.
 *
 * @param {object} p
 * @param {string} p.cli - il file del CLI (findCli)
 * @param {string[]} p.args
 * @param {string} p.runner - dist/cliRunner.mjs dell'estensione
 * @param {string} p.runAsNodeCmd - dist/runAsNode.cmd dell'estensione
 * @param {string} [p.platform]
 * @param {string} [p.execPath] - il binario dell'editor
 * @param {Record<string, string | undefined>} [p.env]
 * @returns {{ command: string, args: string[], env: Record<string, string>, via: "editor" | "node" | "cmd", interactive: boolean, runner: string | null }}
 */
export function cliLaunch({ cli, args, runner, runAsNodeCmd, platform = process.platform, execPath = process.execPath, env = process.env }) {
  const conRunner = [runner, cli, ...args];
  if (platform !== "win32") return { command: execPath, args: conRunner, env: { ELECTRON_RUN_AS_NODE: "1" }, via: "editor", interactive: true, runner };
  const node = nodeOnPath(env);
  if (node) return { command: node, args: conRunner, env: {}, via: "node", interactive: true, runner };
  return { command: runAsNodeCmd, args: [cli, ...args], env: { ELECTRON_RUN_AS_NODE: "1", VT_EDITOR_EXE: execPath }, via: "cmd", interactive: false, runner: null };
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
