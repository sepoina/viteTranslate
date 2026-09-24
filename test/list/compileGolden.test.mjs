// Il test che usa lo strumento test/compileGolden.mjs: dimostra che un testo senza innesco ICU
// compila esattamente come prima della 4.6.3, chiave per chiave — piano 4.6.3, Fase 2.
//
//   node test/list/compileGolden.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeGolden, stripArgHelper } from "../compileGolden.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

console.log("\n== hash di riferimento, chiave per chiave ==");
{
  const saved = JSON.parse(readFileSync(join(ROOT, "test/list/compileGolden.json"), "utf8"));
  const computed = await computeGolden();
  const keys = new Set([...Object.keys(saved), ...Object.keys(computed)]);
  for (const key of [...keys].sort((a, b) => a.localeCompare(b, "en"))) {
    eq(key, saved[key], computed[key]);
  }
}

console.log("\n== stripArgHelper ==");
{
  const conArg = [
    'const _m = "⁇";',
    "function _named(v) {",
    "  return true;",
    "}",
    "function _arg(list, i) {",
    "  return list[i];",
    "}",
    "resto invariato",
  ].join("\n");
  const spogliato = stripArgHelper(conArg);
  eq("il blocco _arg sparisce", true, spogliato.includes("/* _arg helper */"));
  eq("il resto resta", true, spogliato.includes("resto invariato"));
  eq("nessuna traccia di _named o _arg", false, spogliato.includes("_named") || spogliato.includes("function _arg("));
}
{
  const senzaArg = "// generato da vitetranslate\n\nexport default {\n  a: \"ciao\"\n};\n";
  eq("senza _arg il codice resta invariato", senzaArg, stripArgHelper(senzaArg));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
