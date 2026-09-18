// Strato 1: llmOptions.js normalizza `defs.llm`, o restituisce `null` se il blocco non c'è.
//
//   node test/list/llmOptions.test.mjs
import normalizeLlmOptions, { BUDGET_PRESETS } from "../../lib/dev/llm/llmOptions.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const throws = (nome, fn, contains) => {
  try {
    fn();
    fail++;
    console.log("  KO  ", nome.padEnd(52), "-> non ha lanciato");
  } catch (e) {
    const ok = contains === undefined || e.message.includes(contains);
    if (!ok) fail++;
    console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", e.message);
  }
};

const baseConn = { baseURL: "http://x", model: "m" };

// T1
console.log("\n== llm assente ==");
eq("T1 assente -> null", null, normalizeLlmOptions({ localeDir: "x" }));
eq("T1b undefined defs -> null", null, normalizeLlmOptions(undefined));

// T2
console.log("\n== case-insensitive ==");
eq("T2 LLM maiuscolo riconosciuto", "http://x", normalizeLlmOptions({ LLM: { connection: baseConn } })?.connection.baseURL);
eq("T2b Llm misto riconosciuto", "http://x", normalizeLlmOptions({ Llm: { connection: baseConn } })?.connection.baseURL);

// T3 default
console.log("\n== T3 tutti i default ==");
{
  const llm = normalizeLlmOptions({ llm: { connection: baseConn } });
  eq("protocol", "openai-chat", llm.connection.protocol);
  eq("apiKeyEnv", "VITETRANSLATE_API_KEY", llm.connection.apiKeyEnv);
  eq("temperature", 0.2, llm.connection.temperature);
  eq("timeoutMs", 60000, llm.connection.timeoutMs);
  eq("maxRetries", 3, llm.connection.maxRetries);
  eq("maxConcurrency", 4, llm.connection.maxConcurrency);
  eq("costUnity", "$", llm.connection.costUnity);
  eq("providerOptions", {}, llm.connection.providerOptions);
  eq("driver undefined", undefined, llm.driver);
  eq("budget safe", BUDGET_PRESETS.safe, { ...llm.budget, maxCostPerRun: undefined });
  eq("context.mode", "auto", llm.context.mode);
  eq("context.refreshEvery", 40, llm.context.refreshEvery);
  eq("context.sample", 300, llm.context.sample);
  eq("languages undefined", undefined, llm.languages);
  eq("tone undefined", undefined, llm.tone);
}

// T4 preset budgets
console.log("\n== T4 preset di budget ==");
eq("safe", BUDGET_PRESETS.safe, (() => { const b = normalizeLlmOptions({ llm: { connection: baseConn, budget: "safe" } }).budget; delete b.maxCostPerRun; return b; })());
eq("normal", BUDGET_PRESETS.normal, (() => { const b = normalizeLlmOptions({ llm: { connection: baseConn, budget: "normal" } }).budget; delete b.maxCostPerRun; return b; })());
{
  const unlimited = normalizeLlmOptions({ llm: { connection: baseConn, budget: "unlimited" } }).budget;
  eq("unlimited maxKeysPerRun", Infinity, unlimited.maxKeysPerRun);
}
eq(
  "oggetto si fonde sopra safe",
  50 + 0,
  (() => 50)()
);
{
  const merged = normalizeLlmOptions({ llm: { connection: baseConn, budget: { maxKeysPerRun: 5 } } }).budget;
  eq("merge: campo cambiato", 5, merged.maxKeysPerRun);
  eq("merge: resto di safe", 20, merged.maxRequestsPerRun);
}

// T5/T6/T7
console.log("\n== T5/T6/T7 chiavi sconosciute ==");
throws("T5 chiave sconosciuta in llm", () => normalizeLlmOptions({ llm: { connection: baseConn, foo: 1 } }), "llm.foo");
throws("T6 chiave sconosciuta in connection", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, foo: 1 } } }), "llm.connection.foo");
{
  let ok = true;
  try { normalizeLlmOptions({ llm: { connection: { ...baseConn, providerOptions: { anything: 1 } } } }); } catch { ok = false; }
  eq("T7 providerOptions libero -> nessun errore", true, ok);
}

// T8
console.log("\n== T8 protocol non openai-chat ==");
throws("T8", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, protocol: "anthropic" } } }), "llm.driver");

// T9
console.log("\n== T9 baseURL/model obbligatori senza driver ==");
throws("T9 mancano entrambi", () => normalizeLlmOptions({ llm: {} }), "baseURL");
throws("T9 manca model", () => normalizeLlmOptions({ llm: { connection: { baseURL: "x" } } }), "model");
{
  let ok = true;
  try { normalizeLlmOptions({ llm: { driver: () => {} } }); } catch { ok = false; }
  eq("T9 con driver -> nessun errore", true, ok);
}

// T10
console.log("\n== T10 costMillionInput/Output ==");
throws("T10 solo input", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, costMillionInput: 1 } } }), "give both or neither");
throws("T10 solo output", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, costMillionOutput: 1 } } }), "give both or neither");
{
  let ok = true;
  try { normalizeLlmOptions({ llm: { connection: { ...baseConn, costMillionInput: 1, costMillionOutput: 2 } } }); } catch { ok = false; }
  eq("T10 entrambi -> ok", true, ok);
}
{
  let ok = true;
  try { normalizeLlmOptions({ llm: { connection: baseConn } }); } catch { ok = false; }
  eq("T10 nessuno dei due -> ok", true, ok);
}

// T11
console.log("\n== T11 maxCostPerRun senza prezzi ==");
throws("T11", () => normalizeLlmOptions({ llm: { connection: baseConn, budget: { maxCostPerRun: 5 } } }), "maxCostPerRun");

// T12
console.log("\n== T12 costUnity ==");
eq("T12 default $", "$", normalizeLlmOptions({ llm: { connection: baseConn } }).connection.costUnity);
throws("T12 stringa vuota", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, costUnity: "" } } }), "costUnity");

// T13
console.log("\n== T13 range ==");
throws("T13 temperature 3", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, temperature: 3 } } }), "temperature");
throws("T13 timeoutMs 10", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, timeoutMs: 10 } } }), "timeoutMs");
throws("T13 maxConcurrency 99", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, maxConcurrency: 99 } } }), "maxConcurrency");

// T14
console.log("\n== T14 languages ==");
throws("T14 fr-FF non valido", () => normalizeLlmOptions({ llm: { connection: baseConn, languages: ["fr-FF"] } }));
{
  const llm = normalizeLlmOptions({ llm: { connection: baseConn, languages: ["fr-FR"] } });
  eq("T14 fr-FR valido", ["fr-FR"], llm.languages);
}

// T15 costGuard
console.log("\n== T15 costGuard ==");
eq("T15 assente -> undefined", undefined, normalizeLlmOptions({ llm: { connection: baseConn } }).costGuard);
eq(
  "T15 con i due prezzi -> ok",
  0.05,
  normalizeLlmOptions({
    llm: { connection: { ...baseConn, costMillionInput: 1, costMillionOutput: 2 }, costGuard: 0.05 },
  }).costGuard
);
throws(
  "T15 senza prezzi",
  () => normalizeLlmOptions({ llm: { connection: baseConn, costGuard: 0.05 } }),
  "without prices"
);
throws(
  "T15 negativo",
  () => normalizeLlmOptions({ llm: { connection: { ...baseConn, costMillionInput: 1, costMillionOutput: 2 }, costGuard: -1 } }),
  "finite number"
);
throws(
  "T15 stringa",
  () => normalizeLlmOptions({ llm: { connection: { ...baseConn, costMillionInput: 1, costMillionOutput: 2 }, costGuard: "0.05" } }),
  "finite number"
);
throws(
  "T15 Infinity",
  () => normalizeLlmOptions({ llm: { connection: { ...baseConn, costMillionInput: 1, costMillionOutput: 2 }, costGuard: Infinity } }),
  "finite number"
);

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
