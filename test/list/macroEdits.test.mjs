// flattenEdits: le modifiche macro (che SPOSTANO pezzi di sorgente) annidate le une nelle
// altre, risolte in una lista piatta e disgiunta — vedi lib/dev/babel/macroEdits.js.
//
//   node test/list/macroEdits.test.mjs
import { flattenEdits } from "../../lib/dev/babel/macroEdits.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

/** [start, end) della prima occorrenza di `needle` in `code`: evita di contare gli offset a mano. */
function span(code, needle) {
  const start = code.indexOf(needle);
  if (start === -1) throw new Error(`non trovato: ${JSON.stringify(needle)}`);
  return [start, start + needle.length];
}

console.log("\n== Senza macro: lo stesso array, non una copia ==");
{
  const code = "const a = 1;";
  const edits = [{ start: 6, end: 7, text: "b" }];
  const out = flattenEdits(code, edits);
  eq("stesso riferimento", true, out === edits);
}

console.log("\n== Un buco che contiene una modifica piatta ==");
{
  const code = "0123456789";
  const [hs, he] = span(code, "3456"); // [3, 7)
  const macro = { start: 0, end: 10, pieces: ["X", { hole: [hs, he] }, "Y"] };
  const flat = { start: 4, end: 6, text: "ZZ" }; // dentro il buco, sostituisce "45"
  const [out] = flattenEdits(code, [macro, flat]);
  eq("il testo della modifica piatta compare DENTRO il pezzo spostato", "X3ZZ6Y", out.text);
}

console.log("\n== Una macro dentro il buco di un'altra macro ==");
{
  const code = "0123456789ABCDEF";
  const [ohs, ohe] = span(code, "456789AB"); // buco esterno
  const [ihs, ihe] = span(code, "78"); // buco interno, dentro quello esterno
  const outer = { start: 0, end: 16, pieces: ["O(", { hole: [ohs, ohe] }, ")O"] };
  const inner = { start: code.indexOf("6"), end: code.indexOf("9") + 1, pieces: ["I(", { hole: [ihs, ihe] }, ")I"] };
  const [out] = flattenEdits(code, [outer, inner]);
  eq("l'interna e' annidata dentro il rendering dell'esterna", "O(45I(78)IAB)O", out.text);
}

console.log("\n== Righe: gli a-capo del pezzo sostituito, e un buco che comincia sulla sua riga ==");
{
  const code = "before\nHOLE\nafter";
  const [hs, he] = span(code, "HOLE");
  const macro = { start: 0, end: code.length, pieces: ["X", { hole: [hs, he] }, "Y"] };
  const [out] = flattenEdits(code, [macro]);
  eq("il buco comincia dopo l'a-capo che lo precede nel sorgente", "X\nHOLEY\n", out.text);
  const nlSorgente = (code.match(/\n/g) ?? []).length;
  const nlReso = (out.text.match(/\n/g) ?? []).length;
  eq("lo stesso numero di a-capo del pezzo sostituito", nlSorgente, nlReso);
}

console.log('\n== selfClose: <a href="/x"> diventa <a href="/x" /> ==');
{
  const code = 'const el = <a href="/x">contenuto</a>;';
  const [hs, he] = span(code, '<a href="/x">');
  const macro = { start: hs, end: code.length, pieces: [{ hole: [hs, he], selfClose: true }] };
  const [out] = flattenEdits(code, [macro]);
  eq("il tag di apertura si autochiude", '<a href="/x" />', out.text);
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
