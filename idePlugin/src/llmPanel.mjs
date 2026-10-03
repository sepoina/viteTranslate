// Lo stato del pannello LLM: la sezione facoltativa (al posto di Results) quando si clicca LLM su
// un progetto che ha il blocco `llm`. In testa tre controlli, poi le azioni --llm-* (LLM_ACTIONS).
//   - API key: dove sta (mai il valore), dal controllo in background (llmCheck.mjs);
//   - Settings: se il blocco `llm` basta per partire. È già valido (il plugin rifiuta un blocco
//     sbagliato, e allora il bottone porta a Help): si dice con cosa parla, e cosa manca per i costi;
//   - Ping: se il modello risponde, dal controllo in background.
// Ogni controllo: { id, state: "ok" | "warning" | "error" | "running", text, description?, tooltip? }.
// Nessun import di `vscode`.
import path from "node:path";
import { LLM_ACTIONS } from "./syncCommand.mjs";

// La riga della chiave, da quello che stampa `--llm-status` (resolveApiKey in lib/dev/llm/apiKey.js).
function keyCheck(check, { apiKeyEnv, baseDir }) {
  const id = "key";
  const da = check?.key;
  if (da === undefined) {
    if (check?.error) return { id, state: "warning", text: "API key: unknown", description: "the check failed", tooltip: check.error };
    return { id, state: "running", text: "API key: looking…" };
  }
  if (da === "not found") {
    return {
      id,
      state: "error",
      text: "API key: not found",
      description: apiKeyEnv,
      tooltip: `Looked for ${apiKeyEnv} in the environment, in .env.local and .env (${baseDir}), and in the system keyring.\n\nAdd ${apiKeyEnv}=… to .env.local, or use "Set the API key" below.`,
    };
  }
  if (da.startsWith("env:")) return { id, state: "ok", text: "API key: environment variable", description: da.slice(4) };
  if (da === ".env.local" || da === ".env") return { id, state: "ok", text: `API key: ${da}`, description: apiKeyEnv, tooltip: path.join(baseDir, da) };
  if (da === "keyring") return { id, state: "ok", text: "API key: system keyring", description: apiKeyEnv };
  if (da.startsWith("n/a")) return { id, state: "ok", text: "API key: not needed", description: "custom driver" };
  return { id, state: "ok", text: `API key: ${da}` };
}

function settingsCheck(llm) {
  const id = "settings";
  if (llm.driver) return { id, state: "ok", text: "Settings: ready", description: "custom driver" };
  const conn = llm.connection ?? {};
  let host = conn.baseURL;
  try {
    host = new URL(conn.baseURL).host;
  } catch {
    // non un URL: resta com'è
  }
  const prezzi = conn.costMillionInput !== undefined;
  return {
    id,
    state: "ok",
    text: "Settings: ready",
    description: [conn.model, host].filter(Boolean).join(" @ ") + (prezzi ? "" : " · no prices"),
    tooltip: prezzi
      ? undefined
      : "No costMillionInput/costMillionOutput in llm.connection: estimates and budgets are in tokens, not money.",
  };
}

function pingCheck(check) {
  const id = "ping";
  const p = check?.ping;
  if (p?.skipped) return { id, state: "warning", text: "Ping: not tried", description: "no API key" };
  if (p?.ok) return { id, state: "ok", text: "Ping: the model answers" };
  if (p) return { id, state: "error", text: "Ping: no answer", description: p.error, tooltip: p.error };
  if (check?.error) return { id, state: "warning", text: "Ping: not tried", description: "the check failed", tooltip: check.error };
  return { id, state: "running", text: "Ping: asking the model…", tooltip: "One minimal request, in the background." };
}

/**
 * @param {object} p
 * @param {object} p.llm - il blocco `llm` normalizzato, come lo dà la sonda
 * @param {string} p.baseDir - la cartella in cui il CLI cerca .env.local e .env
 * @param {object | null} [p.check] - lo stato del controllo in background (runLlmCheck), se è partito
 * @param {string | null} [p.title] - il nome del progetto
 */
export function llmPanelState({ llm, baseDir, check = null, title = null }) {
  const apiKeyEnv = llm.connection?.apiKeyEnv ?? "VITETRANSLATE_API_KEY";
  const checks = [keyCheck(check, { apiKeyEnv, baseDir }), settingsCheck(llm), pingCheck(check)];
  return {
    title,
    checks,
    // Il controllo si può rilanciare solo quando ha finito.
    checking: checks.some((c) => c.state === "running"),
    actions: LLM_ACTIONS.map(({ id, icon, label, detail, args }) => ({ id, icon, label, detail, tooltip: `vitetranslate ${args.join(" ")}` })),
  };
}
