// Quello che il task del CLI (cliTasks.mjs) lancia davvero: `cliRunner.mjs <cli> <args...>`. Scrive
// l'intestazione che riceve in VT_HEADER (cliHeader.mjs: il comando equivalente, e se chiesti i
// dettagli del lancio), fa girare il CLI nel terminale del task (stdio ereditato: colori, la
// conferma di --llm-translate, la chiave nascosta di --llm-key-set), poi decide quando il
// terminale si chiude. Il task ha `close: true`: il terminale se ne va quando questo processo esce.
//   - CLI riuscito: "Press Enter within 10s to keep the terminal open", e sotto il conto alla
//     rovescia. Invio: resta aperto finché non si preme un tasto; un altro tasto, o il tempo
//     scaduto: si chiude.
//   - CLI fallito: resta aperto finché non si preme un tasto, l'errore è lì da leggere.
// Esce col codice del CLI: è quello che il task riporta all'estensione (onDidEndTaskProcess).
// Gira col node del task (cliLaunch in syncCommand.mjs): niente import oltre a Node.
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const SECONDS = 10;
const GRIGIO = "\x1b[2m";
const FINE = "\x1b[0m";
const RIGA = "\r\x1b[2K"; // a capo riga e cancella: il conto si riscrive sul posto

/**
 * Ascolta un tasto (stdin in raw mode, se è un terminale): `allaPressione` riceve quello premuto
 * ("" se stdin finisce). Restituisce la funzione che smette di ascoltare.
 */
function ascolta(stdin, allaPressione) {
  const smetti = () => {
    stdin.off("data", fine);
    stdin.off("end", fine);
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
  };
  const fine = (dati) => {
    smetti();
    allaPressione(String(dati ?? ""));
  };
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.on("data", fine);
  stdin.on("end", fine);
  stdin.resume();
  return smetti;
}

/**
 * Dopo il CLI: il conto alla rovescia, o l'attesa di un tasto. Si risolve quando il terminale può
 * chiudersi.
 *
 * @param {object} p
 * @param {number} p.code - il codice d'uscita del CLI
 * @param {NodeJS.ReadableStream & { isTTY?: boolean, setRawMode?: (b: boolean) => void }} [p.stdin]
 * @param {NodeJS.WritableStream} [p.stdout]
 * @param {number} [p.seconds]
 * @param {number} [p.tick] - quanto dura un secondo, in ms (i test lo accorciano)
 * @returns {Promise<"timeout" | "key" | "kept" | "failed">} come è finita
 */
export function afterCli({ code, stdin = process.stdin, stdout = process.stdout, seconds = SECONDS, tick = 1000 }) {
  return new Promise((resolve) => {
    if (code !== 0) {
      stdout.write(`\n${GRIGIO}Press any key to close the terminal.${FINE}`);
      ascolta(stdin, () => resolve("failed"));
      return;
    }
    let resto = seconds;
    const conto = () => stdout.write(`${RIGA}${GRIGIO}Closing in ${resto}s…${FINE}`);
    stdout.write(`\n${GRIGIO}Press Enter within ${seconds}s to keep the terminal open, any other key to close it now.${FINE}\n`);
    conto();
    const smetti = ascolta(stdin, (tasto) => {
      clearInterval(timer);
      if (tasto !== "\r" && tasto !== "\n") {
        stdout.write("\n");
        return resolve("key");
      }
      stdout.write(`${RIGA}${GRIGIO}Kept open. Press any key to close the terminal.${FINE}`);
      ascolta(stdin, () => resolve("kept"));
    });
    const timer = setInterval(() => {
      resto -= 1;
      if (resto > 0) return conto();
      clearInterval(timer);
      smetti();
      stdout.write("\n");
      resolve("timeout");
    }, tick);
  });
}

async function main() {
  const [cli, ...args] = process.argv.slice(2);
  // Ctrl+C mentre il CLI gira arriva a tutti i processi del terminale: lo gestisce il CLI, il
  // runner aspetta che esca e poi chiede come al solito.
  process.on("SIGINT", () => {});
  // L'intestazione è per il terminale, non per il CLI: non la eredita.
  const { VT_HEADER, ...env } = process.env;
  if (VT_HEADER) process.stdout.write(`${VT_HEADER}\n\n`);
  const figlio = spawn(process.execPath, [cli, ...args], { stdio: "inherit", env });
  const code = await new Promise((resolve) => {
    figlio.on("error", (error) => {
      console.error(`\ncannot start ${cli}: ${error.message}`);
      resolve(1);
    });
    figlio.on("exit", (codice, segnale) => resolve(codice ?? (segnale === "SIGINT" ? 130 : 1)));
  });
  await afterCli({ code });
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
