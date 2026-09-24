// Guardia di regressione byte-per-byte sul compilatore (piano 4.6.3): dimostra che un testo
// senza innesco ICU compila esattamente come prima della 4.6.3. Non un test (`test/run.mjs`
// scopre solo `test/list/*.test.mjs`): uno strumento, usato sia a mano (`--write`) sia dal
// test che lo importa (`test/list/compileGolden.test.mjs`).
//
//   node test/compileGolden.mjs --write   # rigenera test/list/compileGolden.json
//   node test/compileGolden.mjs           # stampa le differenze rispetto al file salvato
//
// Rigenerarlo è lecito SOLO per un cambiamento voluto della compilazione, dichiarato nel piano
// che lo introduce — mai per far sparire un fallimento che non si è capito.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { compileLanguageModule } from "../lib/dev/compile/compileTable.js";
import readLanguageFile from "../lib/dev/vite/uty/readLanguageFile.js";
import { isLanguageFileName, tagFromFileName } from "../lib/dev/vite/uty/languageFileFormat.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = join(ROOT, "test/list/compileGolden.json");

// Le sei cartelle di riferimento. Non llmRestaurant: la 1.16 del piano la modifica apposta.
const FOLDERS = [
  "site/pages/playground/locale",
  "site/pages/playEdge/locale",
  "site/landing/locale",
  "demo/Vite_8/minimal/locale",
  "demo/Vite_7/minimal/locale",
  "demo/Vite_8/llmTranslate/locale",
];

// Il blocco dell'helper `_arg` cambia di proposito in 4.6.3 (vedi il piano 4_6_3.md, "`_arg` cambia"):
// si confronta tutto il resto. Il blocco va dalla riga "const _m = " alla prima riga "}" dopo
// "function _arg(". Le sue semantiche le verifica namedArgs.test.mjs, caso per caso.
export function stripArgHelper(code) {
  const lines = code.split("\n");
  const start = lines.findIndex((l) => l.startsWith("const _m = "));
  if (start === -1) return code;
  const fn = lines.findIndex((l, i) => i > start && l.startsWith("function _arg("));
  const end = lines.findIndex((l, i) => i > fn && l === "}");
  lines.splice(start, end - start + 1, "/* _arg helper */");
  return lines.join("\n");
}

export async function computeGolden() {
  const hashes = {};
  for (const folder of FOLDERS) {
    const dirAbs = join(ROOT, folder);
    let files;
    try {
      files = readdirSync(dirAbs);
    } catch {
      continue;
    }
    const langFiles = files.filter(isLanguageFileName);
    const sourcePath = join(dirAbs, "it-IT.yml");
    const { table: sourceTable } = readLanguageFile(sourcePath);
    for (const file of langFiles) {
      const tag = tagFromFileName(file);
      const filePath = join(dirAbs, file);
      const { table } = readLanguageFile(filePath);
      const code = compileLanguageModule(table, tag, tag === "it-IT" ? null : sourceTable, {
        emitUntranslated: tag !== "it-IT",
      });
      const relPath = relative(ROOT, filePath).split("\\").join("/");
      hashes[relPath] = createHash("sha256").update(stripArgHelper(code)).digest("hex");
    }
  }
  const sorted = {};
  for (const key of Object.keys(hashes).sort((a, b) => a.localeCompare(b, "en"))) {
    sorted[key] = hashes[key];
  }
  return sorted;
}

async function main() {
  const write = process.argv.includes("--write");
  const golden = await computeGolden();
  if (write) {
    writeFileSync(OUT_FILE, JSON.stringify(golden, null, 2) + "\n");
    console.log(`compileGolden.mjs: wrote ${Object.keys(golden).length} hash(es) to test/list/compileGolden.json`);
    return;
  }
  let saved;
  try {
    saved = JSON.parse(readFileSync(OUT_FILE, "utf8"));
  } catch {
    console.log("compileGolden.mjs: test/list/compileGolden.json is missing, run with --write first");
    process.exitCode = 1;
    return;
  }
  const keys = new Set([...Object.keys(saved), ...Object.keys(golden)]);
  let diffs = 0;
  for (const key of keys) {
    if (saved[key] !== golden[key]) {
      diffs++;
      console.log(`  DIFF  ${key}`);
      console.log(`        saved:    ${saved[key] ?? "(missing)"}`);
      console.log(`        computed: ${golden[key] ?? "(missing)"}`);
    }
  }
  console.log(diffs === 0 ? "compileGolden.mjs: nessuna differenza" : `compileGolden.mjs: ${diffs} differenza/e`);
  if (diffs > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
