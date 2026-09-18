// Strato 10: translatePass.js — l'orchestratore. Il test che conta: su una cartella temporanea
// con due lingue e un driver finto, mai la rete vera.
//
//   node test/list/llmTranslatePass.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
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
  const result = await translatePass({ config: baseConfig(baseDir, driver), yes: true });
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
  const result = await translatePass({ config: baseConfig(baseDir, driver), yes: true });
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
  const result = await translatePass({ config: baseConfig(baseDir, driver), yes: true });
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
  const result = await translatePass({ config: baseConfig(baseDir, driver), yes: true });
  eq("rejected per placeholder-count", true, result.perLanguage.every((l) => l.rejectedByReason["placeholder-count"] === 1));
  const frText = readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8");
  eq("la chiave resta null nel file", true, /:\s*null\s*$/m.test(frText));
}

// --------------------------------------------------------------- T68: failures.count >= 2 -> saltata; --force -> ritentata
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
  await translatePass({ config: baseConfig(baseDir, async () => ({ translations: {} })), yes: true });
  const realKey = keyOf(baseDir);
  updateLedger(baseDir, (l) => {
    recordFailure(l, "fr-FR", realKey, "placeholder-count");
    recordFailure(l, "fr-FR", realKey, "placeholder-count");
  });

  const result1 = await translatePass({ config, yes: true });
  const frReport = result1.perLanguage.find((l) => l.tag === "fr-FR");
  eq("saltata senza --force", 1, frReport?.skipped ?? 0);
  eq("nessuna chiamata al driver per fr-FR (nulla da tradurre lì)", true, frReport.filled === 0);

  const result2 = await translatePass({ config, force: true, yes: true });
  const frReport2 = result2.perLanguage.find((l) => l.tag === "fr-FR");
  eq("con --force ritentata e riempita", 1, frReport2.filled);
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
  await translatePass({ config: baseConfig(baseDir, driver), yes: true });
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
  await translatePass({ config: baseConfig(baseDir, fillAll), yes: true });
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
  await translatePass({ config: baseConfig(baseDir, fillAll), yes: true });
  const frAfterSecond = readFileSync(join(baseDir, "locale", "fr-FR.yml"), "utf8");

  eq("le due chiavi già tradotte compaiono identiche", true, frAfterSecond.includes('"TR:Already done"') && frAfterSecond.includes('"TR:New one"'));
  eq("la terza chiave nuova è stata aggiunta e tradotta", true, frAfterSecond.includes('"TR:Third one"'));
  void frAfterFirst;
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
