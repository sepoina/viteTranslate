// Strato 9: fetchDriver.js e callModel.js. `fetch` è sempre una funzione finta: mai la rete vera.
//
//   node test/list/llmDriver.test.mjs
import fetchDriver from "../../lib/dev/llm/fetchDriver.js";
import { callModel, runWithConcurrency } from "../../lib/dev/llm/callModel.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const conn = { baseURL: "http://x", model: "m", temperature: 0.2, timeoutMs: 1000, providerOptions: {}, maxRetries: 3 };
const okResponse = (content, usage, finishReason) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  text: async () => JSON.stringify({
    choices: [{ message: { content }, ...(finishReason ? { finish_reason: finishReason } : {}) }],
    ...(usage ? { usage } : {}),
  }),
  headers: { get: () => null },
});

// T55 — baseURL con/senza slash finale -> stesso URL
console.log("\n== T55 normalizzazione baseURL ==");
{
  let seenUrl1, seenUrl2;
  await fetchDriver({ connection: { ...conn, baseURL: "http://x/" }, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async (url) => { seenUrl1 = url; return okResponse('{"A":"b"}'); } });
  await fetchDriver({ connection: { ...conn, baseURL: "http://x" }, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async (url) => { seenUrl2 = url; return okResponse('{"A":"b"}'); } });
  eq("stesso URL con o senza slash finale", seenUrl1, seenUrl2);
}

// T56 — fence markdown attorno al JSON
console.log("\n== T56 fence markdown sbucciato ==");
{
  const r = await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async () => okResponse('```json\n{"A_1":"Ciao"}\n```') });
  eq("JSON parsato dopo lo sbucciamento", { A_1: "Ciao" }, r.translations);
}

// T57 — usage estratto; assente -> null
console.log("\n== T57 usage ==");
{
  const r1 = await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async () => okResponse('{"A":"b"}', { prompt_tokens: 10, completion_tokens: 5 }) });
  eq("usage estratto", { tokensIn: 10, tokensOut: 5, cachedIn: 0, reasoningOut: 0 }, r1.usage);
  eq("charsOut = lunghezza della risposta", '{"A":"b"}'.length, r1.charsOut);

  const r2 = await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async () => okResponse('{"A":"b"}') });
  eq("usage assente -> null", null, r2.usage);
}

// T58 — retry su 429/503, mai su 400/401
console.log("\n== T58 retry selettivo ==");
{
  let calls = 0;
  const driver = async () => {
    calls++;
    if (calls < 3) { const e = new Error("x"); e.status = 429; throw e; }
    return { A: "ok" };
  };
  await callModel({ connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u", sleepImpl: async () => {} });
  eq("429 riprovato fino al successo", 3, calls);
}
{
  let calls = 0;
  const driver = async () => { calls++; const e = new Error("x"); e.status = 503; throw e; };
  let threw = false;
  try {
    await callModel({ connection: { ...conn, maxRetries: 2 }, driver, apiKey: "k", systemPrompt: "s", userPayload: "u", sleepImpl: async () => {} });
  } catch { threw = true; }
  eq("503 riprovato maxRetries+1 volte poi lancia", true, threw && calls === 3);
}
{
  let calls = 0;
  const driver = async () => { calls++; const e = new Error("bad key"); e.status = 401; throw e; };
  let threw = false;
  try { await callModel({ connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u", sleepImpl: async () => {} }); } catch { threw = true; }
  eq("401 mai riprovato", true, threw && calls === 1);
}
{
  let calls = 0;
  const driver = async () => { calls++; const e = new Error("bad request"); e.status = 400; throw e; };
  let threw = false;
  try { await callModel({ connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u", sleepImpl: async () => {} }); } catch { threw = true; }
  eq("400 mai riprovato", true, threw && calls === 1);
}

// T59 — Retry-After rispettato
console.log("\n== T59 Retry-After ==");
{
  let calls = 0;
  const driver = async () => {
    calls++;
    if (calls < 2) { const e = new Error("x"); e.status = 503; e.retryAfter = "2"; throw e; }
    return { A: "ok" };
  };
  const sleeps = [];
  await callModel({ connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u", sleepImpl: async (ms) => sleeps.push(ms) });
  eq("attende esattamente Retry-After * 1000", [2000], sleeps);
}

// T60 — timeout: l'errore non contiene la chiave
console.log("\n== T60 timeout senza chiave nel messaggio ==");
{
  let message = "";
  try {
    await fetchDriver({
      connection: conn, apiKey: "sk-super-secret", systemPrompt: "s", userPayload: "u",
      fetchImpl: async () => { throw new Error("The operation was aborted due to timeout, key=sk-super-secret"); },
    });
  } catch (e) { message = e.message; }
  eq("la chiave non compare nel messaggio", false, message.includes("sk-super-secret"));
}

// T61 — driver utente: Record<key,string> e {translations, usage}, entrambi accettati
console.log("\n== T61 i due rami del contratto driver ==");
{
  const r1 = await callModel({ connection: conn, driver: async () => ({ A_1: "x" }), apiKey: "k", systemPrompt: "s", userPayload: "u" });
  eq("Record<key,string>", { translations: { A_1: "x" }, usage: null, charsOut: JSON.stringify({ A_1: "x" }).length }, r1);

  const r2 = await callModel({ connection: conn, driver: async () => ({ translations: { A_1: "y" }, usage: { tokensIn: 1, tokensOut: 1 } }), apiKey: "k", systemPrompt: "s", userPayload: "u" });
  eq("{translations, usage}", { translations: { A_1: "y" }, usage: { tokensIn: 1, tokensOut: 1 }, charsOut: JSON.stringify({ A_1: "y" }).length }, r2);

  const r3 = await callModel({ connection: conn, driver: async () => ({ translations: { A_1: "y" }, usage: { tokensIn: 1, tokensOut: 1 }, charsOut: 77 }), apiKey: "k", systemPrompt: "s", userPayload: "u" });
  eq("charsOut dal driver, se lo dà", 77, r3.charsOut);
}

// D-trace — fetchDriver: `trace` vede request (senza Authorization) e response (status + body)
console.log("\n== D-trace fetchDriver ==");
{
  const events = [];
  const trace = (kind, data) => events.push({ kind, data });
  await fetchDriver({
    connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u", trace,
    fetchImpl: async () => okResponse('{"A_1":"Ciao"}'),
  });
  const request = events.find((e) => e.kind === "request");
  const response = events.find((e) => e.kind === "response");
  eq("request ha url", true, typeof request.data.url === "string");
  eq("request ha body.messages", true, Array.isArray(request.data.body.messages));
  eq("request non ha Authorization", true, request.data.headers === undefined && !("Authorization" in request.data));
  eq("response ha status", 200, response.data.status);
  eq("response ha body parsato", { A_1: "Ciao" }, response.data.body.choices[0].message.content ? JSON.parse(response.data.body.choices[0].message.content) : null);
}

// D-trace — callModel: driver custom, un errore poi un successo, etichette nell'ordine giusto
console.log("\n== D-trace callModel ==");
{
  const written = [];
  const debug = { write: (label, data) => written.push({ label, data }) };
  let calls = 0;
  const driver = async () => {
    calls++;
    if (calls === 1) { const e = new Error("boom"); e.status = 500; throw e; }
    return { A_1: "ok" };
  };
  await callModel({
    connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u",
    debug, label: "x", sleepImpl: async () => {},
  });
  eq(
    "etichette nell'ordine: x-request, x-error, x-a2-request, x-a2-response",
    ["x-request", "x-error", "x-a2-request", "x-a2-response"],
    written.map((w) => w.label)
  );
  const errorEntry = written.find((w) => w.label === "x-error");
  eq("errore: attempt 1, willRetry true", true, errorEntry.data.attempt === 1 && errorEntry.data.willRetry === true);
  eq("nessuna -response per il tentativo fallito (il driver ha lanciato)", undefined, written.find((w) => w.label === "x-response"));
}

// R-retry — callModel: `onRetry` dice quando si riprova e perché (la riga del pannello lo mostra)
console.log("\n== R-retry onRetry ==");
{
  const visti = [];
  let calls = 0;
  const driver = async () => {
    calls++;
    if (calls === 1) { const e = new Error("rate"); e.status = 429; throw e; }
    return { A_1: "ok" };
  };
  await callModel({
    connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u",
    sleepImpl: async () => {}, onRetry: (info) => visti.push(info),
  });
  eq("chiamato una volta, prima del secondo tentativo", 1, visti.length);
  eq("con numero, massimo e l'errore", { retry: 1, maxRetries: 3, status: 429 },
    { retry: visti[0].retry, maxRetries: visti[0].maxRetries, status: visti[0].error.status });
}
{
  const visti = [];
  const driver = async () => { const e = new Error("bad key"); e.status = 401; throw e; };
  try {
    await callModel({
      connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u",
      sleepImpl: async () => {}, onRetry: (info) => visti.push(info),
    });
  } catch { /* atteso */ }
  eq("un errore che non si riprova non lo chiama", 0, visti.length);
}
{
  // Anche con --llm-debug acceso: la trace e il pannello ricevono lo stesso tentativo fallito.
  const visti = [];
  const written = [];
  let calls = 0;
  const driver = async () => {
    calls++;
    if (calls === 1) { const e = new Error("boom"); e.status = 503; throw e; }
    return { A_1: "ok" };
  };
  await callModel({
    connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u", label: "x",
    debug: { write: (label) => written.push(label) }, sleepImpl: async () => {}, onRetry: (info) => visti.push(info),
  });
  eq("insieme a debug: trace e onRetry", true, written.includes("x-error") && visti.length === 1);
}

// T62 — maxConcurrency: mai più di N chiamate contemporanee
console.log("\n== T62 concorrenza limitata ==");
{
  let active = 0, maxActive = 0;
  const tasks = Array.from({ length: 10 }, (_, i) => async () => {
    active++; maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return i;
  });
  const results = await runWithConcurrency(tasks, 2);
  eq("mai più di 2 alla volta", true, maxActive <= 2);
  eq("risultati nell'ordine originale", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], results);
}

// M1 — max_tokens nel body, col nome scelto da `maxTokensField`
console.log("\n== M1 max_tokens ==");
{
  const bodyOf = async (connection, ...rest) => {
    const maxTokens = rest.length ? rest[0] : 4096;
    let body;
    await fetchDriver({
      connection, apiKey: "k", systemPrompt: "s", userPayload: "u", maxTokens,
      fetchImpl: async (url, init) => { body = JSON.parse(init.body); return okResponse('{"A":"b"}'); },
    });
    return body;
  };
  eq("max_tokens", 4096, (await bodyOf({ ...conn, maxTokensField: "max_tokens" })).max_tokens);
  const completion = await bodyOf({ ...conn, maxTokensField: "max_completion_tokens" });
  eq("max_completion_tokens", 4096, completion.max_completion_tokens);
  eq("...e niente max_tokens", undefined, completion.max_tokens);
  const off = await bodyOf({ ...conn, maxTokensField: false });
  eq("false: niente di niente", [undefined, undefined], [off.max_tokens, off.max_completion_tokens]);
  eq("senza maxTokens: niente", undefined, (await bodyOf({ ...conn, maxTokensField: "max_tokens" }, undefined)).max_tokens);
  eq("providerOptions vince", 99, (await bodyOf({ ...conn, maxTokensField: "max_tokens", providerOptions: { max_tokens: 99 } })).max_tokens);
}

// M2 — troncamento: finish_reason "length" -> errore `truncated`, con usage, MAI ritentato
console.log("\n== M2 troncamento ==");
{
  const truncated = () => okResponse('{"A_1":"Ci', { prompt_tokens: 10, completion_tokens: 4096 }, "length");
  let error;
  try {
    await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u", fetchImpl: async () => truncated() });
  } catch (e) { error = e; }
  eq("errore truncated", true, error?.truncated === true);
  eq("messaggio", "openai-chat reply truncated: max_tokens reached", error?.message);
  eq("porta l'usage (si è pagato)", { tokensIn: 10, tokensOut: 4096, cachedIn: 0, reasoningOut: 0 }, error?.usage);
  eq("porta quello che è arrivato, per salvarne le coppie complete", '{"A_1":"Ci', error?.partialContent);

  // Anche in modalità contesto: il markdown troncato non si tiene.
  let contextError;
  try {
    await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u", mode: "context", fetchImpl: async () => truncated() });
  } catch (e) { contextError = e; }
  eq("vale anche per il contesto", true, contextError?.truncated === true);
  eq("...ma lì non c'è niente da salvare", undefined, contextError?.partialContent);

  let fetches = 0;
  const usages = [];
  let threw;
  try {
    await callModel({
      connection: { ...conn, maxRetries: 3 }, apiKey: "k", systemPrompt: "s", userPayload: "u", sleepImpl: async () => {},
      onUsage: (usage, info) => usages.push({ usage, ok: info.ok }),
      // `callModel` col driver built-in: si intercetta `fetch` globale.
      driver: async () => { fetches++; return fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u", fetchImpl: async () => truncated() }); },
    });
  } catch (e) { threw = e; }
  eq("una sola chiamata, nessun retry", 1, fetches);
  eq("lancia il troncamento", true, threw?.truncated === true);
  eq("l'usage del tentativo è comunque contato", [{ usage: { tokensIn: 10, tokensOut: 4096, cachedIn: 0, reasoningOut: 0 }, ok: false }], usages);
}

// M3 — error.usage sugli errori dopo una 2xx; cachedIn nei due formati
console.log("\n== M3 usage sugli errori e cachedIn ==");
{
  let error;
  try {
    await fetchDriver({
      connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
      fetchImpl: async () => okResponse("non è JSON", { prompt_tokens: 7, completion_tokens: 3 }),
    });
  } catch (e) { error = e; }
  eq("risposta non JSON: porta l'usage", { tokensIn: 7, tokensOut: 3, cachedIn: 0, reasoningOut: 0 }, error?.usage);

  const deepseek = await fetchDriver({
    connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async () => okResponse('{"A":"b"}', { prompt_tokens: 100, completion_tokens: 5, prompt_cache_hit_tokens: 80 }),
  });
  eq("cachedIn: formato DeepSeek", 80, deepseek.usage.cachedIn);
  const openai = await fetchDriver({
    connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async () => okResponse('{"A":"b"}', { prompt_tokens: 100, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 60 } }),
  });
  eq("cachedIn: formato OpenAI", 60, openai.usage.cachedIn);
}

// M4 — onUsage: una volta per tentativo con usage; maxTokens arriva al driver utente
console.log("\n== M4 onUsage e maxTokens ==");
{
  let calls = 0;
  const seen = [];
  const usages = [];
  const driver = async (args) => {
    seen.push(args.maxTokens);
    calls++;
    if (calls === 1) { const e = new Error("x"); e.status = 503; e.usage = { tokensIn: 5, tokensOut: 1 }; throw e; }
    if (calls === 2) { const e = new Error("y"); e.status = 503; throw e; } // senza usage: non si conta
    return { translations: { A_1: "z" }, usage: { tokensIn: 9, tokensOut: 2 }, charsOut: 12 };
  };
  await callModel({
    connection: conn, driver, apiKey: "k", systemPrompt: "s", userPayload: "u", maxTokens: 2048,
    sleepImpl: async () => {}, onUsage: (usage, info) => usages.push({ usage, ...info }),
  });
  eq("maxTokens passato al driver, a ogni tentativo", [2048, 2048, 2048], seen);
  eq("onUsage: solo i tentativi con usage", [
    { usage: { tokensIn: 5, tokensOut: 1 }, ok: false },
    { usage: { tokensIn: 9, tokensOut: 2 }, ok: true, charsOut: 12 },
  ], usages);
}

// M5 — il lettore tollerante di readReply.js anche qui: la trace del 2026-09-19 aveva un JSON
// completo seguito da `</root>`, rifiutato da un JSON.parse secco, pagato e richiesto di nuovo.
console.log("\n== M5 JSON completo con coda estranea ==");
{
  const r = await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async () => okResponse('{"A_1":"Ciao","B_2":"Mondo"}</root>') });
  eq("letto, non rifiutato", { A_1: "Ciao", B_2: "Mondo" }, r.translations);

  const prosa = await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async () => okResponse('Here you go:\n{"A_1":"Ciao"}') });
  eq("anche con una frase prima", { A_1: "Ciao" }, prosa.translations);

  let error;
  try {
    await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
      fetchImpl: async () => okResponse("nessun oggetto qui") });
  } catch (e) { error = e; }
  eq("senza nessun JSON resta un errore (e si ritenta)", true, /not a JSON object/.test(error?.message ?? ""));
}

// M6 — il ragionamento: la parte di `completion_tokens` che il modello ha speso a pensare
console.log("\n== M6 reasoningOut dal campo standard ==");
{
  const r = await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    fetchImpl: async () => okResponse('{"A":"b"}', {
      prompt_tokens: 100, completion_tokens: 900, completion_tokens_details: { reasoning_tokens: 700 },
    }) });
  eq("reasoningOut letto", 700, r.usage.reasoningOut);
  eq("tokensOut resta il totale fatturato", 900, r.usage.tokensOut);

  let error;
  try {
    await fetchDriver({ connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
      fetchImpl: async () => okResponse("", {
        prompt_tokens: 100, completion_tokens: 4096, completion_tokens_details: { reasoning_tokens: 4096 },
      }, "length") });
  } catch (e) { error = e; }
  eq("troncata tutta in ragionamento: niente da salvare, ma si sa perché", { reasoningOut: 4096, partialContent: "" },
    { reasoningOut: error?.usage?.reasoningOut, partialContent: error?.partialContent });
}

// M7 — `elapsedMs` a corpo letto: c'è chi manda gli header subito e il corpo quando è pronto
console.log("\n== M7 elapsedMs misura la risposta intera ==");
{
  const events = [];
  await fetchDriver({
    connection: conn, apiKey: "k", systemPrompt: "s", userPayload: "u",
    trace: (kind, data) => events.push({ kind, data }),
    fetchImpl: async () => {
      const response = okResponse('{"A":"b"}');
      const text = response.text;
      return { ...response, text: async () => { await new Promise((r) => setTimeout(r, 60)); return text(); } };
    },
  });
  const response = events.find((e) => e.kind === "response");
  eq("il tempo del corpo è dentro", true, response.data.elapsedMs >= 50);
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
