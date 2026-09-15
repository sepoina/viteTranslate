// T10 del piano 4.4.0: `cleanJsxText` deve produrre ESATTAMENTE ciò che `preset-react` mette
// in `children` per lo stesso sorgente — non "più o meno JSX", alla lettera. Il confronto è
// fatto girando `preset-react` per davvero, non contro valori copiati a mano: se un giorno
// Babel cambiasse la propria regola di whitespace, questo test lo scoprirebbe da solo.
//
//   node test/list/cleanJsxText.test.mjs
import { transformSync } from "@babel/core";
import { cleanJsxText } from "../../lib/dev/babel/markerCore.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(40), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Ciò che `preset-react` mette DAVVERO in `children` per <p>{raw}</p>. Una stringa vuota se
// preset-react non emette affatto un children stringa (testo che collassa del tutto).
function children(raw) {
  const out = transformSync(`const a = <p>${raw}</p>;`, {
    babelrc: false, configFile: false,
    presets: [["@babel/preset-react", { runtime: "automatic" }]],
  }).code;
  const m = out.match(/children:\s*("(?:[^"\\]|\\.)*")/);
  return m ? JSON.parse(m[1]) : "";
}

console.log("\n== T10: cleanJsxText contro preset-react, forma per forma ==");
const CASI = [
  "ciao",
  " ciao ",
  "\n  ciao\n",
  "\n  hello\n   world\n",
  "\n  a\n\n  b\n",
  "a\t\n\tb",
  "\r\n  x\r\n",
  "  solo   spazi   interni  ",
  "\n\n\n",
  "fine senza acapo ",
  // Le quattro forme che una versione scritta a intuito sbaglia (§ 2.1 del piano): il tab
  // interno (non solo quello a cavallo di riga) e l'inizializzazione di `last`.
  "a\tb",
  "x\t\ty",
  "a\tb\n c\td",
  "  ",
];
for (const raw of CASI) {
  eq(JSON.stringify(raw), children(raw), cleanJsxText(raw));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
