// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// L'unico strato dove un errore si misura in soldi di qualcun altro. Va letto due volte in
// review: in particolare, la guardia CI (`checkCI`) non prende mai `auto` né `costGuard` come
// parametro — è l'unica guardia che `--llm-auto` non può scavalcare, per costruzione, non per
// un `if` che si potrebbe dimenticare, e `costGuard` salta solo la domanda di conferma, non
// questa guardia.

import { formatCost } from "./costModel.js";

function refusal(reasonLine) {
  return {
    ok: false,
    message:
      `refused: ${reasonLine}\n` +
      "raise `llm.budget`, narrow with --llm-translate <tag>, or run once with --llm-auto.",
  };
}

/**
 * I cinque tetti numerici, prima di spedire. In quest'ordine:
 * `maxKeysPerRun` -> `maxRequestsPerRun` -> `maxCharsPerRun` -> `maxKeysPerDay` (dal ledger) ->
 * `maxCostPerRun` (solo se i due prezzi ci sono). `--llm-auto` li scavalca tutti e cinque.
 *
 * @param {{
 *   keys: number, requests: number, chars: number, cost?: number,
 *   keysToday?: number, budget: object, auto?: boolean, costUnity?: string,
 * }} params
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function checkNumericCaps({ keys, requests, chars, cost, keysToday = 0, budget, auto = false, costUnity = "$" }) {
  if (auto) return { ok: true };

  if (keys > budget.maxKeysPerRun) {
    return refusal(
      `this run would translate ${keys} key(s), over the ${budget.maxKeysPerRun} of \`llm.budget.maxKeysPerRun\`.`
    );
  }
  if (requests > budget.maxRequestsPerRun) {
    return refusal(
      `this run would make ${requests} request(s), over the ${budget.maxRequestsPerRun} of \`llm.budget.maxRequestsPerRun\`.`
    );
  }
  if (chars > budget.maxCharsPerRun) {
    return refusal(
      `this run would send ${chars} character(s), over the ${budget.maxCharsPerRun} of \`llm.budget.maxCharsPerRun\`.`
    );
  }
  if (keysToday + keys > budget.maxKeysPerDay) {
    return refusal(
      `this run would bring today's total to ${keysToday + keys} key(s), over the ${budget.maxKeysPerDay} of \`llm.budget.maxKeysPerDay\`.`
    );
  }
  if (budget.maxCostPerRun !== undefined && cost !== undefined && cost > budget.maxCostPerRun) {
    return refusal(
      `this run is estimated at ${formatCost(cost, costUnity)}, over the ${formatCost(budget.maxCostPerRun, costUnity)} ` +
      "of `llm.budget.maxCostPerRun`."
    );
  }

  return { ok: true };
}

/**
 * La guardia CI. Non prende `auto` né `costGuard`: è l'unica guardia senza scorciatoia,
 * perché in CI nessuno legge il log mentre scorre.
 *
 * @param {{ env?: object, noAsk?: boolean }} params
 */
export function checkCI({ env = process.env, noAsk = false } = {}) {
  if (!env.CI) return { ok: true };
  if (noAsk) return { ok: true };
  if (env.VITETRANSLATE_LLM_ALLOW_CI) return { ok: true };

  return {
    ok: false,
    message:
      "refused: CI detected (process.env.CI is set) — refusing to spend money unattended.\n" +
      "pass --llm-noask, set VITETRANSLATE_LLM_ALLOW_CI, or run this off CI. `--llm-auto` does not bypass this.",
  };
}

/**
 * `--llm-translate` chiede sempre conferma con TTY, salvo `--llm-noask` o `llm.costGuard`
 * soddisfatto. Senza TTY, senza `--llm-noask` e senza un `costGuard` soddisfatto si rifiuta
 * invece di chiedere. `--llm-dry-run` non deve mai chiamare questa funzione: non spedisce niente.
 *
 * @param {{
 *   noAsk?: boolean, cost?: number, costGuard?: number,
 *   isTTY?: boolean, ask?: (question: string) => Promise<string>,
 * }} params
 * @returns {Promise<{ ok: boolean, how: "noask" | "costGuard" | "prompt", message?: string }>}
 */
export async function confirmProceed({ noAsk = false, cost, costGuard, isTTY = process.stdin.isTTY, ask } = {}) {
  if (noAsk) return { ok: true, how: "noask" };
  if (costGuard !== undefined && cost !== undefined && cost < costGuard) return { ok: true, how: "costGuard" };

  if (!isTTY) {
    return {
      ok: false,
      how: "prompt",
      message: "refused: no TTY to confirm on — run interactively, pass --llm-noask, or raise llm.costGuard above the estimate.",
    };
  }

  const answer = await (ask ?? defaultAsk)("Proceed? [y/N] ");
  if (/^y(es)?$/i.test(answer.trim())) return { ok: true, how: "prompt" };
  return { ok: false, how: "prompt", message: "declined." };
}

async function defaultAsk(question) {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((resolve) => rl.question(question, resolve));
  } finally {
    rl.close();
  }
}

/**
 * Durante il run, sull'`usage` reale accumulato batch dopo batch: se `maxCostPerRun` viene
 * superato ci si ferma, ma quello che è già stato validato resta scritto — le traduzioni
 * valide sono valide, e buttarle vorrebbe dire aver speso per niente.
 *
 * @param {{ costSoFar: number, maxCostPerRun?: number }} params
 */
export function shouldStopMidRun({ costSoFar, maxCostPerRun }) {
  return maxCostPerRun !== undefined && costSoFar > maxCostPerRun;
}
