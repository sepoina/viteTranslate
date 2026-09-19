// Le demo che sono workspace (demo/Vite_8/*) dipendono da @sepoina/vitetranslate con un range che
// la versione della radice deve soddisfare: è la condizione perché npm, nel repo, le colleghi alla
// libreria in sviluppo invece di scaricarne una copia dal registro (il perché per esteso è in
// test/syncDemoDeps.mjs). Non serve l'uguaglianza esatta: "^4.6.2-rc.1" va bene per 4.6.2-rc.2 e 4.6.2.
//
// Fallisce quando la radice esce dal range, per esempio passando a un altro X.Y.Z con un
// package.json ritoccato a mano invece che con npm version. Rimedio: npm run sync:demos.
//
//   node test/list/demoDeps.test.mjs
import { demoDirs, nonSoddisfatte, soddisfa } from "../syncDemoDeps.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

eq("almeno una demo trovata", true, demoDirs().length > 0);

const indietro = new Map(nonSoddisfatte().map((d) => [d.demo, d]));
for (const demo of demoDirs()) {
  const d = indietro.get(demo);
  eq(`${demo} accetta la versione della radice`, d?.atteso ?? "allineata", d?.attuale ?? "allineata");
}

// Il controllo di range, senza toccare il disco.
eq("rc successiva dello stesso X.Y.Z", true, soddisfa("4.6.2-rc.2", "^4.6.2-rc.1"));
eq("rc.10 dopo rc.9 (numerico, non lessicografico)", true, soddisfa("4.6.2-rc.10", "^4.6.2-rc.9"));
eq("la stabile dopo la sua rc", true, soddisfa("4.6.2", "^4.6.2-rc.1"));
eq("una stabile più alta, stesso major", true, soddisfa("4.7.0", "^4.6.2-rc.1"));
eq("la rc precedente non basta", false, soddisfa("4.6.2-rc.1", "^4.6.2-rc.2"));
eq("un altro X.Y.Z in pre-release non basta", false, soddisfa("4.6.3-rc.1", "^4.6.2-rc.1"));
eq("una pre-release non entra in un caret stabile", false, soddisfa("4.6.2-rc.1", "^4.6.1"));
eq("un altro major no", false, soddisfa("5.0.0", "^4.6.2"));
eq("una pre-release del major dopo no", false, soddisfa("5.0.0-rc.1", "^4.6.2"));
eq("una forma di range non prevista non passa", false, soddisfa("4.6.2", "next"));
eq("nemmeno l'assenza di dipendenza", false, soddisfa("4.6.2", undefined));

if (fail > 0) console.log("\nnpm run sync:demos per allinearle");
process.exit(fail > 0 ? 1 : 0);
