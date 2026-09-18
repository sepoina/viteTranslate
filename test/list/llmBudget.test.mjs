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

// T39 — --force scavalca tutti e cinque
console.log("\n== T39 --force scavalca i cinque tetti ==");
eq("force bypassa keys/requests/chars/day/cost", true, checkNumericCaps({ keys: 99999, requests: 99999, chars: 99999999, cost: 999, keysToday: 999, budget, force: true }).ok);

// T40 — CI: --force NON la scavalca. La prova che protegge la decisione più importante.
console.log("\n== T40 guardia CI ==");
eq("CI=1 rifiuta", false, checkCI({ env: { CI: "1" } }).ok);
eq("CI=1 con --yes passa", true, checkCI({ env: { CI: "1" }, yes: true }).ok);
eq("CI=1 con VITETRANSLATE_LLM_ALLOW_CI passa", true, checkCI({ env: { CI: "1", VITETRANSLATE_LLM_ALLOW_CI: "1" } }).ok);
// checkCI non accetta `force` come parametro: passarlo comunque non deve scavalcare nulla,
// perché la funzione lo ignora per costruzione — è così che --force non tocca questa guardia.
eq("--force (ignorato) non scavalca la guardia CI", false, checkCI({ env: { CI: "1" }, force: true }).ok);
eq("nessun CI -> ok", true, checkCI({ env: {} }).ok);

// T41 — senza TTY e senza --yes, si rifiuta invece di chiedere
console.log("\n== T41 conferma senza TTY ==");
{
  const r = await confirmProceed({ isTTY: false });
  eq("rifiuta", false, r.ok);
}
eq("con --yes passa anche senza TTY", true, (await confirmProceed({ isTTY: false, yes: true })).ok);
eq("con TTY e risposta y passa", true, (await confirmProceed({ isTTY: true, ask: async () => "y" })).ok);
eq("con TTY e risposta n rifiuta", false, (await confirmProceed({ isTTY: true, ask: async () => "n" })).ok);

// T42 — maxCostPerRun superato a metà run: ci si ferma
console.log("\n== T42 guardia \"durante\" ==");
eq("sotto il tetto -> non si ferma", false, shouldStopMidRun({ costSoFar: 0.5, maxCostPerRun: 1 }));
eq("sopra il tetto -> si ferma", true, shouldStopMidRun({ costSoFar: 1.5, maxCostPerRun: 1 }));
eq("nessun tetto -> non si ferma mai", false, shouldStopMidRun({ costSoFar: 999, maxCostPerRun: undefined }));

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
