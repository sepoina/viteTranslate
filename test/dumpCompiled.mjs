// Scrive su file il modulo di lingua così come lo riceve il bundler, cioè il risultato del
// transform su localeDir, e classifica ogni chiave nella forma in cui è stata compilata.
// Serve a ispezionare a occhio cosa finisce davvero nel bundle, senza doverlo estrarre da un
// chunk minificato.
//
//   node test/dumpCompiled.mjs [tag] [localeDir]
//
// Default: en-US dalla cartella locale del playground. L'output va in test/<tag>.compiled.js
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const { compileLanguageModule, compileEntry } = await import(`${ROOT}/lib/dev/compile/compileTable.js`);
const { default: importLanguageModule } = await import(`${ROOT}/lib/dev/vite/uty/importLanguageModule.js`);

const tag = process.argv[2] ?? "en-US";
const localeDir = process.argv[3] ?? join(ROOT, "playground/src/locale");
const sourcePath = join(localeDir, `${tag}.js`);

const table = await importLanguageModule(sourcePath);
const compiled = compileLanguageModule(table, tag);

const outPath = join(HERE, `${tag}.compiled.js`);
mkdirSync(HERE, { recursive: true });
writeFileSync(outPath, compiled, "utf8");

// --- classificazione ---

// Rifà la compilazione voce per voce per capire in quale delle quattro forme è finita.
// `compileEntry` è la stessa funzione usata dal modulo intero, quindi la classificazione non
// può divergere da ciò che è stato scritto sul file.
function classify(value) {
  if (typeof value !== "string") return value === null ? "chiave non tradotta" : "metadati";
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
  const form = classify(value);
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
