// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Quello che sta attorno al driver, built-in o fornito dall'utente: retry, concorrenza, e la
// normalizzazione dell'`usage`. Il contratto del driver ha due rami — `Record<key,string>`
// oppure `{ translations, usage }` — ed è così che la contabilità funziona anche per chi porta
// il proprio driver.

import fetchDriver from "./fetchDriver.js";

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDriverResult(result) {
  if (result && typeof result === "object" && "translations" in result) {
    return { translations: result.translations ?? {}, usage: result.usage ?? null };
  }
  return { translations: result ?? {}, usage: null };
}

/**
 * Retry su 429, 5xx e errori di rete (nessuno status). **Mai** su 400/401/403: una chiave
 * sbagliata riprovata tre volte è lo stesso errore tre volte più tardi. Backoff esponenziale
 * con jitter, e si rispetta `Retry-After` quando c'è.
 */
async function withRetry(attempt, { maxRetries, sleepImpl = defaultSleep, randomImpl = Math.random }) {
  let lastError;
  for (let tryNum = 0; tryNum <= maxRetries; tryNum++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      const retryable = error.status === undefined || isRetryableStatus(error.status);
      if (!retryable || tryNum === maxRetries) throw error;

      const retryAfterMs = error.retryAfter ? Number(error.retryAfter) * 1000 : null;
      const backoffMs = retryAfterMs ?? 2 ** tryNum * 200 + randomImpl() * 200;
      await sleepImpl(backoffMs);
    }
  }
  throw lastError;
}

/**
 * Una chiamata al modello, con retry. `driver`, se presente, scavalca il driver `openai-chat`
 * built-in per intero. `mode: "context"` è la generazione dell'abstract: chiede un testo
 * libero, non passa dal contratto a due rami di `translations`/`usage`.
 *
 * @param {{
 *   connection: object, driver?: Function, apiKey: string,
 *   systemPrompt: string, userPayload: string, mode?: "translate" | "context",
 *   sleepImpl?: Function, randomImpl?: Function,
 * }} params
 */
export async function callModel({
  connection, driver, apiKey, systemPrompt, userPayload, mode = "translate", sleepImpl, randomImpl,
}) {
  const attempt = async () => {
    const raw = driver
      ? await driver({ connection, apiKey, systemPrompt, userPayload, mode })
      : await fetchDriver({ connection, apiKey, systemPrompt, userPayload, mode });
    if (mode === "context") {
      return typeof raw === "string" ? { text: raw, usage: null } : { text: raw?.text ?? "", usage: raw?.usage ?? null };
    }
    return normalizeDriverResult(raw);
  };

  return withRetry(attempt, { maxRetries: connection.maxRetries, sleepImpl, randomImpl });
}

/**
 * Esegue `tasks` (funzioni `() => Promise`) con al più `limit` chiamate contemporanee,
 * preservando l'ordine dei risultati. Sui lotti di **tutte** le lingue insieme: il chiamante
 * costruisce un'unica lista di task per l'intero run, non una per lingua.
 *
 * @param {Array<() => Promise<any>>} tasks
 * @param {number} limit
 */
export async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
