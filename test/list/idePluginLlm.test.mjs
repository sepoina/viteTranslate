// Estensione per l'editor (idePlugin): il pannello LLM. La lettura dell'uscita di
// `--llm-status --llm-ping` (llmCheck.mjs) sui due formati del log, lo stato del pannello
// (llmPanel.mjs), la sua pagina (llmPage.mjs), e il controllo in background davvero: il CLI di
// questo repo su due progetti temporanei, uno con la chiave in .env.local e uno senza. Il modello
// è un indirizzo che non risponde (127.0.0.1:1): il ping fallisce subito, senza rete.
//
//   node test/list/idePluginLlm.test.mjs
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseLlmStatus, errorOf, runLlmCheck, LLM_CHECK_ARGS } from "../../idePlugin/src/webViews/optional/llm/llmCheck.mjs";
import { llmPanelState } from "../../idePlugin/src/webViews/optional/llm/llmPanel.mjs";
import { llmHtml } from "../../idePlugin/src/webViews/optional/llm/llmPage.mjs";
import { LLM_ACTIONS } from "../../idePlugin/src/core/syncCommand.mjs";
import { BACK_LABEL, COMMAND_BAR_CSS } from "../../idePlugin/src/webViews/commandBar/commandBar.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Due uscite vere del CLI (4.6.4), --simpleLog e log ricco: la riga del ping va a capo.
const SEMPLICE =
  "\x1b[32m:::\x1b[0m \x1b[2mllm\x1b[0m\n" +
  "\x1b[32m:::\x1b[0m   connection: http://127.0.0.1:1/v1 (m)\n" +
  "\x1b[32m:::\x1b[0m   API key: .env.local\n" +
  "\x1b[32m:::\x1b[0m   model class: standard — batches up to 3.0k output tokens / 100 keys,\n" +
  "\x1b[32m:::\x1b[0m     max_tokens 4096 (max_tokens)\n" +
  "\x1b[32m:::\x1b[0m   ping: failed (openai-chat request to\n" +
  "\x1b[32m:::\x1b[0m     http://127.0.0.1:1/v1/chat/completions failed: fetch failed)\n";
const RICCO =
  "\x1b[32m:::\x1b[0m\x1b[2m \x1b[0m\x1b[2mllm                 \x1b[0m\x1b[2m ║  \x1b[0mconnection: http://127.0.0.1:1/v1 (m)\n" +
  "\x1b[32m:::\x1b[0m\x1b[2m \x1b[0m\x1b[2m                    \x1b[0m\x1b[2m ║  \x1b[0mAPI key: env:MY_KEY\n" +
  "\x1b[32m:::\x1b[0m\x1b[2m \x1b[0m\x1b[1;38;5;208m                    \x1b[0m\x1b[2m ║  \x1b[0mping: failed (openai-chat request to\n" +
  "\x1b[32m:::\x1b[0m\x1b[2m                      ║  \x1b[0m  http://127.0.0.1:1/v1/chat/completions failed: fetch failed)\n";
const ERRORE = "openai-chat request to http://127.0.0.1:1/v1/chat/completions failed: fetch failed";

console.log("\n== l'uscita del CLI ==");
{
  eq("--simpleLog: chiave e ping, con la continuazione", { key: ".env.local", ping: { ok: false, error: ERRORE } }, parseLlmStatus(SEMPLICE));
  eq("log ricco: lo stesso, dopo la colonna ║", { key: "env:MY_KEY", ping: { ok: false, error: ERRORE } }, parseLlmStatus(RICCO));
  eq("a metà: la chiave c'è, il ping ancora no", { key: ".env.local" }, parseLlmStatus(SEMPLICE.split("ping:")[0]));
  eq("…né con la sua riga troncata (parentesi aperta)", { key: ".env.local" }, parseLlmStatus(SEMPLICE.split("\x1b[32m:::\x1b[0m     http")[0]));
  eq("ping ok", { key: "keyring", ping: { ok: true } }, parseLlmStatus("::: API key: keyring\n::: ping: ok\n"));
  eq("l'errore di un config che non si carica", 'could not load "vite.config.js": boom', errorOf('\n\x1b[1;31m[vitetranslate]\x1b[0m could not load "vite.config.js": boom\n'));
  eq("gli argomenti: status, ping, log semplice", ["--llm-status", "--llm-ping", "--simpleLog"], LLM_CHECK_ARGS);
}

console.log("\n== lo stato del pannello ==");
{
  const llm = { connection: { baseURL: "https://api.deepseek.com/v1", model: "deepseek-flash", apiKeyEnv: "MY_KEY" } };
  const base = { llm, baseDir: join("/", "p"), title: "app" };
  const testi = (s) => s.checks.map((c) => [c.id, c.state, c.text, c.description ?? null]);
  eq("appena aperto: tutto in corso, settings già pronte", [
    ["key", "running", "API key: looking…", null],
    ["settings", "ok", "Settings: ready", "deepseek-flash @ api.deepseek.com · no prices"],
    ["ping", "running", "Ping: asking the model…", null],
  ], testi(llmPanelState({ ...base, check: {} })));
  eq("…e Check again spento finché gira", true, llmPanelState({ ...base, check: {} }).checking);
  const env = llmPanelState({ ...base, check: { key: ".env.local", ping: { ok: true } } });
  eq(".env.local: dove sta, il percorso nel tooltip, ping ok", [["ok", "API key: .env.local", join("/", "p", ".env.local")], ["ok", "Ping: the model answers"], false],
    [[env.checks[0].state, env.checks[0].text, env.checks[0].tooltip], [env.checks[2].state, env.checks[2].text], env.checking]);
  eq("variabile d'ambiente: il suo nome", ["API key: environment variable", "MY_KEY"], ((c) => [c.text, c.description])(llmPanelState({ ...base, check: { key: "env:MY_KEY" } }).checks[0]));
  const senza = llmPanelState({ ...base, check: { key: "not found", ping: { skipped: true } } });
  eq("senza chiave: errore, e il ping non provato", [["error", "API key: not found", "MY_KEY"], ["warning", "Ping: not tried", "no API key"]],
    [[senza.checks[0].state, senza.checks[0].text, senza.checks[0].description], [senza.checks[2].state, senza.checks[2].text, senza.checks[2].description]]);
  eq("…il tooltip dice dove ha guardato, mai un valore", true, /environment, in \.env\.local and \.env .*system keyring/.test(senza.checks[0].tooltip));
  eq("ping fallito: il perché", ["error", "fetch failed"], ((c) => [c.state, c.description.split(": ").at(-1)])(llmPanelState({ ...base, check: { key: "keyring", ping: { ok: false, error: ERRORE } } }).checks[2]));
  eq("controllo fallito: avvisi, non errori", ["warning", "warning"],
    llmPanelState({ ...base, check: { error: "boom" } }).checks.filter((c) => c.id !== "settings").map((c) => c.state));
  eq("coi prezzi: niente 'no prices'", "deepseek-flash @ api.deepseek.com",
    llmPanelState({ ...base, llm: { connection: { ...llm.connection, costMillionInput: 1, costMillionOutput: 2 } } }).checks[1].description);
  eq("driver: niente chiave, settings pronte", ["API key: not needed", "custom driver"],
    ((s) => [s.checks[0].text, s.checks[1].description])(llmPanelState({ ...base, llm: { driver: "custom", connection: {} }, check: { key: "n/a (llm.driver is set)" } })));
  eq("trouble: con un errore o un avviso sì, in corso o tutto ok no", [true, true, true, false, false],
    [senza.trouble, llmPanelState({ ...base, check: { key: "keyring", ping: { ok: false, error: ERRORE } } }).trouble,
      llmPanelState({ ...base, check: { error: "boom" } }).trouble, llmPanelState({ ...base, check: {} }).trouble, env.trouble]);
  const azioni = llmPanelState(base).actions;
  eq("le azioni: tutte, con la codicon e il comando nel tooltip", [LLM_ACTIONS.map((a) => a.id), "sparkle", "npx vitetranslate --llm-translate"],
    [azioni.map((a) => a.id), azioni[0].icon, azioni[0].tooltip]);
}

console.log("\n== la pagina ==");
{
  const html = llmHtml({ scriptUri: "vscode-webview://x/optionalWebview.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" });
  eq("CSP col nonce, lo script della sezione", [true, true],
    [html.includes("script-src 'nonce-abc'"), html.includes('<script type="module" nonce="abc" src="vscode-webview://x/optionalWebview.js">')]);
  eq("i controlli, le azioni, poi la barra", true, /<div id="checks"><\/div>[\s\S]*<div id="actions"><\/div>[\s\S]*<\/main>\s*<footer class="actions">/.test(html));
  eq("…le azioni su due piani: la descrizione sotto il nome, che va a capo", true,
    /\.azione \{[^}]*grid-template-columns: 16px 1fr;[\s\S]*\.azione \.desc \{ grid-column: 2;/.test(html) && !/\.azione \.desc \{[^}]*nowrap/.test(html));
  eq("nella barra: Back, Check again (lo id per spegnerlo), il ? di Help", ["close", "recheck", "help"], [...html.matchAll(/data-cmd="(\w+)"/g)].map((m) => m[1]));
  eq("…il ? è un'icona-bottone, nascosta finché un controllo non va male", true,
    /<vscode-icon id="help" data-cmd="help" name="question" action-icon label="Help" title="[^"]+" hidden><\/vscode-icon>/.test(html));
  eq("…Check again primario, come Sync", true, /<vscode-button id="recheck" data-cmd="recheck" icon="refresh"/.test(html));
  eq("…Back, non Close: la freccia indietro", true, /data-cmd="close"[^>]*icon="arrow-left"[^>]*>Back</.test(html));
  eq("…la barra di Project: coi comandi niente Return to project, l'icona di LLM sì", [true, false, true],
    [html.includes(COMMAND_BAR_CSS), html.includes(BACK_LABEL), html.includes('<vscode-icon class="pagina" name="sparkle"')]);
  eq("lo sfondo tinto della sezione facoltativa", true, html.includes("background: color-mix(in srgb, var(--vscode-sideBar-background), var(--vscode-focusBorder) 14%)"));
}

console.log("\n== il controllo, col CLI vero ==");
{
  const PLUGIN = pathToFileURL(fileURLToPath(new URL("../../lib/dev/vite/vitetranslate.js", import.meta.url))).href;
  const CLI = fileURLToPath(new URL("../../lib/dev/vite/cli.js", import.meta.url));
  const progetto = (chiave) => {
    const dir = mkdtempSync(join(tmpdir(), "vt-idellm-"));
    mkdirSync(join(dir, "locale"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "p", type: "module" }));
    // Un nome di variabile che nessuno ha: né nell'ambiente né nel keyring di chi lancia i test.
    writeFileSync(join(dir, "vite.config.js"), `import vitetranslate from ${JSON.stringify(PLUGIN)};\nexport default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT", llm: { connection: { baseURL: "http://127.0.0.1:1/v1", model: "m", apiKeyEnv: "VT_IDE_TEST_KEY_NOPE", maxRetries: 0, timeoutMs: 2000 } } })] };\n`);
    if (chiave) writeFileSync(join(dir, ".env.local"), "VT_IDE_TEST_KEY_NOPE=not-a-real-key\n");
    return dir;
  };
  const conChiave = progetto(true);
  const aggiornamenti = [];
  const esito = await runLlmCheck({ cli: CLI, dir: conChiave, onUpdate: (s) => aggiornamenti.push(s) }).done;
  eq("chiave in .env.local, ping fallito (nessuno risponde)", [".env.local", false], [esito.key, esito.ping?.ok]);
  eq("…la chiave arriva prima del ping", { key: ".env.local" }, aggiornamenti[0]);
  const senza = progetto(false);
  const esito2 = await runLlmCheck({ cli: CLI, dir: senza }).done;
  eq("senza chiave: si ferma lì, il ping non parte", { key: "not found", ping: { skipped: true } }, esito2);
  const rotto = progetto(true);
  writeFileSync(join(rotto, "vite.config.js"), "throw new Error('boom');\n");
  const esito3 = await runLlmCheck({ cli: CLI, dir: rotto }).done;
  eq("un vite.config che non si carica: l'errore, nient'altro", [undefined, true], [esito3.key, /boom/.test(esito3.error)]);
  for (const d of [conChiave, senza, rotto]) rmSync(d, { recursive: true, force: true });
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
