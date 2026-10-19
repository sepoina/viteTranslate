// Lancia npm per i controlli e ne tiene l'uscita: se fallisce, il controllo mostra la coda.
// Non è un controllo (test/commit.mjs prende solo i *.check.mjs): è l'aiuto comune di 03, 07 e 08.
// Asincrono apposta: mentre una build gira, la barra di avanzamento di commit.mjs continua a muoversi.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RADICE = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * `npm <args>` con lo stesso npm che ha lanciato commit.mjs (npm_execpath), come npm() di site/cli/build.mjs:
 * sotto `npm run` il primo "npm" del PATH può essere uno vecchio dentro un node_modules/.bin.
 * @returns {Promise<{ status: number, coda: string[] }>} `coda`: le ultime righe dell'uscita
 */
export function npm(args, righe = 30) {
  const eseguibile = process.env.npm_execpath;
  const [comando, argomenti, shell] = eseguibile?.includes("npm")
    ? [process.execPath, [eseguibile, ...args], false]
    : ["npm", args, process.platform === "win32"];
  return new Promise((resolve) => {
    const figlio = spawn(comando, argomenti, { cwd: RADICE, shell, stdio: ["ignore", "pipe", "pipe"] });
    let uscita = "";
    for (const flusso of [figlio.stdout, figlio.stderr]) {
      flusso.setEncoding("utf8");
      flusso.on("data", (pezzo) => (uscita += pezzo));
    }
    const fine = (status, extra = "") => resolve({ status, coda: `${uscita}${extra}`.trim().split("\n").slice(-righe) });
    figlio.on("error", (e) => fine(1, `\n${e.stack}`));
    figlio.on("close", (status) => fine(status ?? 1));
  });
}
