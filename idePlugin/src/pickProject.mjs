// Quali progetti elenca il pannello: tutti i vite.config.* del workspace, fuori da node_modules,
// uno per cartella. Quale si guarda lo decide l'utente (extension.mjs), non il file attivo.
//
// Nessun import di `vscode`: i percorsi arrivano da fuori (extension.mjs), così tutto si prova in
// Node puro.
import path from "node:path";
import { CONFIG_FILES } from "../../lib/dev/vite/uty/configFiles.js";

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
