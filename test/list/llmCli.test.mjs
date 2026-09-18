// Strato 12: llmCommands.js — i comandi LLM della CLI.
//
//   node test/list/llmCli.test.mjs
import maybeRunLlmCommand, { hasAnyLlmFlag } from "../../lib/dev/llm/llmCommands.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const throwsMsg = async (nome, fn, contains) => {
  try {
    await fn();
    fail++;
    console.log("  KO  ", nome.padEnd(52), "-> non ha lanciato");
  } catch (e) {
    const ok = contains === undefined || e.message.includes(contains);
    if (!ok) fail++;
    console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", e.message);
  }
};

// Un config minimo, senza `llm`: basta a far scattare gli errori di combinazione, che si
// controllano prima di normalizzare le opzioni.
const config = { baseDir: "/nonexistent", srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT" };

// T71 — le cinque combinazioni rifiutate
console.log("\n== T71 combinazioni rifiutate ==");
await throwsMsg("--translate con --status", () => maybeRunLlmCommand(["--translate", "--status"], config), "--status");
await throwsMsg("--translate con --migrate", () => maybeRunLlmCommand(["--translate", "--migrate"], config), "--migrate");
await throwsMsg("--retranslate senza tag", () => maybeRunLlmCommand(["--retranslate"], config), "at least one language tag");
await throwsMsg("--dry-run da solo", () => maybeRunLlmCommand(["--dry-run"], config), "only makes sense");
await throwsMsg("--ping senza --llm-status", () => maybeRunLlmCommand(["--ping"], config), "only makes sense");

// T72 — flag letti case-insensitive
console.log("\n== T72 case-insensitive ==");
eq("hasAnyLlmFlag riconosce --Context", true, hasAnyLlmFlag(["--Context"]));
eq("hasAnyLlmFlag riconosce --TRANSLATE", true, hasAnyLlmFlag(["--TRANSLATE"]));
eq("hasAnyLlmFlag falso senza flag llm", false, hasAnyLlmFlag(["--status", "--simpleLog"]));
await throwsMsg("--DRY-RUN maiuscolo comunque rifiutato da solo", () => maybeRunLlmCommand(["--DRY-RUN"], config), "only makes sense");

// T73 — --dry-run non scrive niente e non chiama nessun driver
console.log("\n== T73 --dry-run non chiama il driver ==");
{
  // Un config senza `llm` normalizzabile fa fallire translatePass prima di chiamare nessun
  // driver: la prova che conta è che l'errore sia "llm is not configured", non un errore di
  // rete o di file system — cioè non si è nemmeno arrivati a un driver.
  let message = "";
  try {
    await maybeRunLlmCommand(["--translate", "--dry-run"], config);
  } catch (e) { message = e.message; }
  eq("si ferma alla normalizzazione, non chiama reti", true, message.includes("llm is not configured"));
}

// T74 — --llm-status senza --ping non chiama nessun driver
console.log("\n== T74 --llm-status senza --ping ==");
{
  let threw = false;
  try {
    // Nessun `llm` in config: runLlmStatus stampa "not configured" e ritorna, senza chiamare
    // resolveApiKey né un driver.
    const handled = await maybeRunLlmCommand(["--llm-status"], config);
    eq("comando riconosciuto e gestito", true, handled);
  } catch { threw = true; }
  eq("nessuna eccezione (non tenta la rete)", false, threw);
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
