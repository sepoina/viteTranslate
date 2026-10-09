// I nomi brevi (4.7.0): `Trans`, `useTrans`, `TransContainer`, `useTransLanguage` sono le STESSE funzioni dei nomi
// lunghi, non delle copie (React DevTools le mostra col nome esteso), e i tipi li dichiarano.
//
// react e react-dom sono peerDependencies opzionali: se mancano, test/run.mjs salta il file.
//
//   node test/list/reactAliases.test.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { transformSync } from "@babel/core";
import { temporaneiAllUscita } from "./tempFiles.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(54), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// lib/react/index.js importa il modulo virtuale: si riscrive l'import verso un manifest vero, scritto
// accanto (come translateComponent.test.mjs). index.js importa i moduli fratelli, che a loro volta
// importano il modulo virtuale: qui si carica l'indice, quindi serve un manifest per ciascuno di
// quelli che lo importano. Il più semplice: la copia temporanea di ogni file di lib/react che lo cita.
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const temporanei = temporaneiAllUscita();
const scrivi = (nome, contenuto) => {
  const p = join(ROOT, "lib/react", nome);
  writeFileSync(p, contenuto, "utf8");
  temporanei.push(p);
  return p;
};

const manifestNome = `__manifest-alias-${stamp}.mjs`;
scrivi(manifestNome, `
export const languages = { "it-IT": { name: "italiano", preloaded: true, table: {}, load: () => Promise.resolve({ default: {} }) } };
export const sourceLanguage = "it-IT";
export const fallbackTable = {};
export const devRender = null;
export const icu = null;
export const icuDev = null;
export const errorSolve = { badData: "", malformed: "", untranslated: "", notFullyTranslated: "", absentDataInArray: "", warn: false };
export const partiallyTranslated = {};
`);

const riscrivi = (file) =>
  readFileSync(join(ROOT, "lib/react", file), "utf8")
    .replaceAll(/["']virtual:vitetranslate\/languages["']/g, JSON.stringify(`./${manifestNome}`));

// Per semplicità e robustezza: si copia solo index.js, con l'import del modulo virtuale riscritto,
// e i suoi import relativi che portano ai moduli dipendenti dal virtuale si riscrivono verso copie
// con lo stesso trattamento.
const mappa = new Map();
function copia(file) {
  if (mappa.has(file)) return mappa.get(file);
  const nome = file.replace(/(\.[a-z]+)$/, `-${stamp}.mjs`).replace(/^/, "__");
  mappa.set(file, nome);
  // `version` lo inlinea il bundler leggendo package.json: qui una costante.
  let testo = riscrivi(file).replace(/import \{ version \} from "\.\.\/\.\.\/package\.json" with \{ type: "json" \};/, 'const version = "test";');
  // gli import relativi ad altri file di lib/react che vanno copiati a loro volta
  testo = testo.replaceAll(/from\s+(["'])\.\/([A-Za-z]+\.jsx?)\1/g, (m, q, f) => {
    const sorgente = readFileSync(join(ROOT, "lib/react", f), "utf8");
    if (!/virtual:vitetranslate\/languages|from\s+["']\.\//.test(sorgente)) return m;
    return `from ${q}./${copia(f)}${q}`;
  });
  // TranslateContainer è JSX: stessa trasformazione che rolldown.config.js applica al bundle.
  if (file.endsWith(".jsx")) {
    testo = transformSync(testo, {
      filename: file, presets: [["@babel/preset-react", { runtime: "automatic", development: false }]], babelrc: false, configFile: false,
    }).code;
  }
  scrivi(nome, testo);
  return nome;
}

const indice = copia("index.js");
const lib = await import(`${pathToFileURL(join(ROOT, "lib/react", indice)).href}?t=${stamp}`);

console.log("\n== i nomi brevi sono le stesse funzioni dei nomi lunghi ==");
eq("Trans === Translate", true, lib.Trans === lib.Translate);
eq("useTrans === useTranslateToString", true, lib.useTrans === lib.useTranslateToString);
eq("TransContainer === TranslateContainer", true, lib.TransContainer === lib.TranslateContainer);
eq("useTransLanguage === useTranslateLanguage", true, lib.useTransLanguage === lib.useTranslateLanguage);
eq("i nomi lunghi ci sono ancora", true, typeof lib.Translate === "function" && typeof lib.useTranslateToString === "function");
eq("useTranslateNode, jsxArg, basicHtmlToNodes non hanno alias", false, "useTransNode" in lib || "TransArg" in lib);

console.log("\n== i tipi dichiarano i quattro nomi ==");
{
  const d = readFileSync(join(ROOT, "lib/react.d.ts"), "utf8");
  eq("Trans", true, /export declare const Trans: typeof Translate;/.test(d));
  eq("TransContainer", true, /export declare const TransContainer: typeof TranslateContainer;/.test(d));
  eq("useTrans", true, /export declare const useTrans: typeof useTranslateToString;/.test(d));
  eq("useTransLanguage", true, /export declare const useTransLanguage: typeof useTranslateLanguage;/.test(d));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
