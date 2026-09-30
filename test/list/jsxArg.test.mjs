// jsxArg: un valore JSX reso come lo renderebbe React (piano 4.6.4). La macro lo inietta
// attorno a ogni valore che sposta negli argomenti — senza, {vip && <b>VIP</b>} con `false`
// diventerebbe "false" (la ricomposizione _cat concatena) e {nick} a `null` diventerebbe `⁇`.
//
//   node test/list/jsxArg.test.mjs
import { jsxArg } from "../../lib/react/jsxArg.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(40), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

console.log("\n== ciò che React non renderebbe diventa \"\" ==");
eq("null", "", jsxArg(null));
eq("undefined", "", jsxArg(undefined));
eq("true", "", jsxArg(true));
eq("false", "", jsxArg(false));

console.log("\n== ogni altro valore passa così com'è ==");
eq("stringa", "ciao", jsxArg("ciao"));
eq("stringa vuota (valore legittimo)", "", jsxArg(""));
eq("zero (valore legittimo)", 0, jsxArg(0));
eq("numero", 42, jsxArg(42));
eq("NaN (valore legittimo per React)", true, Number.isNaN(jsxArg(NaN)));
{
  const elemento = { $$typeof: Symbol.for("react.transitional.element"), type: "b", props: {} };
  eq("elemento React", elemento, jsxArg(elemento));
}
{
  const lista = [1, 2];
  eq("array", lista, jsxArg(lista));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
