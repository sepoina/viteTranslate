// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import path from "path";

// Le estensioni che Vite stesso accetta per il file di config, nel suo stesso ordine di
// preferenza. Cercare solo ".js" voleva dire che un progetto TypeScript — cioè il default dei
// template `create-vite` con TS — riceveva un ERR_MODULE_NOT_FOUND su un file che non aveva
// mai scritto, senza alcun indizio che il problema fosse l'estensione.
//
// File suo, invece di stare dentro cli.js come prima: fastVerify.js deve cercare il file di
// config con la stessa lista e lo stesso ordine di cli.js, e importarla da lì chiuderebbe un
// ciclo (cli.js importa fastVerify.js).
export const CONFIG_FILES = [
  "vite.config.js", "vite.config.mjs", "vite.config.ts",
  "vite.config.cjs", "vite.config.mts", "vite.config.cts",
];

/** Il primo file di config trovato in `cwd`, nell'ordine di CONFIG_FILES, o `undefined`. */
export function findConfigFile(cwd) {
  return CONFIG_FILES.find((f) => fs.existsSync(path.join(cwd, f)));
}
