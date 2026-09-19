// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// L'unico strato dove un errore si misura in soldi di qualcun altro. Va letto due volte in
// review: in particolare, la guardia CI (`checkCI`) non prende mai `auto` né `costGuard` come
// parametro — è l'unica guardia che `--llm-auto` non può scavalcare, per costruzione, non per
// un `if` che si potrebbe dimenticare, e `costGuard` salta solo la domanda di conferma, non
// questa guardia.

import { formatCost, formatTokens } from "./costModel.js";

function refusal(reasonLine) {
  return {
    ok: false,
    message:
      `refused: ${reasonLine}\n` +
      "raise `llm.budget`, narrow with --llm-translate <tag>, or run once with --llm-auto.",
  };
}

/**
 * I tetti del budget, prima di spedire. In quest'ordine: `maxCostPerRun` -> `maxCostPerDay`
 * (`today.cost` + la stima) -> `maxTokensPerRun` -> `maxTokensPerDay`. Un tetto `undefined`
 * (l'altra unità) si salta, e così un costo `undefined` (senza prezzi). `--llm-auto` li scavalca.
 *
 * @param {{
 *   estimate: { cost?: number, tokens: number }, today?: { cost: number, tokens: number },
 *   budget: object, auto?: boolean, costUnity?: string,
 * }} params
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function checkCaps({ estimate, today = { cost: 0, tokens: 0 }, budget, auto = false, costUnity = "$" }) {
  if (auto) return { ok: true };

  const money = (n) => formatCost(n, costUnity);

  if (budget.maxCostPerRun !== undefined && estimate.cost !== undefined && estimate.cost > budget.maxCostPerRun) {
    return refusal(
      `this run is estimated at ${money(estimate.cost)}, over the ${money(budget.maxCostPerRun)} of \`llm.budget.maxCostPerRun\`.`
    );
  }
  if (budget.maxCostPerDay !== undefined && estimate.cost !== undefined && today.cost + estimate.cost > budget.maxCostPerDay) {
    return refusal(
      `this run would bring today's spend to ${money(today.cost + estimate.cost)}, over the ${money(budget.maxCostPerDay)} of \`llm.budget.maxCostPerDay\`.`
    );
  }
  if (budget.maxTokensPerRun !== undefined && estimate.tokens > budget.maxTokensPerRun) {
    return refusal(
      `this run is estimated at ${formatTokens(estimate.tokens)} tokens, over the ${formatTokens(budget.maxTokensPerRun)} of \`llm.budget.maxTokensPerRun\`.`
    );
  }
  if (budget.maxTokensPerDay !== undefined && today.tokens + estimate.tokens > budget.maxTokensPerDay) {
    return refusal(
      `this run would bring today's total to ${formatTokens(today.tokens + estimate.tokens)} tokens, over the ${formatTokens(budget.maxTokensPerDay)} of \`llm.budget.maxTokensPerDay\`.`
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
 * Durante il run, sull'`usage` reale accumulato richiesta dopo richiesta: se uno qualunque dei
 * quattro tetti viene superato ci si ferma, ma quello che è già stato validato resta scritto —
 * le traduzioni valide sono valide, e buttarle vorrebbe dire aver speso per niente.
 * `spent` è ciò che il run ha speso finora, `today` il totale del giorno **all'inizio** del run:
 * i tetti giornalieri si confrontano con `today + spent`.
 *
 * @param {{
 *   spent: { cost: number, tokens: number }, today?: { cost: number, tokens: number }, budget: object,
 * }} params
 * @returns {string | false} il nome del tetto superato (`"maxCostPerRun"`…), o `false`
 */
export function shouldStopMidRun({ spent, today = { cost: 0, tokens: 0 }, budget }) {
  const over = (cap, value) => cap !== undefined && value > cap;

  if (over(budget.maxCostPerRun, spent.cost)) return "maxCostPerRun";
  if (over(budget.maxCostPerDay, today.cost + spent.cost)) return "maxCostPerDay";
  if (over(budget.maxTokensPerRun, spent.tokens)) return "maxTokensPerRun";
  if (over(budget.maxTokensPerDay, today.tokens + spent.tokens)) return "maxTokensPerDay";
  return false;
}
