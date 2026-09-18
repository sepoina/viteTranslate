// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Cosa si vede a schermo. Sempre attraverso `logEchoColored`/`logRule`/`logCommand` di
// lib/utility.js, mai un `console.log` diretto: la colonna e `--simpleLog` valgono anche qui.

import { logEchoColored, logCommand } from "../../utility.js";
import { formatCost, formatTokens } from "./costModel.js";
import { CLI_NAME } from "../vite/uty/cliName.js";

function tokenLine({ tokensIn, tokensOut, cost, costUnity, estimated }) {
  const prefix = estimated ? "~" : "";
  const tokens = `${prefix}${formatTokens(tokensIn)} in + ${prefix}${formatTokens(tokensOut)} out tokens`;
  if (!cost) return tokens;
  return (
    `${tokens}  ${estimated ? "≈" : "="}  ${formatCost(cost.cost, costUnity)}  ` +
    `(in ${formatCost(cost.costIn, costUnity)}, out ${formatCost(cost.costOut, costUnity)})`
  );
}

/**
 * La stima, prima di spedire (`--llm-dry-run` o la conferma di `--llm-translate`).
 *
 * @param {{ tags: string[], keys: number, requests: number, tokensIn: number, tokensOut: number,
 *   cost?: { cost: number, costIn: number, costOut: number }, costUnity?: string }} params
 */
export function printEstimate({ tags, keys, requests, tokensIn, tokensOut, cost, costUnity = "$" }) {
  logEchoColored("llm", `${tags.join(", ")}: ${keys} key(s), ${requests} request(s)`);
  logEchoColored("", tokenLine({ tokensIn, tokensOut, cost, costUnity, estimated: true }));
  logEchoColored("", "estimated from characters · no prompt-caching discount");
}

/**
 * Il rapporto di fine run vero. `perLanguage`: `[{ tag, filled, rejectedByReason, skipped }]` —
 * i rifiuti si raggruppano per `reason`, non si elencano uno per uno.
 */
export function printRunResult({ perLanguage, tokensIn, tokensOut, cost, costUnity = "$" }) {
  for (const lang of perLanguage) {
    const parts = [`${lang.filled} filled`];
    const reasons = Object.entries(lang.rejectedByReason ?? {});
    if (reasons.length === 0) {
      parts.push("0 rejected");
    } else {
      parts.push(...reasons.map(([reason, count]) => `${count} rejected (${reason})`));
    }
    if (lang.skipped) parts.push(`${lang.skipped} skipped`);
    logEchoColored("llm", `${lang.tag}: ${parts.join(", ")}`);
    if (lang.unknownKeys) {
      logEchoColored("", `${lang.unknownKeys} unknown key(s) in the reply, ignored`, "warning");
    }
  }
  logEchoColored("", tokenLine({ tokensIn, tokensOut, cost, costUnity, estimated: false }));
  logEchoColored("", "measured from provider usage");
}

export function printRefusal(message) {
  logEchoColored("llm", message, "warning");
}

/** Con `--llm-dry-run`, se `llm.costGuard` è configurato: dice se questo run l'avrebbe
 *  soddisfatto o no, senza dover confrontare a mente le due righe di stima. */
export function printCostGuard({ cost, costGuard, costUnity = "$" }) {
  if (costGuard === undefined || cost === undefined) return;
  logEchoColored(
    "",
    cost < costGuard
      ? `would run without asking (under costGuard ${formatCost(costGuard, costUnity)})`
      : `would ask: over costGuard (${formatCost(costGuard, costUnity)})`
  );
}

/** La riga che invita a lanciare `--llm-translate`, usata da syncReport.js quando `llm` è
 *  configurato e restano chiavi mancanti. */
export function printTranslateHint(count) {
  logEchoColored("", `${count} string(s) still untranslated`);
  logCommand(`npx ${CLI_NAME} --llm-translate`);
}
