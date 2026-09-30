// prompts.js: i due prompt di sistema e i payload utente. Nessun test dedicato esisteva prima
// del piano 4.6.4 (che vi aggiunge le regole degli slot e il campo "p"): qui il contratto intero.
//
//   node test/list/llmPrompts.test.mjs
import {
  buildTranslateSystemPrompt, buildUserPayload, buildRepairUserPayload, payloadItem, SYSTEM_TRANSLATE,
} from "../../lib/dev/llm/prompts.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const BASE = { targetTag: "it-IT", sourceTag: "en-US" };

console.log("\n== buildTranslateSystemPrompt: senza slots, identico a prima della 4.6.4 ==");
{
  const senzaSlots = buildTranslateSystemPrompt(BASE);
  const slotsFalse = buildTranslateSystemPrompt({ ...BASE, slots: false });
  eq("senza il campo slots", true, senzaSlots.startsWith(SYSTEM_TRANSLATE));
  eq("slots:false == slots assente", senzaSlots, slotsFalse);
  eq("nessuna regola sui tag numerati", false, senzaSlots.includes("numbered tags"));
}

console.log("\n== buildTranslateSystemPrompt: con slots, le regole compaiono ==");
{
  const conSlots = buildTranslateSystemPrompt({ ...BASE, slots: true });
  eq("contiene le regole dei tag numerati", true, conSlots.includes("numbered tags"));
  eq("nomina il campo p", true, conSlots.includes('"p"'));
  eq("resta il resto del prompt", true, conSlots.includes(`Target language: it-IT`));
}

console.log("\n== buildTranslateSystemPrompt: slots e icu insieme non si pestano i piedi ==");
{
  const conEntrambi = buildTranslateSystemPrompt({ ...BASE, slots: true, icu: { cardinal: ["one", "other"], ordinal: ["other"] } });
  eq("le regole ICU restano", true, conEntrambi.includes("ICU MessageFormat"));
  eq("e anche quelle degli slot", true, conEntrambi.includes("numbered tags"));
}

console.log("\n== payloadItem: p solo se la voce ha hints ==");
{
  eq("senza hints: nessuna chiave p", { k: "A_1", t: "Ciao", where: "A" },
    payloadItem({ key: "A_1", text: "Ciao", where: "A" }));
  eq("con hints: la chiave p compare", { k: "A_1", t: "Ciao <1>qui</1>", where: "A", p: { "<1>": "<a href>" } },
    payloadItem({ key: "A_1", text: "Ciao <1>qui</1>", where: "A", hints: { "<1>": "<a href>" } }));
}

console.log("\n== buildUserPayload: usa payloadItem per ogni voce ==");
{
  const items = [
    { key: "A_1", text: "Ciao", where: "A" },
    { key: "A_2", text: "Ciao <1>qui</1>", where: "A", hints: { "<1>": "<a href>" } },
  ];
  const payload = JSON.parse(buildUserPayload(items));
  eq("due voci", 2, payload.items.length);
  eq("la prima non ha p", undefined, payload.items[0].p);
  eq("la seconda ha p", { "<1>": "<a href>" }, payload.items[1].p);
}

console.log("\n== buildRepairUserPayload: hints conservato insieme al motivo del rifiuto ==");
{
  const items = [{ key: "A_1", text: "Ciao <1>qui</1>", where: "A", hints: { "<1>": "<a href>" } }];
  const payload = JSON.parse(buildRepairUserPayload(items, { A_1: "slot-args: missing <1>" }));
  eq("un item", 1, payload.items.length);
  eq("hints -> p", { "<1>": "<a href>" }, payload.items[0].p);
  eq("il motivo del rifiuto resta", "slot-args: missing <1>", payload.items[0].previousAttemptRejectedBecause);
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
