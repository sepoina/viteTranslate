// L'interprete di sviluppo per le chiavi non ancora sincronizzate — piano 4.6.3, § 1.9.
//
//   node test/list/icuDev.test.mjs
import { interpretIcu } from "../../lib/icu/devInterpret.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const ok_ = (nome, cond) => {
  if (!cond) fail++;
  console.log(cond ? "  ok  " : "  KO  ", nome);
};

console.log("\n== interpretIcu ==");
{
  const r = interpretIcu("{0, plural, one {# file} other {# file}}", [3], "en-US");
  eq("plurale -> testo con %s", "%s file", r.text);
  eq("valori formattati", ["3"], r.values);
}
{
  const el = { $$typeof: Symbol.for("react.transitional.element"), type: "b", props: {} };
  const r = interpretIcu("{0}", [el], "en-US");
  ok_("elemento React resta nei values", r.values[0] === el);
  eq("text ha un solo %s", "%s", r.text);
}
eq("testo non ICU -> null", null, interpretIcu("plain text", [], "en-US"));
eq("ICU non valido -> null", null, interpretIcu("{0, plural, one {x}}", [1], "en-US")); // manca "other"

console.log("\n== 4.7.1: invalid dates in dev interpretation ==");
{
  // The dev interpreter shares lib/icu/runtime.js: same fallback, no exception.
  const show = (value, pattern = "{0, date, short}") => {
    try { return interpretIcu(pattern, [value], "en-US").values[0]; } catch (e) { return `THREW ${e.message}`; }
  };
  eq("2024-02-31 stays as written", "2024-02-31", show("2024-02-31"));
  eq("2024-13-01 stays as written", "2024-13-01", show("2024-13-01"));
  eq("2024-02-31T10:00Z stays as written", "2024-02-31T10:00Z", show("2024-02-31T10:00Z"));
  eq("1e20 stays as it is", 1e20, show(1e20));
  eq("a real date is formatted", new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 1, 29))), show("2024-02-29"));
  ok_("0099-01-01 is not 1999", !String(show("0099-01-01", "{0, date, ::yyyy}")).includes("1999"));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
