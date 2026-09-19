// Strato 4: buildBatches.js — dalle chiavi a null ai lotti da spedire, deterministico.
//
//   node test/list/llmBatches.test.mjs
import buildBatches from "../../lib/dev/llm/buildBatches.js";
import { itemCharsIn } from "../../lib/dev/llm/costModel.js";
import { MODEL_CLASSES } from "../../lib/dev/llm/llmOptions.js";

// Nessun tetto attivo, salvo quelli che il caso sovrascrive: `k` enorme = la soglia non chiude mai.
const OPEN = { k: 1e9, maxOutputTokens: 1e9, maxKeys: 1e9 };
const params = (over = {}) => ({
  overheadTokens: 100, modelClass: { ...OPEN, ...(over.modelClass ?? {}) }, ratioIn: 4, ratioOut: 4, ...over, });
const many = (n, text = "t") => Array.from({ length: n }, (_, i) => ({ key: `K${String(i).padStart(3, "0")}_x`, text }));

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
  const a = buildBatches(entries, params());
  const b = buildBatches([...entries].reverse(), params());
  eq("stesso ordine di lotti da ordini d'ingresso diversi", a, b);
  eq("ordinate per chiave (en)", ["Alpha_1", "Mid_2", "Zeta_3"], a.flat().map((i) => i.key));
}

// T30 — la soglia k·O chiude DOPO aver aggiunto la voce
console.log("\n== T30 soglia minima k·O: chiude dopo ==");
{
  const entries = many(60);
  const tIn = itemCharsIn({ key: "K000_x", text: "t", where: "K000" }) / 4;
  // k·O = 2.5 voci: la terza porta P oltre la soglia e chiude, quindi lotti da 3.
  const O = (2.5 * tIn) / 3;
  const batches = buildBatches(entries, params({ overheadTokens: O, modelClass: { k: 3 } }));
  eq("lotti da 3 (la voce che supera la soglia resta nel lotto)", true, batches.slice(0, -1).every((b) => b.length === 3));
  eq("nessuna voce persa", 60, batches.flat().length);

  const bigO = buildBatches(entries, params({ overheadTokens: O * 10, modelClass: { k: 3 } }));
  eq("con O grande i lotti crescono", true, bigO[0].length > batches[0].length);
  eq("con O molto grande, un lotto solo", 1, buildBatches(entries, params({ overheadTokens: 1e6, modelClass: { k: 3 } })).length);
}

// T30b — i soffitti chiudono PRIMA di aggiungere
console.log("\n== T30b soffitti maxKeys e maxOutputTokens: chiudono prima ==");
{
  const byKeys = buildBatches(many(60), params({ modelClass: { maxKeys: 7 } }));
  eq("maxKeys 7 -> lotti da 7, l'ultimo da 4", [7, 7, 7, 7, 7, 7, 7, 7, 4], byKeys.map((b) => b.length));

  // Una voce "K000_x"/"t" pesa 13.15 caratteri in uscita = 3.2875 token: tre stanno in 10, la quarta no.
  const byOut = buildBatches(many(60), params({ modelClass: { maxOutputTokens: 10 } }));
  eq("maxOutputTokens 10 -> lotti da 3", true, byOut.every((b) => b.length === 3));

  // Il soffitto vince sulla soglia quando scatta per primo.
  const both = buildBatches(many(60), params({ overheadTokens: 1e6, modelClass: { k: 3, maxKeys: 5 } }));
  eq("soglia lontana, maxKeys 5 -> lotti da 5", true, both.every((b) => b.length === 5));
}

// T30c — la taratura di uscita muove i lotti
console.log("\n== T30c ratioOut CJK: meno chiavi per lotto ==");
{
  const cls = { maxOutputTokens: 100 };
  const latin = buildBatches(many(200, "x".repeat(20)), params({ modelClass: cls, ratioOut: 4 }));
  const cjk = buildBatches(many(200, "x".repeat(20)), params({ modelClass: cls, ratioOut: 1.5 }));
  eq("con 1,5 caratteri/token i lotti hanno meno chiavi", true, cjk[0].length < latin[0].length);
}

// T30d — il ragionamento per chiave pesa nel soffitto come la risposta
console.log("\n== T30d reasoningPerKey: lotti più piccoli ==");
{
  const cls = { maxOutputTokens: 1000 };
  const plain = buildBatches(many(200, "x".repeat(20)), params({ modelClass: cls }));
  const thinking = buildBatches(many(200, "x".repeat(20)), params({ modelClass: cls, reasoningPerKey: 60 }));
  // Una voce: (20 * 1.15 + 6 + 6) / 4 = 8.75 token di risposta; con 60 di ragionamento 68.75.
  eq("senza ragionamento: 114 chiavi per lotto", 114, plain[0].length);
  eq("con 60 token di ragionamento per chiave: 14", 14, thinking[0].length);
  eq("nessuna voce persa", 200, thinking.flat().length);
}

// T31 — una voce singola oltre un soffitto va da sola
console.log("\n== T31 voce singola oltre il soffitto ==");
{
  const entries = [{ key: "Huge_1", text: "x".repeat(20000) }, { key: "Small_2", text: "hi" }, { key: "Tiny_3", text: "yo" }];
  const batches = buildBatches(entries, params({ modelClass: { maxOutputTokens: MODEL_CLASSES.standard.maxOutputTokens } }));
  const hugeBatch = batches.find((b) => b.some((i) => i.key === "Huge_1"));
  eq("la voce enorme è sola nel suo lotto", 1, hugeBatch.length);
  eq("non spezzata: testo intatto", 20000, hugeBatch[0].text.length);
  eq("le altre non sono perse", 3, batches.flat().length);
}
{
  // La voce enorme arriva dopo una piccola: il lotto corrente si chiude prima, la enorme apre il suo.
  const entries = [{ key: "A_1", text: "hi" }, { key: "Huge_2", text: "x".repeat(20000) }];
  const batches = buildBatches(entries, params({ modelClass: { maxOutputTokens: 3000 } }));
  eq("piccola e enorme in due lotti", [1, 1], batches.map((b) => b.length));
}

// T32 — where da Basename_checksum
console.log("\n== T32 where ricavato dalla chiave ==");
{
  const [batch] = buildBatches([{ key: "BasicExample_1nke42v", text: "hi" }], params());
  eq("where", "BasicExample", batch[0].where);
}
{
  const [batch] = buildBatches([{ key: "My_Component_1a2b3c", text: "hi" }], params());
  eq("where con underscore nel nome componente", "My_Component", batch[0].where);
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
