// Il controllo LLM in background, per il pannello LLM (llmPanel.mjs): il CLI del progetto con
// `--llm-status --llm-ping`, in un processo nascosto, e due righe lette dalla sua uscita:
//   - `API key: <da dove>` — env:NOME, .env.local, .env, keyring, not found, n/a (llm.driver …).
//     Il valore della chiave non lo stampa mai il CLI, e qui non si legge mai;
//   - `ping: ok` o `ping: failed (<perché>)` — una richiesta minima al modello.
// Senza chiave il processo si ferma appena lo dice: un ping senza chiave è una richiesta sprecata.
//
// `--llm-status` esce prima di ogni sync (maybeRunLlmCommand in cli.js): non scrive niente.
// Nessun import di `vscode`: il CLI lo trova syncCommand.mjs, e qui si prova tutto in Node.
import { spawn } from "node:child_process";

export const LLM_CHECK_ARGS = ["--llm-status", "--llm-ping", "--simpleLog"];
// Quanto si aspetta il ping: il CLI ritenta da sé (connection.maxRetries), e ogni tentativo ha il
// suo timeoutMs. Oltre, il processo si ferma e il pannello dice che il modello non ha risposto.
const LLM_CHECK_TIMEOUT_MS = 90000;

const ANSI = /\x1b\[[0-9;]*m/g;

/**
 * Le righe del log del CLI, senza colori né gutter (`:::` di --simpleLog, la colonna con `║` del
 * log ricco), col loro rientro: una riga troppo lunga va a capo rientrando di più.
 */
function righeDi(testo) {
  const righe = [];
  for (const grezza of String(testo).replace(ANSI, "").split(/\r?\n/)) {
    let r = grezza.replace(/^:::/, "");
    const barra = r.indexOf("║");
    if (barra !== -1) r = r.slice(barra + 1);
    const t = r.trim();
    if (t) righe.push({ rientro: r.length - r.trimStart().length, testo: t });
  }
  return righe;
}

// Il valore di `nome: …`, con le sue continuazioni (le righe dopo, rientrate di più).
function campo(righe, nome) {
  const i = righe.findIndex((r) => r.testo.startsWith(`${nome}:`));
  if (i === -1) return undefined;
  let valore = righe[i].testo.slice(nome.length + 1).trim();
  for (let j = i + 1; j < righe.length && righe[j].rientro > righe[i].rientro; j++) valore += ` ${righe[j].testo}`;
  return valore;
}

/**
 * Quello che si sa finora dall'uscita del CLI (anche a metà: si chiama a ogni pezzo).
 *
 * @param {string} testo
 * @returns {{ key?: string, ping?: { ok: boolean, error?: string } }}
 */
export function parseLlmStatus(testo) {
  const righe = righeDi(testo);
  const esito = {};
  const key = campo(righe, "API key");
  if (key !== undefined) esito.key = key;
  const ping = campo(righe, "ping");
  // La riga del ping è completa solo con la sua parentesi chiusa (un errore va a capo).
  if (ping === "ok") esito.ping = { ok: true };
  else if (ping?.startsWith("failed (") && ping.endsWith(")")) esito.ping = { ok: false, error: ping.slice("failed (".length, -1) };
  return esito;
}

/** La prima riga d'errore del CLI (un vite.config che non si carica), per il tooltip. */
export function errorOf(testo) {
  const righe = righeDi(testo).map((r) => r.testo);
  return righe.find((r) => r.includes("[vitetranslate]"))?.replace(/^\[vitetranslate\]\s*/, "") ?? righe.at(-1) ?? null;
}

/**
 * Lancia il controllo. `onUpdate` riceve lo stato ogni volta che si sa qualcosa di nuovo; la
 * promessa si risolve (mai un rifiuto) con lo stato finale:
 *   { key?, ping?: { ok, error? } | { skipped: true }, error?: string }
 *
 * @param {object} p
 * @param {string} p.cli - il file del CLI (findCli)
 * @param {string} p.dir - la cartella del progetto, la cwd
 * @param {(stato: object) => void} [p.onUpdate]
 * @param {number} [p.timeoutMs]
 * @returns {{ done: Promise<object>, cancel: () => void }}
 */
export function runLlmCheck({ cli, dir, onUpdate, timeoutMs = LLM_CHECK_TIMEOUT_MS }) {
  let child;
  let cancel = () => {};
  const done = new Promise((resolve) => {
    let testo = "";
    let firma = "{}";
    let chiuso = false;
    let timer;
    const fine = (stato) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(timer);
      child?.kill();
      resolve(stato);
    };
    cancel = () => fine({ ...parseLlmStatus(testo), error: "cancelled" });
    try {
      // Il binario dell'editor in modalità Node, come le sonde e i task (runProbe.mjs).
      child = spawn(process.execPath, [cli, ...LLM_CHECK_ARGS], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", VITETRANSLATE_NO_SYNC: "1" },
      });
    } catch (error) {
      fine({ error: String(error?.message ?? error) });
      return;
    }
    const pezzo = (dati) => {
      testo += dati;
      const stato = parseLlmStatus(testo);
      const nuova = JSON.stringify(stato);
      if (nuova !== firma) {
        firma = nuova;
        onUpdate?.(stato);
      }
      if (stato.key === "not found") fine({ ...stato, ping: { skipped: true } });
      else if (stato.ping) fine(stato);
    };
    child.stdout.on("data", pezzo);
    child.stderr.on("data", pezzo);
    child.on("error", (error) => fine({ ...parseLlmStatus(testo), error: String(error?.message ?? error) }));
    child.on("close", (code) => {
      const stato = parseLlmStatus(testo);
      fine(stato.key === undefined || !stato.ping ? { ...stato, error: errorOf(testo) ?? `exited with code ${code}` } : stato);
    });
    timer = setTimeout(() => fine({ ...parseLlmStatus(testo), ping: { ok: false, error: `no answer within ${timeoutMs / 1000} s` } }), timeoutMs);
  });
  return { done, cancel: () => cancel() };
}
