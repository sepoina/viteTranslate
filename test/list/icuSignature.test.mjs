// La firma di un testo e il confronto compareIcu — piano 4.6.3, § 1.6.
//
//   node test/list/icuSignature.test.mjs
import { compareIcu, requiredPluralCategories, llmSourceText } from "../../lib/dev/compile/icu/icuSignature.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const ok_ = (nome, cond, extra = "") => {
  if (!cond) fail++;
  console.log(cond ? "  ok  " : "  KO  ", nome, extra);
};
const codesOf = (r) => [...r.errors, ...r.warnings].map((x) => x.code);

console.log("\n== compareIcu ==");
eq("stessi argomenti in ordine diverso -> ok", [], codesOf(compareIcu("{0} {1}", "{1} {0}")));
{
  const r = compareIcu("hi {name}", "ciao {nome}");
  eq("nome tradotto -> icu-args", ["icu-args"], codesOf(r));
  ok_("il messaggio elenca sia missing sia unexpected", /missing \{name\}/.test(r.errors[0].message) && /unexpected \{nome\}/.test(r.errors[0].message));
}
{
  const r = compareIcu("hi {0}", "ciao"); // manca l'argomento del tutto
  eq("argomento mancante -> icu-args", ["icu-args"], codesOf(r));
}
eq("plural <-> date sullo stesso argomento -> icu-arg-type", ["icu-arg-type"], codesOf(compareIcu("{0, date}", "{0, plural, one {x} other {y}}")));
eq('"%s %s" contro ICU "{1} {0}" -> ok', [], codesOf(compareIcu("%s %s", "{1} {0}")));
{
  const r = compareIcu("{g, select, m {he} f {she} other {they}}", "{g, select, m {il} other {altro}}", "it-IT");
  eq("select con una chiave del sorgente mancante -> icu-select-keys", ["icu-select-keys"], codesOf(r));
  ok_("il messaggio nomina la chiave mancante", /lacks the source keys: f/.test(r.warnings[0].message));
}
{
  // Nessuno dei due è ICU: nessun parse, risultato vuoto.
  eq("nessuno dei due è ICU -> vuoto", [], codesOf(compareIcu("ciao %s", "hello %s")));
}
{
  // La sorgente rotta la segnala la sua lingua: la traduzione si compila per conto proprio.
  eq("sorgente ICU rotta -> nessun errore qui", [], codesOf(compareIcu("{0, plural, one {x}}", "{0, plural, one {x} other {y}}")));
}

console.log("\n== requiredPluralCategories ==");
{
  const it = requiredPluralCategories("it-IT", false);
  ok_("it cardinale ⊇ one,other", it.includes("one") && it.includes("other"));
  ok_("it cardinale senza many", !it.includes("many"));
}
eq("pl cardinale", ["one", "few", "many", "other"], requiredPluralCategories("pl-PL", false));
eq("ja cardinale", ["other"], requiredPluralCategories("ja-JP", false));
eq("en ordinale", ["one", "two", "few", "other"], requiredPluralCategories("en-US", true));
eq("tag non valido -> other", ["other"], requiredPluralCategories("", false));

console.log("\n== llmSourceText ==");
eq("non ICU: invariato", "ciao %s", llmSourceText("ciao %s"));
eq("misto: %s numerati", "{0} ha {1, plural, one {# file} other {# file}}", llmSourceText("%s ha {1, plural, one {# file} other {# file}}"));
eq("ICU senza %s: invariato", "{name} ciao", llmSourceText("{name} ciao"));
eq("non stringa: invariato", null, llmSourceText(null));

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
