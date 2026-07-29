// Come un file di lingua viene letto dal disco e riscritto: readLanguageTable,
// importLanguageModule, splitAndSortEntries, serializeLanguageModule, stableStringify,
// updateKeys.
//
// Sono i pezzi che il comando di sincronizzazione mette in fila (vedi syncPipeline.test.mjs
// per il loro effetto d'insieme). Qui si guarda ciascuno da vicino, perché è il punto in cui
// una lettura sbagliata non produce un errore ma un contenuto plausibile e diverso: e a quel
// punto la riscrittura del file lo rende definitivo.
//
//   node test/list/languageFileIO.test.mjs
import { mkdtempSync, rmSync, writeFileSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readLanguageTable, { normalizeBuilder } from "../../lib/dev/vite/uty/readLanguageTable.js";
import importLanguageModule from "../../lib/dev/vite/uty/importLanguageModule.js";
import splitAndSortEntries from "../../lib/dev/vite/uty/splitAndSortEntries.js";
import serializeLanguageModule from "../../lib/dev/vite/uty/serializeLanguageModule.js";
import stableStringify from "../../lib/dev/vite/uty/stableStringify.js";
import updateKeys from "../../lib/dev/vite/uty/updateKeys.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
/** Una cartella usa e getta. Con `esm` ci mette dentro un package.json "type": "module". */
function cartella(esm = true) {
  const dir = mkdtempSync(join(tmpdir(), "vt-io-"));
  temporanee.push(dir);
  if (esm) writeFileSync(join(dir, "package.json"), '{ "type": "module" }');
  return dir;
}
const scrivi = (dir, nome, testo) => {
  const p = join(dir, nome);
  writeFileSync(p, testo, "utf8");
  return p;
};

// ------------------------------------------------------------- lettura senza module loader
console.log("\n== readLanguageTable: la forma piatta si legge dal sorgente ==");
{
  // Esattamente ciò che serializeLanguageModule produce: commenti di intestazione, un commento
  // separatore DENTRO l'oggetto e una virgola finale. Nessuna delle tre è JSON valido.
  const generato = serializeLanguageModule({
    tag: "en-US",
    isSource: false,
    translated: [["__builder__", { v: 1, languageName: "American English", incomplete: false }], ["App_a", "Hello"]],
    untranslated: [["App_b", null]],
    now: new Date(2026, 0, 2, 3, 4),
  });
  const t = readLanguageTable(generato, "en-US.js");
  eq("tabella letta", "App_a,App_b,__builder__", t === undefined ? "(undefined)" : Object.keys(t).sort().join(","));
  eq("valore tradotto", "Hello", t?.App_a);
  eq("valore non tradotto", "null", JSON.stringify(t?.App_b));
  eq("incomplete: false omesso su disco", false, generato.includes("incomplete"));
  eq("e ripristinato in lettura", false, normalizeBuilder(t).__builder__.incomplete);
  eq("virgola finale tollerata", true, /,\n};/.test(generato));
}
{
  // Un valore che contiene le parole chiave del formato non deve spostare il punto in cui la
  // tabella comincia: `search` trova il primo `export default` in posizione di istruzione.
  const t = readLanguageTable('export default { "App_a": "scrivi export default {} nel file" };', "x.js");
  eq("un valore che cita 'export default'", "scrivi export default {} nel file", t?.App_a);
}
{
  const casi = [
    ["modulo con import in testa", 'import base from "./base.js";\nexport default { ...base };'],
    ["modulo con require", 'const base = require("./base.js");\nexport default { ...base };'],
    ["export nominale prima", 'export const x = 1;\nexport default { "App_a": "x" };'],
    ["sintassi rotta", 'export default { "App_a": '],
    ["nessun export default", 'const a = 1;'],
    ["default non oggetto", 'export default "una stringa";'],
    ["default array", 'export default ["a", "b"];'],
  ];
  for (const [nome, codice] of casi) {
    eq(nome + " -> lasciato a chi sa caricarlo", undefined, readLanguageTable(codice, "x.js"));
  }
}
{
  // Il contesto di valutazione non ha globali: un file che ne usa non viene letto qui, e la
  // decisione passa a importLanguageModule, che lo carica per davvero. È il confine fra le due
  // strade, e vale la pena che sia visibile.
  const conGlobale = 'export default { "App_a": process.platform ? "vero" : "falso" };';
  eq("file che usa un globale -> non letto qui", undefined, readLanguageTable(conGlobale, "x.js"));
  const dir = cartella();
  eq("...ma caricato dal ripiego", "vero", (await importLanguageModule(scrivi(dir, "en-US.js", conGlobale)))?.App_a);
}

// ------------------------------------------------------------------------ file vuoto
console.log("\n== un file vuoto è una lingua nuova, non una lingua vuota ==");
{
  // Il modo documentato per aggiungere una lingua è creare il file vuoto e lanciare la sync.
  // La risposta non deve dipendere dal fatto che il progetto ospite sia ESM o CommonJS: in
  // CommonJS `import()` di un file vuoto restituisce `{}` — un oggetto vero, che passava per
  // una tabella valida e vuota, e il file restava vuoto senza che nessuno lo segnalasse.
  for (const [nome, esm] of [["progetto ESM", true], ["progetto CommonJS", false]]) {
    const dir = cartella(esm);
    eq(`${nome}: file vuoto`, undefined, await importLanguageModule(scrivi(dir, "en-US.js", "")));
    eq(`${nome}: file di soli spazi`, undefined, await importLanguageModule(scrivi(dir, "fr-FR.js", "\n  \n\t")));
  }
}

// --------------------------------------------------- cache dei moduli e contenuto stantio
console.log("\n== due versioni dello stesso file non si confondono ==");
{
  // Regressione. La cache dei moduli ESM di Node non si svuota mai, quindi il ripiego
  // `import()` porta con sé una query che deve cambiare quando cambia il contenuto. Con
  // l'mtime non cambiava sempre: la granularità del timestamp del filesystem è grossolana
  // (3 ms su ext4 con HZ=300, 1-2 s su exFAT/FAT) e due scritture dentro lo stesso tick
  // condividevano la chiave. Node restituiva allora la versione PRECEDENTE, in silenzio.
  //
  // Qui il tick grossolano è simulato rimettendo a mano l'mtime di prima: deterministico,
  // mentre aspettarsi la collisione dall'orologio la renderebbe una prova a metà.
  const dir = cartella();
  const p = scrivi(dir, "en-US.js", 'import "node:path";\nexport default { "App_a": "prima" };');
  const { atime, mtime } = statSync(p);
  eq("prima lettura", "prima", (await importLanguageModule(p))?.App_a);

  scrivi(dir, "en-US.js", 'import "node:path";\nexport default { "App_a": "dopo" };');
  utimesSync(p, atime, mtime); // stesso identico mtime: come due scritture nello stesso tick
  eq("contenuto nuovo, stesso mtime", "dopo", (await importLanguageModule(p))?.App_a);

  // L'altra metà del patto: a contenuto immutato non si deve creare una entry di cache nuova
  // a ogni lettura (era la ragione per cui si era scelto l'mtime invece di Date.now()).
  utimesSync(p, atime, new Date(mtime.getTime() + 60000));
  eq("stesso contenuto, mtime diverso", "dopo", (await importLanguageModule(p))?.App_a);
}

// ------------------------------------------------------------------- ordinamento e scrittura
console.log("\n== splitAndSortEntries: chi va sopra e chi va sotto ==");
{
  const tabella = { App_z: "z", App_a: "a", __builder__: { v: 1 }, App_m: null, App_b: null };
  const { translated, untranslated } = splitAndSortEntries(tabella);
  eq("tradotte: builder in testa, poi alfabetico", "__builder__,App_a,App_z", translated.map(([k]) => k).join(","));
  eq("non tradotte: i null, alfabetico", "App_b,App_m", untranslated.map(([k]) => k).join(","));

  // Il criterio è parametrico: per la lingua sorgente "non tradotta" vuol dire "manca altrove".
  const altrove = { App_z: true };
  const { untranslated: perLaSorgente } = splitAndSortEntries(tabella, (k) => k in altrove);
  eq("criterio esterno rispettato", "App_z", perLaSorgente.map(([k]) => k).join(","));

  // Ordinamento con locale esplicito ("en"): senza, l'ordine dipenderebbe dal locale del
  // processo, e siccome il file si riscrive solo quando queste liste cambiano, la stessa
  // tabella risulterebbe "cambiata" passando da una macchina all'altra. L'ordine atteso è
  // quello di una persona che legge (le maiuscole non vengono prima di tutto il resto, come
  // farebbe invece un confronto sui code point), e la minuscola precede la maiuscola a parità
  // di lettera.
  const misto = splitAndSortEntries({ b_1: "x", A_1: "x", a_2: "x", B_2: "x", a_1: "x" });
  eq("maiuscole e minuscole in ordine stabile", "a_1,A_1,a_2,b_1,B_2", misto.translated.map(([k]) => k).join(","));
}

console.log("\n== serializeLanguageModule: quello che finisce sul disco ==");
{
  const testo = serializeLanguageModule({
    tag: "it-IT",
    isSource: true,
    translated: [["__builder__", { v: 1, languageName: "italiano", incomplete: true }], ["App_a", 'con "virgolette" e \\ backslash']],
    untranslated: [["App_b", null]],
    now: new Date(2026, 0, 2, 3, 4),
  });
  eq("intestazione con il conteggio", true, /missing key: 1/.test(testo));
  eq("intestazione con la data al minuto", true, /processed: 2026-01-02 03:04/.test(testo));
  eq("marcata come lingua sorgente", true, testo.includes("(sourceLanguage)"));
  eq("incomplete: true resta scritto", true, testo.includes('"incomplete":true'));
  eq("separatore prima delle non tradotte", true, testo.indexOf("to be translated") < testo.indexOf('"App_b"'));
  const riletto = readLanguageTable(testo, "it-IT.js");
  eq("rilettura fedele del valore ostile", 'con "virgolette" e \\ backslash', riletto?.App_a);
  eq("rilettura fedele del null", "null", JSON.stringify(riletto?.App_b));
}

// ----------------------------------------------------------------------- confronti
console.log("\n== stableStringify: due tabelle uguali devono risultare uguali ==");
{
  eq("ordine delle chiavi ininfluente", stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  eq("anche annidato", stableStringify({ x: { a: 1, b: 2 } }), stableStringify({ x: { b: 2, a: 1 } }));
  // È il caso vero: `incomplete` viene omesso in scrittura e riappeso in coda in lettura,
  // quindi lo stesso __builder__ torna con le chiavi in un altro ordine.
  const scritto = { v: 1, languageName: "italiano", incomplete: false };
  const riletto = normalizeBuilder({ __builder__: { v: 1, languageName: "italiano" } }).__builder__;
  eq("round-trip di __builder__ non conta come modifica", stableStringify(scritto), stableStringify(riletto));
  eq("l'ordine negli array conta ancora", false, stableStringify([1, 2]) === stableStringify([2, 1]));
  eq("undefined non fa esplodere il confronto", "null", stableStringify(undefined));
  eq("valori diversi restano diversi", false, stableStringify({ a: 1 }) === stableStringify({ a: "1" }));
}

console.log("\n== updateKeys: cosa è entrato e cosa è uscito ==");
{
  const vecchio = { App_a: "a", App_b: "b" };
  const [stato, aggiornato] = updateKeys(vecchio, { App_a: "a", App_c: "c" });
  eq("chiavi risultanti", "App_a,App_c", Object.keys(aggiornato).sort().join(","));
  eq("aggiunte", "App_c", stato.added.join(","));
  eq("rimosse", "App_b", stato.deleted.join(","));
  eq("valore della rimossa conservato (serve ai rename)", "b", stato.deletedValues.App_b);
  eq("segnalato come cambiato", true, stato.changed);

  const [fermo] = updateKeys({ App_a: "a" }, { App_a: "diverso" });
  // updateKeys guarda le CHIAVI, non i valori: un testo sorgente riscritto senza cambiare id
  // non esiste (l'id è l'hash del testo), quindi qui non c'è nulla da rilevare.
  eq("stesso insieme di chiavi: nessuna variazione", false, fermo.changed);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
