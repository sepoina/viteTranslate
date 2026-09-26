// L'innesco, la normalizzazione di "%s" e il parse/i controlli di lib/icu/parse.js — piano
// 4.6.3, § 1.3.
//
//   node test/list/icuParse.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { isIcuCandidate, normalizePlaceholders, parseIcu, TYPE } from "../../lib/icu/parse.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(48), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const ok_ = (nome, cond) => {
  if (!cond) fail++;
  console.log(cond ? "  ok  " : "  KO  ", nome);
};

console.log("\n== il parser vendorizzato ==");
try {
  readFileSync(join(ROOT, "lib/dist/icuParser.js"));
  ok_("lib/dist/icuParser.js esiste", true);
} catch {
  ok_("lib/dist/icuParser.js esiste (run npm run build)", false);
}
{
  const pkgVersion = JSON.parse(readFileSync(join(ROOT, "node_modules/@formatjs/icu-messageformat-parser/package.json"), "utf8")).version;
  const { FORMATJS_PARSER_VERSION } = await import(pathToFileURL(join(ROOT, "lib/dist/icuParser.js")).href);
  eq("FORMATJS_PARSER_VERSION combacia con node_modules", pkgVersion, FORMATJS_PARSER_VERSION);
}

console.log("\n== isIcuCandidate: l'innesco ==");
for (const s of ['{ t: null }', '{ t, a }', '${}']) ok_(`non ICU: ${s}`, isIcuCandidate(s) === false);
for (const s of ['{0}', '{ 0 , plural, one {x} other {y}}', '{name}', '{ name }', '{città}', '{count, number}', '{n, plural, one {x} other {y}}']) {
  ok_(`ICU: ${s}`, isIcuCandidate(s) === true);
}

console.log("\n== normalizePlaceholders ==");
{
  const r = normalizePlaceholders("%s ha {1, plural, one {# file} other {# file}}");
  eq("il primo %s diventa {0}", "{0} ha {1, plural, one {# file} other {# file}}", r.text);
  eq("count", 1, r.count);
}
{
  // Gli apostrofi sono testo (4.6.3, toParserText in lib/icu/parse.js): il "%s" fra apostrofi
  // si normalizza come ogni altro.
  const r = normalizePlaceholders("'%s' {0}");
  eq("l'apostrofo isolato non apre una citazione", "'{0}' {0}", r.text);
  eq("il primo %s È stato numerato ({0})", 1, r.count);
}
{
  // Nessuna citazione MF1: "'{%s}'" è un "%s" dentro graffe, come senza apostrofi.
  const r = normalizePlaceholders("'{%s}'");
  eq("'{%s}': gli apostrofi non proteggono", true, r.inBranch);
}
{
  const r = normalizePlaceholders("{0, select, a {%s} other {x}}");
  ok_("inBranch è true", r.inBranch === true);
}

console.log("\n== l'apostrofo è testo, mai sintassi (4.6.3) ==");
{
  // Un riassunto dell'AST: il testo letterale così com'è, gli argomenti come <nome>.
  const flat = (text) => {
    const r = parseIcu(text, "it-IT");
    if (!r.ok) return r.code;
    const walk = (ast) => ast.map((n) => n.type === TYPE.literal ? n.value : n.type === TYPE.pound ? "#"
      : n.type === TYPE.plural ? Object.values(n.options).map((o) => walk(o.value)).join("|") : `<${n.value}>`).join("");
    return walk(r.ast);
  };
  eq("dell'{0}: l'elisione funziona", "dell'<0>", flat("dell'{0}"));
  eq("'{nome}': virgolette intorno al valore", "'<nome>'", flat("'{nome}'"));
  eq("’{0}’ e '{0}' hanno gli stessi argomenti", flat("'{0}'").replaceAll("'", "’"), flat("’{0}’"));
  eq("'' sono due apostrofi", "dell''<0>", flat("dell''{0}"));
  eq("l'# in un plurale", "l'#|gli #", flat("{0, plural, one {l'#} other {gli #}}"));
  eq("dopo un carattere cinese", "按'<0>'", flat("按'{0}'"));
}

console.log("\n== errori bloccanti ==");

{
  const r = parseIcu("{0} {1a}", "it-IT");
  ok_('{0} {1a} -> icu-argument-name o icu-syntax', r.code === "icu-argument-name" || r.code === "icu-syntax");
}
eq("plurale senza other", "icu-syntax", parseIcu("{0, plural, one {x}}", "it-IT").code);
eq("currency senza codice", "icu-style", parseIcu("{0, number, currency}", "it-IT").code);
eq("tipo ICU sconosciuto", "icu-syntax", parseIcu("{0, foo}", "it-IT").code);
eq("%s dentro un ramo", "icu-placeholder-in-branch", parseIcu("{0, select, a {%s} other {x}}", "it-IT").code);

console.log("\n== avvisi ==");
{
  const r = parseIcu("%s {0, number}", "it-IT");
  ok_("ok:true", r.ok === true);
  ok_("icu-mixed-index", r.warnings.some((w) => w.code === "icu-mixed-index"));
}
{
  const r = parseIcu("%s e {name}", "it-IT");
  ok_("ok:true", r.ok === true);
  ok_("icu-mixed-named", r.warnings.some((w) => w.code === "icu-mixed-named"));
}
{
  const r = parseIcu("{nome} {0}", "it-IT");
  ok_("valido", r.ok === true);
  eq("nessun avviso", [], r.warnings);
}

console.log("\n== opzioni skeleton ==");
{
  const r = parseIcu("{0, number, ::currency/EUR precision-integer}", "it-IT");
  ok_("ok:true", r.ok === true);
  eq("vtOptions", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }, r.ast[0].vtOptions);
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
