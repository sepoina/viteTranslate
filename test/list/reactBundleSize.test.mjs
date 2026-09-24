// Il peso "al massimo" del runtime client, verificato: vedi test/measureReactBundle.mjs per
// cosa si misura e perché. Questo file aggiunge solo le soglie — la misura vera e propria la
// stampa anche `npm run estimateSize`, con lo stesso codice.
//
// rolldown e @babel/core sono devDependencies di questo repo (le usa anche rolldown.config.js),
// ma la sonda resta la stessa di translateContainer.test.mjs: se mancano, il file si salta da
// solo (vedi test/run.mjs, tabella OPZIONALI) invece di far fallire l'intera suite.
//
//   node test/list/reactBundleSize.test.mjs
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import measureReactBundle, { EXTERNAL, measureRuntime, sizeLabels } from "../measureReactBundle.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

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

// Nessun bundle di produzione deve mai contenere il parser ICU: né un pezzo del suo codice
// (MISSING_OTHER_CLAUSE è una stringa che formatjs incorpora, univoca), né il nome del
// pacchetto stesso.
eq("nessuna traccia del parser ICU (MISSING_OTHER_CLAUSE)", false, code.includes("MISSING_OTHER_CLAUSE"));
eq('nessuna traccia di "icu-messageformat"', false, code.includes("icu-messageformat"));

// Il peso reale (React + helper ICU) confrontato con site/runtimeSize.json, che npm run
// estimateSize riscrive: un salto di un kB fa fallire questo test finché le cifre non vengono
// aggiornate — è la guardia contro le fughe silenziose, legata a ciò che i documenti dicono
// (piano 4.6.3, Fase 5 § 2b). I byte esatti NON si confrontano: cambiano con la versione di
// rolldown, e li controlla estimateSize a ogni chiusura. Il README non si legge qui: la Fase 2
// viene prima della Fase 5.
{
  const { gzip: totalGzip } = await measureRuntime();
  const { real, compare } = sizeLabels(totalGzip);
  const KO_HINT = 'run "npm run estimateSize", then update README.md (plan 4.6.3, Fase 5 § 2b)';
  let runtimeSize;
  try {
    runtimeSize = JSON.parse(readFileSync(join(ROOT, "site/runtimeSize.json"), "utf8"));
  } catch {
    runtimeSize = null;
  }
  eq(`site/runtimeSize.json: real combacia — ${KO_HINT}`, real, runtimeSize?.real);
  eq(`site/runtimeSize.json: compare combacia — ${KO_HINT}`, compare, runtimeSize?.compare);
}

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

// --- 4.5.0: lib/dev/llm/ non deve essere raggiungibile da lib/react/index.js ---
//
// Verificato sul grafo degli import del SORGENTE, come già si fa per Babel, invece che sul
// testo del bundle: i file di lib/dev/llm/ non hanno una stringa distintiva grep-abile come
// "@babel", quindi il controllo che conta è "nessun import relativo, seguito ricorsivamente da
// lib/react/index.js, risolve dentro lib/dev/llm/" — non "il bundle non contiene una parola".
function resolveImport(fromFile, spec) {
  let resolved = resolve(dirname(fromFile), spec);
  if (existsSync(resolved) && !resolved.match(/\.[jt]sx?$/)) {
    if (existsSync(join(resolved, "index.js"))) return join(resolved, "index.js");
  }
  if (existsSync(resolved)) return resolved;
  for (const ext of [".js", ".jsx"]) {
    if (existsSync(resolved + ext)) return resolved + ext;
  }
  return resolved; // non trovato: resta com'è, il chiamante lo salterà silenziosamente
}

function collectSourceImports(entryFile) {
  const visited = new Set();
  const stack = [resolve(entryFile)];
  const IMPORT_RE = /(?:import|export)(?:[^'"();]*?from)?\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

  while (stack.length > 0) {
    const file = stack.pop();
    if (visited.has(file)) continue;
    visited.add(file);

    let text;
    try { text = readFileSync(file, "utf8"); } catch { continue; }

    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2];
      if (!spec.startsWith(".")) continue; // bare specifier: pacchetto esterno, non sorgente nostro
      stack.push(resolveImport(file, spec));
    }
  }
  return visited;
}

console.log(`\n== lib/dev/llm/ irraggiungibile da lib/react/index.js (grafo import sorgente) ==`);
const reactGraph = collectSourceImports(join(ROOT, "lib/react/index.js"));
const llmFilesReached = [...reactGraph].filter((f) => f.includes(`${join("lib", "dev", "llm")}${"/"}`) || f.includes(`${join("lib", "dev", "llm")}\\`));
eq("nessun file di lib/dev/llm/ raggiunto", "", llmFilesReached.join(", "));
eq(`grafo esplorato per intero (${reactGraph.size} file)`, true, reactGraph.size > 1);

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
