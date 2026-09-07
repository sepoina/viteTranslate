// Fonte di verità per la cifra che il README promette ("< 5 kB gzip"): stampa il peso del solo
// runtime React, misurato come farebbe test/list/reactBundleSize.test.mjs — vedi
// test/measureReactBundle.mjs per cosa si misura e perché è un limite "al massimo".
//
// Non è un test: non fa parte della suite (test/run.mjs scopre solo test/list/*.test.mjs),
// è uno strumento da rilanciare a mano quando lib/react cambia, per sapere se la cifra nel
// README è ancora vera prima di pubblicare.
//
//   npm run estimateSize
import measureReactBundle from "./measureReactBundle.mjs";

const KB = 1024;
const asKB = (bytes) => `${(bytes / KB).toFixed(2)} kB`;

const { fileName, raw, gzip } = await measureReactBundle();

const SOGLIA_GZIP = 5 * KB;
const entroLaSoglia = gzip < SOGLIA_GZIP;

console.log(`
viteTranslate — React runtime size (${fileName}, minified)

  raw    ${raw} B  (${asKB(raw)})
  gzip   ${gzip} B  (${asKB(gzip)})

README claims "< 5 kB gzip": ${entroLaSoglia ? "OK" : "NOW FALSE"} — ${asKB(Math.abs(SOGLIA_GZIP - gzip))} of ${entroLaSoglia ? "headroom" : "overshoot"}
`);

if (!entroLaSoglia) process.exitCode = 1;
