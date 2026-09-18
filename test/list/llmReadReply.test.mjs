// Strato 3: readReply.js — dalla risposta del modello alla mappa `chiave -> candidato` di un lotto.
// Puro: nessun I/O, si prova con una risposta e le chiavi del lotto.
//
//   node test/list/llmReadReply.test.mjs
import readReply from "../../lib/dev/llm/readReply.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// L'esito intero, in un ordine fisso di campi: `eq` confronta le stringhe JSON, quindi l'ordine conta.
const fmt = (r) => ({ shape: r.shape, translations: r.translations, unknownKeys: r.unknownKeys, conflicts: r.conflicts });

// T70 — la forma chiesta dal prompt: oggetto piatto `{ "<k>": "<traduzione>" }`
console.log("\n== T70 forma piatta ==");
eq("oggetto piatto", { shape: "flat", translations: { A_1: "Hello" }, unknownKeys: [], conflicts: [] },
  fmt(readReply({ A_1: "Hello" }, ["A_1"])));

// T71 — la forma della trace 260918204954: il modello ricopia il payload invece di appiattirlo
console.log("\n== T71 `{ items: [{ k, t, where }] }` (la trace della demo) ==");
eq("involucro items riconosciuto",
  { shape: "items", translations: { A_1: "Hello" }, unknownKeys: [], conflicts: [] },
  fmt(readReply({ items: [{ k: "A_1", t: "Hello", where: "App" }] }, ["A_1"])));

// T72 — la stessa lista, ma nuda (il modello toglie l'involucro e lascia l'array)
console.log("\n== T72 `[{ k, t }]` nudo ==");
eq("array di voci",
  { shape: "items", translations: { A_1: "Hello" }, unknownKeys: [], conflicts: [] },
  fmt(readReply([{ k: "A_1", t: "Hello" }], ["A_1"])));

// T73 — un involucro in più attorno alla mappa piatta
console.log("\n== T73 `{ translations: { <k>: … } }` ==");
eq("involucro singolo riconosciuto",
  { shape: "wrapped", translations: { A_1: "Hello" }, unknownKeys: [], conflicts: [] },
  fmt(readReply({ translations: { A_1: "Hello" } }, ["A_1"])));

// T74 — blocchi di codice e prosa attorno al JSON (la risposta arriva come stringa)
console.log("\n== T74 fence e prosa attorno al JSON ==");
eq("```json … ```", { shape: "flat", translations: { A_1: "Hello" }, unknownKeys: [], conflicts: [] },
  fmt(readReply('```json\n{"A_1":"Hello"}\n```', ["A_1"])));
eq("frase prima e dopo", { shape: "flat", translations: { A_1: "Hello" }, unknownKeys: [], conflicts: [] },
  fmt(readReply('Ecco: {"A_1":"Hello"} fine', ["A_1"])));

// T75 — risposta illeggibile: né JSON né una delle forme note
console.log("\n== T75 illeggibile ==");
eq("testo non JSON", { shape: "unreadable", translations: {}, unknownKeys: [], conflicts: [] },
  fmt(readReply("garbage", ["A_1"])));

// T76 — chiave fuori lotto: conta come sconosciuta, il resto si legge
console.log("\n== T76 chiave sconosciuta ==");
eq("junk contata, A_1 letta",
  { shape: "flat", translations: { A_1: "Hello" }, unknownKeys: ["junk"], conflicts: [] },
  fmt(readReply({ A_1: "Hello", junk: "x" }, ["A_1"])));

// T77 — i nomi alternativi dei campi di una voce ricopiata
console.log("\n== T77 `key`/`translation` invece di `k`/`t` ==");
eq("nomi alternativi",
  { shape: "items", translations: { A_1: "Hello" }, unknownKeys: [], conflicts: [] },
  fmt(readReply({ items: [{ key: "A_1", translation: "Hello" }] }, ["A_1"])));

// T78 — il valore ricopiato come oggetto `{ t: … }`
console.log("\n== T78 valore-involucro ==");
eq("oggetto col solo valore dentro",
  { shape: "flat", translations: { A_1: "Hello" }, unknownKeys: [], conflicts: [] },
  fmt(readReply({ A_1: { t: "Hello" } }, ["A_1"])));

// T79 — stessa chiave con due valori diversi: non si sceglie, resta senza risposta
console.log("\n== T79 conflitto ==");
eq("A_1 scartata (due valori diversi)",
  { shape: "items", translations: {}, unknownKeys: [], conflicts: ["A_1"] },
  fmt(readReply({ items: [{ k: "A_1", t: "Hello" }, { k: "A_1", t: "Hi" }] }, ["A_1"])));

// T80 — due involucri possibili: due letture, nessuna scelta
console.log("\n== T80 due involucri ==");
eq("ambiguo -> illeggibile",
  { shape: "unreadable", translations: {}, unknownKeys: ["a", "b"], conflicts: [] },
  fmt(readReply({ a: { A_1: "x" }, b: { A_1: "y" } }, ["A_1"])));

// T81 — le chiavi si confrontano esatte: niente trim, niente case
console.log("\n== T81 confronto esatto delle chiavi ==");
eq("' A_1' non è 'A_1'",
  { shape: "unreadable", translations: {}, unknownKeys: [" A_1"], conflicts: [] },
  fmt(readReply({ " A_1": "x" }, ["A_1"])));

// T82 — voce senza un valore univoco: `t` e `translation` discordano -> saltata
console.log("\n== T82 voce senza valore univoco ==");
eq("campi in disaccordo -> voce saltata",
  { shape: "items", translations: {}, unknownKeys: [], conflicts: [] },
  fmt(readReply({ items: [{ k: "A_1", t: "Hello", translation: "Hi" }] }, ["A_1"])));

// T83 — più voci insieme: ordine del lotto preservato e una sconosciuta in mezzo
console.log("\n== T83 più voci ==");
eq("due lette, una sconosciuta",
  { shape: "items", translations: { A_1: "one", B_2: "two" }, unknownKeys: ["C_3"], conflicts: [] },
  fmt(readReply({ items: [{ k: "A_1", t: "one" }, { k: "C_3", t: "three" }, { k: "B_2", t: "two" }] }, ["A_1", "B_2"])));

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
