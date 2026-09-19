// Strato 6: budgetGuard.js — l'unico strato dove un errore si misura in soldi di qualcun altro.
//
//   node test/list/llmBudget.test.mjs
import { checkCaps, checkCI, confirmProceed, shouldStopMidRun } from "../../lib/dev/llm/budgetGuard.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const budget = { maxCostPerRun: 1, maxCostPerDay: 5, maxTokensPerRun: 100000, maxTokensPerDay: 400000 };
const today0 = { cost: 0, tokens: 0 };

// T38 — ognuno dei quattro tetti rifiuta, nominando quale e con quale numero
console.log("\n== T38 i quattro tetti ==");
{
  const r = checkCaps({ estimate: { cost: 1.5, tokens: 1 }, today: today0, budget });
  eq("maxCostPerRun rifiuta", false, r.ok);
  eq("nomina il tetto e i numeri", true, r.message.includes("maxCostPerRun") && r.message.includes("$1.50") && r.message.includes("$1.00"));
}
{
  const r = checkCaps({ estimate: { cost: 0.5, tokens: 1 }, today: { cost: 4.75, tokens: 0 }, budget });
  eq("maxCostPerDay rifiuta (today + stima)", false, r.ok);
  eq("nomina maxCostPerDay", true, r.message.includes("maxCostPerDay"));
}
{
  const r = checkCaps({ estimate: { cost: 0.1, tokens: 150000 }, today: today0, budget });
  eq("maxTokensPerRun rifiuta", false, r.ok);
  eq("nomina il tetto, in token formattati", true, r.message.includes("maxTokensPerRun") && r.message.includes("150.0k"));
}
{
  const r = checkCaps({ estimate: { cost: 0.1, tokens: 60000 }, today: { cost: 0, tokens: 350000 }, budget });
  eq("maxTokensPerDay rifiuta (today + stima)", false, r.ok);
  eq("nomina maxTokensPerDay", true, r.message.includes("maxTokensPerDay"));
}
eq("dentro i tetti -> ok", true, checkCaps({ estimate: { cost: 0.1, tokens: 1000 }, today: today0, budget }).ok);
eq(
  "ordine: costo per run prima di tutto",
  true,
  checkCaps({ estimate: { cost: 9, tokens: 9e9 }, today: { cost: 99, tokens: 9e9 }, budget }).message.includes("maxCostPerRun")
);
eq(
  "ordine: maxCostPerDay prima dei token",
  true,
  checkCaps({ estimate: { cost: 0.9, tokens: 9e9 }, today: { cost: 4.5, tokens: 0 }, budget }).message.includes("maxCostPerDay")
);
{
  // Il ripiego in token: senza prezzi il costo è `undefined` e i tetti di costo (già `undefined`) si saltano.
  const tokensOnly = { maxCostPerRun: undefined, maxCostPerDay: undefined, maxTokensPerRun: 1000, maxTokensPerDay: undefined };
  eq("costo undefined salta i tetti di costo", true, checkCaps({ estimate: { cost: undefined, tokens: 10 }, today: today0, budget }).ok);
  eq("tetti undefined saltati", true, checkCaps({ estimate: { cost: 999, tokens: 999 }, today: today0, budget: tokensOnly }).ok);
  eq("il tetto di token attivo rifiuta", false, checkCaps({ estimate: { tokens: 2000 }, today: today0, budget: tokensOnly }).ok);
}
eq("valuta nel messaggio", true, checkCaps({ estimate: { cost: 2, tokens: 1 }, today: today0, budget, costUnity: "€" }).message.includes("€2.00"));

// T39 — --llm-auto scavalca tutti e quattro
console.log("\n== T39 --llm-auto e costGuard: passarli a checkCI non scavalca ==");
eq(
  "auto bypassa costo/giorno/token",
  true,
  checkCaps({ estimate: { cost: 999, tokens: 9e9 }, today: { cost: 999, tokens: 9e9 }, budget, auto: true }).ok
);
// checkCI non accetta `auto` né `costGuard` come parametri: passarli comunque non deve
// scavalcare nulla, perché la funzione li ignora per costruzione — è così che né --llm-auto né
// llm.costGuard toccano questa guardia.
eq("--llm-auto (ignorato) non scavalca la guardia CI", false, checkCI({ env: { CI: "1" }, auto: true }).ok);
eq("costGuard (ignorato) non scavalca la guardia CI", false, checkCI({ env: { CI: "1" }, costGuard: 100 }).ok);

// T40 — CI: --llm-auto NON la scavalca. La prova che protegge la decisione più importante.
console.log("\n== T40 guardia CI ==");
eq("CI=1 rifiuta", false, checkCI({ env: { CI: "1" } }).ok);
eq("CI=1 con --llm-noask passa", true, checkCI({ env: { CI: "1" }, noAsk: true }).ok);
eq("CI=1 con VITETRANSLATE_LLM_ALLOW_CI passa", true, checkCI({ env: { CI: "1", VITETRANSLATE_LLM_ALLOW_CI: "1" } }).ok);
eq("nessun CI -> ok", true, checkCI({ env: {} }).ok);

// T41 — senza TTY e senza --llm-noask, si rifiuta invece di chiedere
console.log("\n== T41 conferma senza TTY ==");
{
  const r = await confirmProceed({ isTTY: false });
  eq("rifiuta", false, r.ok);
}
eq("con --llm-noask passa anche senza TTY", true, (await confirmProceed({ isTTY: false, noAsk: true })).ok);
eq("con TTY e risposta y passa", true, (await confirmProceed({ isTTY: true, ask: async () => "y" })).ok);
eq("con TTY e risposta n rifiuta", false, (await confirmProceed({ isTTY: true, ask: async () => "n" })).ok);

// T42 — un tetto superato a metà run: ci si ferma, e si dice quale
console.log("\n== T42 guardia \"durante\" ==");
const spent = (cost, tokens = 0) => ({ cost, tokens });
eq("sotto i tetti -> non si ferma", false, shouldStopMidRun({ spent: spent(0.5, 10), today: today0, budget }));
eq("maxCostPerRun -> nome del tetto", "maxCostPerRun", shouldStopMidRun({ spent: spent(1.5), today: today0, budget }));
eq("maxCostPerDay usa today + spent", "maxCostPerDay", shouldStopMidRun({ spent: spent(0.9), today: { cost: 4.5, tokens: 0 }, budget }));
eq("...e da solo non basta", false, shouldStopMidRun({ spent: spent(0.9), today: today0, budget }));
eq("maxTokensPerRun", "maxTokensPerRun", shouldStopMidRun({ spent: spent(0, 100001), today: today0, budget }));
eq("maxTokensPerDay usa today + spent", "maxTokensPerDay", shouldStopMidRun({ spent: spent(0, 60000), today: { cost: 0, tokens: 350000 }, budget }));
eq(
  "nessun tetto -> non si ferma mai",
  false,
  shouldStopMidRun({ spent: spent(999, 9e9), today: today0, budget: { maxCostPerRun: undefined, maxCostPerDay: undefined, maxTokensPerRun: undefined, maxTokensPerDay: undefined } })
);
eq("Infinity non scatta mai", false, shouldStopMidRun({ spent: spent(999, 9e9), today: today0, budget: { maxCostPerRun: Infinity, maxTokensPerRun: Infinity } }));

// G1-G5 — costGuard in confirmProceed
console.log("\n== G1-G5 costGuard ==");
{
  const r = await confirmProceed({ isTTY: false, cost: 0.001, costGuard: 0.01 });
  eq("G1 sotto costGuard -> ok", true, r.ok);
  eq("G1 how: costGuard", "costGuard", r.how);
}
{
  const r = await confirmProceed({ isTTY: false, cost: 0.01, costGuard: 0.01 });
  eq("G2 cost === costGuard -> confronto stretto, senza TTY rifiuta", false, r.ok);
}
{
  const r = await confirmProceed({ isTTY: false, cost: undefined, costGuard: 0.01 });
  eq("G3 cost assente -> senza TTY rifiuta", false, r.ok);
}
{
  const r = await confirmProceed({ isTTY: false, noAsk: true, cost: 0.01, costGuard: 0.01 });
  eq("G4 noAsk vince anche con costGuard soddisfatto", "noask", r.how);
}
{
  const r = await confirmProceed({ isTTY: true, cost: 100, costGuard: 0.01, ask: async () => "n" });
  eq("G5 con TTY e costGuard superato -> chiede", "declined.", r.message);
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
