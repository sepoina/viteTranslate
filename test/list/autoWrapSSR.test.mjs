// Il cerchio completo dell'auto-wrap, dal marcatore nudo fino all'HTML renderizzato —
// extractMarkers (autoWrap: true), il preset React come lo applicherebbe il plugin del
// progetto, e il runtime vero (Translate.js, useTranslateNode.js, useTranslateToString.js)
// contro una tabella compilata. Deve uscire il testo tradotto, non l'opcode (vedi
// doc/ImplementationPlans/4_3_0.md, "Il problema, in concreto", e 4_4_0.md § 5/6).
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
// I file di appoggio vivono dentro lib/react perché gli import relativi che Translate.js e
// useTranslateNode.js fanno dei loro vicini (TranslateContext.js, interpolate.js, ...) devono
// continuare a risolversi — stesso schema di translateComponent.test.mjs e translateContainer.test.mjs.
const REACT_DIR = join(ROOT, "lib/react");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(54), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

let contatore = 0;
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

/**
 * Il giro completo, da un sorgente utente senza <Translate> fino all'HTML renderizzato.
 * Ogni chiamata usa nomi di modulo distinti (un contatore in coda allo stamp) cosi' le
 * chiamate successive non si pestano i piedi a vicenda.
 *
 * @param {string} src - il sorgente utente completo (un default export)
 * @param {Record<string,string>} traduzioni - id -> testo tradotto, per la tabella compilata
 * @returns {Promise<{ estratto: object, table: Record<string,string>, html: string }>}
 */
async function roundTrip(src, traduzioniById) {
  const n = ++contatore;
  const filename = join(ROOT, "src-fixture", `AutoWrapDemo${n}.jsx`); // non deve esistere: extractMarkers legge `code`, non il disco
  const table = {};
  const estratto = extractMarkers(src, { filename, table, autoWrap: true, includeFallback: false });
  if (estratto === null) return { estratto, table, html: null };

  // 2. come lo vede il plugin React del progetto
  const compilatoJsx = transformSync(estratto.code, {
    filename,
    presets: [["@babel/preset-react", { runtime: "automatic", development: false }]],
    babelrc: false,
    configFile: false,
  }).code;

  // 3. la tabella compilata, come da una build vera
  const tabellaModulo = `__tabella-autowrap-${stamp}-${n}.mjs`;
  scrivi(tabellaModulo, compileLanguageModule(traduzioniById(table), "test"));
  const tabella = (await import(`${pathToFileURL(join(REACT_DIR, tabellaModulo)).href}?t=${stamp}-${n}`)).default;

  const manifestModulo = `__manifest-autowrap-${stamp}-${n}.mjs`;
  scrivi(manifestModulo, `
import tabella from "./${tabellaModulo}";
export const languages = { "it-IT": { name: "italiano", preloaded: true, table: tabella, load: () => Promise.resolve({ default: tabella }) } };
export const sourceLanguage = "it-IT";
export const fallbackTable = tabella;
`);

  // 4. Translate.js e useTranslateNode.js/useTranslateToString.js veri, virtual import a parte.
  // Translate.js esporta `default`; useTranslate*.js esportano un nominato — qui rifatti a mano
  // con un wrapper, così l'import nominato che il componente estratto si aspetta trova qualcosa
  // a cui agganciarsi.
  const patch = (testo) => testo.replaceAll(/["']virtual:vitetranslate\/languages["']/g, JSON.stringify(`./${manifestModulo}`));
  const translateRawModulo = `__translate-raw-autowrap-${stamp}-${n}.mjs`;
  scrivi(translateRawModulo, patch(readFileSync(join(REACT_DIR, "Translate.js"), "utf8")));
  const nodeRawModulo = `__node-raw-autowrap-${stamp}-${n}.mjs`;
  scrivi(nodeRawModulo, patch(readFileSync(join(REACT_DIR, "useTranslateNode.js"), "utf8")));
  const strRawModulo = `__str-raw-autowrap-${stamp}-${n}.mjs`;
  scrivi(strRawModulo, patch(readFileSync(join(REACT_DIR, "useTranslateToString.js"), "utf8")));
  const bridgeModulo = `__bridge-autowrap-${stamp}-${n}.mjs`;
  scrivi(bridgeModulo,
    `export { default as Translate } from "./${translateRawModulo}";\n` +
    `export { useTranslateNode } from "./${nodeRawModulo}";\n` +
    `export { useTranslateToString } from "./${strRawModulo}";\n`);

  // 5. il componente estratto, import pubblico a parte
  // "@sepoina/vitetranslate/react" risolverebbe al bundle in lib/dist (via l'"exports" del
  // package.json), non ai sorgenti: qui lo si punta a mano al bridge appena patchato, la
  // stessa sostituzione che fa la risoluzione dei moduli in un progetto vero.
  const componenteModulo = `__autowrap-demo-${stamp}-${n}.mjs`;
  scrivi(componenteModulo, compilatoJsx.replace(
    /["']@sepoina\/vitetranslate\/react["']/,
    JSON.stringify(`./${bridgeModulo}`),
  ));

  const { default: Componente } = await import(`${pathToFileURL(join(REACT_DIR, componenteModulo)).href}?t=${stamp}-${n}`);
  const html = renderToStaticMarkup(h(Componente));
  return { estratto, table, html };
}

// ============================================================ 1. il caso base: un figlio, senza <Translate>
{
  const src = "export default function AutoWrapDemo() {\n return (<p>_%_ciao dal wrap_%_</p>);\n}\n";
  const table = {};
  const estratto = extractMarkers(src, {
    filename: join(ROOT, "src-fixture", "AutoWrapDemo.jsx"), table, autoWrap: true, includeFallback: false,
  });
  const [id, testoOriginale] = Object.entries(table)[0] ?? [];

  console.log("\n== extractMarkers con autoWrap: true ==");
  eq("un solo id estratto", 1, Object.keys(table).length);
  eq("il testo sorgente registrato e' quello marcato", "ciao dal wrap", testoOriginale);
  // AutoWrapDemo e' un componente VERDE (esportato, JSX diretto, zero parametri): dallo strato
  // 5 in poi la forma emessa e' l'hook (`{__vtNode(...)}`), non piu' il wrap 4.3.0
  // (`<__vtTranslate .../>`) — vedi autoWrapOptionCase.test.mjs per la stessa nota.
  eq("l'output usa l'hook, non il wrap 4.3.0", true, estratto.code.includes("__vtNode("));
  eq("l'import punta al pacchetto pubblico", true, estratto.code.includes('from "@sepoina/vitetranslate/react"'));

  console.log("\n== round trip completo: dal marcatore nudo al testo tradotto ==");
  // L'id dipende dal PERCORSO oltre che dal testo (vedi registerMarker): `roundTrip` estrae di
  // nuovo con un proprio filename numerato, quindi il vero id da tradurre è quello che RESTITUISCE
  // — non quello calcolato qui sopra su un filename diverso. `id`/`testoOriginale` sopra servono
  // solo alle due asserzioni sulla tabella di QUESTA estrazione.
  const { html } = await roundTrip(src, (t) => ({ [Object.keys(t)[0]]: "Ciao dal wrap, tradotto" }));
  eq("esce il testo tradotto, non l'opcode", "<p>Ciao dal wrap, tradotto</p>", html);
  eq("nessun marcatore compilato a schermo", false, html.includes("_<_") || html.includes("_>_"));
}

// ============================================================ 2. T37 — figlio E attributo, stesso componente
{
  const src =
    "export default function AutoWrapDemo() {\n" +
    ' return (<div><p>_%_ciao dal wrap_%_</p><input placeholder="_%_segnaposto_%_" /></div>);\n' +
    "}\n";
  const table = {};
  const estratto = extractMarkers(src, {
    filename: join(ROOT, "src-fixture", "AutoWrapDemoAttr.jsx"), table, autoWrap: true, includeFallback: false,
  });

  console.log("\n== T37: figlio + attributo sullo stesso componente verde ==");
  eq("due id estratti", 2, Object.keys(table).length);
  eq("una sola const per l'hook dei nodi", 1, (estratto.code.match(/__vtNode\d*\s*=\s*__vtUseNode\d*\(\)/g) ?? []).length);
  eq("una sola const per l'hook stringa", 1, (estratto.code.match(/__vtStr\d*\s*=\s*__vtUseStr\d*\(\)/g) ?? []).length);

  // Stessa cosa del blocco precedente: l'id dipende dal filename, quindi si legge dalla
  // tabella che RESTITUISCE `roundTrip` (la sua propria estrazione), non da quella qui sopra.
  const { html } = await roundTrip(src, (t) => {
    const [idFiglio] = Object.entries(t).find(([, v]) => v === "ciao dal wrap");
    const [idAttr] = Object.entries(t).find(([, v]) => v === "segnaposto");
    return { [idFiglio]: "Ciao dal wrap, tradotto", [idAttr]: "Segnaposto tradotto" };
  });
  eq("esce sia il testo del figlio", true, html.includes(">Ciao dal wrap, tradotto<"));
  eq("sia il valore dell'attributo, tradotti", true, html.includes('placeholder="Segnaposto tradotto"'));
  eq("nessun marcatore compilato a schermo", false, html.includes("_<_") || html.includes("_>_"));
}

// ============================================================ 3. T38 — <title>, con e senza spazi a cavallo
{
  const casi = [
    ["senza spazi a cavallo", "export default function TitleDemo() {\n return (<title>_%_Home_%_</title>);\n}\n"],
    ["con spazi a cavallo, una riga sola", "export default function TitleDemo() {\n return (<title> _%_Home_%_ </title>);\n}\n"],
  ];
  console.log("\n== T38: SSR su <title>, componente verde ==");
  for (const [nome, src] of casi) {
    const { html } = await roundTrip(src, (t) => ({ [Object.keys(t)[0]]: "Pagina Iniziale" }));
    eq(`${nome}: esce il titolo tradotto`, "<title>Pagina Iniziale</title>", html);
  }
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
