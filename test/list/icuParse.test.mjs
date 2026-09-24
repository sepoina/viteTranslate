// L'innesco, la normalizzazione di "%s" e il parse/i controlli di lib/icu/parse.js — piano
// 4.6.3, § 1.3.
//
//   node test/list/icuParse.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { isIcuCandidate, normalizePlaceholders, parseIcu } from "../../lib/icu/parse.js";

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
  // La citazione MF1 si apre solo prima di "{ } # |" (vedi il commento di normalizePlaceholders
  // in lib/icu/parse.js): un apostrofo seguito da "%" resta un apostrofo qualunque, quindi il
  // suo "%s" SI normalizza — a differenza di un "%s" dentro un argomento o un ramo, che è
  // l'errore icu-placeholder-in-branch (vedi sotto), qui il "%s" è fuori da ogni graffa.
  const r = normalizePlaceholders("'%s' {0}");
  eq("l'apostrofo isolato non apre una citazione", "'{0}' {0}", r.text);
  eq("il primo %s È stato numerato ({0})", 1, r.count);
}
{
  // Qui invece l'apostrofo precede "{": apre una citazione MF1, e il "%s" al suo interno resta
  // testo letterale.
  const r = normalizePlaceholders("'{%s}'");
  eq("%s dentro una citazione MF1 resta invariato", "'{%s}'", r.text);
  eq("nessun %s normalizzato dentro la citazione", 0, r.count);
}
{
  const r = normalizePlaceholders("{0, select, a {%s} other {x}}");
  ok_("inBranch è true", r.inBranch === true);
}

console.log("\n== errori bloccanti ==");
eq("apostrofo prima di {0}", "icu-apostrophe", parseIcu("dell'{0}", "it-IT").code);
eq("apostrofo prima di {nome}", "icu-apostrophe", parseIcu("dell'{nome}", "it-IT").code);
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
