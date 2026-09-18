// Strato 10: translatePass.js — l'orchestratore. Il test che conta: su una cartella temporanea
// con due lingue e un driver finto, mai la rete vera.
//
//   node test/list/llmTranslatePass.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import translatePass from "../../lib/dev/llm/translatePass.js";
import { updateLedger, recordFailure } from "../../lib/dev/llm/llmLedger.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function progetto(sourceText) {
  const baseDir = mkdtempSync(join(tmpdir(), "vt-tpass-"));
  temporanee.push(baseDir);
  mkdirSync(join(baseDir, "node_modules"));
  mkdirSync(join(baseDir, "src"));
  mkdirSync(join(baseDir, "locale"));
  writeFileSync(join(baseDir, "src", "App.jsx"), sourceText);
  writeFileSync(join(baseDir, "locale", "fr-FR.yml"), "");
  writeFileSync(join(baseDir, "locale", "de-DE.yml"), "");
  return baseDir;
}

function baseConfig(baseDir, driver) {
  return {
    baseDir, srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT", simpleLog: true,
    llm: {
      connection: { baseURL: "http://fake", model: "fake-model" },
      driver,
      budget: "unlimited",
      context: { mode: "off" }, // disattivato: non è oggetto di questo test
    },
  };
}

function keyOf(baseDir, filePath = join(baseDir, "locale", "it-IT.yml")) {
  const text = readFileSync(filePath, "utf8");
  const m = text.match(/^([A-Za-z0-9_]+):/m);
  return m[1];
}

// --------------------------------------------------------------- T63/T64: giro felice
console.log("\n== T63/T64 giro felice ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Welcome_%_"}</div>;
}
`);
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = `TR:${item.t}`;
    return { translations };
  };
  const result = await translatePass({ config: baseConfig(baseDir, driver), noAsk: true });
  eq("T63 mode done", "done", result.mode);

  const key = keyOf(baseDir);
  const frText = readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8");
  eq("T63 fr-FR riempita", true, frText.includes(`"TR:Welcome"`));
  eq("T63 nessun null residuo", false, frText.includes("null"));
  eq("T63 header missing key: 0", true, frText.includes("missing key: 0"));

  // T64 — la lingua sorgente non è mai fra i file scritti da translatePass
  eq("T64 sourceLanguage mai in filesWritten", false, result.filesWritten.some((f) => f.tag === "it-IT"));
  const itAfterSameRun = readFileSync(join(baseDir, "locale", "it-IT.yml"), "utf8");
  eq("T64 la lingua sorgente ha la chiave (scritta dalla sync, non da translatePass)", true, itAfterSameRun.includes(key));
}

// --------------------------------------------------------------- T65: chiave assente dalla risposta
console.log("\n== T65 chiave assente dalla risposta resta null ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Hello there_%_"}</div>;
}
`);
  const driver = async () => ({ translations: {} }); // non risponde a nessuna chiave
  const result = await translatePass({ config: baseConfig(baseDir, driver), noAsk: true });
  eq("nessuna scrittura (niente da fondere)", 0, result.filesWritten.filter((f) => f.written).length);
  const frText = readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8");
  eq("la chiave resta null", true, /:\s*null\s*$/m.test(frText));
  eq("0 filled, 0 rejected (non è un errore)", { filled: 0, rejectedByReason: {} }, { filled: result.perLanguage[0].filled, rejectedByReason: result.perLanguage[0].rejectedByReason });
}

// --------------------------------------------------------------- T66: chiave sconosciuta nella risposta
console.log("\n== T66 chiave sconosciuta nella risposta ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Known text_%_"}</div>;
}
`);
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    const translations = { "Not_A_Real_Key": "ghost" };
    for (const item of items) translations[item.k] = `TR:${item.t}`;
    return { translations };
  };
  const result = await translatePass({ config: baseConfig(baseDir, driver), noAsk: true });
  eq("chiave nota comunque riempita", true, result.perLanguage.every((l) => l.filled === 1));
  eq("chiave sconosciuta contata", true, result.perLanguage.every((l) => l.unknownKeys === 1));
}

// --------------------------------------------------------------- T67: valore che non passa il validatore
console.log("\n== T67 validatore rifiuta -> resta null e finisce nel ledger ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Say %s now_%_"}</div>;
}
`);
  // Il driver perde sempre il placeholder: la riparazione (un solo giro) fallisce di nuovo.
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = "senza segnaposto";
    return { translations };
  };
  const result = await translatePass({ config: baseConfig(baseDir, driver), noAsk: true });
  eq("rejected per placeholder-count", true, result.perLanguage.every((l) => l.rejectedByReason["placeholder-count"] === 1));
  const frText = readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8");
  eq("la chiave resta null nel file", true, /:\s*null\s*$/m.test(frText));
}

// --------------------------------------------------------------- T68: failures.count >= 2 -> saltata; --llm-auto -> ritentata
console.log("\n== T68 chiave già fallita due volte ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Retry me_%_"}</div>;
}
`);
  let calls = 0;
  const driver = async ({ userPayload }) => {
    calls++;
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = `TR:${item.t}`;
    return { translations };
  };
  const config = baseConfig(baseDir, driver);

  // Prima una sync "a vuoto" per conoscere la chiave vera e pre-sporcare il ledger.
  await translatePass({ config: baseConfig(baseDir, async () => ({ translations: {} })), noAsk: true });
  const realKey = keyOf(baseDir);
  updateLedger(baseDir, (l) => {
    recordFailure(l, "fr-FR", realKey, "placeholder-count");
    recordFailure(l, "fr-FR", realKey, "placeholder-count");
  });

  const result1 = await translatePass({ config, noAsk: true });
  const frReport = result1.perLanguage.find((l) => l.tag === "fr-FR");
  eq("saltata senza --llm-auto", 1, frReport?.skipped ?? 0);
  eq("nessuna chiamata al driver per fr-FR (nulla da tradurre lì)", true, frReport.filled === 0);

  const result2 = await translatePass({ config, auto: true, noAsk: true });
  const frReport2 = result2.perLanguage.find((l) => l.tag === "fr-FR");
  eq("con --llm-auto ritentata e riempita", 1, frReport2.filled);
  void calls;
}

// --------------------------------------------------------------- T69: un solo giro di riparazione
console.log("\n== T69 un solo giro di riparazione ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Always fails_%_"}</div>;
}
`);
  let calls = 0;
  // Restituisce sempre la chiave stessa (echo-key): rifiutata sempre, anche al secondo giro.
  const driver = async ({ userPayload }) => {
    calls++;
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = item.k;
    return { translations };
  };
  await translatePass({ config: baseConfig(baseDir, driver), noAsk: true });
  // Due lingue (fr-FR, de-DE), un lotto ciascuna: primo giro 2 chiamate, riparazione altre 2 = 4.
  eq("driver chiamato esattamente due volte per lingua (primo giro + un solo giro di riparazione)", 4, calls);
}

// --------------------------------------------------------------- T70: il resto del file non cambia
console.log("\n== T70 le chiavi già tradotte non cambiano ==");
{
  const baseDir = progetto(`export default function App() {
  return (
    <div>
      {"_%_Already done_%_"}
      {"_%_New one_%_"}
    </div>
  );
}
`);
  // Prima sync + traduzione completa di entrambe le chiavi.
  const fillAll = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = `TR:${item.t}`;
    return { translations };
  };
  await translatePass({ config: baseConfig(baseDir, fillAll), noAsk: true });
  const frAfterFirst = readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8");

  // Aggiunge una terza stringa nuova, e ritraduce: solo la nuova deve cambiare.
  writeFileSync(join(baseDir, "src", "App.jsx"), `export default function App() {
  return (
    <div>
      {"_%_Already done_%_"}
      {"_%_New one_%_"}
      {"_%_Third one_%_"}
    </div>
  );
}
`);
  await translatePass({ config: baseConfig(baseDir, fillAll), noAsk: true });
  const frAfterSecond = readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8");

  eq("le due chiavi già tradotte compaiono identiche", true, frAfterSecond.includes('"TR:Already done"') && frAfterSecond.includes('"TR:New one"'));
  eq("la terza chiave nuova è stata aggiunta e tradotta", true, frAfterSecond.includes('"TR:Third one"'));
  void frAfterFirst;
}

// --------------------------------------------------------------- T84: risposta nella forma del payload
console.log("\n== T84 la forma `{ items: [{ k, t, where }] }` viene letta, non buttata ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Welcome_%_"}</div>;
}
`);
  // Come la trace 260918204954: il modello ricopia il payload invece di appiattirlo. Prima della
  // correzione questo rispondeva 0 filled e 1 unknown key ("items"), e la traduzione si perdeva.
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    return { translations: { items: items.map((i) => ({ k: i.k, t: `TR:${i.t}`, where: i.where })) } };
  };
  const result = await translatePass({ config: baseConfig(baseDir, driver), noAsk: true });

  eq("mode done", "done", result.mode);
  eq("entrambe le lingue riempite", true, result.perLanguage.every((l) => l.filled === 1));
  eq("nessuna sconosciuta: l'involucro è riconosciuto", true, result.perLanguage.every((l) => l.unknownKeys === 0));
  const frText = readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8");
  eq("la traduzione è finita nel file", true, frText.includes('"TR:Welcome"'));
}

// --------------------------------------------------------------- T85: il formato del blocco LLM
console.log("\n== T85 il blocco LLM: modello, fornitore, token reali, niente helper ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Good night_%_"}</div>;
}
`);
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])), usage: { tokensIn: 1200, tokensOut: 300 } };
  };
  const { righe } = await catturaAsync(() => translatePass({ config: baseConfig(baseDir, driver), noAsk: true }));

  eq("il modello fra virgolette", true, righe.some((r) => r.includes('"fake-model"')));
  eq("il fornitore ricostruito da baseURL (http://fake -> fake)", true, righe.some((r) => r.includes("⌘ fake")));
  eq("la sintesi del lavoro", true, righe.some((r) => r.includes("- (2/2) incomplete tables - 2 missing keys - 2 api requests")));
  eq("la stima dei token", true, righe.some((r) => r.includes("- token (in ~") && r.includes("out ~")));
  eq("i token reali misurati (2 lotti x (1200 + 300))", true, righe.some((r) => r.includes("real token: 3000")));
  eq("niente report per-lingua", false, righe.some((r) => /: \d+ filled/.test(r)));
  eq("niente 'estimated from characters'", false, righe.some((r) => r.includes("estimated from characters")));
  eq("niente 'measured from provider usage'", false, righe.some((r) => r.includes("measured from provider usage")));
  eq("la riga 'still untranslated' resta", true, righe.some((r) => r.includes("2 string(s) still untranslated")));
  eq("l'helper npx non compare nel run LLM", false, righe.some((r) => /\$ .*--llm-translate/.test(r)));
}

// --------------------------------------------------------------- P1: --llm-debug traccia il giro
console.log("\n== P1 --llm-debug traccia richieste, risposte, rifiuti, riparazione ==");
{
  const { default: createDebugTrace } = await import("../../lib/dev/llm/debugTrace.js");
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Say %s now_%_"}</div>;
}
`);
  // Perde sempre il segnaposto: primo giro rifiutato, riparazione rifiutata di nuovo.
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = "senza segnaposto";
    return { translations };
  };
  const debug = createDebugTrace({ localeDir: join(baseDir, "locale") });
  await translatePass({ config: baseConfig(baseDir, driver), noAsk: true, debug });

  const names = readdirSync(debug.dir);
  const hasSuffix = (suffix) => names.some((n) => n.endsWith(suffix));
  eq("translate-fr-FR-b01-request.json esiste", true, hasSuffix("-translate-fr-FR-b01-request.json"));
  eq("translate-fr-FR-b01-response.json esiste", true, hasSuffix("-translate-fr-FR-b01-response.json"));
  eq("validate-fr-FR-rejected.json esiste", true, hasSuffix("-validate-fr-FR-rejected.json"));
  eq("repair-fr-FR-b01-request.json esiste", true, hasSuffix("-repair-fr-FR-b01-request.json"));
  eq("summary.json esiste", true, hasSuffix("-summary.json"));
}

// --------------------------------------------------------------- P2: costGuard
console.log("\n== P2 costGuard: senza TTY, soddisfa la conferma da solo ==");
{
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = `TR:${item.t}`;
    return { translations };
  };
  const configWithGuard = (baseDir, costGuard) => ({
    ...baseConfig(baseDir, driver),
    llm: {
      ...baseConfig(baseDir, driver).llm,
      connection: { baseURL: "http://fake", model: "fake-model", costMillionInput: 0.1, costMillionOutput: 0.1 },
      costGuard,
    },
  });

  // Nessun --llm-noask: il test runner lancia i figli con stdin "ignore", isTTY è falso —
  // senza costGuard sarebbe "refused", con costGuard abbastanza alto dev'essere "done".
  // Qui si prova confirmProceed, non la guardia CI: su GitHub Actions CI=true e checkCI
  // rifiuterebbe prima (costGuard non la scavalca, apposta — vedi llmBudget). Quindi si toglie.
  const ciPrima = process.env.CI;
  delete process.env.CI;
  try {
    const baseDir1 = progetto(`export default function App() {
  return <div>{"_%_Cheap one_%_"}</div>;
}
`);
    const result1 = await translatePass({ config: configWithGuard(baseDir1, 100) });
    eq("costGuard alto -> done anche senza noAsk", "done", result1.mode);

    const baseDir2 = progetto(`export default function App() {
  return <div>{"_%_Cheap two_%_"}</div>;
}
`);
    const result2 = await translatePass({ config: configWithGuard(baseDir2, 0) });
    eq("costGuard 0 -> refused", "refused", result2.mode);
  } finally {
    if (ciPrima !== undefined) process.env.CI = ciPrima;
  }
}

// --------------------------------------------------------------- P3–P6: il pannello delle richieste
/** Quello che `fn` stampa con console.log mentre gira, senza colori. Qui stdout non è un
 *  terminale: del pannello si vede solo il log finale, che è quello che conta. */
async function catturaAsync(fn) {
  const righe = [];
  const vero = console.log;
  console.log = (...args) => righe.push(args.join(" ").replace(/\x1b\[[0-9;]*m/g, ""));
  try {
    return { valore: await fn(), righe };
  } finally {
    console.log = vero;
  }
}

const riempie = (usage) => async ({ userPayload }) => {
  const { items } = JSON.parse(userPayload);
  const translations = {};
  for (const item of items) translations[item.k] = `TR:${item.t}`;
  return { translations, usage };
};

console.log("\n== P3 il pannello: una riga per connessione, con la coda ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Good morning_%_"}</div>;
}
`);
  const config = baseConfig(baseDir, riempie({ tokensIn: 1000, tokensOut: 2000 }));
  config.llm.connection = { ...config.llm.connection, costMillionInput: 0.6, costMillionOutput: 1.2 };
  const { righe } = await catturaAsync(() => translatePass({ config, noAsk: true }));
  const pannello = righe.filter((r) => r.includes("✔ < ") || r.includes("✖ - "));
  eq("una riga per lingua (un lotto ciascuna)", 2, pannello.length);
  eq("de-DE", true, pannello.some((r) => /✔ < 1 new key Deutsch\. completed \/ \d+s\./.test(r)));
  eq("fr-FR", true, pannello.some((r) => /✔ < 1 new key français\. completed \/ \d+s\./.test(r)));
  eq("ogni riga chiude con la coda, nessun costo", true, pannello.every((r) => /completed \/ \d+s\.$/.test(r) && !r.includes("$")));
}

console.log("\n== P4 una richiesta fallita: la sua riga lo dice, il run prosegue ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Good evening_%_"}</div>;
}
`);
  const driver = async (args) => {
    if (args.systemPrompt.includes("Target language: de-DE")) {
      throw Object.assign(new Error("unauthorized"), { status: 401 });
    }
    return riempie(null)(args);
  };
  const { valore: result, righe } = await catturaAsync(() => translatePass({ config: baseConfig(baseDir, driver), noAsk: true }));
  eq("mode done", "done", result.mode);
  eq("la riga d'errore", true, righe.some((r) => r.includes("✖ - error Deutsch (HTTP 401) / see trace in debug mode /")));
  eq("l'altra lingua tradotta", 1, result.perLanguage.find((l) => l.tag === "fr-FR").filled);
}

console.log("\n== P5 la riparazione ha le sue righe ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Pay %s now_%_"}</div>;
}
`);
  // Perde sempre il segnaposto: rifiutata al primo giro, e di nuovo alla riparazione.
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    return { translations: Object.fromEntries(items.map((item) => [item.k, "senza segnaposto"])) };
  };
  const { righe } = await catturaAsync(() => translatePass({ config: baseConfig(baseDir, driver), noAsk: true }));
  eq("primo giro: rifiutata", true, righe.some((r) => r.includes("✔ < 0 new keys Deutsch. 1 rejected")));
  eq("riparazione: ancora rifiutata", true, righe.some((r) => r.includes("✔ < 0 keys repaired Deutsch. 1 still rejected")));
}

console.log("\n== P6 maxCostPerRun superato a metà: una nota dice cosa non è partito ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Expensive_%_"}</div>;
}
`);
  const config = baseConfig(baseDir, riempie({ tokensIn: 1000, tokensOut: 1000 }));
  // Una connessione alla volta: la prima risposta (≈ $0.002) supera il tetto, la seconda non parte.
  config.llm.connection = { ...config.llm.connection, costMillionInput: 1, costMillionOutput: 1, maxConcurrency: 1 };
  config.llm.budget = { maxCostPerRun: 0.0001 };
  // --llm-auto: la stima non deve rifiutare prima di partire, è lo stop a metà run che si prova.
  const { valore: result, righe } = await catturaAsync(() => translatePass({ config, noAsk: true, auto: true }));
  eq("stoppedOnBudget", true, result.stoppedOnBudget);
  eq("una sola richiesta partita", 1, righe.filter((r) => r.includes("✔ < ")).length);
  eq("la nota", true, righe.some((r) => r.includes("maxCostPerRun ($0.0001) reached: 1 request(s) not sent")));
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
