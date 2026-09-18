// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Cosa si vede a schermo. Sempre attraverso `logEchoColored` di lib/utility.js, mai un
// `console.log` diretto: la colonna e `--simpleLog` valgono anche qui.
//
// Il blocco, per intero:
//
//   LLM           │  "deepseek-flash"
//   ⌘ deepseek.com│  - (1/3) incomplete table - 8 missing keys - 1 api request
//                 │  - token (in ~1.2k - out ~1.3k) ≈ $0.0022 < costGuard ($0.2000)
//                 │
//                 │   ✔ < 8 new keys Deutsch. Full translate!
//                 │
//                 │   real token: 2051 (≈ $0.0017)
//   --llm-debug   │  locale/.llm/260918213048 (7 files)

import { logEchoColored } from "../../utility.js";
import { formatCost, formatTokens } from "./costModel.js";

/** Il fornitore dall'URL: l'host, senza il prefisso `api.` e senza la porta. `null` se non c'è un
 *  `baseURL` (un `llm.driver` fornito dall'utente) o se non se ne ricava un host. */
export function providerFrom(baseURL) {
  if (!baseURL) return null;
  const conSchema = /^[a-z][a-z0-9+.-]*:\/\//i.test(baseURL) ? baseURL : `https://${baseURL}`;
  try {
    const host = new URL(conSchema).hostname.replace(/^api\./, "");
    return host || null;
  } catch {
    return null;
  }
}

const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

/** La riga dei token stimati, col confronto con `llm.costGuard` accanto quando c'è: è l'unico
 *  posto in cui si dice se il run avrebbe chiesto conferma. */
function tokenLineStimata({ tokensIn, tokensOut, cost, costGuard, costUnity }) {
  let riga = `- token (in ~${formatTokens(tokensIn)} - out ~${formatTokens(tokensOut)})`;
  if (cost) riga += ` ≈ ${formatCost(cost.cost, costUnity)}`;
  if (costGuard !== undefined && cost) {
    riga += cost.cost < costGuard
      ? ` < costGuard (${formatCost(costGuard, costUnity)})`
      : ` ≥ costGuard (${formatCost(costGuard, costUnity)})`;
  }
  return riga;
}

/**
 * L'apertura del blocco: modello, fornitore, sintesi del lavoro e stima dei token. Prima di
 * spedire, cioè con `--llm-dry-run` o prima della conferma di `--llm-translate`.
 *
 * @param {{ connection?: { model?: string, baseURL?: string },
 *   incomplete: number, total: number, keys: number, requests: number,
 *   tokensIn: number, tokensOut: number,
 *   cost?: { cost: number, costIn: number, costOut: number },
 *   costGuard?: number, costUnity?: string }} params
 *   `incomplete`/`total`: quante lingue di destinazione hanno lavoro, su quante ce ne sono.
 */
export function printEstimate({
  connection = {}, incomplete, total, keys, requests, tokensIn, tokensOut, cost, costGuard, costUnity = "$",
}) {
  const provider = providerFrom(connection.baseURL);
  logEchoColored("LLM", `"${connection.model ?? "custom-driver"}"`);
  logEchoColored(
    provider ? `⌘ ${provider}` : "",
    `- (${incomplete}/${total}) incomplete ${incomplete === 1 ? "table" : "tables"} - ` +
    `${plurale(keys, "missing key", "missing keys")} - ${plurale(requests, "api request", "api requests")}`
  );
  logEchoColored("", tokenLineStimata({ tokensIn, tokensOut, cost, costGuard, costUnity }));
  logEchoColored("", "");
}

/**
 * Il rapporto di fine run: una riga sola, i token misurati dal provider e il loro costo. Il
 * dettaglio per lingua vive nella trace di `--llm-debug` (`summary.json`), non a schermo.
 *
 * @param {{ tokensIn?: number, tokensOut?: number, cost?: { cost: number },
 *   costUnity?: string, unknownKeys?: number }} params
 */
export function printRunResult({ tokensIn, tokensOut, cost, costUnity = "$", unknownKeys = 0 }) {
  const total = Math.round((tokensIn ?? 0) + (tokensOut ?? 0));
  if (total > 0) {
    logEchoColored("", "");
    logEchoColored("", `real token: ${total}${cost ? ` (≈ ${formatCost(cost.cost, costUnity)})` : ""}`);
  }
  if (unknownKeys > 0) {
    logEchoColored("", `${unknownKeys} unknown key(s) in the reply, ignored`, "warning");
  }
}

export function printRefusal(message) {
  logEchoColored("LLM", message, "warning");
}
