// interpolate() dopo il passaggio ad argAt (piano 4.6.3, 1.11): stesso comportamento di sempre
// per array, scalari, `false`, `null`, `0` e `""` — non li tocca questo piano, li ha già
// interpolate.js da prima — più il nuovo caso, un oggetto semplice come VALORE non si rende
// più "[object Object]": diventa il segnaposto di argomento mancante, come un valore assente.
//
//   node test/list/interpolate.test.mjs
import { interpolate } from "../../lib/react/interpolate.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(48), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

console.log("\n== casi di sempre, invariati ==");
eq("array", "ciao aldo", interpolate("ciao %s", ["aldo"]));
eq("scalare", "ciao aldo", interpolate("ciao %s", "aldo"));
eq("false (sentinella)", "ciao ⁇", interpolate("ciao %s", false));
eq("null", "ciao ⁇", interpolate("ciao %s", null));
eq("nessun argomento", "ciao ⁇", interpolate("ciao %s", undefined));
eq("zero e' un valore", "ciao 0", interpolate("ciao %s", 0));
eq("stringa vuota e' un valore", "ciao ", interpolate("ciao %s", ""));
eq("due segnaposto", "da roma a milano", interpolate("da %s a %s", ["roma", "milano"]));
eq("nessun segnaposto: testo invariato", "ciao", interpolate("ciao", ["aldo"]));

console.log("\n== nuovo: un oggetto semplice come valore diventa assente ==");
eq('interpolate("ciao %s", { name: "x" })', "ciao ⁇", interpolate("ciao %s", { name: "x" }));
eq('interpolate("%s", [{}])', "⁇", interpolate("%s", [{}]));
eq("prototipo nullo come valore", "ciao ⁇", interpolate("ciao %s", [Object.create(null)]));

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exitCode = fail === 0 ? 0 : 1;
