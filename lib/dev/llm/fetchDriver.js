// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Il driver "openai-chat": copre Gemini (l'endpoint `/v1beta/openai/`), OpenAI, OpenRouter,
// Groq, Ollama, LM Studio, vLLM. Node 18 ha `fetch` globale, non serve nessuna dipendenza.

import { redact } from "./apiKey.js";

const FENCE_RE = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;

function stripFences(content) {
  const trimmed = content.trim();
  const match = trimmed.match(FENCE_RE);
  return match ? match[1] : trimmed;
}

/**
 * @param {{
 *   connection: object, apiKey: string, systemPrompt: string, userPayload: string,
 *   mode?: "translate" | "context", fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<
 *   { translations: Record<string,string>, usage: { tokensIn: number, tokensOut: number } | null } |
 *   { text: string, usage: { tokensIn: number, tokensOut: number } | null }
 * >} la prima forma per `mode: "translate"` (default), la seconda per `mode: "context"` — la
 *   generazione dell'abstract chiede un markdown libero, non un oggetto JSON.
 */
export default async function fetchDriver({
  connection, apiKey, systemPrompt, userPayload, mode = "translate", fetchImpl = fetch,
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
    // Si fonde per ultimo, così chi deve forzare un campo del provider può.
    ...connection.providerOptions,
  };

  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(connection.timeoutMs),
    });
  } catch (cause) {
    // Un timeout finisce qui: il messaggio non deve mai contenere la chiave.
    throw new Error(redact(`openai-chat request to ${url} failed: ${cause.message}`, apiKey), { cause });
  }

  const text = await response.text();

  if (!response.ok) {
    const error = new Error(
      redact(`openai-chat request failed: ${response.status} ${response.statusText} — ${text}`, apiKey)
    );
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new Error(redact(`openai-chat response was not JSON: ${text.slice(0, 200)}`, apiKey), { cause });
  }

  const content = json.choices?.[0]?.message?.content ?? "";
  const usage = json.usage
    ? { tokensIn: json.usage.prompt_tokens, tokensOut: json.usage.completion_tokens }
    : null;

  if (mode === "context") return { text: content.trim(), usage };

  let translations;
  try {
    translations = JSON.parse(stripFences(content));
  } catch (cause) {
    throw new Error(redact(`openai-chat reply was not a JSON object: ${content.slice(0, 200)}`, apiKey), { cause });
  }

  return { translations, usage };
}
