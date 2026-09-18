// Le demo che sono workspace (demo/Vite_8/*) dipendono da @sepoina/vitetranslate con "^<versione della radice>":
// è la condizione perché npm, nel repo, le colleghi alla libreria in sviluppo invece di
// scaricarne una copia dal registro (il perché per esteso è in test/syncDemoDeps.mjs).
//
// Fallisce quando la versione della radice cambia e le demo restano indietro, per esempio con
// un package.json ritoccato a mano invece che con npm version. Rimedio: npm run sync:demos.
//
//   node test/list/demoDeps.test.mjs
import { demoDirs, differenze } from "../syncDemoDeps.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

eq("almeno una demo trovata", true, demoDirs().length > 0);

const indietro = new Map(differenze().map((d) => [d.demo, d]));
for (const demo of demoDirs()) {
  const d = indietro.get(demo);
  eq(`${demo} segue la radice`, d?.atteso ?? "allineata", d?.attuale ?? "allineata");
}

if (fail > 0) console.log("\nnpm run sync:demos per allinearle");
process.exit(fail > 0 ? 1 : 0);
