// Strato 4: buildBatches.js — dalle chiavi a null ai lotti da spedire, deterministico.
//
//   node test/list/llmBatches.test.mjs
import buildBatches, { MAX_BATCH_CHARS, MAX_BATCH_ITEMS } from "../../lib/dev/llm/buildBatches.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// T29 — determinismo
console.log("\n== T29 determinismo ==");
{
  const entries = [
    { key: "Zeta_3", text: "z" }, { key: "Alpha_1", text: "a" }, { key: "Mid_2", text: "m" },
  ];
  const a = buildBatches(entries);
  const b = buildBatches([...entries].reverse());
  eq("stesso ordine di lotti da ordini d'ingresso diversi", a, b);
  eq("ordinate per chiave (en)", ["Alpha_1", "Mid_2", "Zeta_3"], a.flat().map((i) => i.key));
}

// T30 — taglio a 50 voci e a 4000 caratteri, il primo dei due che scatta
console.log("\n== T30 taglio a MAX_BATCH_ITEMS e a MAX_BATCH_CHARS ==");
{
  const entries = Array.from({ length: 60 }, (_, i) => ({ key: `K${String(i).padStart(3, "0")}_x`, text: "t" }));
  const batches = buildBatches(entries);
  eq("60 voci corte -> due lotti, il primo da 50 (limite voci)", [MAX_BATCH_ITEMS, 10], batches.map((b) => b.length));
}
{
  // Poche voci ma grandi: scatta il limite caratteri, non quello voci.
  const bigText = "x".repeat(1000);
  const entries = Array.from({ length: 6 }, (_, i) => ({ key: `K${i}_x`, text: bigText }));
  const batches = buildBatches(entries);
  eq("6 voci grandi -> più di un lotto per limite caratteri", true, batches.length > 1);
  eq("nessun lotto oltre MAX_BATCH_CHARS (salvo voce singola)", true, batches.every((b) => b.length === 1 || JSON.stringify(b).length <= MAX_BATCH_CHARS + 200));
}

// T31 — una voce singola più lunga di MAX_BATCH_CHARS va da sola
console.log("\n== T31 voce singola oltre il limite ==");
{
  const entries = [{ key: "Huge_1", text: "x".repeat(5000) }, { key: "Small_2", text: "hi" }];
  const batches = buildBatches(entries);
  const hugeBatch = batches.find((b) => b.some((i) => i.key === "Huge_1"));
  eq("la voce enorme è sola nel suo lotto", 1, hugeBatch.length);
  eq("non spezzata: testo intatto", 5000, hugeBatch[0].text.length);
}

// T32 — where da Basename_checksum
console.log("\n== T32 where ricavato dalla chiave ==");
{
  const [batch] = buildBatches([{ key: "BasicExample_1nke42v", text: "hi" }]);
  eq("where", "BasicExample", batch[0].where);
}
{
  const [batch] = buildBatches([{ key: "My_Component_1a2b3c", text: "hi" }]);
  eq("where con underscore nel nome componente", "My_Component", batch[0].where);
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
