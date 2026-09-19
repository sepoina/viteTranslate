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

// Il budget è la spesa dell'utente, in **costo**: i preset valgono per chi ha configurato i
// prezzi. Senza prezzi si ripiega sugli stessi tetti espressi in token (input + output). Una
// sola unità alla volta. I numeri hanno la scala del dollaro o dell'euro: con `costUnity: "¥"`
// vanno riscritti a mano (doc/llm.md).
export const BUDGET_PRESETS = {
  safe: {
    cost: { maxCostPerRun: 0.1, maxCostPerDay: 0.5 },
    tokens: { maxTokensPerRun: 50000, maxTokensPerDay: 200000 },
  },
  normal: {
    cost: { maxCostPerRun: 1, maxCostPerDay: 5 },
    tokens: { maxTokensPerRun: 500000, maxTokensPerDay: 2000000 },
  },
  unlimited: {
    cost: { maxCostPerRun: Infinity, maxCostPerDay: Infinity },
    tokens: { maxTokensPerRun: Infinity, maxTokensPerDay: Infinity },
  },
};
const BUDGET_KEYS = new Set(["maxCostPerRun", "maxCostPerDay", "maxTokensPerRun", "maxTokensPerDay"]);
// `preset` non è un'opzione dell'utente: è l'etichetta che la normalizzazione aggiunge, e che
// rientra qui quando il plugin passa il blocco già normalizzato alla CLI, che lo normalizza di
// nuovo (translatePass.js). Ogni normalizzazione di questo file deve essere idempotente.
const BUDGET_LABEL_KEY = "preset";
const BUDGET_COST_KEYS = ["maxCostPerRun", "maxCostPerDay"];

// Le classi di modello dicono quanto regge il modello, e fissano **in token** la dimensione dei
// lotti (doc/ImplementationPlans/4_6_2.md, "Il concetto"). I valori sono stime di partenza, non
// misure. `maxTokens` è ciò che si manda al provider: lascia margine sopra `maxOutputTokens`,
// che conta anche il ragionamento dei modelli che ragionano (i loro token di pensiero sono
// token di output fatturati, e la taratura del rapporto li include).
export const MODEL_CLASSES = {
  basic:    { k: 1, maxOutputTokens: 1500, maxKeys: 40,  maxTokens: 2048 },
  standard: { k: 3, maxOutputTokens: 3000, maxKeys: 100, maxTokens: 4096 },
  advanced: { k: 4, maxOutputTokens: 4500, maxKeys: 150, maxTokens: 6144 },
  expert:   { k: 5, maxOutputTokens: 6000, maxKeys: 200, maxTokens: 8192 },
  frontier: { k: 6, maxOutputTokens: 8000, maxKeys: 250, maxTokens: 12288 },
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
  "modelClass",
  "maxTokensField",
]);

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function presetBudget(name, hasPrices) {
  return { ...(hasPrices ? BUDGET_PRESETS[name].cost : BUDGET_PRESETS[name].tokens) };
}

// `hasPrices` decide l'unità dei preset: i prezzi si calcolano prima del budget.
function normalizeBudget(raw, hasPrices) {
  const empty = { maxCostPerRun: undefined, maxCostPerDay: undefined, maxTokensPerRun: undefined, maxTokensPerDay: undefined };

  if (raw === undefined || typeof raw === "string") {
    const name = raw ?? "safe";
    if (!(name in BUDGET_PRESETS)) {
      throw new Error(
        `[vitetranslate] llm.budget "${name}" is not one of "safe", "normal", "unlimited".`
      );
    }
    return { ...empty, ...presetBudget(name, hasPrices), preset: name };
  }

  if (!isPlainObject(raw)) {
    throw new Error(`[vitetranslate] llm.budget must be a string ("safe", "normal", "unlimited") or an object.`);
  }

  // Un tetto `undefined` (l'altra unità, in un budget già normalizzato) vale "assente".
  raw = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined));

  for (const key of Object.keys(raw)) {
    if (key === BUDGET_LABEL_KEY) {
      if (!(raw[key] in BUDGET_PRESETS) && raw[key] !== "custom") {
        throw new Error(`[vitetranslate] llm.budget.preset "${raw[key]}" is not one of "safe", "normal", "unlimited", "custom".`);
      }
      continue;
    }
    if (!BUDGET_KEYS.has(key)) {
      throw new Error(
        `[vitetranslate] llm.budget.${key} is not a recognised option. Budget caps are in cost ` +
        `(maxCostPerRun, maxCostPerDay) or, without prices, in tokens (maxTokensPerRun, maxTokensPerDay) — see doc/llm.md.`
      );
    }
    if (typeof raw[key] !== "number" || Number.isNaN(raw[key]) || raw[key] < 0) {
      throw new Error(`[vitetranslate] llm.budget.${key} must be a number >= 0 (or Infinity).`);
    }
  }
  if (!hasPrices) {
    const priced = BUDGET_COST_KEYS.find((key) => key in raw);
    if (priced) {
      throw new Error(
        `[vitetranslate] llm.budget.${priced} is set without llm.connection.costMillionInput/` +
        `costMillionOutput: without prices it cannot be computed.`
      );
    }
  }

  // Un campo esplicito vale sempre, anche se sta nell'altra unità rispetto alla base.
  const { [BUDGET_LABEL_KEY]: label, ...caps } = raw;
  const merged = { ...empty, ...presetBudget("safe", hasPrices), ...caps };

  // Il nome del preset si tiene solo se i tetti sono davvero quelli del preset.
  const isPreset = label in BUDGET_PRESETS &&
    Object.entries(presetBudget(label, hasPrices)).every(([key, value]) => merged[key] === value) &&
    [...BUDGET_KEYS].every((key) => key in presetBudget(label, hasPrices) || merged[key] === undefined);
  return { ...merged, preset: isPreset ? label : "custom" };
}

function normalizeModelClass(raw) {
  if (raw === undefined) return { name: "standard", ...MODEL_CLASSES.standard };

  if (typeof raw === "string") {
    if (!(raw in MODEL_CLASSES)) {
      throw new Error(
        `[vitetranslate] llm.connection.modelClass "${raw}" is not one of ` +
        `${Object.keys(MODEL_CLASSES).map((name) => `"${name}"`).join(", ")}.`
      );
    }
    return { name: raw, ...MODEL_CLASSES[raw] };
  }

  if (!isPlainObject(raw)) {
    throw new Error(`[vitetranslate] llm.connection.modelClass must be a class name or an object.`);
  }
  // `name` è l'etichetta che la normalizzazione aggiunge (vedi BUDGET_LABEL_KEY): si accetta per
  // idempotenza, ma la si tiene solo se i valori sono davvero quelli della classe.
  const { name: label, ...fields } = raw;
  if (label !== undefined && !(label in MODEL_CLASSES) && label !== "custom") {
    throw new Error(
      `[vitetranslate] llm.connection.modelClass.name "${label}" is not one of ` +
      `${Object.keys(MODEL_CLASSES).map((name) => `"${name}"`).join(", ")}, "custom".`
    );
  }
  for (const key of Object.keys(fields)) {
    if (!(key in MODEL_CLASSES.standard)) {
      throw new Error(
        `[vitetranslate] llm.connection.modelClass.${key} is not a recognised option. ` +
        `Accepted: ${Object.keys(MODEL_CLASSES.standard).join(", ")}.`
      );
    }
  }
  const resolved = { ...MODEL_CLASSES.standard, ...fields };

  const { k, maxOutputTokens, maxKeys, maxTokens } = resolved;
  if (typeof k !== "number" || !(k > 0 && k <= 20)) {
    throw new Error(`[vitetranslate] llm.connection.modelClass.k must be a number within (0, 20].`);
  }
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 200) {
    throw new Error(`[vitetranslate] llm.connection.modelClass.maxOutputTokens must be an integer >= 200.`);
  }
  if (!Number.isInteger(maxKeys) || maxKeys < 1 || maxKeys > 1000) {
    throw new Error(`[vitetranslate] llm.connection.modelClass.maxKeys must be an integer within [1, 1000].`);
  }
  if (!Number.isInteger(maxTokens) || maxTokens < maxOutputTokens) {
    throw new Error(
      `[vitetranslate] llm.connection.modelClass.maxTokens must be an integer >= maxOutputTokens ` +
      `(${maxOutputTokens}): otherwise every full batch would be truncated by construction.`
    );
  }
  const isNamed = label in MODEL_CLASSES &&
    Object.entries(MODEL_CLASSES[label]).every(([key, value]) => resolved[key] === value);
  return { name: isNamed ? label : "custom", k, maxOutputTokens, maxKeys, maxTokens };
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
    maxTokensField: rawConnection.maxTokensField ?? "max_tokens",
    modelClass: normalizeModelClass(rawConnection.modelClass),
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

  if (!["max_tokens", "max_completion_tokens", false].includes(connection.maxTokensField)) {
    throw new Error(
      `[vitetranslate] llm.connection.maxTokensField must be "max_tokens", "max_completion_tokens" or false.`
    );
  }

  const budget = normalizeBudget(raw.budget, hasCostInput && hasCostOutput);

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
