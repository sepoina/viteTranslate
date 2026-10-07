// devRender.js: il fallback di sviluppo senza DOM (piano 4.6.4) deve rendere ESATTAMENTE come
// la voce compilata — stesso parseMarkup, stessa lettura degli argomenti, stessi slot. Qui si
// confronta il suo output con quello del vero compilatore (compileLanguageModule), voce per
// voce, su tutte le tabelle di lingua del repo più i 14 casi speciali dell'Appendice H del piano.
//
// react e react-dom sono peerDependencies opzionali: se mancano, test/run.mjs salta il file.
//
//   node test/list/devRender.test.mjs
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { devRender } from "../../lib/markup/devRender.js";
import { compileLanguageModule } from "../../lib/dev/compile/compileTable.js";
import readLanguageFile from "../../lib/dev/vite/uty/readLanguageFile.js";
import { temporaneiAllUscita } from "./tempFiles.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ICU_RUNTIME_URL = pathToFileURL(join(ROOT, "lib/icu/runtime.js")).href;
const REACT_DIR = join(ROOT, "lib/react");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Rende un nodo React qualunque (stringa, numero, elemento, frammento, array) come HTML, per
// confrontare senza distinguere le forme che React considera equivalenti.
const renderAny = (node) => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  return renderToStaticMarkup(createElement(Fragment, null, node));
};

// Cancellati all'uscita; uno che resta è un KO (tempFiles.mjs).
const temporanei = temporaneiAllUscita();
let contatore = 0;
async function compilaTabella(table, tag) {
  const n = ++contatore;
  const code = compileLanguageModule(table, tag, null, { icuModule: ICU_RUNTIME_URL, sourceTag: tag, warn: () => {} });
  const p = join(ROOT, "lib/dev/compile", `__devrender-parity-${process.pid}-${n}.mjs`);
  writeFileSync(p, code, "utf8");
  temporanei.push(p);
  const mod = await import(`${pathToFileURL(p).href}?t=${n}`);
  return mod.default;
}

// Argomenti di prova (Appendice H): una stringa per ogni "%s" (più qualcuna di scorta); se il
// testo usa nomi, l'oggetto dei nomi in testa, con 3 per un numero e una data di calendario per
// date/d (i plurali e le date hanno bisogno di un valore del loro tipo).
//
// Nomi solo ASCII (non [\p{L}_] come nell'Appendice H alla lettera): un ramo ICU scritto in
// caratteri CJK e privo di spazi prima della "}" di chiusura (es. "没有新消息}") soddisfa la
// stessa forma di un nome di argomento, e verrebbe scambiato per un argomento con nome che il
// sorgente non ha. Nessuna tabella del repo usa un nome ICU non-ASCII: la restrizione non perde
// nessun caso vero.
function argsFor(text) {
  const nomi = [...text.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,}]/g)].map((m) => m[1]);
  const n = (text.match(/%s/g) ?? []).length + 3;
  const obj = Object.fromEntries(nomi.map((k) => [k, k === "date" || k === "d" ? "2026-10-03" : 3]));
  const pos = Array.from({ length: n }, (_, i) => `v${i}`);
  return nomi.length ? [obj, ...pos] : pos;
}

console.log("\n== Parita' su tutte le tabelle di lingua del repo ==");
{
  const files = [];
  const scan = (dir) => {
    for (const n of readdirSync(dir)) {
      if (n === "node_modules" || n.startsWith(".")) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { if (n === "locale") files.push(...readdirSync(p).filter((f) => f.endsWith(".yml")).map((f) => join(p, f))); else scan(p); }
    }
  };
  scan(join(ROOT, "site"));
  scan(join(ROOT, "demo"));

  let confrontate = 0;
  for (const f of files) {
    let table;
    try { ({ table } = readLanguageFile(f)); } catch { continue; }
    if (!table) continue;
    const tag = /([a-z]{2,3}-[A-Z]{2})\.yml$/.exec(f)?.[1] ?? "it-IT";
    const voci = Object.entries(table).filter(([k, v]) => typeof v === "string" && k !== "__untranslated__");
    if (voci.length === 0) continue;

    const daCompilare = Object.fromEntries(voci);
    const compilata = await compilaTabella(daCompilare, tag);
    for (const [key, text] of voci) {
      const args = argsFor(text);
      const valoreCompilato = typeof compilata[key] === "function" ? compilata[key](args) : compilata[key];
      const atteso = renderAny(valoreCompilato);
      const ottenuto = renderAny(devRender(text, args, tag, null));
      confrontate++;
      if (atteso !== ottenuto) {
        fail++;
        console.log("  KO  ", `${f.replace(ROOT, "")} :: ${key}`.padEnd(60), "->", JSON.stringify(ottenuto), `(atteso ${JSON.stringify(atteso)})`);
      }
    }
  }
  console.log(`       (${confrontate} voci confrontate, 1 per riga solo se KO)`);
  eq("nessuna divergenza su tutte le voci del repo", true, fail === 0);
}

console.log("\n== I 14 casi speciali (Appendice H) ==");
{
  // Elementi React VERI (createElement), non oggetti finti: sia _slot che devRender chiamano
  // cloneElement/isValidElement, e un oggetto senza props/key/ref farebbe fallire react-dom.
  const linkFinto = createElement("a", null, "originale");
  const bFinto = createElement("b", null, "originale");
  const casi = [
    ["slot semplice", "Leggi la <0>guida</0>.", "it-IT", [linkFinto]],
    ["slot con elemento dentro", "<0><b>qui</b></0>", "it-IT", [linkFinto]],
    ["slot mancante", "Leggi la <0>guida</0>.", "it-IT", []],
    ["slot non elemento", "Leggi la <0>guida</0>.", "it-IT", ["testo"]],
    ["slot annidati", "<0>a <1>b</1> c</0>", "it-IT", [linkFinto, bFinto]],
    ["nomi + slot (base 1)", "Ciao {nome}, leggi <1>qui</1>", "it-IT", [{ nome: "Aldo" }, linkFinto]],
    ["slot in un ramo plurale", "{1, plural, one {<0># file</0>} other {<0># file</0>}}", "it-IT", [linkFinto, 3]],
    ["slot in un select", "{n, select, a {<1>A</1>} other {B}}", "it-IT", [{ n: "a" }, bFinto]],
    ["elemento come %s", "Visto: %s", "it-IT", [linkFinto]],
    ["argomento ICU mancante", "Ciao {nome}", "it-IT", [{}]],
    ["booleano in _cat", "Stato: {0}", "it-IT", [false]],
    ["tag incrociati", "<b>x <i>y</b> z</i>", "it-IT", []],
    ["entita'", "&amp; &hearts; &alpha;", "it-IT", []],
    ["solo slot", "<0>tutto link</0>", "it-IT", [linkFinto]],
  ];
  for (const [nome, sorgente, tag, args] of casi) {
    const tabella = await compilaTabella({ voce: sorgente }, tag);
    const valoreCompilato = typeof tabella.voce === "function" ? tabella.voce(args) : tabella.voce;
    const atteso = renderAny(valoreCompilato);
    const ottenuto = renderAny(devRender(sorgente, args, tag, null));
    eq(nome, atteso, ottenuto);
  }
}

console.log("\n== devRender non tocca il DOM (gira in Node) ==");
eq("nessun 'document' globale in questo processo", "undefined", typeof globalThis.document);
eq("devRender funziona comunque", "Leggi <a>qui</a>", renderAny(devRender("Leggi <0>qui</0>", [
  createElement("a", null, "originale"),
], "it-IT", null)));

console.log("\n== resolveEntry.js chiama diag.devRender nel ramo di sviluppo ==");
{
  // `import.meta.env` non esiste fuori da un bundler (stessa nota di translateComponent.test.mjs):
  // per esercitare il ramo `DEV` di missing() qui si patcha il testo del modulo, come già fa
  // autoWrapSSR.test.mjs con l'import virtuale — nessun altro modo in Node puro.
  const originale = readFileSync(join(REACT_DIR, "resolveEntry.js"), "utf8");
  const patchato = originale.replaceAll("import.meta.env?.DEV", "true");
  eq("la patch ha trovato almeno un punto da forzare a DEV", true, patchato !== originale);
  const bollo = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const modulo = `__resolveEntry-dev-${bollo}.mjs`;
  const p = join(REACT_DIR, modulo);
  writeFileSync(p, patchato, "utf8");
  temporanei.push(p);
  const { resolveEntry } = await import(`${pathToFileURL(p).href}?t=${bollo}`);

  const chiamate = [];
  const diag = {
    ...((await import("../../lib/errorSolve.js")).DEFAULT_DIAGNOSTICS),
    icuLocale: "it-IT",
    devRender: (...args) => { chiamate.push(args); return "reso-da-devRender"; },
  };
  const marker = "_<_App_maiVisto_/_testo nuovo_>_"; // chiave assente, col fallback incorporato
  const out = resolveEntry({}, {}, "App_maiVisto", ["Aldo"], marker, diag, { timeZone: "UTC" });

  eq("devRender chiamato esattamente una volta", 1, chiamate.length);
  eq("il risultato di missing() e' quello di devRender", "reso-da-devRender", out);
  if (chiamate.length === 1) {
    const [fallback, args, locale, icu, diagPassato] = chiamate[0];
    eq("primo argomento: il fallback del marcatore", "testo nuovo", fallback);
    eq("secondo argomento: gli args originali", "Aldo", args?.[0]);
    eq("terzo argomento: diag.icuLocale", "it-IT", locale);
    eq("quarto argomento: icu", "UTC", icu?.timeZone);
    eq("quinto argomento: diag stesso", true, diagPassato === diag);
  }
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
