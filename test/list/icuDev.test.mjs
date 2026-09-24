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

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
