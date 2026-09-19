// Strato 1: llmOptions.js normalizza `defs.llm`, o restituisce `null` se il blocco non c'è.
//
//   node test/list/llmOptions.test.mjs
import normalizeLlmOptions, { BUDGET_PRESETS, MODEL_CLASSES } from "../../lib/dev/llm/llmOptions.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Uguaglianza profonda che distingue Infinity e undefined (JSON.stringify li appiattisce); le funzioni per riferimento.
const deepEqual = (a, b) => {
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return Object.is(a, b);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => deepEqual(a[key], b[key]));
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
const priced = { ...baseConn, costMillionInput: 1, costMillionOutput: 2 };
// Le chiavi non attive valgono `undefined`: JSON.stringify le salta, così il confronto è fra i soli tetti attivi.
const defined = (budget) => Object.fromEntries(Object.entries(budget).filter(([, v]) => v !== undefined));

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
  eq("budget safe (senza prezzi: token)", { ...BUDGET_PRESETS.safe.tokens, preset: "safe" }, defined(llm.budget));
  eq("modelClass standard", { name: "standard", ...MODEL_CLASSES.standard }, llm.connection.modelClass);
  eq("maxTokensField", "max_tokens", llm.connection.maxTokensField);
  eq("context.mode", "auto", llm.context.mode);
  eq("context.refreshEvery", 40, llm.context.refreshEvery);
  eq("context.sample", 300, llm.context.sample);
  eq("languages undefined", undefined, llm.languages);
  eq("tone undefined", undefined, llm.tone);
}

// T4 preset budgets
console.log("\n== T4 preset di budget ==");
const budgetOf = (budget, connection = baseConn) => normalizeLlmOptions({ llm: { connection, budget } }).budget;
for (const name of ["safe", "normal"]) {
  eq(`${name} con prezzi: solo costo`, { ...BUDGET_PRESETS[name].cost, preset: name }, defined(budgetOf(name, priced)));
  eq(`${name} senza prezzi: solo token`, { ...BUDGET_PRESETS[name].tokens, preset: name }, defined(budgetOf(name)));
}
eq("unlimited con prezzi", Infinity, budgetOf("unlimited", priced).maxCostPerRun);
eq("unlimited senza prezzi", Infinity, budgetOf("unlimited").maxTokensPerDay);
eq("preset dichiarato", "unlimited", budgetOf("unlimited").preset);
eq("undefined vale safe", "safe", budgetOf(undefined).preset);
{
  const merged = budgetOf({ maxCostPerRun: 5 }, priced);
  eq("merge: campo cambiato", 5, merged.maxCostPerRun);
  eq("merge: resto di safe", BUDGET_PRESETS.safe.cost.maxCostPerDay, merged.maxCostPerDay);
  eq("merge: preset custom", "custom", merged.preset);
  eq("merge: token non attivi", undefined, merged.maxTokensPerRun);
}
eq("un campo esplicito vale anche nell'altra unità", 1000, budgetOf({ maxTokensPerRun: 1000 }, priced).maxTokensPerRun);
throws("campo della 4.6.1 -> errore col rimando", () => budgetOf({ maxKeysPerRun: 5 }), "doc/llm.md");
throws("campo della 4.6.1 -> nomina il campo", () => budgetOf({ maxKeysPerRun: 5 }), "llm.budget.maxKeysPerRun is not a recognised option");
throws("valore negativo", () => budgetOf({ maxTokensPerRun: -1 }), "must be a number >= 0");
throws("preset sconosciuto", () => budgetOf("huge"), '"huge"');

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
console.log("\n== T11 maxCost* senza prezzi ==");
throws("T11 maxCostPerRun", () => normalizeLlmOptions({ llm: { connection: baseConn, budget: { maxCostPerRun: 5 } } }), "maxCostPerRun");
throws("T11 maxCostPerDay", () => normalizeLlmOptions({ llm: { connection: baseConn, budget: { maxCostPerDay: 5 } } }), "maxCostPerDay");

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

// T16 classi di modello e maxTokensField
console.log("\n== T16 modelClass e maxTokensField ==");
const classOf = (modelClass) => normalizeLlmOptions({ llm: { connection: { ...baseConn, modelClass } } }).connection.modelClass;
eq("frontier per nome", { name: "frontier", ...MODEL_CLASSES.frontier }, classOf("frontier"));
throws("nome sconosciuto", () => classOf("huge"), 'modelClass "huge" is not one of "basic", "standard", "advanced", "expert", "frontier"');
eq("oggetto: si fonde sopra standard, name custom", { name: "custom", ...MODEL_CLASSES.standard, k: 2 }, classOf({ k: 2 }));
throws("oggetto: chiave sconosciuta", () => classOf({ foo: 1 }), "modelClass.foo");
throws("maxTokens < maxOutputTokens", () => classOf({ maxOutputTokens: 5000, maxTokens: 4096 }), "truncated by construction");
throws("k fuori range", () => classOf({ k: 0 }), "modelClass.k");
throws("k fuori range (alto)", () => classOf({ k: 21 }), "modelClass.k");
throws("maxOutputTokens < 200", () => classOf({ maxOutputTokens: 100, maxTokens: 4096 }), "maxOutputTokens");
throws("maxKeys fuori range", () => classOf({ maxKeys: 0 }), "maxKeys");
throws("modelClass non oggetto né stringa", () => classOf(3), "modelClass must be");
const fieldOf = (maxTokensField) => normalizeLlmOptions({ llm: { connection: { ...baseConn, maxTokensField } } }).connection.maxTokensField;
eq("max_completion_tokens", "max_completion_tokens", fieldOf("max_completion_tokens"));
eq("false", false, fieldOf(false));
throws("maxTokensField non valido", () => fieldOf("max_new_tokens"), "maxTokensField");

// T17 idempotenza: il plugin normalizza il blocco e lo passa alla CLI, che lo normalizza di nuovo
// (translatePass.js). Il risultato del primo giro deve essere un input valido, e lo stesso, del secondo.
console.log("\n== T17 normalizzare due volte dà lo stesso risultato ==");
{
  const variants = {
    "default, senza prezzi": { connection: baseConn },
    "preset con prezzi": { connection: priced, budget: "normal" },
    "preset senza prezzi": { connection: baseConn, budget: "normal" },
    "unlimited": { connection: priced, budget: "unlimited" },
    "budget a oggetto": { connection: priced, budget: { maxCostPerRun: 2, maxTokensPerDay: 1000 } },
    "budget a oggetto, solo token": { connection: baseConn, budget: { maxTokensPerRun: 1000 } },
    "classe per nome": { connection: { ...baseConn, modelClass: "frontier" } },
    "classe a oggetto": { connection: { ...baseConn, modelClass: { k: 2, maxKeys: 10 } } },
    "maxTokensField false": { connection: { ...baseConn, maxTokensField: false } },
    "tutto insieme": {
      connection: { ...priced, modelClass: "basic", maxTokensField: "max_completion_tokens" },
      budget: "safe", context: { mode: "off" }, languages: ["fr-FR"], tone: "informal", costGuard: 0.1,
    },
  };
  for (const [nome, llm] of Object.entries(variants)) {
    const once = normalizeLlmOptions({ llm });
    let twice;
    try { twice = normalizeLlmOptions({ llm: once }); } catch (e) { twice = e.message; }
    // Infinity e undefined non passano da JSON: si confronta il risultato con l'oggetto stesso.
    eq(nome, true, typeof twice === "object" && deepEqual(once, twice));
  }
  const once = normalizeLlmOptions({ llm: { connection: priced, budget: "normal" } });
  eq("l'etichetta del preset sopravvive", "normal", normalizeLlmOptions({ llm: once }).budget.preset);
  eq("l'etichetta della classe sopravvive", "standard", normalizeLlmOptions({ llm: once }).connection.modelClass.name);
  eq("una classe con valori ritoccati non tiene il nome", "custom",
    normalizeLlmOptions({ llm: { connection: { ...baseConn, modelClass: { name: "expert", k: 2 } } } }).connection.modelClass.name);
  throws("name della classe sconosciuto", () => normalizeLlmOptions({ llm: { connection: { ...baseConn, modelClass: { name: "huge" } } } }), "modelClass.name");
  eq("un preset ritoccato non tiene il nome", "custom", budgetOf({ preset: "normal", maxCostPerRun: 9 }, priced).preset);
  throws("preset del budget sconosciuto", () => budgetOf({ preset: "huge" }), "llm.budget.preset");
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
