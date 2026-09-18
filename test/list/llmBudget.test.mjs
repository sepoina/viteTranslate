// Strato 6: budgetGuard.js — l'unico strato dove un errore si misura in soldi di qualcun altro.
//
//   node test/list/llmBudget.test.mjs
import { checkNumericCaps, checkCI, confirmProceed, shouldStopMidRun } from "../../lib/dev/llm/budgetGuard.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const budget = { maxKeysPerRun: 50, maxRequestsPerRun: 20, maxKeysPerDay: 200, maxCharsPerRun: 200000, maxCostPerRun: 1 };

// T38 — ognuno dei cinque tetti rifiuta, nominando quale e con quale numero
console.log("\n== T38 i cinque tetti ==");
{
  const r = checkNumericCaps({ keys: 128, requests: 1, chars: 1, keysToday: 0, budget });
  eq("maxKeysPerRun rifiuta", false, r.ok);
  eq("nomina il tetto e il numero", true, r.message.includes("maxKeysPerRun") && r.message.includes("50"));
}
{
  const r = checkNumericCaps({ keys: 1, requests: 99, chars: 1, keysToday: 0, budget });
  eq("maxRequestsPerRun rifiuta", false, r.ok);
}
{
  const r = checkNumericCaps({ keys: 1, requests: 1, chars: 999999, keysToday: 0, budget });
  eq("maxCharsPerRun rifiuta", false, r.ok);
}
{
  const r = checkNumericCaps({ keys: 10, requests: 1, chars: 1, keysToday: 195, budget });
  eq("maxKeysPerDay rifiuta", false, r.ok);
}
{
  const r = checkNumericCaps({ keys: 1, requests: 1, chars: 1, cost: 5, keysToday: 0, budget });
  eq("maxCostPerRun rifiuta", false, r.ok);
}
eq("dentro i tetti -> ok", true, checkNumericCaps({ keys: 1, requests: 1, chars: 1, cost: 0.1, keysToday: 0, budget }).ok);

// T39 — --llm-auto scavalca tutti e cinque
console.log("\n== T39 --llm-auto e costGuard: passarli a checkCI non scavalca ==");
eq(
  "auto bypassa keys/requests/chars/day/cost",
  true,
  checkNumericCaps({ keys: 99999, requests: 99999, chars: 99999999, cost: 999, keysToday: 999, budget, auto: true }).ok
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

// T42 — maxCostPerRun superato a metà run: ci si ferma
console.log("\n== T42 guardia \"durante\" ==");
eq("sotto il tetto -> non si ferma", false, shouldStopMidRun({ costSoFar: 0.5, maxCostPerRun: 1 }));
eq("sopra il tetto -> si ferma", true, shouldStopMidRun({ costSoFar: 1.5, maxCostPerRun: 1 }));
eq("nessun tetto -> non si ferma mai", false, shouldStopMidRun({ costSoFar: 999, maxCostPerRun: undefined }));

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
