// Quali progetti elenca il pannello: tutti i vite.config.* del workspace, fuori da node_modules,
// uno per cartella. Quale si guarda lo sceglie l'utente in Selector, o lo porta il file attivo
// (projectOf): extension.mjs.
//
// Nessun import di `vscode`: i percorsi arrivano da fuori (extension.mjs), così tutto si prova in
// Node puro.
import path from "node:path";
import { CONFIG_FILES } from "../../../lib/dev/vite/uty/configFiles.js";

// Per `workspace.findFiles`: gli stessi nomi, nello stesso ordine, che cercano il CLI e Vite.
export const CONFIG_GLOB = `**/{${CONFIG_FILES.join(",")}}`;
// Per il FileSystemWatcher: cambia ciò che il pannello mostra.
export const WATCH_GLOB = `**/{package.json,${CONFIG_FILES.join(",")}}`;

export const inNodeModules = (file) => file.split(/[\\/]/).includes("node_modules");

/**
 * L'elenco. Un progetto per cartella: se in una cartella convivono più config vince il primo
 * nell'ordine di CONFIG_FILES, lo stesso che sceglierebbe il CLI. Ordinati per percorso.
 *
 * @param {string[]} files - percorsi assoluti di vite.config.*
 */
export function dedupeConfigs(files) {
  const perCartella = new Map();
  for (const file of files) {
    if (inNodeModules(file)) continue;
    const dir = path.dirname(file);
    const nome = path.basename(file);
    if (!CONFIG_FILES.includes(nome)) continue;
    const prima = perCartella.get(dir);
    if (!prima || CONFIG_FILES.indexOf(nome) < CONFIG_FILES.indexOf(prima)) perCartella.set(dir, nome);
  }
  return [...perCartella]
    .map(([dir, configFile]) => ({ dir, configFile }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/**
 * La forma di un percorso per confrontarlo: normalizzato, e su Windows senza maiuscole (VS Code
 * scrive `c:\`, Node spesso `C:\`).
 */
export const pathKey = (file, caseless = process.platform === "win32") => {
  const p = path.resolve(file);
  return caseless ? p.toLowerCase() : p;
};

/**
 * Il progetto a cui appartiene un file: quello la cui cartella lo contiene, il più profondo se
 * sono annidati. null se nessuno.
 *
 * @param {Array<{ dir: string }>} projects - l'elenco di dedupeConfigs
 * @param {string} file - percorso assoluto
 */
export function projectOf(projects, file, caseless = process.platform === "win32") {
  const f = pathKey(file, caseless);
  let scelto = null;
  for (const p of projects) {
    const d = pathKey(p.dir, caseless);
    if (f.startsWith(d.endsWith(path.sep) ? d : d + path.sep) && (!scelto || p.dir.length > scelto.dir.length)) scelto = p;
  }
  return scelto;
}
