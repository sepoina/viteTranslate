// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Il driver "openai-chat": copre Gemini (l'endpoint `/v1beta/openai/`), OpenAI, OpenRouter,
// Groq, Ollama, LM Studio, vLLM. Node 18 ha `fetch` globale, non serve nessuna dipendenza.

import { redact } from "./apiKey.js";
import { tryParseJson } from "./debugTrace.js";
import { parseJsonReply } from "./readReply.js";

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
 *   `Usage` è `{ tokensIn, tokensOut, cachedIn, reasoningOut }`: `reasoningOut` è la parte di
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

  trace?.("request", { url, method: "POST", body });

  let response;
  let text;
  const startedAt = Date.now();
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(connection.timeoutMs),
    });
    text = await response.text();
  } catch (cause) {
    // Un timeout finisce qui, anche a metà corpo: il messaggio non deve mai contenere la chiave.
    throw new Error(redact(`openai-chat request to ${url} failed: ${cause.message}`, apiKey), { cause });
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
      redact(`openai-chat request failed: ${response.status} ${response.statusText} — ${text}`, apiKey)
    );
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }

  // Da qui la risposta è 2xx, cioè pagata: gli errori che seguono portano il loro `usage`
  // (`error.usage`), così il costo del tentativo entra comunque nei conti (callModel.js,
  // `onUsage`). Un corpo che non è nemmeno JSON un `usage` non ce l'ha da dare.
  let json;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new Error(redact(`openai-chat response was not JSON: ${text.slice(0, 200)}`, apiKey), { cause });
  }

  const content = json.choices?.[0]?.message?.content ?? "";
  // `cachedIn`: il primo campo è di DeepSeek, il secondo di OpenAI. Si misura e basta.
  // `reasoningOut`: il formato di OpenAI, che anche gli altri compatibili riprendono.
  const usage = json.usage
    ? {
        tokensIn: json.usage.prompt_tokens,
        tokensOut: json.usage.completion_tokens,
        cachedIn: json.usage.prompt_cache_hit_tokens ?? json.usage.prompt_tokens_details?.cached_tokens ?? 0,
        reasoningOut: json.usage.completion_tokens_details?.reasoning_tokens ?? 0,
      }
    : null;

  // Prima di leggere il contenuto: una risposta tagliata a metà non è un JSON, e non si ritenta.
  // Quello che è arrivato va con l'errore: le coppie già chiuse si salvano (readReply.js,
  // `salvageTruncated`), il resto torna al modello in lotti più piccoli (translatePass.js).
  if (json.choices?.[0]?.finish_reason === "length") {
    const error = new Error("openai-chat reply truncated: max_tokens reached");
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
    const error = new Error(redact(`openai-chat reply was not a JSON object: ${content.slice(0, 200)}`, apiKey), { cause });
    error.usage = usage;
    throw error;
  }

  return { translations, usage, charsOut: content.length };
}
