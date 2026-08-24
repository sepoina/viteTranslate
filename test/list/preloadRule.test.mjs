// Quali lingue finiscono nel bundle iniziale, e cosa esporta il modulo virtuale.
//
//   dev   -> sempre la sourceLanguage, più le eventuali preloadedLanguages
//   build -> le preloadedLanguages se ce ne sono, altrimenti la sourceLanguage
//
// La regola vive nel bundle: sbagliarla significa o spedire una tabella che nessuno leggerà,
// o far sospendere il primo render. Nessuna delle due si vede dai test degli altri moduli.
//
//   node test/list/preloadRule.test.mjs
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import vitetranslate from "../../lib/dev/vite/vitetranslate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const VIRTUAL = "\0virtual:vitetranslate/languages";

/** Genera il modulo virtuale come lo vedrebbe il bundler nell'ambiente richiesto. */
async function generate({ preloadedLanguages, isProduction }) {
  const [, plugin] = vitetranslate({
    baseDir: join(ROOT, "playground"),
    localeDir: "src/locale",
    sourceLanguage: "it-IT",
    ...(preloadedLanguages ? { preloadedLanguages } : {}),
  });
  plugin.configResolved({ isProduction, build: {} });
  const out = await plugin.load(VIRTUAL);
  return out.code;
}

/** Le lingue importate staticamente, nell'ordine in cui compaiono. */
const eagerOf = (code) =>
  [...code.matchAll(/^import __vt_pre_\d+ from ".*\/([^/"]+)\.yml";$/gm)].map((m) => m[1]).join(",");

const exportOf = (code, name) => {
  const m = new RegExp(`^export const ${name} = (.*);$`, "m").exec(code);
  return m ? m[1] : undefined;
};
/** Il tag della lingua a cui punta un binding __vt_pre_N. */
const tagOfBinding = (code, expr) => {
  const i = /__vt_pre_(\d+)/.exec(expr)?.[1];
  return i === undefined ? expr : eagerOf(code).split(",")[Number(i)];
};

/** Le voci di `languages`, nell'ordine di emissione: tag -> { preloaded, hasTable, name }. */
function manifestOf(code) {
  const body = /export const languages = \{([\s\S]*?)\n\};/.exec(code)[1];
  const out = [];
  for (const line of body.split("\n")) {
    const m = /^\s*"([^"]+)": \{ name: ("(?:[^"\\]|\\.)*"), preloaded: (true|false)(, table: __vt_pre_\d+)?, load:/.exec(line);
    if (m) out.push({ tag: m[1], name: m[2], preloaded: m[3] === "true", hasTable: m[4] !== undefined });
  }
  return out;
}
const orderOf = (code) => manifestOf(code).map((e) => e.tag).join(",");
const preloadedOf = (code) => manifestOf(code).filter((e) => e.preloaded).map((e) => e.tag).join(",");
/** La prima precaricata: è il default di initialLanguage in <TranslateContainer>. */
const firstPreloaded = (code) => preloadedOf(code).split(",")[0];

console.log("\n== dev: la sourceLanguage è sempre precaricata ==");
{
  const code = await generate({ isProduction: false });
  eq("solo sourceLanguage precaricata", "it-IT", preloadedOf(code));
  eq("fallbackTable punta a it-IT", "it-IT", tagOfBinding(code, exportOf(code, "fallbackTable")));
}
{
  const code = await generate({ preloadedLanguages: ["en-US"], isProduction: false });
  eq("con preloadedLanguages: sorgente inclusa lo stesso", "en-US,it-IT", preloadedOf(code));
  eq("fallbackTable punta a en-US", "en-US", tagOfBinding(code, exportOf(code, "fallbackTable")));
}

console.log("\n== build: la sourceLanguage cede il posto alle preloadedLanguages ==");
{
  const code = await generate({ isProduction: true });
  eq("senza preloadedLanguages: resta la sorgente", "it-IT", preloadedOf(code));
}
{
  const code = await generate({ preloadedLanguages: ["en-US"], isProduction: true });
  // Il punto di tutta la modifica: la tabella italiana non viaggia piu' nel bundle iniziale.
  eq("con preloadedLanguages: SOLO quelle", "en-US", preloadedOf(code));
  eq("fallbackTable punta a en-US", "en-US", tagOfBinding(code, exportOf(code, "fallbackTable")));
  // La sorgente resta selezionabile, ma come chunk lazy.
  eq("it-IT resta caricabile", true, /"it-IT": \{ name: .*preloaded: false, load: \(\) => import\(/.test(code));
  eq("en-US non è un import dinamico", true, /"en-US": \{ name: .*preloaded: true, table: __vt_pre_0/.test(code));
}
{
  const code = await generate({ preloadedLanguages: ["en-US", "zh-CN"], isProduction: true });
  eq("piu' preloadedLanguages: tutte, senza la sorgente", "en-US,zh-CN", preloadedOf(code));
}

console.log("\n== la prima precaricata NON diverge fra dev e build ==");
// Era il difetto della prima stesura: senza `initialLanguage`, l'app partiva in italiano in
// sviluppo e in inglese una volta pubblicata. Il default si legge dalla prima precaricata,
// quindi l'ordine di emissione deve essere lo stesso nei due ambienti.
for (const preloadedLanguages of [undefined, ["en-US"], ["en-US", "zh-CN"], ["zh-CN"]]) {
  const dev = firstPreloaded(await generate({ preloadedLanguages, isProduction: false }));
  const build = firstPreloaded(await generate({ preloadedLanguages, isProduction: true }));
  const etichetta = preloadedLanguages ? `preloaded: [${preloadedLanguages}]` : "nessuna preloaded";
  eq(`${etichetta} · dev == build`, build, dev);
  eq(`${etichetta} · vale ${preloadedLanguages?.[0] ?? "it-IT"}`, preloadedLanguages?.[0] ?? "it-IT", dev);
}

console.log("\n== forma del manifest ==");
{
  const code = await generate({ preloadedLanguages: ["en-US"], isProduction: true });
  const m = manifestOf(code);
  eq("una voce per lingua", 3, m.length);
  eq("le precaricate vengono per prime", "en-US,it-IT,zh-CN", orderOf(code));
  eq("la precaricata porta la tabella", true, m[0].preloaded && m[0].hasTable);
  eq("la lazy non porta tabella", false, m[1].preloaded || m[1].hasTable);
  eq("ogni voce ha il nome", true, m.every((e) => e.name.length > 2));
  eq("nome autonimo dalla sync", '"American English"', m[0].name);
  // Le mappe parallele sono sparite: una lingua è una riga sola.
  eq("niente preloadedTables", undefined, exportOf(code, "preloadedTables"));
  eq("niente languageNames", undefined, exportOf(code, "languageNames"));
  eq("niente defaultLanguage", undefined, exportOf(code, "defaultLanguage"));
}

console.log("\n== casi che non devono lasciare il bundle senza tabelle ==");
{
  // Una preloadedLanguages inesistente viene creata al volo dal plugin, quindi resta valida:
  // il caso da coprire è che comunque una tabella eager ci sia sempre.
  const code = await generate({ preloadedLanguages: ["it-IT"], isProduction: true });
  eq("preloaded == sourceLanguage: nessun duplicato", "it-IT", preloadedOf(code));
  eq("una sola importazione statica", "it-IT", eagerOf(code));
}
{
  const code = await generate({ preloadedLanguages: [], isProduction: true });
  eq("preloadedLanguages vuoto: ricade sulla sorgente", "it-IT", preloadedOf(code));
}
{
  const code = await generate({ preloadedLanguages: ["en-US"], isProduction: true });
  eq("c'è sempre almeno una tabella eager", true, preloadedOf(code).length > 0);
  eq("fallbackTable non è mai null", false, exportOf(code, "fallbackTable") === "null");
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
