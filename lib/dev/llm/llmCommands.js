// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// I comandi LLM della CLI, per non gonfiare cli.js: `maybeRunLlmCommand` restituisce `false`
// se nessun flag LLM è presente, e in quel caso cli.js prosegue esattamente come oggi.
// Ogni flag LLM vive nel namespace `--llm-*` (doc/ImplementationPlans/4_6_0.md): il prefisso è
// il namespace, e un refuso dentro (`--llm-tranlate`) è un errore, non una sync silenziosa.

import { logEchoColored, logRule } from "../../utility.js";
import { localeDirOf } from "../vite/syncCore.js";
import shortPath from "../vite/uty/shortPath.js";
import normalizeLlmOptions from "./llmOptions.js";
import { resolveApiKey, keyringSet, keyringClear, keyringStatus } from "./apiKey.js";
import { readLedger } from "./llmLedger.js";
import { readContextFile, readGeneratedMeta, contextFilePath, contextDir } from "./contextFile.js";
import createDebugTrace, { listDebugTraces } from "./debugTrace.js";
import { callModel } from "./callModel.js";
import { formatCost } from "./costModel.js";
import { printRefusal } from "./llmReport.js";
import translatePass from "./translatePass.js";

const LLM_PREFIX = "--llm-";

// Il catalogo completo. Tutto ciò che comincia per `--llm-` e non è qui è un errore: il
// prefisso è il namespace, e un refuso dentro il namespace non deve diventare una sync silenziosa.
const LLM_COMMANDS = [
  "--llm-translate", "--llm-retranslate", "--llm-context", "--llm-status", "--llm-ping",
  "--llm-key-set", "--llm-key-status", "--llm-key-clear",
];
const LLM_MODIFIERS = ["--llm-dry-run", "--llm-auto", "--llm-noask", "--llm-debug"];
const LLM_KNOWN = new Set([...LLM_COMMANDS, ...LLM_MODIFIERS]);
const KEY_ACTIONS = { "--llm-key-set": "set", "--llm-key-status": "status", "--llm-key-clear": "clear" };

/** I tag che seguono un flag, fino al prossimo argomento che comincia per "-". `null` se il
 *  flag non c'è, `[]` se c'è ma senza tag dietro — sono due casi diversi. Case-insensitive sul
 *  nome del flag, non sui tag che lo seguono. */
function collectTagsAfter(argv, flag) {
  const idx = argv.map((a) => a.toLowerCase()).indexOf(flag.toLowerCase());
  if (idx === -1) return null;
  const tags = [];
  for (let i = idx + 1; i < argv.length && !argv[i].startsWith("-"); i++) tags.push(argv[i]);
  return tags;
}

/** Vero se `argv` contiene un qualunque `--llm-*`: usato anche da cli.js per il rifiuto
 *  `--fastverify` + comando esplicito. */
export function hasAnyLlmFlag(argv) {
  return argv.some((a) => a.toLowerCase().startsWith(LLM_PREFIX));
}

/**
 * Legge i flag LLM da `argv` e applica le regole di combinazione (doc/ImplementationPlans/4_6_0.md,
 * § "Regole di combinazione"). Pura: non legge config né disco.
 *
 * @param {string[]} argv
 * @returns {null | {
 *   translateTags: string[] | null, retranslateTags: string[] | null, context: boolean,
 *   status: boolean, ping: boolean, keyAction: "set" | "status" | "clear" | null,
 *   dryRun: boolean, auto: boolean, noAsk: boolean, debug: boolean,
 * }} `null` se non c'è nessun flag LLM.
 */
export function parseLlmArgs(argv) {
  const low = argv.map((a) => a.toLowerCase());
  const llmArgs = low.filter((a) => a.startsWith(LLM_PREFIX));
  if (llmArgs.length === 0) return null; // regola 1

  const unknown = llmArgs.find((a) => !LLM_KNOWN.has(a));
  if (unknown) { // regola 2
    throw new Error(`[vitetranslate] unknown flag "${unknown}". LLM flags: ${[...LLM_KNOWN].join(", ")}.`);
  }

  if (low.includes("--add") || low.includes("-add") || low.includes("--status") || low.includes("--migrate")) {
    // regola 3
    throw new Error(
      "[vitetranslate] --llm-* flags cannot be combined with --add, --status or --migrate: run them separately."
    );
  }

  const has = (f) => low.includes(f);
  const translate = has("--llm-translate");
  const retranslate = has("--llm-retranslate");
  const context = has("--llm-context");
  const status = has("--llm-status");
  const ping = has("--llm-ping");
  const dryRun = has("--llm-dry-run");
  const auto = has("--llm-auto");
  const noAsk = has("--llm-noask");
  const debug = has("--llm-debug");

  const keyFlags = llmArgs.filter((a) => a in KEY_ACTIONS);
  if (keyFlags.length > 1) { // regola 4
    throw new Error("[vitetranslate] pick one of --llm-key-set, --llm-key-status, --llm-key-clear.");
  }
  if (keyFlags.length === 1 && llmArgs.length > 1) { // regola 4
    throw new Error(`[vitetranslate] ${keyFlags[0]} runs alone.`);
  }

  if (translate && retranslate) { // regola 5
    throw new Error("[vitetranslate] --llm-translate and --llm-retranslate are alternatives: pick one.");
  }

  const translateTags = translate ? collectTagsAfter(argv, "--llm-translate") : null;
  const retranslateTags = retranslate ? collectTagsAfter(argv, "--llm-retranslate") : null;

  if (retranslate && retranslateTags.length === 0) { // regola 6
    throw new Error("[vitetranslate] --llm-retranslate needs at least one language tag, e.g. --llm-retranslate fr-FR");
  }

  if ((status || ping) && (translate || retranslate || context || dryRun || auto || noAsk)) { // regola 7
    throw new Error("[vitetranslate] --llm-status and --llm-ping only combine with each other and with --llm-debug.");
  }

  if (dryRun && !translate && !retranslate && !context) { // regola 8
    throw new Error("[vitetranslate] --llm-dry-run only makes sense with --llm-translate, --llm-retranslate or --llm-context.");
  }

  if (auto && !translate && !retranslate) { // regola 9
    throw new Error("[vitetranslate] --llm-auto only makes sense with --llm-translate or --llm-retranslate.");
  }

  if (noAsk && !translate && !retranslate && !context) { // regola 10
    throw new Error("[vitetranslate] --llm-noask only makes sense with --llm-translate, --llm-retranslate or --llm-context.");
  }

  if (debug && !translate && !retranslate && !context && !ping) { // regola 11
    throw new Error(
      "[vitetranslate] --llm-debug only makes sense with --llm-translate, --llm-retranslate, --llm-context or --llm-ping."
    );
  }

  return {
    translateTags, retranslateTags, context, status, ping,
    keyAction: keyFlags.length ? KEY_ACTIONS[keyFlags[0]] : null,
    dryRun, auto, noAsk, debug,
  };
}

async function readSecretLine() {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasTTY = stdin.isTTY;
    let input = "";
    if (wasTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\n" || char === "\r" || char === "") {
        stdin.removeListener("data", onData);
        if (wasTTY) stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write("\n");
        resolve(input);
        return;
      }
      if (char === "") process.exit(130); // Ctrl+C
      if (char === "") { input = input.slice(0, -1); return; }
      input += char;
    };
    stdin.on("data", onData);
  });
}

async function runKeyCommand(config, action) {
  const llm = normalizeLlmOptions(config);
  if (llm === null || llm.driver) {
    throw new Error("[vitetranslate] --llm-key-* needs an `llm.connection` configured (not `llm.driver`).");
  }
  const account = llm.connection.apiKeyEnv;

  if (action === "set") {
    process.stdout.write(`Paste the API key for "${account}" (input hidden): `);
    const value = await readSecretLine();
    await keyringSet(account, value);
    logEchoColored("llm", `key stored in the keyring for "${account}".`);
  } else if (action === "clear") {
    await keyringClear(account);
    logEchoColored("llm", `key removed from the keyring for "${account}".`);
  } else {
    const status = await keyringStatus(account);
    const text = !status.available
      ? "keyring not available (package not installed, or no Secret Service here)."
      : status.present
        ? `key present for "${account}".`
        : `no key stored for "${account}".`;
    logEchoColored("llm", `keyring: ${text}`);
  }
}

async function runLlmStatus(config, { ping, debug }) {
  const llm = normalizeLlmOptions(config);
  if (llm === null) {
    logEchoColored("llm", "not configured — add an `llm` block to vite.config. See doc/llm.md.", "warning");
    return;
  }

  const localeDir = localeDirOf(config);

  let keyInfo = "n/a (llm.driver is set)";
  let apiKey;
  if (!llm.driver) {
    try {
      const resolved = await resolveApiKey({ connection: llm.connection, baseDir: config.baseDir });
      keyInfo = resolved.from;
      apiKey = resolved.key;
      debug?.setSecret(resolved.key);
      debug?.write("api-key", { from: resolved.from });
    } catch {
      keyInfo = "not found";
    }
  }

  const ledger = readLedger(config.baseDir);
  const contextText = readContextFile(localeDir);
  const meta = readGeneratedMeta(contextText);

  logEchoColored(
    "llm",
    llm.driver ? "connection: custom driver" : `connection: ${llm.connection.baseURL} (${llm.connection.model})`
  );
  logEchoColored("", `API key: ${keyInfo}`);

  let contextLine;
  if (contextText === null) {
    contextLine = "context: not generated yet — --llm-translate or --llm-context creates it";
  } else if (meta === null) {
    contextLine = `context: ${shortPath(contextFilePath(localeDir))} · ${contextText.length} byte(s) · hand-written, never regenerated`;
  } else {
    contextLine = `context: ${shortPath(contextFilePath(localeDir))} · ${contextText.length} byte(s) · generated ${meta.date} · ${meta.keys} keys · ${meta.model}`;
  }
  logEchoColored("", contextLine);

  logEchoColored("", `today: ${ledger.keysToday} key(s), ${formatCost(ledger.costToday, llm.connection.costUnity)}`);
  logEchoColored(
    "",
    llm.costGuard !== undefined
      ? `costGuard: ${formatCost(llm.costGuard, llm.connection.costUnity)} — no confirmation below it`
      : "costGuard: off — always asks"
  );

  const traces = listDebugTraces(localeDir);
  if (traces.length > 0) {
    logEchoColored(
      "",
      `debug traces: ${traces.length} in ${shortPath(contextDir(localeDir))} (latest ${traces[traces.length - 1]})`
    );
  }

  if (ping) {
    try {
      await callModel({
        connection: llm.connection, driver: llm.driver, apiKey,
        systemPrompt: 'Reply with the JSON object {"ping":"pong"} and nothing else.',
        userPayload: "{}", debug, label: "ping",
      });
      logEchoColored("", "ping: ok");
    } catch (error) {
      logEchoColored("", `ping: failed (${error.message})`, "warning");
    }
  }

  if (contextText !== null) {
    logRule();
    // Regola di stile: l'abstract resta grezzo (mai logEchoColored) per poterlo copiare o
    // mandare in pipe, come faceva `--context --show` nella 4.5.0.
    console.log(contextText);
  }
}

function describeLlm(config) {
  let llm;
  try {
    llm = normalizeLlmOptions(config);
  } catch (e) {
    return { invalid: e.message };
  }
  if (llm === null) return null;
  return { ...llm, driver: llm.driver ? "custom function" : "built-in openai-chat" };
}

/** Il bug della 4.5.0: un rifiuto dei tetti, della guardia CI o della conferma non stampava
 *  niente ed usciva con 0. "declined" (l'utente ha risposto no) non è un fallimento: exit 0.
 *  Ogni altro rifiuto: exit 1 — è quello che serve a una CI per accorgersi che non ha
 *  tradotto niente. */
function reportOutcome(result) {
  if (result.mode === "refused") {
    printRefusal(result.message);
    if (!result.declined) process.exitCode = 1;
  } else if (result.mode === "nothing-to-do") {
    logEchoColored("LLM", "nothing to translate: every target language is complete.");
  } else if (result.mode === "context") {
    if (result.regenerated) {
      logEchoColored("LLM", "context abstract regenerated.");
    } else if (result.reason === "off") {
      logEchoColored("LLM", "context abstract left as it is (llm.context.mode is \"off\").");
    } else if (result.reason === "unmanaged") {
      logEchoColored("LLM", "context abstract left as it is (hand-written, never regenerated).");
    } else {
      logEchoColored("LLM", "context abstract left as it is.");
    }
  }
}

/**
 * @param {string[]} argv
 * @param {object} config - `vitetranslateConfig`, come da `loadConfig()`
 * @returns {Promise<boolean>} `false` se nessun flag LLM è presente: cli.js prosegue come oggi.
 */
export default async function maybeRunLlmCommand(argv, config) {
  const args = parseLlmArgs(argv);
  if (args === null) return false;

  if (args.keyAction) {
    await runKeyCommand(config, args.keyAction);
    return true;
  }

  const debug = args.debug ? createDebugTrace({ localeDir: localeDirOf(config) }) : null;
  debug?.write("run", {
    argv, cwd: process.cwd(), baseDir: config.baseDir, localeDir: config.localeDir,
    sourceLanguage: config.sourceLanguage, flags: args, llm: describeLlm(config),
  });

  let ranPass = false;
  try {
    if (args.status || args.ping) {
      await runLlmStatus(config, { ping: args.ping, debug });
      return true;
    }

    const result = await translatePass({
      config,
      tags: args.translateTags?.length ? args.translateTags : null,
      dryRun: args.dryRun, auto: args.auto, noAsk: args.noAsk,
      contextOnly: args.context && !args.translateTags && !args.retranslateTags,
      forceContext: args.context,
      retranslateTags: args.retranslateTags,
      debug,
    });
    ranPass = true;
    reportOutcome(result);
    return true;
  } catch (error) {
    debug?.write("fatal-error", { message: error.message, stack: error.stack });
    throw error;
  } finally {
    // La trace, e poi la traversa che chiude il blocco LLM. `ranPass` la tiene fuori da
    // `--llm-status`/`--llm-ping`, che hanno le loro traverse.
    if (debug?.dir) logEchoColored("--llm-debug", `${shortPath(debug.dir)} (${debug.count} file(s))`);
    if (ranPass) logRule();
  }
}
