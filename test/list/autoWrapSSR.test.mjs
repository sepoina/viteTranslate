// Il test facoltativo del piano 4.3.0: il cerchio completo dell'auto-wrap, dal <p> senza
// <Translate> fino all'HTML renderizzato — extractMarkers (autoWrap: true), il preset React
// come lo applicherebbe il plugin del progetto, e il runtime Translate vero contro una tabella
// compilata. Deve uscire il testo tradotto, non l'opcode (vedi doc/ImplementationPlans/4_3_0.md,
// "Il problema, in concreto").
//
// react, react-dom e @babel/core sono peerDependencies opzionali: se mancano, test/run.mjs
// salta il file.
//
//   node test/list/autoWrapSSR.test.mjs
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { transformSync } from "@babel/core";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import extractMarkers from "../../lib/dev/babel/extractMarkers.js";
import { compileLanguageModule } from "../../lib/dev/compile/compileTable.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
// I file di appoggio vivono dentro lib/react perché l'import relativo che Translate.js fa dei
// suoi vicini (TranslateContext.js, interpolate.js, ...) deve continuare a risolversi — stesso
// schema di translateComponent.test.mjs e translateContainer.test.mjs.
const REACT_DIR = join(ROOT, "lib/react");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(54), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const temporanei = [];
process.on("exit", () => {
  for (const percorso of temporanei) {
    try { unlinkSync(percorso); } catch { /* già rimosso */ }
  }
});
function scrivi(nome, contenuto) {
  const percorso = join(REACT_DIR, nome);
  writeFileSync(percorso, contenuto, "utf8");
  temporanei.push(percorso);
  return percorso;
}

// ------------------------------------------------------------ 1. il sorgente utente, senza <Translate>
const filename = join(ROOT, "src-fixture", "AutoWrapDemo.jsx"); // non deve esistere: extractMarkers legge `code`, non il disco
const src = "export default function AutoWrapDemo() {\n return (<p>_%_ciao dal wrap_%_</p>);\n}\n";
const table = {};
const estratto = extractMarkers(src, { filename, table, autoWrap: true, includeFallback: false });
const [id, testoOriginale] = Object.entries(table)[0] ?? [];

console.log("\n== extractMarkers con autoWrap: true ==");
eq("un solo id estratto", 1, Object.keys(table).length);
eq("il testo sorgente registrato e' quello marcato", "ciao dal wrap", testoOriginale);
eq("l'output contiene l'elemento avvolto", true, estratto.code.includes("<__vtTranslate"));
eq("l'import punta al pacchetto pubblico", true, estratto.code.includes('from "@sepoina/vitetranslate/react"'));

// ------------------------------------------------------------ 2. come lo vede il plugin React del progetto
const compilatoJsx = transformSync(estratto.code, {
  filename,
  presets: [["@babel/preset-react", { runtime: "automatic", development: false }]],
  babelrc: false,
  configFile: false,
}).code;

// ------------------------------------------------------------ 3. la tabella compilata, come da una build vera
const tabellaModulo = `__tabella-autowrap-${stamp}.mjs`;
scrivi(tabellaModulo, compileLanguageModule({ [id]: "Ciao dal wrap, tradotto" }, "test"));
const tabella = (await import(`${pathToFileURL(join(REACT_DIR, tabellaModulo)).href}?t=${stamp}`)).default;

const manifestModulo = `__manifest-autowrap-${stamp}.mjs`;
scrivi(manifestModulo, `
import tabella from "./${tabellaModulo}";
export const languages = { "it-IT": { name: "italiano", preloaded: true, table: tabella, load: () => Promise.resolve({ default: tabella }) } };
export const sourceLanguage = "it-IT";
export const fallbackTable = tabella;
`);

// ------------------------------------------------------------ 4. Translate.js vero, virtual import a parte
// Translate.js esporta `default`; il nome "Translate" è un re-export di lib/react/index.js,
// non del file stesso — qui rifatto a mano con un wrapper, così l'import nominato che il
// componente estratto si aspetta ("Translate as alias") trova qualcosa a cui agganciarsi.
const translateRawModulo = `__translate-raw-autowrap-${stamp}.mjs`;
scrivi(translateRawModulo, readFileSync(join(REACT_DIR, "Translate.js"), "utf8")
  .replaceAll(/["']virtual:vitetranslate\/languages["']/g, JSON.stringify(`./${manifestModulo}`)));
const translateModulo = `__translate-autowrap-${stamp}.mjs`;
scrivi(translateModulo, `export { default as Translate } from "./${translateRawModulo}";\n`);

// ------------------------------------------------------------ 5. il componente estratto, import pubblico a parte
// "@sepoina/vitetranslate/react" risolverebbe al bundle in lib/dist (via l'"exports" del
// package.json), non ai sorgenti: qui lo si punta a mano al Translate.js appena patchato, la
// stessa sostituzione che fa la risoluzione dei moduli in un progetto vero.
const componenteModulo = `__autowrap-demo-${stamp}.mjs`;
scrivi(componenteModulo, compilatoJsx.replace(
  /["']@sepoina\/vitetranslate\/react["']/,
  JSON.stringify(`./${translateModulo}`),
));

const { default: AutoWrapDemo } = await import(`${pathToFileURL(join(REACT_DIR, componenteModulo)).href}?t=${stamp}`);

console.log("\n== round trip completo: dal marcatore nudo al testo tradotto ==");
const html = renderToStaticMarkup(h(AutoWrapDemo));
eq("esce il testo tradotto, non l'opcode", "<p>Ciao dal wrap, tradotto</p>", html);
eq("nessun marcatore compilato a schermo", false, html.includes("_<_") || html.includes("_>_"));

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
