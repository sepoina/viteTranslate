// Fonte di verità per il peso che README.md promette: il runtime React (lib/react) più gli
// helper ICU (lib/icu/runtime.js), misurati come farebbe test/list/reactBundleSize.test.mjs —
// vedi test/measureReactBundle.mjs per cosa si misura, perché è un limite "al massimo" e come
// si scrivono le cifre nei documenti (sizeLabels).
//
// Non è un test: non fa parte della suite (test/run.mjs scopre solo test/list/*.test.mjs).
// Riscrive site/runtimeSize.json (le cifre del sito) e confronta README.md: in chiusura di ogni
// bundle di release, a ogni revisione di versione (regola di AGENTS.md), non solo "se cambia".
//
//   npm run estimateSize
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { measureRuntime, sizeLabels, expectedReadme } from "./measureReactBundle.mjs";
import { syncTheme } from "../site/syncTheme.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KB = 1024;
const asKB = (bytes) => `${(bytes / KB).toFixed(2)} kB`;

const { react, icu, gzip } = await measureRuntime();
const { real, compare } = sizeLabels(gzip);

console.log(`
viteTranslate — runtime size (minified, gzip)

  React runtime   ${react.gzip} B
  ICU helpers     ${icu.gzip} B   (only in apps whose tables use ICU)
  total           ${gzip} B   (${asKB(gzip)})

Docs: write "${real}" (real weight, rounded down) and "${compare}" in comparisons.
`);

const runtimeSizePath = join(ROOT, "site/runtimeSize.json");
const nextJson = JSON.stringify({ gzipBytes: gzip, real, compare }, null, 2) + "\n";
const prevJson = (() => {
  try {
    return readFileSync(runtimeSizePath, "utf8");
  } catch {
    return null;
  }
})();
if (prevJson !== nextJson) {
  writeFileSync(runtimeSizePath, nextJson);
  console.log("site/runtimeSize.json: updated");
} else {
  console.log("site/runtimeSize.json: unchanged");
}

// Le pagine leggono la loro copia (src/theme/runtimeSize.json): si riallineano subito.
syncTheme();
console.log("site/theme: copies updated");

const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const expected = expectedReadme(gzip);
const problems = [];
for (const s of [...expected.rounded, expected.exact]) {
  if (!readme.includes(s)) problems.push(`missing "${s}"`);
}
const forbiddenMatch = readme.match(expected.forbidden);
if (forbiddenMatch) problems.push(`forbidden phrasing found: "${forbiddenMatch[0]}"`);

if (problems.length === 0) {
  console.log("README: OK");
} else {
  console.log("README: update —");
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
