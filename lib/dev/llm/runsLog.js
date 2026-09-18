// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// `<localeDir>/.llm/runs.log`, append, una riga per run. È un file da `tail`, non un archivio:
// i contatori che servono al codice stanno nel ledger (strato 5), questo esiste solo per
// essere letto da una persona.

import fs from "fs";
import path from "path";
import { contextDir, ensureContextDir } from "./contextFile.js";
import { formatTokens, formatCost } from "./costModel.js";

const MAX_LINES = 500;

export function runsLogPath(localeDir) {
  return path.join(contextDir(localeDir), "runs.log");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTimestamp(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * @param {string} localeDir
 * @param {{
 *   action: "translate" | "context", subject: string, requests: number,
 *   tokensIn: number, tokensOut: number, cost?: number, costUnity?: string,
 *   measured: boolean, now?: Date,
 * }} entry
 */
export function appendRunLog(localeDir, entry) {
  ensureContextDir(localeDir);

  const date = formatTimestamp(entry.now ?? new Date());
  const costText = entry.cost !== undefined ? formatCost(entry.cost, entry.costUnity ?? "$") : "";
  const tokensText = `${formatTokens(entry.tokensIn)} in + ${formatTokens(entry.tokensOut)} out`;
  const line = [
    date,
    entry.action.padEnd(9),
    entry.subject.padEnd(16),
    `${entry.requests} req`.padEnd(8),
    tokensText.padEnd(20),
    costText.padEnd(9),
    entry.measured ? "measured" : "estimated",
  ].join("  ");

  const filePath = runsLogPath(localeDir);
  let lines = [];
  try {
    lines = fs.readFileSync(filePath, "utf8").split("\n").filter((l) => l !== "");
  } catch {
    // file assente: questa è la prima riga
  }
  lines.push(line);
  // Si taglia dalla testa oltre le 500 righe.
  if (lines.length > MAX_LINES) lines = lines.slice(lines.length - MAX_LINES);
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}
