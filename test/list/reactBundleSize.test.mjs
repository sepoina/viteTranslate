// Il peso "al massimo" del runtime client, verificato: vedi test/measureReactBundle.mjs per
// cosa si misura e perché. Questo file aggiunge solo le soglie — la misura vera e propria la
// stampa anche `npm run estimateSize`, con lo stesso codice.
//
// rolldown e @babel/core sono devDependencies di questo repo (le usa anche rolldown.config.js),
// ma la sonda resta la stessa di translateContainer.test.mjs: se mancano, il file si salta da
// solo (vedi test/run.mjs, tabella OPZIONALI) invece di far fallire l'intera suite.
//
//   node test/list/reactBundleSize.test.mjs
import measureReactBundle, { EXTERNAL } from "../measureReactBundle.mjs";

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

// --- La barra: Babel sta in "serve" e in "build", MAI nel bundle che l'utente produce ---
//
// Finora era vero per costruzione e non per controllo: `@babel/core` non compare fra gli
// external del bundle runtime (vedi componentExternal in rolldown.config.js), quindi una sua
// importazione accidentale da lib/react/ non resterebbe un import, verrebbe bundlata dentro.
// La soglia dei 5 kB qui sopra intercetterebbe una fuga grossolana — Babel pesa megabyte — ma
// non direbbe qual è la regola violata, e non vedrebbe affatto un `createRequire("@babel/core")`,
// che di byte ne aggiunge una manciata e trascina Babel nell'app di chi ci usa solo a runtime.
//
// I due controlli guardano due cose diverse: la lista degli import è il confine dichiarato,
// il testo del codice è ciò che dentro quel confine è finito davvero.
//
// `\(?` non è di troppo: senza, la forma dinamica `import("...")` sfuggirebbe alla lista, ed
// è proprio la forma che un caricamento pigro userebbe. Oggi nel bundle non ce n'è nessuna,
// ma languageResource.js esiste per fare code splitting con `import()`, quindi la prima che
// comparirà arriverà da lì.
const AMMESSI = new Set(EXTERNAL);
const importati = [...new Set(
  [...code.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1])
)];
// Confrontati come stringa perché `eq` usa `===`: su due array sarebbe sempre falso, e il
// join ha il vantaggio di stampare i colpevoli invece di un "false" senza nomi.
const estranei = importati.filter((s) => !AMMESSI.has(s));
eq("il bundle runtime importa solo gli external dichiarati", "", estranei.join(", "));

// `createRequire` è il modo in cui il lato plugin raggiunge Babel (vedi ensureBabel in
// extractMarkers.js). Nel bundle runtime non ha nessuna ragione di esistere, e la sua comparsa
// significherebbe che un modulo di lib/dev/ è stato tirato dentro da lib/react/.
for (const proibito of ["@babel", "createRequire", "node:module"]) {
  eq(`nessuna traccia di "${proibito}" nel bundle runtime`, true, !code.includes(proibito));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
