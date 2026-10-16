// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// DOCS-PAGE: llm/custom-endpoint, llm/setup, llm/tested-endpoints — the user manual describes this behaviour; update it and run npm run docs:seal (AGENTS.md).
//
// Il driver "openai-chat": copre Gemini (l'endpoint `/v1beta/openai/`), OpenAI, OpenRouter,
// Groq, Ollama, LM Studio, vLLM. Node 18 ha `fetch` globale, non serve nessuna dipendenza.

import { redact } from "./apiKey.js";
import { tryParseJson } from "./debugTrace.js";
import { parseJsonReply } from "./readReply.js";

/**
 * Fra quanti secondi si azzera il limite di un 429, quando la risposta lo dice: OpenRouter lo
 * mette nel corpo dell'errore (`error.metadata.headers["X-RateLimit-Reset"]`, millisecondi
 * epoch), altri nell'header `x-ratelimit-reset`. Il valore può essere in millisecondi epoch, in
 * secondi epoch o già in secondi da adesso; altro (`"6m0s"`) non si legge. `null` se manca: il
 * ritentativo resta allora sul backoff di callModel.js.
 */
export function rateLimitResetSeconds(headers, text, now = Date.now()) {
  let raw = headers?.get?.("x-ratelimit-reset") ?? null;
  if (raw === null) {
    try {
      raw = JSON.parse(text)?.error?.metadata?.headers?.["X-RateLimit-Reset"] ?? null;
    } catch {
      return null;
    }
  }
  const n = Number(raw);
  if (raw === null || raw === "" || !Number.isFinite(n)) return null;
  const ms = n > 1e12 ? n - now : n > 1e9 ? n * 1000 - now : n * 1000;
  return Math.max(0, Math.ceil(ms / 1000));
}

/**
 * The library's HTTP call: the built-in driver goes through it, and a custom driver gets it as `fetch`
 * (callModel.js, `driverFetch`). Timeout from `connection.timeoutMs` (unless `init.signal` is given),
 * the body read to the end, the key never in a message, `--llm-debug` traced; a non-2xx reply is the
 * error the retry rules read (`status`, `retryAfter`). `who` names the caller in the messages.
 *
 * @returns {Promise<{ response: Response, text: string }>} only for a 2xx reply
 */
export async function sendRequest({ url, init = {}, connection, apiKey, fetchImpl = fetch, trace, who = "openai-chat" }) {
  trace?.("request", { url, method: init.method ?? "GET", body: tryParseJson(init.body) });

  let response;
  let text;
  const startedAt = Date.now();
  try {
    response = await fetchImpl(url, { ...init, signal: init.signal ?? AbortSignal.timeout(connection.timeoutMs) });
    text = await response.text();
  } catch (cause) {
    // Un timeout finisce qui, anche a metà corpo: il messaggio non deve mai contenere la chiave.
    throw new Error(redact(`${who} request to ${url} failed: ${cause.message}`, apiKey), { cause });
  }
  // A corpo letto, non all'arrivo degli header: c'è chi (DeepSeek) li manda subito e tiene
  // aperta la connessione finché la risposta è pronta, e allora ogni richiesta sembrava durare
  // mezzo secondo.
  const elapsedMs = Date.now() - startedAt;

  let headers = {};
  try {
    if (response.headers) headers = Object.fromEntries(response.headers);
  } catch {
    // Un `Response` finto senza header iterabili non deve far fallire la traccia.
  }
  trace?.("response", { status: response.status, statusText: response.statusText, elapsedMs, headers, body: tryParseJson(text) });

  if (!response.ok) {
    const error = new Error(
      redact(`${who} request failed: ${response.status} ${response.statusText} — ${text}`, apiKey)
    );
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after")
      ?? (response.status === 429 ? rateLimitResetSeconds(response.headers, text) : null);
    throw error;
  }
  return { response, text };
}

/**
 * A reply's `usage` in the library's shape, `{ tokensIn, tokensOut, cachedIn, reasoningOut, cost? }`.
 * A Chat Completions `usage` (`prompt_tokens`…) is mapped; anything else (a custom driver's own
 * `{ tokensIn, tokensOut }`) is passed on as it is.
 */
export function readUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  if (!("prompt_tokens" in usage) && !("completion_tokens" in usage)) return usage;
  // `cachedIn`: il primo campo è di DeepSeek, il secondo di OpenAI. Si misura e basta.
  // `reasoningOut`: il formato di OpenAI, che anche gli altri compatibili riprendono.
  // `cost`: quello che il tentativo è costato davvero, quando il provider lo dice (OpenRouter):
  // vince sui prezzi della configurazione (costModel.js, `attemptCost`).
  return {
    tokensIn: usage.prompt_tokens,
    tokensOut: usage.completion_tokens,
    cachedIn: usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0,
    reasoningOut: usage.completion_tokens_details?.reasoning_tokens ?? 0,
    ...(typeof usage.cost === "number" ? { cost: usage.cost } : {}),
  };
}

/**
 * From the model's text to the driver's result, the same way for the built-in driver and for a custom
 * one that returns `{ content, truncated, usage }`. The reply is 2xx, that is paid: the errors carry
 * their `usage` (`error.usage`), so the attempt's cost still enters the accounts (callModel.js, `onUsage`).
 *
 * @returns {{ translations: Record<string,string>, usage: object | null, charsOut: number } | { text: string, usage: object | null }}
 */
export function finishReply({ content, truncated = false, usage = null, mode = "translate", apiKey, who = "openai-chat" }) {
  // Prima di leggere il contenuto: una risposta tagliata a metà non è un JSON, e non si ritenta.
  // Quello che è arrivato va con l'errore: le coppie già chiuse si salvano (readReply.js,
  // `salvageTruncated`), il resto torna al modello in lotti più piccoli (translatePass.js).
  if (truncated) {
    const error = new Error(`${who} reply truncated: max_tokens reached`);
    error.truncated = true;
    error.usage = usage;
    if (mode !== "context") error.partialContent = content;
    throw error;
  }

  if (mode === "context") return { text: content.trim(), usage };

  // Lo stesso lettore tollerante di readReply.js: un JSON completo seguito da `</root>` (trace del
  // 2026-09-19) era una risposta giusta, pagata, e buttata da un `JSON.parse` più severo di lui.
  let translations;
  try {
    translations = parseJsonReply(content);
  } catch (cause) {
    const error = new Error(redact(`${who} reply was not a JSON object: ${content.slice(0, 200)}`, apiKey), { cause });
    error.usage = usage;
    throw error;
  }

  return { translations, usage, charsOut: content.length };
}

/**
 * @param {{
 *   connection: object, apiKey: string, systemPrompt: string, userPayload: string,
 *   mode?: "translate" | "context", maxTokens?: number, fetchImpl?: typeof fetch,
 *   trace?: (kind: "request" | "response", data: object) => void,
 * }} params
 * @returns {Promise<
 *   { translations: Record<string,string>, usage: Usage | null, charsOut: number } |
 *   { text: string, usage: Usage | null }
 * >} la prima forma per `mode: "translate"` (default), la seconda per `mode: "context"` — la
 *   generazione dell'abstract chiede un markdown libero, non un oggetto JSON.
 *   `Usage` è `{ tokensIn, tokensOut, cachedIn, reasoningOut, cost? }`: `reasoningOut` è la parte di
 *   `tokensOut` spesa a ragionare, dal campo standard `completion_tokens_details.reasoning_tokens`
 *   (0 se il provider non lo dà: la taratura della risposta assorbe allora tutto).
 */
export default async function fetchDriver({
  connection, apiKey, systemPrompt, userPayload, mode = "translate", maxTokens, fetchImpl = fetch, trace,
}) {
  // Il doppio slash rompe su alcuni gateway: normalizzarlo è una riga.
  const baseURL = connection.baseURL.replace(/\/+$/, "");
  const url = `${baseURL}/chat/completions`;

  const body = {
    model: connection.model,
    temperature: connection.temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPayload },
    ],
    // Il contratto JSON vale solo per la traduzione: la generazione del contesto chiede
    // markdown, e forzare `json_object` lì lo rifiuterebbe.
    ...(mode === "translate" ? { response_format: { type: "json_object" } } : {}),
    // Il tetto di token in uscita, col nome che vuole il provider (`connection.maxTokensField`).
    ...(connection.maxTokensField && maxTokens ? { [connection.maxTokensField]: maxTokens } : {}),
    // Si fonde per ultimo, così chi deve forzare un campo del provider può.
    ...connection.providerOptions,
  };

  const { text } = await sendRequest({
    url,
    init: { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
    connection, apiKey, fetchImpl, trace,
  });

  // Un corpo che non è nemmeno JSON un `usage` non ce l'ha da dare.
  let json;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new Error(redact(`openai-chat response was not JSON: ${text.slice(0, 200)}`, apiKey), { cause });
  }

  const choice = json.choices?.[0];
  return finishReply({
    content: choice?.message?.content ?? "",
    truncated: choice?.finish_reason === "length",
    usage: readUsage(json.usage),
    mode, apiKey,
  });
}
