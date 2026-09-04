// Scrive su file il modulo di lingua così come lo riceve il bundler, cioè il risultato del
// transform su localeDir, e classifica ogni chiave nella forma in cui è stata compilata.
// Serve a ispezionare a occhio cosa finisce davvero nel bundle, senza doverlo estrarre da un
// chunk minificato.
//
//   node test/exampleLangCompile.mjs [tag] [localeDir] [tagSorgente]
//
// Default: en-US dalla cartella locale del playground. L'output va in
// test/exampleCompiled/<tag>.compiled.js — una cartella a parte, e fuori da git: sono esempi
// da guardare, si rigenerano a comando e cambiano a ogni modifica del playground, quindi
// tenerli versionati vorrebbe dire diff di file generati a ogni giro.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = join(HERE, "exampleCompiled");

const { compileLanguageModule, compileEntry } = await import(`${ROOT}/lib/dev/compile/compileTable.js`);
const { default: readLanguageFile } = await import(`${ROOT}/lib/dev/vite/uty/readLanguageFile.js`);
const { languageFileName } = await import(`${ROOT}/lib/dev/vite/uty/languageFileFormat.js`);

const tag = process.argv[2] ?? "en-US";
const localeDir = process.argv[3] ?? join(ROOT, "playground/locale");
const sourcePath = join(localeDir, languageFileName(tag));

// La lingua sorgente serve a riempire le chiavi non tradotte: il modulo prodotto dal bundler
// è autonomo, e il dump deve mostrare esattamente quello. Si ricava dal file di lingua che
// dichiara `__builder__` senza essere questo tag — in mancanza di config, la si passa come
// terzo argomento.
const sourceTag = process.argv[4] ?? "it-IT";
const table = readLanguageFile(sourcePath);
const sourceTable = sourceTag === tag
  ? null
  : (() => { try { return readLanguageFile(join(localeDir, languageFileName(sourceTag))); } catch { return null; } })();
const compiled = compileLanguageModule(table, tag, sourceTable);

const outPath = join(OUT_DIR, `${tag}.compiled.js`);
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(outPath, compiled, "utf8");

// --- classificazione ---

// Rifà la compilazione voce per voce per capire in quale delle quattro forme è finita.
// `compileEntry` è la stessa funzione usata dal modulo intero, quindi la classificazione non
// può divergere da ciò che è stato scritto sul file.
function classify(value, key) {
  if (typeof value !== "string") {
    if (value !== null) return "metadati";
    // Il file su disco ha un null, ma il modulo compilato non ce l'ha: porta il testo della
    // sorgente. Dirlo com'è evita di leggere "non tradotta" e cercare invano un null nel dump.
    return typeof sourceTable?.[key] === "string"
      ? "5. non tradotta -> testo della sorgente"
      : "chiave non tradotta (nessun fallback)";
  }
  const expr = compileEntry(value, { jsx: false, jsxs: false, fragment: false, arg: false });
  const isFn = expr.startsWith("a => ");
  const hasJsx = /\bjsxs?\(/.test(expr);
  if (!isFn && !hasJsx) return "1. testo";
  if (!isFn && hasJsx) return "2. markup (elemento costante)";
  if (isFn && !hasJsx) return "3. testo + segnaposto (funzione)";
  return "4. markup + segnaposto (funzione)";
}

const byForm = new Map();
for (const [key, value] of Object.entries(table)) {
  const form = classify(value, key);
  if (!byForm.has(form)) byForm.set(form, []);
  byForm.get(form).push(key);
}

const total = Object.keys(table).length;
console.log(`\n${tag} — ${total} chiavi, da ${sourcePath}`);
console.log(`scritto in ${outPath}\n`);

for (const form of [...byForm.keys()].sort()) {
  const keys = byForm.get(form);
  const pct = ((100 * keys.length) / total).toFixed(0);
  console.log(`${String(keys.length).padStart(3)}  ${pct.padStart(3)}%  ${form}`);
  console.log(`              es. ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", …" : ""}`);
}

// Peso: quanto pesa la forma compilata rispetto alla tabella di stringhe di partenza.
const asStrings = `export default ${JSON.stringify(table, null, 2)};\n`;
const kb = (n) => `${(n / 1024).toFixed(2)} kB`;
console.log(`\nsorgente (sole stringhe) ${kb(Buffer.byteLength(asStrings))}`);
console.log(`compilato                ${kb(Buffer.byteLength(compiled))}`);
