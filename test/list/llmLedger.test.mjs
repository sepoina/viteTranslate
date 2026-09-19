// Strato 5: llmLedger.js — node_modules/.viteTranslate/llm.json. Non lancia mai.
//
//   node test/list/llmLedger.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readLedger, updateLedger, recordRequest, recordFailure, failureCount, ratiosFor, ledgerPath,
} from "../../lib/dev/llm/llmLedger.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function progetto({ conNodeModules = true } = {}) {
  const baseDir = mkdtempSync(join(tmpdir(), "vt-llmledger-"));
  temporanee.push(baseDir);
  if (conNodeModules) mkdirSync(join(baseDir, "node_modules"), { recursive: true });
  return baseDir;
}

// T33 — rollover del giorno in lettura
console.log("\n== T33 rollover del giorno ==");
{
  const baseDir = progetto();
  updateLedger(baseDir, (l) => recordRequest(l, { model: "m", usage: { tokensIn: 100, tokensOut: 50 }, keysAdded: 10, cost: 1 }));
  // Forza `day` a ieri direttamente sul file.
  const raw = JSON.parse(readFileSync(ledgerPath(baseDir), "utf8"));
  raw.day = "2000-01-01";
  writeFileSync(ledgerPath(baseDir), JSON.stringify(raw));

  const rolled = readLedger(baseDir);
  eq("keysToday azzerato in lettura", 0, rolled.keysToday);
  eq("costToday azzerato in lettura", 0, rolled.costToday);
  eq("tokensToday azzerato in lettura", 0, rolled.tokensToday);
  eq("day riscritto a oggi nell'oggetto letto", true, rolled.day !== "2000-01-01");

  const onDisk = JSON.parse(readFileSync(ledgerPath(baseDir), "utf8"));
  eq("il file su disco non cambia finché non si scrive", "2000-01-01", onDisk.day);
}

// T34 — failures per lingua
console.log("\n== T34 failures per lingua ==");
{
  const baseDir = progetto();
  updateLedger(baseDir, (l) => {
    recordFailure(l, "fr-FR", "Some_key", "placeholder-count");
    recordFailure(l, "fr-FR", "Some_key", "placeholder-count");
  });
  const l = readLedger(baseDir);
  eq("fr-FR conta 2", 2, failureCount(l, "fr-FR", "Some_key"));
  eq("de-DE resta a 0", 0, failureCount(l, "de-DE", "Some_key"));
}

// T35 — accumulo per modello su due richieste
console.log("\n== T35 accumulo per modello ==");
{
  const baseDir = progetto();
  updateLedger(baseDir, (l) => recordRequest(l, {
    model: "gpt", tag: "fr-FR", usage: { tokensIn: 25, tokensOut: 12, cachedIn: 5 }, cost: 0.5, charsIn: 100, charsOut: 50, keysAdded: 3,
  }));
  updateLedger(baseDir, (l) => recordRequest(l, {
    model: "gpt", tag: "fr-FR", usage: { tokensIn: 50, tokensOut: 24 }, cost: 0.25, charsIn: 200, charsOut: 100,
  }));
  const l = readLedger(baseDir);
  eq("charsIn sommati", 300, l.models.gpt.charsIn);
  eq("tokensIn sommati", 75, l.models.gpt.tokensIn);
  eq("cachedIn registrato", 5, l.models.gpt.cachedIn);
  eq("requests contate", 2, l.models.gpt.requests);
  eq("uscita per lingua: una voce per risposta (senza `keys`, niente ragionamento)",
    [{ chars: 50, tokens: 12, reasoning: 0, keys: 0 }, { chars: 100, tokens: 24, reasoning: 0, keys: 0 }], l.models.gpt.out["fr-FR"].samples);
  eq("ratioOut sulla finestra", 150 / 36, ratiosFor(l, "gpt", "fr-FR").ratioOut);
  eq("costToday", 0.75, l.costToday);
  eq("tokensToday (in + out)", 111, l.tokensToday);
  eq("keysToday", 3, l.keysToday);
  eq("schema 2", 2, JSON.parse(readFileSync(ledgerPath(baseDir), "utf8")).version);
}

// T35b — un tentativo fallito si paga, ma non tara
console.log("\n== T35b senza taratura: costo e token sì, rapporti no ==");
{
  const baseDir = progetto();
  updateLedger(baseDir, (l) => recordRequest(l, { model: "gpt", tag: "fr-FR", usage: { tokensIn: 40, tokensOut: 60 }, cost: 0.2 }));
  const l = readLedger(baseDir);
  eq("costToday", 0.2, l.costToday);
  eq("tokensToday", 100, l.tokensToday);
  eq("charsIn non toccato", 0, l.models.gpt.charsIn);
  eq("tokensIn non toccato", 0, l.models.gpt.tokensIn);
  eq("out vuoto", {}, l.models.gpt.out);
  eq("ma la richiesta è contata", 1, l.models.gpt.requests);
  eq("nessun rapporto", {}, ratiosFor(l, "gpt", "fr-FR"));
}

// T35c — la chiamata del contesto (senza tag) non tocca l'uscita
console.log("\n== T35c senza tag: la taratura di uscita non si tocca ==");
{
  const baseDir = progetto();
  updateLedger(baseDir, (l) => recordRequest(l, { model: "gpt", usage: { tokensIn: 40, tokensOut: 60 }, charsIn: 160, charsOut: 90 }));
  const l = readLedger(baseDir);
  eq("out vuoto", {}, l.models.gpt.out);
  eq("ma l'ingresso sì", 4, ratiosFor(l, "gpt").ratioIn);
}

// T35d — un ledger v1 si legge come vuoto
console.log("\n== T35d ledger v1 ==");
{
  const baseDir = progetto();
  mkdirSync(join(baseDir, "node_modules", ".viteTranslate"), { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  writeFileSync(ledgerPath(baseDir), JSON.stringify({ version: 1, day, keysToday: 9, costToday: 3, models: { gpt: { charsIn: 1 } } }));
  const l = readLedger(baseDir);
  eq("keysToday a zero", 0, l.keysToday);
  eq("costToday a zero", 0, l.costToday);
  eq("tokensToday a zero", 0, l.tokensToday);
  eq("nessun modello", {}, l.models);
}

// T35e — il ragionamento si tara a parte, per chiave; la risposta senza di lui
console.log("\n== T35e ragionamento per chiave ==");
{
  const baseDir = progetto();
  updateLedger(baseDir, (l) => recordRequest(l, {
    model: "ds", tag: "de-DE", usage: { tokensIn: 100, tokensOut: 1000, reasoningOut: 800 },
    charsIn: 400, charsOut: 600, keys: 10,
  }));
  const l = readLedger(baseDir);
  eq("i token della risposta non contano il ragionamento", [{ chars: 600, tokens: 200, reasoning: 800, keys: 10 }], l.models.ds.out["de-DE"].samples);
  eq("tokensToday conta tutto il fatturato", 1100, l.tokensToday);
  eq("ratioOut sulla sola risposta", 3, ratiosFor(l, "ds", "de-DE").ratioOut);
  eq("reasoningPerKey", 80, ratiosFor(l, "ds", "de-DE").reasoningPerKey);
}
{
  // Un modello che non ragiona, o un provider che non lo dice: ragionamento 0 per chiave.
  const baseDir = progetto();
  updateLedger(baseDir, (l) => recordRequest(l, { model: "m", tag: "fr-FR", usage: { tokensIn: 10, tokensOut: 50 }, charsOut: 150, keys: 5 }));
  eq("senza reasoningOut: 0 per chiave", 0, ratiosFor(readLedger(baseDir), "m", "fr-FR").reasoningPerKey);
}

// T35f — un `out[tag]` della forma di prima (caratteri della risposta, ragionamento dentro) si ignora
console.log("\n== T35f taratura della forma precedente ==");
{
  const baseDir = progetto();
  mkdirSync(join(baseDir, "node_modules", ".viteTranslate"), { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  writeFileSync(ledgerPath(baseDir), JSON.stringify({
    version: 2, day, costToday: 0.27, tokensToday: 300000, keysToday: 912, failures: {}, context: { keysAtGeneration: 228 },
    models: { ds: { charsIn: 300, tokensIn: 100, cachedIn: 0, requests: 58, out: { "ja-JP": { chars: 10211, tokens: 28721 } } } },
  }));
  const l = readLedger(baseDir);
  eq("il resto del ledger vale", [0.27, 228], [l.costToday, l.context.keysAtGeneration]);
  eq("ratioOut vecchio ignorato: solo ratioIn", ["ratioIn"], Object.keys(ratiosFor(l, "ds", "ja-JP")));
  updateLedger(baseDir, (x) => recordRequest(x, { model: "ds", tag: "ja-JP", usage: { tokensIn: 1, tokensOut: 30 }, charsOut: 90, keys: 1 }));
  eq("alla prima scrittura si riparte da zero", { samples: [{ chars: 90, tokens: 30, reasoning: 0, keys: 1 }] }, readLedger(baseDir).models.ds.out["ja-JP"]);
}

// T35g — la taratura segue le ultime ~300 chiavi, non tutta la storia
console.log("\n== T35g finestra delle ultime chiavi ==");
{
  const baseDir = progetto();
  // 300 chiavi con molto ragionamento, poi il ragionamento si spegne.
  for (let i = 0; i < 3; i++) {
    updateLedger(baseDir, (l) => recordRequest(l, { model: "ds", tag: "fr-FR", usage: { tokensIn: 1, tokensOut: 9000, reasoningOut: 6000 }, charsOut: 9000, keys: 100 }));
  }
  eq("prima: 60 token di ragionamento per chiave", 60, ratiosFor(readLedger(baseDir), "ds", "fr-FR").reasoningPerKey);
  for (let i = 0; i < 3; i++) {
    updateLedger(baseDir, (l) => recordRequest(l, { model: "ds", tag: "fr-FR", usage: { tokensIn: 1, tokensOut: 3000, reasoningOut: 0 }, charsOut: 9000, keys: 100 }));
  }
  const dopo = readLedger(baseDir);
  eq("dopo 300 chiavi nuove: il vecchio è sparito", 0, ratiosFor(dopo, "ds", "fr-FR").reasoningPerKey);
  eq("la finestra resta a 300 chiavi", 300, dopo.models.ds.out["fr-FR"].samples.reduce((n, x) => n + x.keys, 0));
  eq("ratioOut invariato: 3 caratteri per token di risposta", 3, ratiosFor(dopo, "ds", "fr-FR").ratioOut);
  updateLedger(baseDir, (l) => recordRequest(l, { model: "ds", tag: "fr-FR", usage: { tokensIn: 1, tokensOut: 30, reasoningOut: 0 }, charsOut: 90, keys: 1 }));
  eq("una risposta in più: esce la più vecchia solo se le altre coprono la finestra", 4, readLedger(baseDir).models.ds.out["fr-FR"].samples.length);
}

// T36 — corrotto -> niente throw, contatori a zero
console.log("\n== T36 llm.json corrotto ==");
{
  const baseDir = progetto();
  mkdirSync(join(baseDir, "node_modules", ".viteTranslate"), { recursive: true });
  writeFileSync(ledgerPath(baseDir), "{ non json", "utf8");
  let lanciato = false;
  let l;
  try { l = readLedger(baseDir); } catch { lanciato = true; }
  eq("nessun throw", false, lanciato);
  eq("keysToday a zero", 0, l.keysToday);
}

// T37 — senza node_modules non scrive e non lancia
console.log("\n== T37 senza node_modules ==");
{
  const baseDir = progetto({ conNodeModules: false });
  let lanciato = false;
  try { updateLedger(baseDir, (l) => recordRequest(l, { model: "x", usage: { tokensIn: 1, tokensOut: 1 }, keysAdded: 1 })); } catch { lanciato = true; }
  eq("nessun throw", false, lanciato);
  eq("keysToday resta a 0 in lettura", 0, readLedger(baseDir).keysToday);
}

// ratiosFor: ratioIn per modello, ratioOut per (modello, lingua)
console.log("\n== ratiosFor ==");
{
  const baseDir = progetto();
  eq("nessun dato -> oggetto vuoto", {}, ratiosFor(readLedger(baseDir), "gpt", "fr-FR"));
  updateLedger(baseDir, (l) => recordRequest(l, { model: "gpt", tag: "fr-FR", usage: { tokensIn: 25, tokensOut: 20 }, charsIn: 100, charsOut: 60 }));
  updateLedger(baseDir, (l) => recordRequest(l, { model: "gpt", tag: "ja-JP", usage: { tokensIn: 25, tokensOut: 40 }, charsIn: 100, charsOut: 60 }));
  const l = readLedger(baseDir);
  eq("ratioIn (per modello)", 4, ratiosFor(l, "gpt").ratioIn);
  eq("ratioOut fr-FR", 3, ratiosFor(l, "gpt", "fr-FR").ratioOut);
  eq("ratioOut ja-JP, separato", 1.5, ratiosFor(l, "gpt", "ja-JP").ratioOut);
  eq("lingua mai vista: solo ratioIn", ["ratioIn"], Object.keys(ratiosFor(l, "gpt", "de-DE")));
  eq("senza tag: solo ratioIn", ["ratioIn"], Object.keys(ratiosFor(l, "gpt")));
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
