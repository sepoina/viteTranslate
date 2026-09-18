// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// I comandi LLM della CLI, per non gonfiare cli.js: `maybeRunLlmCommand` restituisce `false`
// se nessun flag LLM è presente, e in quel caso cli.js prosegue esattamente come oggi.

import { logEchoColored } from "../../utility.js";
import { localeDirOf } from "../vite/syncCore.js";
import normalizeLlmOptions from "./llmOptions.js";
import { resolveApiKey, keyringSet, keyringClear, keyringStatus } from "./apiKey.js";
import { readLedger } from "./llmLedger.js";
import { readContextFile } from "./contextFile.js";
import { callModel } from "./callModel.js";
import { formatCost } from "./costModel.js";
import translatePass from "./translatePass.js";

const LLM_FLAGS = ["--translate", "--retranslate", "--context", "--llm-status", "--key"];

function lower(argv) {
  return argv.map((a) => a.toLowerCase());
}

function hasFlag(argv, flag) {
  return lower(argv).includes(flag.toLowerCase());
}

/** I tag che seguono un flag, fino al prossimo argomento che comincia per "-". `null` se il
 *  flag non c'è, `[]` se c'è ma senza tag dietro — sono due casi diversi. */
function collectTagsAfter(argv, flag) {
  const idx = lower(argv).indexOf(flag.toLowerCase());
  if (idx === -1) return null;
  const tags = [];
  for (let i = idx + 1; i < argv.length && !argv[i].startsWith("-"); i++) tags.push(argv[i]);
  return tags;
}

/** Vero se `argv` contiene un qualunque flag LLM: usato anche da cli.js per estendere il
 *  rifiuto `--fastverify` + comando esplicito. */
export function hasAnyLlmFlag(argv) {
  return LLM_FLAGS.some((flag) => hasFlag(argv, flag));
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
      if (char === "\n" || char === "\r" || char === "") {
        stdin.removeListener("data", onData);
        if (wasTTY) stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write("\n");
        resolve(input);
        return;
      }
      if (char === "") process.exit(130); // Ctrl+C
      if (char === "") { input = input.slice(0, -1); return; }
      input += char;
    };
    stdin.on("data", onData);
  });
}

async function runKeyCommand(config, action) {
  const llm = normalizeLlmOptions(config);
  if (llm === null || llm.driver) {
    throw new Error("[vitetranslate] --key needs an `llm.connection` configured (not `llm.driver`).");
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
  } else if (action === "status") {
    const status = await keyringStatus(account);
    const text = !status.available
      ? "keyring not available (package not installed, or no Secret Service here)."
      : status.present
        ? `key present for "${account}".`
        : `no key stored for "${account}".`;
    logEchoColored("llm", `keyring: ${text}`);
  } else {
    throw new Error(`[vitetranslate] --key needs "set", "clear" or "status", got "${action ?? ""}".`);
  }
}

async function runLlmStatus(config, { ping }) {
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
    } catch {
      keyInfo = "not found";
    }
  }

  const ledger = readLedger(config.baseDir);
  const contextText = readContextFile(localeDir);

  logEchoColored(
    "llm",
    llm.driver ? "connection: custom driver" : `connection: ${llm.connection.baseURL} (${llm.connection.model})`
  );
  logEchoColored("", `API key: ${keyInfo}`);
  logEchoColored("", contextText ? `context: ${contextText.length} byte(s)` : "context: not generated yet");
  logEchoColored("", `today: ${ledger.keysToday} key(s), ${formatCost(ledger.costToday, llm.connection.costUnity)}`);

  if (!ping) return;

  try {
    await callModel({
      connection: llm.connection, driver: llm.driver, apiKey,
      systemPrompt: 'Reply with the JSON object {"ping":"pong"} and nothing else.',
      userPayload: "{}",
    });
    logEchoColored("", "ping: ok");
  } catch (error) {
    logEchoColored("", `ping: failed (${error.message})`, "warning");
  }
}

/**
 * @param {string[]} argv
 * @param {object} config - `vitetranslateConfig`, come da `loadConfig()`
 * @returns {Promise<boolean>} `false` se nessun flag LLM è presente: cli.js prosegue come oggi.
 */
export default async function maybeRunLlmCommand(argv, config) {
  const translateTags = collectTagsAfter(argv, "--translate");
  const retranslateTags = collectTagsAfter(argv, "--retranslate");
  const contextFlag = hasFlag(argv, "--context");
  const showFlag = hasFlag(argv, "--show");
  const dryRunFlag = hasFlag(argv, "--dry-run") || hasFlag(argv, "--dryrun");
  const statusFlag = hasFlag(argv, "--llm-status") || hasFlag(argv, "--llmstatus");
  const pingFlag = hasFlag(argv, "--ping");
  const forceFlag = hasFlag(argv, "--force");
  const yesFlag = hasFlag(argv, "--yes");
  const keyIdx = lower(argv).indexOf("--key");
  const keyAction = keyIdx !== -1 ? argv[keyIdx + 1] : null;

  const isTranslate = translateTags !== null;
  const isRetranslate = retranslateTags !== null;
  const hasKey = keyIdx !== -1;

  // `--dry-run` e `--ping` non bastano da soli a riconoscere un comando LLM (non dicono COSA
  // fare), ma se ci sono devono comunque arrivare ai controlli di combinazione qui sotto: senza
  // questa riga "--dry-run" da solo passerebbe inosservato invece di essere rifiutato.
  if (!isTranslate && !isRetranslate && !contextFlag && !statusFlag && !hasKey && !dryRunFlag && !pingFlag) return false;

  if (isTranslate && (hasFlag(argv, "--status") || hasFlag(argv, "--migrate"))) {
    throw new Error("[vitetranslate] --translate cannot be combined with --status or --migrate.");
  }
  if (isRetranslate && retranslateTags.length === 0) {
    throw new Error("[vitetranslate] --retranslate needs at least one language tag, e.g. --retranslate fr-FR");
  }
  if (dryRunFlag && !isTranslate && !isRetranslate && !contextFlag) {
    throw new Error("[vitetranslate] --dry-run only makes sense with --translate, --retranslate or --context.");
  }
  if (pingFlag && !statusFlag) {
    throw new Error("[vitetranslate] --ping only makes sense with --llm-status.");
  }

  if (statusFlag) {
    await runLlmStatus(config, { ping: pingFlag });
    return true;
  }

  if (hasKey) {
    await runKeyCommand(config, keyAction);
    return true;
  }

  if (contextFlag && showFlag && !isTranslate && !isRetranslate) {
    const result = await translatePass({ config, showContext: true });
    console.log(result.text ?? "(no context file yet — run --context first)");
    return true;
  }

  const contextOnly = contextFlag && !isTranslate && !isRetranslate;
  const tags = isTranslate && translateTags.length > 0 ? translateTags : null;

  await translatePass({
    config, tags, dryRun: dryRunFlag, force: forceFlag, yes: yesFlag,
    contextOnly, forceContext: contextFlag, retranslateTags: isRetranslate ? retranslateTags : null,
  });
  return true;
}
