// Strato 10: translatePass.js — l'orchestratore. Il test che conta: su una cartella temporanea
// con due lingue e un driver finto, mai la rete vera.
//
//   node test/list/llmTranslatePass.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import translatePass from "../../lib/dev/llm/translatePass.js";
import normalizeLlmOptions from "../../lib/dev/llm/llmOptions.js";
import { updateLedger, recordFailure, recordRequest, readLedger, ratiosFor } from "../../lib/dev/llm/llmLedger.js";

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
  eq("de-DE", true, pannello.some((r) => /✔ < 1 new key Deutsch\. Full translate! \/ \d+s\./.test(r)));
  eq("fr-FR", true, pannello.some((r) => /✔ < 1 new key français\. Full translate! \/ \d+s\./.test(r)));
  eq("ogni riga chiude con la coda, nessun costo", true, pannello.every((r) => /Full translate! \/ \d+s\.$/.test(r) && !r.includes("$")));
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
  eq("primo giro: rifiutata", true, righe.some((r) => r.includes("✔ < 0 new keys Deutsch. 1 to do / 1 rejected")));
  eq("riparazione: ancora rifiutata", true, righe.some((r) => r.includes("✔ < 0 keys repaired Deutsch. 1 to do / 1 still rejected")));
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

// --------------------------------------------------------------- scrittura lotto per lotto
console.log("\n== ogni lotto finisce su disco subito, senza calpestare chi scrive nel frattempo ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_First_%_"}{"_%_Second_%_"}</div>;
}
`);
  const file = (tag) => join(baseDir, "locale", `${tag}.yml`);
  const visti = [];
  const driver = async ({ userPayload, systemPrompt }) => {
    const tag = systemPrompt.includes("de-DE") ? "de-DE" : "fr-FR";
    const altro = tag === "de-DE" ? "fr-FR" : "de-DE";
    const { items } = JSON.parse(userPayload);
    if (visti.length === 0) {
      // Durante la prima richiesta qualcuno traduce a mano una chiave dell'altra lingua.
      const [k] = items.map((i) => i.k).sort();
      writeFileSync(file(altro), readFileSync(file(altro), "utf8").replace(new RegExp(`^${k}: null$`, "m"), `${k}: "MANUAL"`));
    } else {
      // Alla seconda richiesta la prima lingua è già scritta: un Ctrl-C adesso non la perde.
      visti.push(readFileSync(file(altro), "utf8").includes('"TR:'));
    }
    visti.push(tag);
    const translations = {};
    for (const item of items) translations[item.k] = `TR:${item.t}`;
    return { translations };
  };
  const config = baseConfig(baseDir, driver);
  config.llm.connection = { ...config.llm.connection, maxConcurrency: 1 };
  const { valore: result, righe } = await catturaAsync(() => translatePass({ config, noAsk: true }));
  eq("la prima lingua era su disco prima della seconda richiesta", true, visti[1]);
  const secondText = readFileSync(file(visti[2]), "utf8");
  eq("la traduzione a mano resta", true, secondText.includes('"MANUAL"') && secondText.includes('"TR:'));
  eq("nessun null residuo", false, secondText.includes("null"));
  eq("filesWritten: entrambe", 2, result.filesWritten.filter((f) => f.written).length);
  eq("lingua completa: Full translate!", true, righe.filter((r) => r.includes("✔ < ")).every((r) => r.includes("Full translate!")));
}

console.log("\n== la riga dice quante ne mancano alla lingua, non al lotto ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Alpha_%_"}{"_%_Beta_%_"}{"_%_Gamma_%_"}</div>;
}
`);
  // Risponde solo alla prima chiave del lotto: il lotto è "riuscito" a metà, la lingua no.
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    return { translations: { [items[0].k]: `TR:${items[0].t}` } };
  };
  const config = baseConfig(baseDir, driver);
  const { righe } = await catturaAsync(() => translatePass({ config, noAsk: true, tags: ["fr-FR"] }));
  const riga = righe.find((r) => r.includes("✔ < "));
  eq("2 to do, niente Full translate!", true, riga.includes("2 to do") && !riga.includes("Full translate!"));
}

// --------------------------------------------------------------- 4.6.2: contabilità per richiesta
const priced = (config, extra = {}) => {
  config.llm.connection = { ...config.llm.connection, costMillionInput: 1, costMillionOutput: 1, ...extra };
  return config;
};
const SRC = `export default function App() {
  return <div>{"_%_Alpha_%_"}{"_%_Beta_%_"}</div>;
}
`;

console.log("\n== R1 il costo è nel ledger richiesta per richiesta, non a fine run ==");
{
  const baseDir = progetto(SRC);
  const costiViste = [];
  const driver = async ({ userPayload }) => {
    // All'arrivo della seconda richiesta la prima è già nel ledger: un Ctrl-C adesso non azzera il giorno.
    const l = readLedger(baseDir);
    costiViste.push({ cost: l.costToday, tokens: l.tokensToday });
    const { items } = JSON.parse(userPayload);
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])), usage: { tokensIn: 1000000, tokensOut: 0 } };
  };
  const config = priced(baseConfig(baseDir, driver), { maxConcurrency: 1 });
  await catturaAsync(() => translatePass({ config, noAsk: true }));
  eq("prima richiesta: ledger vuoto", { cost: 0, tokens: 0 }, costiViste[0]);
  eq("seconda richiesta: la prima è già scritta", { cost: 1, tokens: 1000000 }, costiViste[1]);
  const l = readLedger(baseDir);
  eq("fine run: due richieste, $2", [2, 2000000], [l.costToday, l.tokensToday]);
  eq("requests per modello", 2, l.models["fake-model"].requests);
  eq("keysToday solo informativo (2 chiavi x 2 lingue)", 4, l.keysToday);
  eq("taratura d'uscita per lingua", ["de-DE", "fr-FR"], Object.keys(l.models["fake-model"].out).sort());
}

console.log("\n== R2 un tentativo fallito con usage si paga ==");
{
  const baseDir = progetto(SRC);
  const driver = async () => {
    const error = new Error("reply was not a JSON object");
    error.usage = { tokensIn: 500000, tokensOut: 500000 };
    throw error; // senza status: si riprova (maxRetries), ogni tentativo si paga
  };
  const config = priced(baseConfig(baseDir, driver), { maxRetries: 1, maxConcurrency: 1 });
  const { valore: result } = await catturaAsync(() => translatePass({ config, noAsk: true, tags: ["fr-FR"] }));
  eq("il run finisce comunque", "done", result.mode);
  const l = readLedger(baseDir);
  eq("2 tentativi x $1", 2, l.costToday);
  eq("2 tentativi x 1M token", 2000000, l.tokensToday);
  eq("mai tarato da un fallimento", { charsIn: 0, tokensIn: 0, out: {} }, { charsIn: l.models["fake-model"].charsIn, tokensIn: l.models["fake-model"].tokensIn, out: l.models["fake-model"].out });
  eq("nessuna chiave riempita", 0, l.keysToday);
}

console.log("\n== R3 il troncamento: la stessa domanda mai, le chiavi in lotti di metà ==");
{
  const baseDir = progetto(SRC);
  const lotti = [];
  const driver = async ({ userPayload }) => {
    lotti.push(JSON.parse(userPayload).items.length);
    const error = new Error("openai-chat reply truncated: max_tokens reached");
    error.truncated = true;
    error.usage = { tokensIn: 100, tokensOut: 4096 };
    throw error;
  };
  const config = baseConfig(baseDir, driver);
  const { righe } = await catturaAsync(() => translatePass({ config, noAsk: true, tags: ["fr-FR"] }));
  eq("mai ritentata tale e quale: 2 chiavi, poi 1 + 1, poi basta", [2, 1, 1], lotti);
  eq("la riga dice perché", true, righe.some((r) => r.includes("(truncated)")));
  eq("tre righe d'errore: il lotto e le sue due metà", 3, righe.filter((r) => r.includes("error français (truncated)")).length);
  eq("ogni tentativo si è pagato", 3 * 4196, readLedger(baseDir).tokensToday);
  eq("una nota dice cosa resta e cosa fare", true, righe.some((r) => r.includes("2 key(s) still truncated: raise modelClass or turn reasoning off")));
}

console.log("\n== R4 maxTokens arriva al driver ==");
{
  const baseDir = progetto(SRC);
  const seen = [];
  const driver = async (args) => {
    seen.push(args.maxTokens);
    const { items } = JSON.parse(args.userPayload);
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])) };
  };
  const config = baseConfig(baseDir, driver);
  config.llm.connection = { ...config.llm.connection, modelClass: "advanced" };
  await catturaAsync(() => translatePass({ config, noAsk: true, tags: ["fr-FR"] }));
  eq("il maxTokens della classe advanced", [6144], seen);
}

console.log("\n== R5 maxCostPerDay tiene conto di costToday ==");
{
  const baseDir = progetto(SRC);
  const config = priced(baseConfig(baseDir, riempie(undefined)), { costMillionInput: 100, costMillionOutput: 100 });
  config.llm.budget = { maxCostPerRun: 100, maxCostPerDay: 5 };

  const libero = await catturaAsync(() => translatePass({ config, noAsk: true, dryRun: true }));
  eq("senza spesa del giorno: dry-run passa", "dry-run", libero.valore.mode);

  updateLedger(baseDir, (l) => recordRequest(l, { model: "fake-model", usage: { tokensIn: 1, tokensOut: 1 }, cost: 4.99 }));
  const { valore: result } = await catturaAsync(() => translatePass({ config, noAsk: true, dryRun: true }));
  eq("con $4.99 già spesi: rifiutato", "refused", result.mode);
  eq("nomina maxCostPerDay", true, result.message?.includes("maxCostPerDay"));
}

console.log("\n== R6 il contesto entra in costToday ==");
{
  const baseDir = progetto(SRC);
  const driver = async ({ mode, userPayload }) => {
    if (mode === "context") return { text: "# About\nA test app.", usage: { tokensIn: 300000, tokensOut: 100000 } };
    const { items } = JSON.parse(userPayload);
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])), usage: { tokensIn: 100000, tokensOut: 0 } };
  };
  const config = priced(baseConfig(baseDir, driver), { maxConcurrency: 1 });
  config.llm.context = { mode: "auto" };
  await catturaAsync(() => translatePass({ config, noAsk: true, tags: ["fr-FR"] }));
  const l = readLedger(baseDir);
  eq("costo: contesto $0.4 + un lotto $0.1", 0.5, Math.round(l.costToday * 1e6) / 1e6);
  eq("token: 400k + 100k", 500000, l.tokensToday);
  eq("il contesto non tara l'uscita", ["fr-FR"], Object.keys(l.models["fake-model"].out));
}

console.log("\n== R7 senza prezzi il budget è in token, e lo stop nomina il tetto ==");
{
  const baseDir = progetto(SRC);
  const config = baseConfig(baseDir, riempie({ tokensIn: 1000, tokensOut: 1000 }));
  config.llm.connection = { ...config.llm.connection, maxConcurrency: 1 };
  config.llm.budget = { maxTokensPerRun: 1500 };
  const { valore: result, righe } = await catturaAsync(() => translatePass({ config, noAsk: true, auto: true }));
  eq("stoppedOnBudget", true, result.stoppedOnBudget);
  eq("una sola richiesta partita", 1, righe.filter((r) => r.includes("✔ < ")).length);
  eq("la nota nomina maxTokensPerRun", true, righe.some((r) => r.includes("maxTokensPerRun (1.5k) reached: 1 request(s) not sent")));

  // Senza --llm-auto la stima stessa (in token, non ci sono prezzi) rifiuta prima di partire.
  config.llm.budget = { maxTokensPerRun: 10 };
  const refused = await catturaAsync(() => translatePass({ config, noAsk: true, dryRun: true }));
  eq("la stima in token rifiuta e nomina il tetto", true, refused.valore.mode === "refused" && refused.valore.message.includes("maxTokensPerRun"));
}

console.log("\n== R8 il dry-run predice il numero di richieste del run vero ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_One_%_"}{"_%_Two_%_"}{"_%_Three_%_"}{"_%_Four_%_"}{"_%_Five_%_"}</div>;
}
`);
  let calls = 0;
  const driver = async ({ userPayload }) => {
    calls++;
    const { items } = JSON.parse(userPayload);
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])) };
  };
  const config = baseConfig(baseDir, driver);
  config.llm.connection = { ...config.llm.connection, modelClass: { maxKeys: 2 } };
  const dry = (await catturaAsync(() => translatePass({ config, noAsk: true, dryRun: true }))).valore;
  eq("dry-run: 2 lingue x 3 lotti (2+2+1)", 6, dry.totalRequests);
  await catturaAsync(() => translatePass({ config, noAsk: true }));
  eq("il run vero fa le stesse richieste", dry.totalRequests, calls);
}

console.log("\n== R9 dopo un run la taratura per lingua cambia la stima ==");
{
  const baseDir = progetto(SRC);
  // Un modello che risponde con molti più token del previsto in ja-JP: dal secondo run la stima lo sa.
  writeFileSync(join(baseDir, "locale", "ja-JP.yml"), "");
  const driver = async ({ userPayload, systemPrompt }) => {
    const { items } = JSON.parse(userPayload);
    return {
      translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])),
      usage: { tokensIn: 100, tokensOut: systemPrompt.includes("ja-JP") ? 400 : 10 },
    };
  };
  const config = baseConfig(baseDir, driver);
  await catturaAsync(() => translatePass({ config, noAsk: true }));
  const l = readLedger(baseDir);
  eq("ratioOut separati per lingua", true, ratiosFor(l, "fake-model", "ja-JP").ratioOut < ratiosFor(l, "fake-model", "fr-FR").ratioOut);
}

console.log("\n== R10 il blocco llm già normalizzato dal plugin gira come quello grezzo ==");
{
  const baseDir = progetto(SRC);
  const grezzo = priced(baseConfig(baseDir, riempie(undefined)), { modelClass: "expert" });
  grezzo.llm.budget = "normal";
  // Il plugin normalizza a costruzione e passa il risultato alla CLI, che normalizza di nuovo.
  const config = { ...grezzo, llm: normalizeLlmOptions(grezzo) };
  const { valore: result } = await catturaAsync(() => translatePass({ config, noAsk: true }));
  eq("done, nessun errore di configurazione", "done", result.mode);
}

// --------------------------------------------------------------- troncature recuperate nello stesso run
const troncata = (partialContent, usage = { tokensIn: 50, tokensOut: 4096 }) =>
  Object.assign(new Error("openai-chat reply truncated: max_tokens reached"), { truncated: true, usage, ...(partialContent === undefined ? {} : { partialContent }) });
const QUATTRO = `export default function App() {
  return <div>{"_%_Uno_%_"}{"_%_Due_%_"}{"_%_Tre_%_"}{"_%_Quattro_%_"}</div>;
}
`;

console.log("\n== S1 troncata con coppie complete: si tengono, il resto torna in un lotto più piccolo ==");
{
  const baseDir = progetto(QUATTRO);
  const lotti = [];
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    lotti.push(items.length);
    if (items.length === 4) {
      // Arrivano due coppie e metà della terza, poi max_tokens.
      const [a, b, c] = items;
      throw troncata(`{"${a.k}":"TR:${a.t}","${b.k}":"TR:${b.t}","${c.k}":"TR:${c.t.slice(0, 1)}`);
    }
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])), usage: { tokensIn: 50, tokensOut: 20 } };
  };
  const { valore: result, righe } = await catturaAsync(() => translatePass({ config: baseConfig(baseDir, driver), noAsk: true, tags: ["fr-FR"] }));
  eq("4 chiavi, poi le 2 mancanti in un lotto solo", [4, 2], lotti);
  eq("tutte e 4 tradotte nello stesso run", 4, result.perLanguage[0].filled);
  eq("nessun null residuo", false, readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8").includes("null"));
  eq("la riga della troncata: cosa ha salvato, cosa manca", true, righe.some((r) => r.includes("✔ < 2 new keys français. 2 to do / truncated / 2 not returned")));
  eq("la riga del lotto rimandato", true, righe.some((r) => r.includes("✔ < 2 new keys français. Full translate!")));
  eq("nessuna nota: non resta niente di troncato", false, righe.some((r) => r.includes("still truncated")));
  eq("la troncata non tara: una sola risposta nella finestra", 1, readLedger(baseDir).models["fake-model"].out["fr-FR"].samples.length);
}

console.log("\n== S2 i giri di metà recuperano un modello che ragiona troppo (8 -> 4 -> 2) ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_A1_%_"}{"_%_A2_%_"}{"_%_A3_%_"}{"_%_A4_%_"}{"_%_A5_%_"}{"_%_A6_%_"}{"_%_A7_%_"}{"_%_A8_%_"}</div>;
}
`);
  const lotti = [];
  // Oltre 2 chiavi il ragionamento si mangia tutto max_tokens: nessun contenuto da salvare.
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    lotti.push(items.length);
    if (items.length > 2) throw troncata("", { tokensIn: 50, tokensOut: 4096, reasoningOut: 4096 });
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])), usage: { tokensIn: 50, tokensOut: 300, reasoningOut: 200 } };
  };
  const { valore: result, righe } = await catturaAsync(() => translatePass({ config: baseConfig(baseDir, driver), noAsk: true, tags: ["fr-FR"] }));
  eq("8, poi 4 + 4, poi quattro lotti da 2", [8, 4, 4, 2, 2, 2, 2], [...lotti].sort((x, y) => y - x));
  eq("tutte e 8 tradotte nello stesso run", 8, result.perLanguage[0].filled);
  eq("nessuna nota", false, righe.some((r) => r.includes("still truncated")));
  const runsLog = readFileSync(join(baseDir, "locale", ".llm", "runs.log"), "utf8");
  eq("runs.log conta le 7 chiamate vere, non il lotto pianificato", true, /\b7 req\b/.test(runsLog));
}

console.log("\n== S3 oltre i tre giri le chiavi restano null, e la nota lo dice ==");
{
  const testi = Array.from({ length: 16 }, (_, i) => `{"_%_B${String(i + 1).padStart(2, "0")}_%_"}`).join("");
  const baseDir = progetto(`export default function App() {
  return <div>${testi}</div>;
}
`);
  const lotti = [];
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    lotti.push(items.length);
    if (items.length > 1) throw troncata("");
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])) };
  };
  const { valore: result, righe } = await catturaAsync(() => translatePass({ config: baseConfig(baseDir, driver), noAsk: true, tags: ["fr-FR"] }));
  eq("tre giri e basta: 16, 8 x 2, 4 x 4, 2 x 8", [16, 8, 8, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2], [...lotti].sort((x, y) => y - x));
  eq("nessuna tradotta", 0, result.perLanguage[0].filled);
  eq("la nota conta le 16 chiavi, in una riga", true, righe.some((r) => r.includes("16 key(s) still truncated: raise modelClass or turn reasoning off")));
}

console.log("\n== S4 runs.log conta anche i ritentativi ==");
{
  const baseDir = progetto(SRC);
  let calls = 0;
  const driver = async ({ userPayload }) => {
    calls++;
    if (calls === 1) throw Object.assign(new Error("busy"), { status: 503 });
    const { items } = JSON.parse(userPayload);
    return { translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])) };
  };
  await catturaAsync(() => translatePass({ config: baseConfig(baseDir, driver), noAsk: true, tags: ["fr-FR"] }));
  const runsLog = readFileSync(join(baseDir, "locale", ".llm", "runs.log"), "utf8");
  eq("un lotto, due chiamate: 2 req", true, /\b2 req\b/.test(runsLog));
}

console.log("\n== S5 il ragionamento si misura: riga finale, taratura, lotti del run dopo ==");
{
  const baseDir = progetto(SRC);
  const driver = async ({ userPayload }) => {
    const { items } = JSON.parse(userPayload);
    return {
      translations: Object.fromEntries(items.map((i) => [i.k, `TR:${i.t}`])),
      usage: { tokensIn: 100, tokensOut: 1000, reasoningOut: 800 },
    };
  };
  const config = baseConfig(baseDir, driver);
  const { righe } = await catturaAsync(() => translatePass({ config, noAsk: true }));
  eq("la riga finale dice quanto ha ragionato", true, righe.some((r) => r.includes("real token: 2200") && r.includes("· reasoning 80% of output")));
  const l = readLedger(baseDir);
  eq("400 token di ragionamento per chiave (800 su un lotto da 2)", 400, ratiosFor(l, "fake-model", "fr-FR").reasoningPerKey);

  // Due stringhe nuove: con 400 token a chiave e un soffitto di 500, una chiave per lotto.
  writeFileSync(join(baseDir, "src", "App.jsx"), `export default function App() {
  return <div>{"_%_Alpha_%_"}{"_%_Beta_%_"}{"_%_Gamma_%_"}{"_%_Delta_%_"}</div>;
}
`);
  config.llm.connection = { ...config.llm.connection, modelClass: { maxOutputTokens: 500 } };
  const dry = (await catturaAsync(() => translatePass({ config, noAsk: true, dryRun: true }))).valore;
  eq("2 lingue x 2 lotti da una chiave", 4, dry.totalRequests);
  eq("la stima conta il ragionamento", true, dry.estimate.tokensOut > 4 * 400);
}
{
  const baseDir = progetto(SRC);
  const { righe } = await catturaAsync(() => translatePass({ config: baseConfig(baseDir, riempie({ tokensIn: 10, tokensOut: 10 })), noAsk: true }));
  eq("senza ragionamento la riga non ne parla", false, righe.some((r) => r.includes("reasoning")));
}

console.log("\n== S6 al primo run il rapporto d'uscita segue la lingua sorgente, non quella di destinazione ==");
{
  // Cinque stringhe da 100 caratteri: con 4 caratteri per token stanno in un lotto da 200, con 1,5 no.
  const lunga = (n) => `${n} ${"x".repeat(97)}`;
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_${lunga("C1")}_%_"}{"_%_${lunga("C2")}_%_"}{"_%_${lunga("C3")}_%_"}{"_%_${lunga("C4")}_%_"}{"_%_${lunga("C5")}_%_"}</div>;
}
`);
  writeFileSync(join(baseDir, "locale", "ja-JP.yml"), "");
  const config = baseConfig(baseDir, riempie(undefined));
  config.llm.connection = { ...config.llm.connection, modelClass: { maxOutputTokens: 200 } };
  const ja = (await catturaAsync(() => translatePass({ config, noAsk: true, dryRun: true, tags: ["ja-JP"] }))).valore;
  const fr = (await catturaAsync(() => translatePass({ config, noAsk: true, dryRun: true, tags: ["fr-FR"] }))).valore;
  eq("giapponese e francese, stesso sorgente: stessi lotti", fr.totalRequests, ja.totalRequests);
  eq("un lotto solo", 1, ja.totalRequests);
}

console.log("\n== piano 4.6.3: le regole ICU nel prompt, solo quando servono ==");
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Welcome_%_"}</div>;
}
`);
  let seen = "";
  const driver = async ({ userPayload, systemPrompt }) => {
    seen = systemPrompt;
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = `TR:${item.t}`;
    return { translations };
  };
  await translatePass({ config: baseConfig(baseDir, driver), noAsk: true });
  eq("tabella senza ICU: nessuna regola ICU nel prompt", false, seen.includes("ICU MessageFormat"));
}
{
  const baseDir = progetto(`export default function App() {
  return <div>{"_%_Hai {0, plural, one {# file} other {# file}}_%_"}</div>;
}
`);
  let seen = "";
  const driver = async ({ userPayload, systemPrompt }) => {
    seen = systemPrompt;
    const { items } = JSON.parse(userPayload);
    const translations = {};
    for (const item of items) translations[item.k] = item.t.replace("{0, plural, one {# file} other {# file}}", "{0, plural, one {# fichier} other {# fichiers}}");
    return { translations };
  };
  await translatePass({ config: baseConfig(baseDir, driver), noAsk: true, tags: ["fr-FR"] });
  eq("tabella con ICU: le regole ICU sono nel prompt", true, seen.includes("ICU MessageFormat"));
  eq("le categorie plurali di fr-FR sono nel prompt", true, seen.includes("Plural branches for fr-FR:"));
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
