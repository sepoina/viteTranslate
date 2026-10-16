// Architettura d'insieme: doc/structure.md § "Distribuzione del pacchetto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// DOCS-PAGE: api/plugin-options, api/types, concepts/diagnostics, getting-started/faq — the user manual describes this behaviour; update it and run npm run docs:seal (AGENTS.md).

/// <reference path="./virtual.d.ts" />

/**
 * Cosa si vede a schermo quando una stringa non arriva dove doveva.
 *
 * I primi quattro sono diagnostiche. Tre di essi sono prefissi davanti al testo, e vale il più
 * grave e uno solo: malformato, poi non tradotto qui, poi non tradotto altrove. `badData` non
 * ha un testo davanti a cui stare — è il caso in cui testo non ce n'è — e non compete con gli
 * altri. Ognuno si spegne da solo passando `""` o `false`.
 *
 * Questi nomi sono anche quelli che il runtime legge dal modulo virtuale: la risoluzione a
 * build time copia e spegne, non rinomina.
 */
export interface ErrorSolveMarks {
  /**
   * Nella posizione del testo è arrivato un valore che testo non è e non lo diventerà: una
   * funzione, un simbolo, un elemento React nel primo posto della tupla. Niente da salvare,
   * quindi il glifo non precede un testo — è tutto ciò che si rende, seguito dal nome di ciò
   * che si è trovato: `🚫[func]`, `🚫[symbol]`, `🚫[badDom]`. Spento, non si rende niente.
   * Default: `"🚫"`.
   */
  badData?: string | false;
  /**
   * Testo che la traduzione non ha mai visto (un `_%_..._%_` sfuggito al transform, o un
   * valore che marcato non è mai stato) e prop incompatibili fra loro. Default: `"‼️"`.
   */
  malformed?: string | false;
  /**
   * La lingua corrente non ha una traduzione per questa voce: a schermo c'è il testo della
   * lingua sorgente. Default: `"🔸"`.
   */
  untranslated?: string | false;
  /**
   * Tradotta qui, ma assente in almeno un'altra lingua del progetto. Default: `"🔹"`.
   */
  notFullyTranslated?: string | false;
  /**
   * Segnaposto `%s` rimasto senza valore. **Non** è una diagnostica ma una resa normale:
   * vale in sviluppo e in build, e `markOnlyDev` non lo tocca. Default: `"⁇"`.
   */
  absentDataInArray?: string;
}

/**
 * Cosa succede quando una stringa non arriva dove doveva: un testo che nessuno ha marcato,
 * prop incompatibili fra loro, una voce senza traduzione.
 *
 * Due domande separate: `mark` è **cosa** si vede, il resto è **quando** — a schermo con
 * `markOnlyDev`, in console con `warningDev` / `warningBuild`.
 */
export interface ErrorSolveOptions {
  /** I glifi mostrati a schermo. Ogni campo omesso resta al proprio default. */
  mark?: ErrorSolveMarks;
  /**
   * In build nessun mark diagnostico a schermo: si mostra il fallback e basta. Non tocca
   * `mark.absentDataInArray`, che diagnostica non è. Default: `true`.
   */
  markOnlyDev?: boolean;
  /** Output console del runtime in sviluppo. Default: `true`. */
  warningDev?: boolean;
  /**
   * Output console del runtime in produzione. Default: `false`.
   *
   * Governa **tutto** ciò che la libreria stampa nel browser, comprese le segnalazioni su
   * lingua iniziale non precaricata, tag inesistente e chunk non caricato: con il default
   * un'app pubblicata tace del tutto. I messaggi del plugin (a build time, prefissati
   * `[vitetranslate]`) non passano di qui.
   */
  warningBuild?: boolean;
}

/** Opzioni ICU (vedi la guida ICU: https://sepoina.github.io/viteTranslate/docs/concepts/icu/), il default di build per i messaggi `{n, date}`/`{n, time}`. */
export interface IcuOptions {
  /**
   * Fuso IANA di default (es. `"Europe/Rome"`) per i messaggi ICU `date`/`time`, quando non lo
   * dà la prop `timeZone` di `<TranslateContainer>`. Senza nessuno dei due si usa il fuso del
   * runtime (il browser, o il server in SSR).
   */
  timeZone?: string;
}

// LINKED-DATA: the `llm` types mirror what lib/dev/llm/llmOptions.js accepts (LLM_KEYS, CONNECTION_KEYS, the
// presets) and the driver contract of lib/dev/llm/callModel.js: change one, change the other.

/** How much a model can take: sizes the batches and caps `max_tokens` (https://sepoina.github.io/viteTranslate/docs/llm/price/#model-class). */
export type LlmModelClassName = "basic" | "standard" | "advanced" | "expert" | "frontier";

/** A model class of your own, merged over `"standard"`. */
export interface LlmModelClass {
  /** A batch closes when its payload reaches `k` times the prompt overhead. `(0, 20]`. */
  k?: number;
  /** Expected output tokens of a full batch, reasoning included. Integer, at least 200. */
  maxOutputTokens?: number;
  /** Keys per batch, at most. Integer within `[1, 1000]`. */
  maxKeys?: number;
  /** The ceiling of the `max_tokens` a request sends. Integer, at least `maxOutputTokens`. */
  maxTokens?: number;
}

/** `llm.connection`: where the model is and how to talk to it (https://sepoina.github.io/viteTranslate/docs/llm/options/#connection). */
export interface LlmConnection {
  /** The only value accepted; for anything else, `llm.driver`. Default `"openai-chat"`. */
  protocol?: "openai-chat";
  /** Chat Completions endpoint, `/chat/completions` is appended. Required without a `driver`. */
  baseURL?: string;
  /** Required without a `driver`. */
  model?: string;
  /** The NAME of the variable holding the key, never the key. Looked up in the environment, `.env.local`, `.env`, the keyring. Default `"VITETRANSLATE_API_KEY"`. */
  apiKeyEnv?: string;
  /** `[0, 2]`. Default `0.2`. */
  temperature?: number;
  /** Per request, at least 1000. Default `60000`. */
  timeoutMs?: number;
  /** Retries on 429, 5xx and network errors, `[0, 10]`. Default `3`. */
  maxRetries?: number;
  /** Requests in flight at the same time, `[1, 16]`. Default `4`. */
  maxConcurrency?: number;
  /** Price per million input tokens. Both prices or neither. */
  costMillionInput?: number;
  /** Price per million output tokens. Both prices or neither. */
  costMillionOutput?: number;
  /** Currency symbol printed in front of costs, at most 8 characters. Default `"$"`. */
  costUnity?: string;
  /** Extra fields merged last into the request body, for provider-specific settings (`reasoning`, `thinking`…). */
  providerOptions?: Record<string, unknown>;
  /** Default `"standard"`. */
  modelClass?: LlmModelClassName | LlmModelClass;
  /** Name of the output-limit field, or `false` to send none. Default `"max_tokens"`. */
  maxTokensField?: "max_tokens" | "max_completion_tokens" | false;
}

/** `llm.connection` as a driver receives it: every default filled in. */
export interface LlmResolvedConnection extends LlmConnection {
  protocol: "openai-chat";
  apiKeyEnv: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  maxConcurrency: number;
  costUnity: string;
  providerOptions: Record<string, unknown>;
  maxTokensField: "max_tokens" | "max_completion_tokens" | false;
  modelClass: Required<LlmModelClass> & { name: LlmModelClassName | "custom" };
}

/** Spending caps of your own, merged over `"safe"`: in cost with prices set, in tokens (input + output) without (https://sepoina.github.io/viteTranslate/docs/llm/price/#budget-caps). */
export interface LlmBudget {
  maxCostPerRun?: number;
  maxCostPerDay?: number;
  maxTokensPerRun?: number;
  maxTokensPerDay?: number;
}

/** `llm.context`: the project brief the model reads before every translation (https://sepoina.github.io/viteTranslate/docs/llm/context/). */
export interface LlmContextOptions {
  /** `"auto"` regenerates it when missing or grown, `"manual"` only on `--llm-context`, `"off"` never (but reads it). Default `"auto"`. */
  mode?: "auto" | "manual" | "off";
  /** Regenerate after this many new keys, at least 1. Default `40`. */
  refreshEvery?: number;
  /** Strings that feed the abstract, at least 10. Default `300`. */
  sample?: number;
}

/** A reply's token count in the library's shape. A `cost` is counted instead of your prices. */
export interface LlmUsage {
  tokensIn: number;
  tokensOut: number;
  /** The part of `tokensOut` spent reasoning. */
  reasoningOut?: number;
  cachedIn?: number;
  cost?: number;
}

/** A Chat Completions `usage` as the provider sent it: the library maps it to `LlmUsage`. */
export interface LlmChatCompletionsUsage {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
  cost?: number;
  [field: string]: unknown;
}

/** What a driver receives (https://sepoina.github.io/viteTranslate/docs/llm/custom-endpoint/#what-a-driver-receives). */
export interface LlmDriverParams {
  connection: LlmResolvedConnection;
  /** Found through `connection.apiKeyEnv` like the built-in client's, `undefined` if there is none. */
  apiKey: string | undefined;
  systemPrompt: string;
  userPayload: string;
  /** `"context"` asks for the project brief as free text, not for translations. */
  mode: "translate" | "context";
  /** The output limit this request is worth; ignore it if your API has none. */
  maxTokens: number | undefined;
  /**
   * The library's HTTP call, same signature as `fetch`: timeout, a non-2xx reply turned into the
   * error the retries read, the key kept out of every message, the `--llm-debug` trace.
   */
  fetch: typeof fetch;
}

/**
 * What a driver returns. `{ content, truncated, usage }` hands the model's text to the library, which reads
 * it like its own client (tolerant parser, truncated replies salvaged, `mode: "context"` included). The
 * others are already parsed: translations keyed like the request, or for `mode: "context"` the text.
 */
export type LlmDriverResult =
  | { content: string; truncated?: boolean; usage?: LlmUsage | LlmChatCompletionsUsage | null }
  | { translations: Record<string, string>; usage?: LlmUsage | LlmChatCompletionsUsage | null }
  | Record<string, string>
  | { text: string; usage?: LlmUsage | LlmChatCompletionsUsage | null }
  | string;

/** Your own client instead of the built-in one. Throw an error with a `status` to get the built-in retries and stops. */
export type LlmDriver = (params: LlmDriverParams) => LlmDriverResult | Promise<LlmDriverResult>;

/** The `llm` option: what `vitetranslate --llm-translate` uses. The plugin only validates it (https://sepoina.github.io/viteTranslate/docs/llm/options/). */
export interface LlmOptions {
  connection?: LlmConnection;
  driver?: LlmDriver;
  /** A preset or caps of your own. Default `"safe"`. */
  budget?: "safe" | "normal" | "unlimited" | LlmBudget;
  /** Below this estimated cost, no confirmation. Needs both prices. */
  costGuard?: number;
  context?: LlmContextOptions;
  /** Which languages `--llm-translate` fills. Default: every table in `localeDir`, the source language excluded. */
  languages?: string[];
  /** A free-text line added to every translation prompt, e.g. `"informal, second person"`. */
  tone?: string;
}

/** Opzioni di `vitetranslate(...)`, da registrare fra i `plugins` di vite.config. */
export interface VitetranslateOptions {
  /** Cartella con i file di lingua (`.yml`), relativa a `baseDir` (es. `"src/locale"`). */
  localeDir: string;
  /** Tag BCP 47 della lingua in cui sono scritte le stringhe sorgente (es. `"it-IT"`). */
  sourceLanguage: string;
  /**
   * Lingue incluse staticamente nel bundle iniziale, per un primo paint senza sospensione.
   * In sviluppo `sourceLanguage` è precaricata comunque; in build solo se questo elenco è
   * vuoto (ogni tabella compilata è autonoma, quindi spedirla sarebbe una copia in più).
   * La prima della lista è la lingua iniziale di default di `TranslateContainer`.
   */
  preloadedLanguages?: string[];
  /** Radice del progetto usata per risolvere `localeDir` e `srcDir`. Default: `process.cwd()`. */
  baseDir?: string;
  /** Cartella dei sorgenti scansionata dalla CLI. Default: `"src"`. */
  srcDir?: string;
  /**
   * Sincronizza le tabelle all'avvio del **dev server**, dentro l'hook `config` di Vite —
   * cioè prima che il server esista. Rende inutile lo script `predev`. Usa la verifica
   * veloce: quando nessun sorgente è cambiato dall'ultima sincronizzazione non fa nulla e
   * non stampa nulla. Default: `true`. A `false` si torna al comportamento precedente alla
   * 4.2, in cui scrive solo `vtranslate-cli`.
   */
  autoSyncDev?: boolean;
  /**
   * Come `autoSyncDev`, ma prima di una **build**, e con la scansione piena invece della
   * verifica veloce: davanti a una build vale la certezza di tabelle appena ricostruite.
   * Rende inutile lo script `prebuild`. Default: `true`.
   *
   * Vale per entrambe: solo `false` spegne: qualunque altro valore conta come acceso. La
   * variabile d'ambiente `VITETRANSLATE_NO_SYNC` le spegne tutte e due senza toccare
   * `vite.config.*`.
   */
  autoSyncBuild?: boolean;
  /**
   * Incorpora il testo originale come fallback nel marcatore compilato.
   * Default: `true` in sviluppo, `false` in produzione (risolto da `configResolved`).
   */
  includeFallback?: boolean;
  /**
   * Fa rendere davvero il testo JSX e gli attributi marcati che nessun componente avvolge.
   * Senza, un `<p>_%_ciao_%_</p>` o un `title="_%_ciao_%_"` stampano il marcatore compilato.
   *
   * - `false` (default): nessuna riscrittura.
   * - `true`: acceso, su tutti i tag host tranne `script`, `style`, `title` e `textarea`, che
   *   accettano solo testo e ricevono comunque la forma a stringa.
   * - `RegExp`: acceso, e il testo figlio si riscrive solo sotto i tag che la soddisfano
   *   (`/^(p|span|li|h[1-6])$/`). I quattro tag di sopra restano esclusi comunque.
   *
   * Non tocca il testo dentro un componente, né gli attributi di un componente: lì il
   * marcatore compilato va inoltrato a `<Translate>` o a `ts()`, che è ciò che fa già.
   * Default: `false`.
   */
  autoWrap?: boolean | RegExp;
  /**
   * Il delimitatore del marcatore, uguale ai due capi (`"§"` → `"§ciao§"`). Default `"_%_"`.
   * `markerStart` e `markerEnd`, se presenti, lo correggono per il loro capo.
   *
   * Vietati: spazi, caratteri di controllo, `< > { } " ' \` \ &` e `%s`. Consiglio: almeno due
   * caratteri, oppure un simbolo Unicode che nel testo non compare mai (`≼`, `≽`): ogni stringa che
   * lo contiene senza esserne avvolta produce un avviso.
   */
  marker?: string;
  /** Il delimitatore d'apertura. Default: `marker`, o `"_%_"`. */
  markerStart?: string;
  /** Il delimitatore di chiusura. Default: `marker`, o `"_%_"`. */
  markerEnd?: string;
  /**
   * Diagnostica a schermo e in console per le stringhe che non arrivano dove dovevano.
   * Ogni campo è facoltativo; omettere l'opzione lascia tutti i default.
   */
  errorSolve?: ErrorSolveOptions;
  /**
   * Log del plugin senza colonna d'etichetta né traverse: solo `:::` e il testo, indentato.
   * Stessi colori, righe più corte. Utile in CI o in un terminale stretto. Default: `false`.
   */
  simpleLog?: boolean;
  /** Il default di build per i messaggi ICU `date`/`time` (vedi la guida ICU: https://sepoina.github.io/viteTranslate/docs/concepts/icu/). */
  icu?: IcuOptions;
  /** Translation through an LLM, from the CLI only (`vitetranslate --llm-translate`): never inside a Vite hook. */
  llm?: LlmOptions;
}

/**
 * Plugin Vite: estrae i marcatori (`_%_…_%_` di serie), compila i file di lingua e serve il modulo
 * virtuale `virtual:vitetranslate/languages`. Restituisce **due** plugin, da inserire così
 * com'è nell'array `plugins` (Vite appiattisce gli array annidati).
 *
 * Il tipo di ritorno è volutamente largo: `Plugin` di Vite non è importabile qui, perché
 * `vite` è una peer dependency opzionale e il tipo non esisterebbe per chi usa solo il
 * runtime React. Le opzioni, che sono la parte che vale la pena controllare, sono tipate.
 */
export function vitetranslate(options: VitetranslateOptions): any[];

// `babelTranslate` era esportato fino alla 2.1.4: un plugin Babel che faceva la stessa
// estrazione fuori dal plugin Vite. Nessun percorso della libreria lo usava più (l'estrazione
// è passata a un parse + splice, molto più rapido) e non è mai stato documentato. Ora vive
// solo come implementazione di riferimento nei test, dove serve a dimostrare che quella
// veloce è corretta.
