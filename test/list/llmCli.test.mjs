// Strato 12: llmCommands.js — il parser `parseLlmArgs` (puro) più due test di integrazione.
//
//   node test/list/llmCli.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import maybeRunLlmCommand, { hasAnyLlmFlag, parseLlmArgs } from "../../lib/dev/llm/llmCommands.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const throwsMsg = (nome, fn, contains) => {
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

const notThrows = (nome, fn) => {
  try {
    fn();
    console.log("  ok  ", nome.padEnd(52), "-> non lancia");
  } catch (e) {
    fail++;
    console.log("  KO  ", nome.padEnd(52), "-> ha lanciato:", e.message);
  }
};

// --------------------------------------------------------------- D1
console.log("\n== D1 nessun --llm-* -> null ==");
eq("nessun flag -> null", null, parseLlmArgs([]));
eq("vecchi flag non sono più LLM -> null", null, parseLlmArgs(["--translate"]));
eq("hasAnyLlmFlag falso con vecchi flag", false, hasAnyLlmFlag(["--translate", "--force"]));

// --------------------------------------------------------------- D2
console.log("\n== D2 refuso nel namespace ==");
throwsMsg("--llm-tranlate -> unknown flag", () => parseLlmArgs(["--llm-tranlate"]), "unknown flag");

// --------------------------------------------------------------- D3
console.log("\n== D3 regole 3-11 ==");
throwsMsg("regola 3: --add", () => parseLlmArgs(["--llm-translate", "--add", "fr-FR"]), "--add");
throwsMsg("regola 3: --status", () => parseLlmArgs(["--llm-translate", "--status"]), "--status");
throwsMsg("regola 3: --migrate", () => parseLlmArgs(["--llm-translate", "--migrate"]), "--migrate");
throwsMsg("regola 4: due --llm-key-*", () => parseLlmArgs(["--llm-key-set", "--llm-key-status"]), "pick one of");
throwsMsg("regola 4: --llm-key-* con altro flag", () => parseLlmArgs(["--llm-key-set", "--llm-debug"]), "runs alone");
throwsMsg("regola 5: translate + retranslate", () => parseLlmArgs(["--llm-translate", "--llm-retranslate", "fr-FR"]), "alternatives");
throwsMsg("regola 6: retranslate senza tag", () => parseLlmArgs(["--llm-retranslate"]), "at least one language tag");
throwsMsg("regola 7: status + translate", () => parseLlmArgs(["--llm-status", "--llm-translate"]), "only combine");
throwsMsg("regola 7: ping + dry-run", () => parseLlmArgs(["--llm-ping", "--llm-dry-run"]), "only combine");
throwsMsg("regola 8: dry-run da solo", () => parseLlmArgs(["--llm-dry-run"]), "only makes sense");
throwsMsg("regola 9: auto da solo", () => parseLlmArgs(["--llm-auto"]), "only makes sense");
throwsMsg("regola 9: auto con solo context", () => parseLlmArgs(["--llm-context", "--llm-auto"]), "only makes sense");
throwsMsg("regola 10: noask da solo", () => parseLlmArgs(["--llm-noask"]), "only makes sense");
throwsMsg("regola 11: debug da solo", () => parseLlmArgs(["--llm-debug"]), "only makes sense");

// --------------------------------------------------------------- D4
console.log("\n== D4 case-insensitive ==");
eq("--LLM-Translate riconosciuto", ["fr-FR"], parseLlmArgs(["--LLM-Translate", "fr-FR"])?.translateTags);
eq("hasAnyLlmFlag riconosce --LLM-CONTEXT", true, hasAnyLlmFlag(["--LLM-CONTEXT"]));

// --------------------------------------------------------------- D5
console.log("\n== D5 combinazioni valide ==");
notThrows(
  "translate+context+dry-run+auto+noask+debug",
  () => parseLlmArgs(["--llm-translate", "--llm-context", "--llm-dry-run", "--llm-auto", "--llm-noask", "--llm-debug"])
);
notThrows("ping+debug", () => parseLlmArgs(["--llm-ping", "--llm-debug"]));
notThrows("status+ping", () => parseLlmArgs(["--llm-status", "--llm-ping"]));
eq("--llm-key-set da solo -> keyAction set", "set", parseLlmArgs(["--llm-key-set"])?.keyAction);

// --------------------------------------------------------------- D6/D7/D8: integrazione
const config = { baseDir: "/nonexistent", srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT" };

console.log("\n== D6 --llm-translate --llm-dry-run senza llm configurato ==");
{
  let message = "";
  try {
    await maybeRunLlmCommand(["--llm-translate", "--llm-dry-run"], config);
  } catch (e) { message = e.message; }
  eq("si ferma alla normalizzazione, non chiama reti", true, message.includes("llm is not configured"));
}

console.log("\n== D7 --llm-status senza llm configurato ==");
{
  let threw = false;
  let handled = false;
  try {
    handled = await maybeRunLlmCommand(["--llm-status"], config);
  } catch { threw = true; }
  eq("comando riconosciuto e gestito", true, handled);
  eq("nessuna eccezione (non tenta la rete)", false, threw);
}

console.log("\n== D8 rifiuto stampato ed exit code ==");
{
  const baseDir = mkdtempSync(join(tmpdir(), "vt-llmcli-"));
  mkdirSync(join(baseDir, "node_modules"));
  mkdirSync(join(baseDir, "src"));
  mkdirSync(join(baseDir, "locale"));
  writeFileSync(join(baseDir, "src", "App.jsx"), `export default function App() {
  return <div>{"_%_Hello_%_"}</div>;
}
`);
  writeFileSync(join(baseDir, "locale", "fr-FR.yml"), "");

  const cliConfig = {
    baseDir, srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT", simpleLog: true,
    llm: {
      connection: { baseURL: "http://fake", model: "fake-model" },
      driver: async () => ({ translations: {} }),
      budget: { maxKeysPerRun: 0, maxRequestsPerRun: 0, maxKeysPerDay: 0, maxCharsPerRun: 0 },
      context: { mode: "off" },
    },
  };

  const handled = await maybeRunLlmCommand(["--llm-translate", "--llm-noask"], cliConfig);
  eq("comando gestito", true, handled);
  eq("exit code messo a 1 dal rifiuto", 1, process.exitCode);
  process.exitCode = 0;

  rmSync(baseDir, { recursive: true, force: true });
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
