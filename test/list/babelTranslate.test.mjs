// Estrazione dei marcatori: cosa riconosce il plugin Babel, cosa scrive nella tabella e
// quale codice restituisce. Il codice generato deve restare JSX/TypeScript valido — è il
// plugin React del progetto, non questo, a compilarlo.
//
//   node test/list/babelTranslate.test.mjs
import { transformSync } from "@babel/core";
import babelTranslate from "./babelTranslateReference.mjs";
import parserOptionsFor from "../../lib/dev/babel/parserOptionsFor.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(46), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

/** Trasforma `code` come fa il plugin Vite, e restituisce { code, table }. */
function run(code, filename = "/p/src/App.jsx", options = {}) {
  const table = {};
  const out = transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    parserOpts: parserOptionsFor(filename),
    plugins: [[babelTranslate, { table, ...options }]],
  });
  return { code: out.code, table };
}

const keysOf = (table) => Object.keys(table).sort().join(",");
const valuesOf = (table) => Object.keys(table).sort().map((k) => table[k]).join("|");

// ------------------------------------------------------------------ forme riconosciute
console.log("\n== forme di stringa riconosciute ==");

{
  const { code, table } = run(`const a = "_%_stringa_%_";`);
  eq("StringLiteral estratta", "stringa", valuesOf(table));
  eq("StringLiteral riscritta", true, /^const a = "_<_App_[0-9a-z]+_\/_stringa_>_";$/.test(code.trim()));
}
{
  // Regressione: TemplateElement.value è { raw, cooked }, non una stringa. Leggerlo come
  // stringa rendeva il visitor inerte e i template literal restavano non tradotti.
  const { code, table } = run("const a = `_%_template_%_`;");
  eq("TemplateElement estratta", "template", valuesOf(table));
  eq("TemplateElement riscritta", true, code.includes("_<_") && code.includes("`"));
}
{
  // Regressione: JSXText.value è il testo grezzo, indentazione e newline compresi.
  const { code, table } = run(`const a = <Translate>\n  _%_multilinea_%_\n</Translate>;`);
  eq("JSXText multilinea estratta", "multilinea", valuesOf(table));
  eq("JSXText -> espressione, non testo", true, /<Translate>\{"_<_/.test(code));
}
{
  const { code, table } = run(`const a = <Translate>_%_inline_%_</Translate>;`);
  eq("JSXText inline estratta", "inline", valuesOf(table));
  eq("nessun '<' nudo nel testo JSX", false, /<Translate>_<_/.test(code));
}
{
  const { code } = run(`const a = <Translate t="_%_accento è_%_" />;`);
  eq("attributo JSX -> espressione", true, /t=\{"/.test(code));
}

// ------------------------------------------------------------------ forme NON riconosciute
console.log("\n== cosa resta giustamente fuori ==");
{
  const { table } = run("const a = `_%_pre_%_${x}_%_post_%_`;");
  eq("template con interpolazione: 2 quasi distinti", "post|pre", valuesOf(table));
}
{
  const { table } = run(`const a = "non marcata";`);
  eq("stringa non marcata ignorata", "", keysOf(table));
}
{
  const { table } = run(`const a = <div>testo _%_in mezzo_%_ ad altro</div>;`);
  eq("marcatore in mezzo ad altro testo ignorato", "", keysOf(table));
}

// ------------------------------------------------------------------------ TypeScript
console.log("\n== TypeScript (prima faceva esplodere il transform) ==");
{
  const { code, table } = run(`const a: string = "_%_ts_%_";\ntype T = Array<number>;`, "/p/src/App.ts");
  eq(".ts estratta", "ts", valuesOf(table));
  eq(".ts: annotazioni preservate", true, code.includes("const a: string ="));
}
{
  const { code, table } = run(`const f = (n: number) => <b>_%_tsx_%_</b>;`, "/p/src/App.tsx");
  eq(".tsx estratta", "tsx", valuesOf(table));
  eq(".tsx: JSX e tipi preservati", true, code.includes("(n: number)") && code.includes("<b>"));
}

// ---------------------------------------------------------------------- casi corrosivi
console.log("\n== testi che rompevano la riscrittura ==");
{
  // `$&` e `$1` sono pattern di String.replace: la vecchia implementazione li interpretava.
  const { code, table } = run(`const a = "_%_costa $& e $1_%_";`);
  eq("i pattern $ restano letterali (tabella)", "costa $& e $1", valuesOf(table));
  eq("i pattern $ restano letterali (codice)", true, code.includes("costa $& e $1"));
}
{
  const { code } = run("const a = `_%_backslash \\\\ e dollaro $ qui_%_`;");
  eq("backslash ri-escapato nel raw", true, code.includes("\\\\"));
}

// -------------------------------------------------------------------------- opzioni
console.log("\n== includeFallback ==");
{
  const { code } = run(`const a = "_%_prod_%_";`, "/p/src/App.jsx", { includeFallback: false });
  eq("build: solo id, niente fallback", true, /^const a = "_<_App_[0-9a-z]+_>_";$/.test(code.trim()));
}

// -------------------------------------------------------------------- id e collisioni
console.log("\n== id ==");
{
  const { table } = run(`const a = "_%_x_%_"; const b = "_%_y_%_";`, "/p/src/Componente.jsx");
  eq("id prefissato col basename", true, Object.keys(table).every((k) => k.startsWith("Componente_")));
  eq("due testi diversi, due id", 2, Object.keys(table).length);
}
{
  const { table } = run(`const a = "_%_uguale_%_"; const b = "_%_uguale_%_";`);
  eq("stesso testo -> stesso id, nessun duplicato", 1, Object.keys(table).length);
}
{
  // La collisione vera è irriproducibile a comando: si simula pre-caricando la tabella con
  // un valore diverso sullo stesso id, che è esattamente la condizione che il warn cerca.
  const warnings = [];
  const original = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    const { table } = run(`const a = "_%_uno_%_";`);
    const [id] = Object.keys(table);
    table[id] = "un altro testo";
    transformSync(`const a = "_%_uno_%_";`, {
      filename: "/p/src/App.jsx", babelrc: false, configFile: false,
      parserOpts: parserOptionsFor("/p/src/App.jsx"),
      plugins: [[babelTranslate, { table }]],
    });
  } finally {
    console.warn = original;
  }
  eq("collisione segnalata", true, warnings.length === 1 && warnings[0].includes("id collision"));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
