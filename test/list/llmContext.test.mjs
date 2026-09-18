// Strato 7: contextFile.js e contextSample.js.
//
//   node test/list/llmContext.test.mjs
import { mkdtempSync, rmSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureContextDir, readContextFile, writeContextFile, replaceGeneratedRegion,
  hasGeneratedMarkers, isUnmanaged, shouldRegenerate, contextDir,
} from "../../lib/dev/llm/contextFile.js";
import contextSample, { corpusHash } from "../../lib/dev/llm/contextSample.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function localeDirTmp() {
  const dir = mkdtempSync(join(tmpdir(), "vt-ctxlocale-"));
  temporanee.push(dir);
  return dir;
}

// T43 — la regione generata si sostituisce, il resto torna byte per byte
console.log("\n== T43 sostituzione parziale ==");
{
  const localeDir = localeDirTmp();
  const first = replaceGeneratedRegion(null, "## Domain\nApp.\n", { date: "2026-01-01", keys: 10, model: "m" });
  writeContextFile(localeDir, `${first}\nA hand-written note.\n`);

  const before = readContextFile(localeDir);
  const second = replaceGeneratedRegion(before, "## Domain\nUpdated.\n", { date: "2026-01-02", keys: 20, model: "m" });
  writeContextFile(localeDir, second);
  const after = readContextFile(localeDir);

  eq("il resto del file torna identico", true, after.includes("A hand-written note."));
  eq("la regione generata è cambiata", true, after.includes("Updated.") && !after.includes("App.\n"));
}

// T44 — file senza marcatori non viene mai riscritto
console.log("\n== T44 file senza marcatori ==");
{
  const localeDir = localeDirTmp();
  writeContextFile(localeDir, "# My own notes\nNo markers here.\n");
  const text = readContextFile(localeDir);
  eq("isUnmanaged true", true, isUnmanaged(text));
  eq("shouldRegenerate non scatta mai su un file non gestito", false, shouldRegenerate({ mode: "auto", existingText: text, keysNow: 99999, refreshEvery: 1 }));
}

// T45/T46 — campione deterministico e stratificato
console.log("\n== T45/T46 campione ==");
{
  const entries = [];
  for (const c of ["Alpha", "Beta", "Gamma"]) for (let i = 0; i < 5; i++) entries.push({ key: `${c}_x${i}`, text: `${c} ${i}` });

  const s1 = contextSample(entries, 3);
  eq("T46 uno per componente distinto con sample:3", ["Alpha_x0", "Beta_x0", "Gamma_x0"], s1.map((e) => e.key));

  const s2a = contextSample(entries, 6);
  const s2b = contextSample([...entries].reverse(), 6);
  eq("T45 deterministico su ordini diversi", s2a, s2b);
}

// T47 — rigenerazione automatica: file assente, +refreshEvery, +25%, mai due volte nello stesso giro
console.log("\n== T47 shouldRegenerate ==");
eq("file assente", true, shouldRegenerate({ mode: "auto", existingText: null, keysNow: 5, refreshEvery: 40 }));
{
  const text = replaceGeneratedRegion(null, "## Domain\n", { date: "x", keys: 1, model: "m" });
  eq("+refreshEvery scatta", true, shouldRegenerate({ mode: "auto", existingText: text, keysNow: 250, keysAtGeneration: 200, refreshEvery: 40 }));
  eq("+25% scatta (refreshEvery troppo alto per scattare da solo)", true, shouldRegenerate({ mode: "auto", existingText: text, keysNow: 1260, keysAtGeneration: 1000, refreshEvery: 400 }));
  eq("non ancora -> non scatta", false, shouldRegenerate({ mode: "auto", existingText: text, keysNow: 205, keysAtGeneration: 200, refreshEvery: 40 }));
}
// "mai due volte nella stessa esecuzione" è responsabilità del chiamante (translatePass, che
// valuta la decisione una sola volta per run): qui si verifica solo che la funzione sia pura
// e stabile su input identici.
{
  const text = replaceGeneratedRegion(null, "## Domain\n", { date: "x", keys: 1, model: "m" });
  const args = { mode: "auto", existingText: text, keysNow: 250, keysAtGeneration: 200, refreshEvery: 40 };
  eq("stessa chiamata due volte -> stesso esito (pura)", shouldRegenerate(args), shouldRegenerate(args));
}

// T48 — mode "off" non rigenera ma usa il file esistente
console.log("\n== T48 mode off ==");
eq("off non rigenera mai", false, shouldRegenerate({ mode: "off", existingText: null, keysNow: 99999, refreshEvery: 1 }));
{
  const localeDir = localeDirTmp();
  const text = replaceGeneratedRegion(null, "## Domain\nStable.\n", { date: "x", keys: 1, model: "m" });
  writeContextFile(localeDir, text);
  eq("il file esistente resta leggibile", true, readContextFile(localeDir).includes("Stable."));
}

// T49 — .gitignore creato alla prima volta, mai ricreato se cancellato
console.log("\n== T49 .gitignore ==");
{
  const localeDir = localeDirTmp();
  ensureContextDir(localeDir);
  const gitignorePath = join(contextDir(localeDir), ".gitignore");
  eq("creato la prima volta", true, existsSync(gitignorePath));
  eq("contiene runs.log", true, readFileSync(gitignorePath, "utf8").includes("runs.log"));

  unlinkSync(gitignorePath);
  ensureContextDir(localeDir); // seconda chiamata, cartella già esistente
  eq("non ricreato se cancellato", false, existsSync(gitignorePath));
}

// corpusHash stabile e indipendente dall'ordine
console.log("\n== corpusHash ==");
{
  const entries = [{ key: "B_1", text: "b" }, { key: "A_1", text: "a" }];
  eq("stabile su ordini diversi", corpusHash(entries), corpusHash([...entries].reverse()));
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
