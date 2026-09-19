// Strato 3: costModel.js — caratteri -> token -> costo, e la loro forma stampata.
//
//   node test/list/llmCost.test.mjs
import {
  estimateRun, costOf, formatCost, formatTokens, CHARS_PER_TOKEN, itemCharsIn, itemCharsOut, itemTokensOut, initialRatio,
} from "../../lib/dev/llm/costModel.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// T23 — charsIn = system * lotti + voci serializzate, il contesto NON si somma una seconda volta
console.log("\n== T23 charsIn = system*nBatch + item serializzati ==");
{
  const item = { key: "A_1", text: "hi", where: "A" };
  const systemChars = 150; // il prompt di sistema contiene già il contesto
  const { charsIn } = estimateRun({ languages: [{ systemChars, batches: [[item], [item], [item]] }] });
  eq("charsIn", systemChars * 3 + JSON.stringify({ k: "A_1", t: "hi", where: "A" }).length * 3, charsIn);
  eq("itemCharsIn", JSON.stringify({ k: "A_1", t: "hi", where: "A" }).length, itemCharsIn(item));
}

// T23b — regressione: il contesto contato due volte
console.log("\n== T23b regressione: il contesto non si conta due volte ==");
{
  const item = { key: "A_1", text: "hi", where: "A" };
  const context = "c".repeat(400);
  // Un prompt che contiene il contesto è più lungo di 400 caratteri, non di 800.
  const without = estimateRun({ languages: [{ systemChars: 100, batches: [[item]] }] });
  const withContext = estimateRun({ languages: [{ systemChars: 100 + context.length, batches: [[item]] }] });
  eq("il contesto pesa una volta sola", context.length, withContext.charsIn - without.charsIn);
}

// T24 — charsOut include il +6 per voce
console.log("\n== T24 charsOut = Σtext*1.15 + Σ(key.length+6) ==");
{
  const item = { key: "AB", text: "hello", where: "X" };
  const { charsOut } = estimateRun({ languages: [{ systemChars: 0, batches: [[item]] }] });
  eq("charsOut", 5 * 1.15 + (2 + 6), charsOut);
  eq("itemCharsOut", 5 * 1.15 + (2 + 6), itemCharsOut(item));
}

// T24b — rapporti iniziali e stima per lingua
console.log("\n== T24b initialRatio e stima per lingua ==");
eq("ja-JP -> 1.5", 1.5, initialRatio("ja-JP"));
eq("zh-Hans-CN -> 1.5", 1.5, initialRatio("zh-Hans-CN"));
eq("ko -> 1.5", 1.5, initialRatio("ko"));
eq("fr-FR -> 4", 4, initialRatio("fr-FR"));
{
  const item = { key: "AB", text: "hello", where: "X" };
  const one = estimateRun({ languages: [{ systemChars: 10, batches: [[item]], ratioIn: 4, ratioOut: 4 }] });
  const two = estimateRun({ languages: [
    { systemChars: 10, batches: [[item]], ratioIn: 4, ratioOut: 4 },
    { systemChars: 10, batches: [[item]], ratioIn: 4, ratioOut: 1.5 },
  ] });
  eq("due lingue si sommano, ciascuna col suo ratioOut", one.tokensOut + one.charsOut / 1.5, two.tokensOut);
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
  const batches = [[{ key: "A_1", text: "a".repeat(100), where: "A" }]];
  const withoutRatio = estimateRun({ languages: [{ systemChars: 0, batches }] });
  const withRatio = estimateRun({ languages: [{ systemChars: 0, batches, ratioIn: 2, ratioOut: 2 }] });
  eq("senza ratio usa CHARS_PER_TOKEN", withoutRatio.tokensIn, withoutRatio.charsIn / CHARS_PER_TOKEN);
  eq("con ratio usa quello misurato", withRatio.tokensIn, withRatio.charsIn / 2);
  eq("i due risultati differiscono", true, withRatio.tokensIn !== withoutRatio.tokensIn);
}

// T27b — il ragionamento per chiave si somma alla risposta, voce per voce
console.log("\n== T27b reasoningPerKey ==");
{
  const item = { key: "AB", text: "hello", where: "X" };
  eq("itemTokensOut senza ragionamento = itemCharsOut / ratioOut", itemCharsOut(item) / 2, itemTokensOut(item, { ratioOut: 2 }));
  eq("con 50 token di ragionamento per chiave", itemCharsOut(item) / 2 + 50, itemTokensOut(item, { ratioOut: 2, reasoningPerKey: 50 }));
  eq("senza ratioOut: CHARS_PER_TOKEN", itemCharsOut(item) / CHARS_PER_TOKEN, itemTokensOut(item));
  const batches = [[item, item], [item]];
  const base = estimateRun({ languages: [{ systemChars: 0, batches, ratioOut: 2 }] });
  const thinking = estimateRun({ languages: [{ systemChars: 0, batches, ratioOut: 2, reasoningPerKey: 50 }] });
  eq("la stima conta 50 token in più per ognuna delle 3 chiavi", base.tokensOut + 150, thinking.tokensOut);
  eq("i caratteri stimati non cambiano", base.charsOut, thinking.charsOut);
}

// T28 — formatTokens
console.log("\n== T28 formatTokens ==");
eq("62100 -> 62.1k", "62.1k", formatTokens(62100));
eq("500 -> 500", "500", formatTokens(500));
eq("1500000 -> 1.5M", "1.5M", formatTokens(1500000));

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
