// Lancia una sonda su un progetto e ne aspetta la risposta: probe.mjs (il vite.config) o
// markedProbe.mjs (le voci marcate).
//
// `fork` usa `process.execPath`: dentro VS Code è il binario dell'editor, che con
// ELECTRON_RUN_AS_NODE=1 si comporta da Node (lo stesso trucco dei language server). Così non
// serve un `node` nel PATH — spesso assente quando l'editor parte dal menu e Node viene da nvm —
// e la versione è quella di Electron, oggi Node 24: toglie da sola i tipi di un vite.config.ts.
// Nei test `process.execPath` è il Node della suite, e la variabile non ha effetto.
import { fork } from "node:child_process";

// Quanto output del config si tiene, per il tooltip e per il canale di log.
const MAX_OUTPUT = 4000;

/**
 * @param {object} p
 * @param {string} p.dir - cartella del progetto (diventa la cwd della sonda)
 * @param {string} [p.configFile] - nome del vite.config, relativo a `dir`: l'argomento di probe.mjs
 * @param {string} p.probePath - percorso assoluto della sonda
 * @param {string[]} [p.args] - gli argomenti della sonda, se non è probe.mjs
 * @param {string} [p.what] - chi non ha risposto, nel messaggio di timeout
 * @param {number} [p.timeoutMs]
 * @returns {Promise<object>} la risposta della sonda, più `ms` e `output`; mai un rifiuto
 */
export default function runProbe({ dir, configFile, probePath, args = [configFile], what = "vite.config", timeoutMs = 15000 }) {
  return new Promise((resolve) => {
    const inizio = Date.now();
    let output = "";
    let chiuso = false;
    let child;
    let timer;
    const fine = (risposta) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(timer);
      child?.kill();
      resolve({ ...risposta, ms: Date.now() - inizio, output: output.trim() });
    };
    try {
      child = fork(probePath, args, {
        cwd: dir,
        // Vuoto di proposito: l'extension host può avere --inspect fra i suoi argomenti, e un
        // figlio che li eredita litiga per la stessa porta.
        execArgv: [],
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", VITETRANSLATE_NO_SYNC: "1" },
      });
    } catch (error) {
      fine({ ok: false, code: null, error: String(error?.message ?? error) });
      return;
    }
    const raccogli = (pezzo) => {
      if (output.length < MAX_OUTPUT) output += pezzo;
    };
    child.stdout.on("data", raccogli);
    child.stderr.on("data", raccogli);
    timer = setTimeout(
      () => fine({ ok: false, code: "TIMEOUT", error: `${what} did not answer within ${timeoutMs / 1000} s` }),
      timeoutMs
    );
    child.on("message", fine);
    child.on("error", (error) => fine({ ok: false, code: null, error: String(error?.message ?? error) }));
    // 'close' e non 'exit': arriva dopo che anche i canali del figlio si sono chiusi, quindi dopo
    // l'ultimo 'message'. Con 'exit' una risposta in volo può arrivare tardi e perdersi.
    child.on("close", (code) =>
      fine({ ok: false, code: "NO_ANSWER", error: `the probe exited with code ${code} without answering` })
    );
  });
}
