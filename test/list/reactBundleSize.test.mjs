// Il peso "al massimo" del runtime client, verificato: vedi test/measureReactBundle.mjs per
// cosa si misura e perché. Questo file aggiunge solo le soglie — la misura vera e propria la
// stampa anche `npm run estimateSize`, con lo stesso codice.
//
// rolldown e @babel/core sono devDependencies di questo repo (le usa anche rolldown.config.js),
// ma la sonda resta la stessa di translateContainer.test.mjs: se mancano, il file si salta da
// solo (vedi test/run.mjs, tabella OPZIONALI) invece di far fallire l'intera suite.
//
//   node test/list/reactBundleSize.test.mjs
import measureReactBundle from "../measureReactBundle.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(54), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

console.log(`\n== solo il chunk react, minificato e gzippato (nessun'app a fare tree-shaking incrociato) ==`);

const { fileName, code, raw, gzip } = await measureReactBundle();
console.log(`      ${fileName}: ${raw} B minificati, ${gzip} B gzip`);

// Nessun external è finito bundlato dentro: comparirebbe come "react.createElement(" invece di
// un import, il segno che qualcosa ha risolto "react" alla cieca invece di rispettarlo come
// external — bundlerebbe un secondo React nell'app di chiunque.
eq('"react" resta un import esterno, non bundlato', true, code.includes(`from"react"`) || code.includes(`from "react"`));

// La soglia che il README promette ("< 5 kB gzip" per l'intero runtime). Un salto oltre non è un
// errore in sé, ma è esattamente il tipo di regressione silenziosa che questo file esiste per
// far notare a chi ha appena aggiunto un import pesante in lib/react.
const SOGLIA_GZIP = 5 * 1024;
eq(`sotto i ${SOGLIA_GZIP} B gzip promessi dal README`, true, gzip < SOGLIA_GZIP);

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
