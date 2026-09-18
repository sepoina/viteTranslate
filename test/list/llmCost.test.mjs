// Strato 3: costModel.js — caratteri -> token -> costo, e la loro forma stampata.
//
//   node test/list/llmCost.test.mjs
import { estimateRun, costOf, formatCost, formatTokens, CHARS_PER_TOKEN } from "../../lib/dev/llm/costModel.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// T23 — charsIn include il contesto moltiplicato per nBatch
console.log("\n== T23 charsIn = (system+context)*nBatch + item serializzati ==");
{
  const items = [{ key: "A_1", text: "hi", where: "A" }];
  const systemChars = 100;
  const contextChars = 50;
  const nBatch = 3;
  const { charsIn } = estimateRun({ items, contextChars, systemChars, nBatch });
  const serialized = JSON.stringify({ k: "A_1", t: "hi", where: "A" }).length;
  eq("charsIn", (systemChars + contextChars) * nBatch + serialized, charsIn);
}

// T24 — charsOut include il +6 per voce
console.log("\n== T24 charsOut = Σtext*1.15 + Σ(key.length+6) ==");
{
  const items = [{ key: "AB", text: "hello", where: "X" }];
  const { charsOut } = estimateRun({ items, contextChars: 0, systemChars: 0, nBatch: 1 });
  eq("charsOut", 5 * 1.15 + (2 + 6), charsOut);
}

// T25 — formatCost
console.log("\n== T25 formatCost ==");
eq("$0", "$0", formatCost(0));
eq("< $0.0001", "< $0.0001", formatCost(0.00003));
eq("$0.0191", "$0.0191", formatCost(0.0191));
eq("$12.50", "$12.50", formatCost(12.5));
eq("€0", "€0", formatCost(0, "€"));
eq("< €0.0001", "< €0.0001", formatCost(0.00003, "€"));
eq("€0.0191", "€0.0191", formatCost(0.0191, "€"));
eq("€12.50", "€12.50", formatCost(12.5, "€"));

// T26 — senza prezzi, nessuna stringa di costo
console.log("\n== T26 costOf senza prezzi -> undefined ==");
eq("nessun costMillionInput/Output", undefined, costOf({ tokensIn: 100, tokensOut: 50, connection: {} }));

// T27 — ratio misurato invece della costante
console.log("\n== T27 ratio dal ledger, non CHARS_PER_TOKEN ==");
{
  const items = [{ key: "A_1", text: "a".repeat(100), where: "A" }];
  const withoutRatio = estimateRun({ items, contextChars: 0, systemChars: 0, nBatch: 1 });
  const withRatio = estimateRun({ items, contextChars: 0, systemChars: 0, nBatch: 1, ratios: { ratioIn: 2, ratioOut: 2 } });
  eq("senza ratio usa CHARS_PER_TOKEN", withoutRatio.tokensIn, withoutRatio.charsIn / CHARS_PER_TOKEN);
  eq("con ratio usa quello misurato", withRatio.tokensIn, withRatio.charsIn / 2);
  eq("i due risultati differiscono", true, withRatio.tokensIn !== withoutRatio.tokensIn);
}

// T28 — formatTokens
console.log("\n== T28 formatTokens ==");
eq("62100 -> 62.1k", "62.1k", formatTokens(62100));
eq("500 -> 500", "500", formatTokens(500));
eq("1500000 -> 1.5M", "1.5M", formatTokens(1500000));

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
