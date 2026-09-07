// Il test più importante del piano 4.2.0 (doc/ImplementationPlans/4_2_0.md). Non prova un
// comportamento: prova che il codice è scritto DOVE deve stare, leggendo vitetranslate.js come
// testo. Il suo compito è fermare la modifica che un domani rimetterebbe la scrittura dentro un
// hook di build (buildStart, configureServer, transform, handleHotUpdate) — la stessa cosa per
// cui il plugin scriveva su disco era stato scartato fino alla 4.2.
//
// Se questo test ti sta fallendo dopo una tua modifica, la modifica è sbagliata, non il test:
// leggi doc/structure.md § "Invariants not to break", punto 4.
//
//   node test/list/autoSyncHookPosition.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(resolve(HERE, "../.."), "lib/dev/vite/vitetranslate.js");
const testo = readFileSync(FILE, "utf8");

const conta = (ago) => testo.split(ago).length - 1;

// L'import lega il nome UNA volta; la chiamata compare UNA volta. Un conteggio letterale di
// "autoSync" varrebbe anche per il percorso del file importato ("./autoSync.js"), che non è
// un secondo uso del genere: per questo si contano le due FORME, non la parola nuda.
eq('import da "./autoSync.js" (una volta)', 1, conta('from "./autoSync.js"'));
eq('chiamata "autoSync(" (una volta)', 1, conta("autoSync("));

const idxConfig = testo.indexOf("async config(");
const idxChiamata = testo.indexOf("autoSync(");
const idxConfigResolved = testo.indexOf("configResolved(");
eq("l'hook config esiste ed è async", true, idxConfig !== -1);
eq("configResolved esiste dopo config", true, idxConfigResolved > idxConfig);
eq("la chiamata ad autoSync sta DENTRO l'hook config", true, idxChiamata > idxConfig && idxChiamata < idxConfigResolved);
eq('preceduta da "await" (guardia G2)', true, testo.includes("await autoSync("));

// Nessuna logica di sincronizzazione qui: vive in syncCore.js/autoSync.js, non in vitetranslate.js.
for (const vietato of ["runSync", "syncCore", "updateLanguage", "updateAllSubLanguages", "guardMassErase", "writeLanguageFile", "scanSource"]) {
  eq(`"${vietato}" non compare nel file`, false, testo.includes(vietato));
}

// configureServer non cambia: continua a fare il proprio controllo e a registrare il watcher.
eq("configureServer contiene ancora checkSetup(", true, /configureServer\([\s\S]*?checkSetup\(/.test(testo));
eq("configureServer contiene ancora server.watcher.add(", true, testo.includes("server.watcher.add("));

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
