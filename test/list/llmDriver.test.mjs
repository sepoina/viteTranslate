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
const okResponse = (content, usage) => ({
  ok: true,
  text: async () => JSON.stringify({ choices: [{ message: { content } }], ...(usage ? { usage } : {}) }),
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
  eq("usage estratto", { tokensIn: 10, tokensOut: 5 }, r1.usage);

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
  eq("Record<key,string>", { translations: { A_1: "x" }, usage: null }, r1);

  const r2 = await callModel({ connection: conn, driver: async () => ({ translations: { A_1: "y" }, usage: { tokensIn: 1, tokensOut: 1 } }), apiKey: "k", systemPrompt: "s", userPayload: "u" });
  eq("{translations, usage}", { translations: { A_1: "y" }, usage: { tokensIn: 1, tokensOut: 1 } }, r2);
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

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
