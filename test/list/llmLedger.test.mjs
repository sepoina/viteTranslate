// Strato 5: llmLedger.js — node_modules/.viteTranslate/llm.json. Non lancia mai.
//
//   node test/list/llmLedger.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readLedger, updateLedger, recordUsage, recordFailure, failureCount, ratiosFor, ledgerPath,
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
  updateLedger(baseDir, (l) => recordUsage(l, { model: "m", keysAdded: 10, cost: 1 }));
  // Forza `day` a ieri direttamente sul file.
  const raw = JSON.parse(readFileSync(ledgerPath(baseDir), "utf8"));
  raw.day = "2000-01-01";
  writeFileSync(ledgerPath(baseDir), JSON.stringify(raw));

  const rolled = readLedger(baseDir);
  eq("keysToday azzerato in lettura", 0, rolled.keysToday);
  eq("costToday azzerato in lettura", 0, rolled.costToday);
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

// T35 — accumulo per modello su due run
console.log("\n== T35 accumulo per modello ==");
{
  const baseDir = progetto();
  updateLedger(baseDir, (l) => recordUsage(l, { model: "gpt", charsIn: 100, tokensIn: 25, charsOut: 50, tokensOut: 12 }));
  updateLedger(baseDir, (l) => recordUsage(l, { model: "gpt", charsIn: 200, tokensIn: 50, charsOut: 100, tokensOut: 24 }));
  const l = readLedger(baseDir);
  eq("charsIn sommati", 300, l.models.gpt.charsIn);
  eq("tokensIn sommati", 75, l.models.gpt.tokensIn);
  eq("runs contati", 2, l.models.gpt.runs);
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
  try { updateLedger(baseDir, (l) => recordUsage(l, { model: "x", keysAdded: 1 })); } catch { lanciato = true; }
  eq("nessun throw", false, lanciato);
  eq("keysToday resta a 0 in lettura", 0, readLedger(baseDir).keysToday);
}

// bonus — ratiosFor
console.log("\n== ratiosFor ==");
{
  const baseDir = progetto();
  eq("nessun dato -> undefined", undefined, ratiosFor(readLedger(baseDir), "gpt"));
  updateLedger(baseDir, (l) => recordUsage(l, { model: "gpt", charsIn: 100, tokensIn: 25, charsOut: 60, tokensOut: 20 }));
  const ratios = ratiosFor(readLedger(baseDir), "gpt");
  eq("ratioIn", 4, ratios.ratioIn);
  eq("ratioOut", 3, ratios.ratioOut);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
