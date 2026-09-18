// Strato 9b: debugTrace.js — il registro di --llm-debug.
//
//   node test/list/llmDebug.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import createDebugTrace, { debugStamp, listDebugTraces } from "../../lib/dev/llm/debugTrace.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function localeTemp() {
  const baseDir = mkdtempSync(join(tmpdir(), "vt-debug-"));
  temporanee.push(baseDir);
  const localeDir = join(baseDir, "locale");
  mkdirSync(localeDir, { recursive: true });
  return localeDir;
}

// T1 — debugStamp: mese da 0!
console.log("\n== T1 debugStamp ==");
eq("2026-09-18 15:41:07 -> 260918154107", "260918154107", debugStamp(new Date(2026, 8, 18, 15, 41, 7)));

// T2 — trace mai scritta: nessuna cartella
console.log("\n== T2 trace mai scritta ==");
{
  const localeDir = localeTemp();
  const debug = createDebugTrace({ localeDir, now: new Date(2026, 8, 18, 15, 41, 7) });
  eq("dir === null prima di ogni write", null, debug.dir);
  eq("nessuna cartella .llm su disco", false, existsSync(join(localeDir, ".llm")));
}

// T3 — prima write: nasce .llm/.gitignore, .llm/<stamp>/.gitignore, 001-run.json
console.log("\n== T3 prima write ==");
{
  const localeDir = localeTemp();
  const now = new Date(2026, 8, 18, 15, 41, 7);
  const debug = createDebugTrace({ localeDir, now });
  debug.write("run", { a: 1 });

  eq(".llm/.gitignore esiste", true, existsSync(join(localeDir, ".llm", ".gitignore")));
  eq(".llm/.gitignore contiene runs.log", true, readFileSync(join(localeDir, ".llm", ".gitignore"), "utf8").includes("runs.log"));
  eq("cartella .llm/<stamp> esiste", true, existsSync(join(localeDir, ".llm", "260918154107")));
  eq(".llm/<stamp>/.gitignore è *", "*\n", readFileSync(join(localeDir, ".llm", "260918154107", ".gitignore"), "utf8"));
  const fileText = readFileSync(join(localeDir, ".llm", "260918154107", "001-run.json"), "utf8");
  eq("001-run.json ha JSON indentato", { a: 1 }, JSON.parse(fileText));
  eq("indentato a 2 spazi", true, fileText.includes("\n  \"a\""));

  // T3b — write("note", "testo") -> 002-note.txt
  debug.write("note", "testo");
  eq("002-note.txt esiste", "testo", readFileSync(join(localeDir, ".llm", "260918154107", "002-note.txt"), "utf8"));
}

// T4 — setSecret + redact
console.log("\n== T4 redazione della chiave ==");
{
  const localeDir = localeTemp();
  const debug = createDebugTrace({ localeDir });
  debug.setSecret("sk-SEGRETO");
  debug.write("x", { h: "Bearer sk-SEGRETO" });
  const text = readFileSync(join(debug.dir, "001-x.json"), "utf8");
  eq("la chiave non compare", false, text.includes("sk-SEGRETO"));
  eq("compare «redacted»", true, text.includes("«redacted»"));
}

// T5 — due trace con lo stesso `now` -> seconda cartella <stamp>-2
console.log("\n== T5 collisione di timestamp ==");
{
  const localeDir = localeTemp();
  const now = new Date(2026, 8, 18, 15, 41, 7);
  const debug1 = createDebugTrace({ localeDir, now });
  debug1.write("run", {});
  const debug2 = createDebugTrace({ localeDir, now });
  debug2.write("run", {});
  eq("prima cartella senza suffisso", "260918154107", debug1.dir.split("/").pop());
  eq("seconda cartella con -2", "260918154107-2", debug2.dir.split("/").pop());
}

// T6 — Infinity nel dato -> "Infinity" nel file
console.log("\n== T6 Infinity ==");
{
  const localeDir = localeTemp();
  const debug = createDebugTrace({ localeDir });
  debug.write("x", { budget: Infinity });
  const text = readFileSync(join(debug.dir, "001-x.json"), "utf8");
  eq("Infinity diventa stringa", true, text.includes('"Infinity"'));
}

// T7 — localeDir che è un file: write non lancia, dir resta null
console.log("\n== T7 localeDir è un file ==");
{
  const baseDir = mkdtempSync(join(tmpdir(), "vt-debug-"));
  temporanee.push(baseDir);
  const fakeLocaleDir = join(baseDir, "locale-as-file");
  writeFileSync(fakeLocaleDir, "not a directory");
  const debug = createDebugTrace({ localeDir: fakeLocaleDir });
  let threw = false;
  try {
    debug.write("run", { a: 1 });
  } catch { threw = true; }
  eq("write non lancia", false, threw);
  eq("dir resta null", null, debug.dir);
  debug.write("another", { b: 2 }); // spenta: non deve lanciare né scrivere niente
  eq("dir resta null anche dopo la seconda write", null, debug.dir);
}

// T8 — listDebugTraces: ordinate, ignora context.md/runs.log/una cartella qualunque
console.log("\n== T8 listDebugTraces ==");
{
  const localeDir = localeTemp();
  mkdirSync(join(localeDir, ".llm"), { recursive: true });
  writeFileSync(join(localeDir, ".llm", "context.md"), "# ciao");
  writeFileSync(join(localeDir, ".llm", "runs.log"), "");
  mkdirSync(join(localeDir, ".llm", "pippo"));
  mkdirSync(join(localeDir, ".llm", "260918154107"));
  mkdirSync(join(localeDir, ".llm", "260918160000"));
  eq("solo le due cartelle di trace, ordinate", ["260918154107", "260918160000"], listDebugTraces(localeDir));
  eq("cartella .llm assente -> []", [], listDebugTraces(join(localeDir, "nonexistent")));
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
