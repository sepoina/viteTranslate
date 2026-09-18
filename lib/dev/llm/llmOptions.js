// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Normalizza `defs.llm` in un oggetto completo di default, o `null` se il blocco non c'è.
// Funzione pura: non legge variabili d'ambiente, non tocca il disco, non risolve la chiave
// API. Non importa nient'altro del proprio albero (lib/dev/llm/): lo importa anche il plugin
// (vitetranslate.js), e tirarsi dietro il driver o il keyring vorrebbe dire metterli nel
// bundle `vitetranslate.es.js` per una validazione — stessa disciplina di babelPeer.js.

import validateLanguageTag from "../vite/uty/validateLanguageTag.js";

export const BUDGET_PRESETS = {
  safe: { maxKeysPerRun: 50, maxRequestsPerRun: 20, maxKeysPerDay: 200, maxCharsPerRun: 200000 },
  normal: { maxKeysPerRun: 500, maxRequestsPerRun: 200, maxKeysPerDay: 2000, maxCharsPerRun: 2000000 },
  unlimited: {
    maxKeysPerRun: Infinity,
    maxRequestsPerRun: Infinity,
    maxKeysPerDay: Infinity,
    maxCharsPerRun: Infinity,
  },
};

const LLM_KEYS = new Set(["connection", "driver", "budget", "context", "languages", "tone", "costGuard"]);

const CONNECTION_KEYS = new Set([
  "protocol",
  "baseURL",
  "model",
  "apiKeyEnv",
  "temperature",
  "timeoutMs",
  "maxRetries",
  "maxConcurrency",
  "costMillionInput",
  "costMillionOutput",
  "costUnity",
  "providerOptions",
]);

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function normalizeBudget(raw) {
  if (raw === undefined) return { ...BUDGET_PRESETS.safe, maxCostPerRun: undefined };

  if (typeof raw === "string") {
    if (!(raw in BUDGET_PRESETS)) {
      throw new Error(
        `[vitetranslate] llm.budget "${raw}" is not one of "safe", "normal", "unlimited".`
      );
    }
    return { ...BUDGET_PRESETS[raw], maxCostPerRun: undefined };
  }

  if (!isPlainObject(raw)) {
    throw new Error(`[vitetranslate] llm.budget must be a string ("safe", "normal", "unlimited") or an object.`);
  }

  return { ...BUDGET_PRESETS.safe, maxCostPerRun: undefined, ...raw };
}

/**
 * Normalizza `defs.llm`. `null` se il blocco non c'è: nessun errore, funzione spenta — è il
 * caso di tutti quelli che aggiornano dalla 4.4.
 *
 * @param {object} defs
 * @returns {object | null}
 */
export default function normalizeLlmOptions(defs) {
  const llmKey = Object.keys(defs ?? {}).find((k) => k.toLowerCase() === "llm");
  if (llmKey === undefined) return null;
  const raw = defs[llmKey];

  if (!isPlainObject(raw)) {
    throw new Error(`[vitetranslate] llm must be an object.`);
  }

  for (const key of Object.keys(raw)) {
    if (!LLM_KEYS.has(key)) {
      throw new Error(
        `[vitetranslate] llm.${key} is not a recognised option. Accepted: ${[...LLM_KEYS].join(", ")}.`
      );
    }
  }

  const rawConnection = raw.connection ?? {};
  if (!isPlainObject(rawConnection)) {
    throw new Error(`[vitetranslate] llm.connection must be an object.`);
  }
  for (const key of Object.keys(rawConnection)) {
    if (!CONNECTION_KEYS.has(key)) {
      throw new Error(
        `[vitetranslate] llm.connection.${key} is not a recognised option ` +
        `("providerOptions" is the only free-form passthrough). Accepted: ${[...CONNECTION_KEYS].join(", ")}.`
      );
    }
  }

  if (raw.driver !== undefined && typeof raw.driver !== "function") {
    throw new Error(`[vitetranslate] llm.driver must be a function.`);
  }

  const connection = {
    protocol: rawConnection.protocol ?? "openai-chat",
    baseURL: rawConnection.baseURL,
    model: rawConnection.model,
    apiKeyEnv: rawConnection.apiKeyEnv ?? "VITETRANSLATE_API_KEY",
    temperature: rawConnection.temperature ?? 0.2,
    timeoutMs: rawConnection.timeoutMs ?? 60000,
    maxRetries: rawConnection.maxRetries ?? 3,
    maxConcurrency: rawConnection.maxConcurrency ?? 4,
    costMillionInput: rawConnection.costMillionInput,
    costMillionOutput: rawConnection.costMillionOutput,
    costUnity: rawConnection.costUnity ?? "$",
    providerOptions: rawConnection.providerOptions ?? {},
  };

  if (raw.driver === undefined) {
    if (typeof connection.baseURL !== "string" || connection.baseURL === "") {
      throw new Error(`[vitetranslate] llm.connection.baseURL is required when llm.driver is not set.`);
    }
    if (typeof connection.model !== "string" || connection.model === "") {
      throw new Error(`[vitetranslate] llm.connection.model is required when llm.driver is not set.`);
    }
  }

  if (connection.protocol !== "openai-chat") {
    throw new Error(
      `[vitetranslate] llm.connection.protocol "${connection.protocol}": only "openai-chat" is ` +
      `supported; use \`llm.driver\` for anything else.`
    );
  }

  if (connection.temperature < 0 || connection.temperature > 2) {
    throw new Error(`[vitetranslate] llm.connection.temperature must be within [0, 2].`);
  }
  if (connection.timeoutMs < 1000) {
    throw new Error(`[vitetranslate] llm.connection.timeoutMs must be >= 1000.`);
  }
  if (connection.maxRetries < 0 || connection.maxRetries > 10) {
    throw new Error(`[vitetranslate] llm.connection.maxRetries must be within [0, 10].`);
  }
  if (connection.maxConcurrency < 1 || connection.maxConcurrency > 16) {
    throw new Error(`[vitetranslate] llm.connection.maxConcurrency must be within [1, 16].`);
  }

  const hasCostInput = connection.costMillionInput !== undefined;
  const hasCostOutput = connection.costMillionOutput !== undefined;
  if (hasCostInput !== hasCostOutput) {
    throw new Error(
      `[vitetranslate] llm.connection.costMillionInput and costMillionOutput: give both or neither ` +
      `— a half price is a wrong estimate, not a partial one.`
    );
  }
  if (hasCostInput && (typeof connection.costMillionInput !== "number" || connection.costMillionInput < 0)) {
    throw new Error(`[vitetranslate] llm.connection.costMillionInput must be a number >= 0.`);
  }
  if (hasCostOutput && (typeof connection.costMillionOutput !== "number" || connection.costMillionOutput < 0)) {
    throw new Error(`[vitetranslate] llm.connection.costMillionOutput must be a number >= 0.`);
  }

  if (
    typeof connection.costUnity !== "string" ||
    connection.costUnity === "" ||
    connection.costUnity.length > 8
  ) {
    throw new Error(`[vitetranslate] llm.connection.costUnity must be a non-empty string of at most 8 characters.`);
  }

  const budget = normalizeBudget(raw.budget);
  if (budget.maxCostPerRun !== undefined && !(hasCostInput && hasCostOutput)) {
    throw new Error(
      `[vitetranslate] llm.budget.maxCostPerRun is set without llm.connection.costMillionInput/` +
      `costMillionOutput: without prices it cannot be computed.`
    );
  }

  const costGuard = raw.costGuard;
  if (costGuard !== undefined) {
    if (typeof costGuard !== "number" || !Number.isFinite(costGuard) || costGuard < 0) {
      throw new Error(`[vitetranslate] llm.costGuard must be a finite number >= 0.`);
    }
    if (!(hasCostInput && hasCostOutput)) {
      throw new Error(
        `[vitetranslate] llm.costGuard is set without llm.connection.costMillionInput/costMillionOutput: ` +
        `without prices there is no estimate to compare it with.`
      );
    }
  }

  const rawContext = raw.context ?? {};
  if (!isPlainObject(rawContext)) {
    throw new Error(`[vitetranslate] llm.context must be an object.`);
  }
  const context = {
    mode: rawContext.mode ?? "auto",
    refreshEvery: rawContext.refreshEvery ?? 40,
    sample: rawContext.sample ?? 300,
  };
  if (!["auto", "manual", "off"].includes(context.mode)) {
    throw new Error(`[vitetranslate] llm.context.mode "${context.mode}" is not one of "auto", "manual", "off".`);
  }
  if (context.refreshEvery < 1) {
    throw new Error(`[vitetranslate] llm.context.refreshEvery must be >= 1.`);
  }
  if (context.sample < 10) {
    throw new Error(`[vitetranslate] llm.context.sample must be >= 10.`);
  }

  let languages;
  if (raw.languages !== undefined) {
    if (!Array.isArray(raw.languages) || raw.languages.some((tag) => typeof tag !== "string")) {
      throw new Error(`[vitetranslate] llm.languages must be an array of language tags.`);
    }
    for (const tag of raw.languages) {
      const result = validateLanguageTag(tag);
      if (!result.ok) {
        throw new Error(`[vitetranslate] llm.languages: ${result.reason}`);
      }
    }
    languages = raw.languages;
  }

  return {
    connection,
    driver: raw.driver,
    budget,
    context,
    languages,
    tone: raw.tone,
    costGuard,
  };
}
