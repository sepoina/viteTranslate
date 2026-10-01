// L'indice delle voci per l'estensione dell'editor: <baseDir>/node_modules/.viteTranslate/markers.json
// (lib/dev/vite/uty/markerIndex.js). Lo scrive la sync, dal CLI vero: dove sta ogni voce, in che
// forma, gli avvisi di ogni file, e [mtimeMs, size] di ogni file letto. Un file che non si parsa
// manca dall'indice ma l'indice c'è (a differenza di scan.json); --status non scrive niente.
//
//   node test/list/markerIndex.test.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readMarkerIndex, markerIndexPath, autoWrapKey, writeMarkerIndex } from "../../lib/dev/vite/uty/markerIndex.js";
import { scanPath } from "../../lib/dev/vite/uty/scanRecord.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(resolve(HERE, "../.."), "lib/dev/vite/cli.js");
const PLUGIN = pathToFileURL(join(resolve(HERE, "../.."), "lib/index.js")).href;
const temporanee = [];

function progetto(opzioni = '{ localeDir: "locale", sourceLanguage: "it-IT" }') {
  const radice = mkdtempSync(join(tmpdir(), "vt-markerindex-"));
  temporanee.push(radice);
  mkdirSync(join(radice, "node_modules"));
  mkdirSync(join(radice, "src"));
  writeFileSync(join(radice, "package.json"), '{ "type": "module" }');
  writeFileSync(join(radice, "vite.config.mjs"),
    `import { vitetranslate } from ${JSON.stringify(PLUGIN)};\n` +
    `export default { plugins: [vitetranslate(${opzioni})] };\n`);
  return radice;
}
const lancia = (radice, argv = []) => spawnSync(process.execPath, [CLI, ...argv], { cwd: radice, encoding: "utf8" });

console.log("\n== la sync scrive l'indice ==");
{
  const radice = progetto();
  writeFileSync(join(radice, "src", "App.jsx"), 'export const App = () => (\n  <p title="_%_Titolo_%_">_%_Ciao_%_</p>\n);\n');
  writeFileSync(join(radice, "src", "code.js"), 'export const s = "_%_Stringa_%_";\nexport const m = "_%_spaiato";\n');
  writeFileSync(join(radice, "src", "plain.js"), "export const nulla = 1;\n");
  eq("sync riuscita", 0, lancia(radice).status);
  const indice = readMarkerIndex(radice);
  eq("c'è, dove dice markerIndexPath", true, existsSync(markerIndexPath(radice)));
  eq("config come scritta, autoWrap come chiave", ["src", "locale", false], [indice?.srcDir, indice?.localeDir, indice?.autoWrap]);
  eq("pkgVersion e schema", [true, 1], [typeof indice?.pkgVersion === "string" && indice.pkgVersion.length > 0, indice?.version]);
  eq("files: ogni file letto, marcato o no", ["src/App.jsx", "src/code.js", "src/plain.js"], Object.keys(indice?.files ?? {}).sort());
  const st = statSync(join(radice, "src", "plain.js"));
  eq("…con [mtimeMs, size]", [st.mtimeMs, st.size], indice?.files["src/plain.js"]);
  eq("marked: solo i file con marcatori", ["src/App.jsx", "src/code.js"], Object.keys(indice?.marked ?? {}).sort());
  eq("le voci: testo, riga, colonna, forma", [["Titolo", 2, 12, "attribute"], ["Ciao", 2, 27, "jsxText"]],
    indice?.marked["src/App.jsx"].entries.map((e) => [e.text, e.line, e.column, e.form]));
  eq("…con l'id della tabella", true, /^App_/.test(indice?.marked["src/App.jsx"].entries[0].id));
  eq("gli avvisi del file, col tipo", ["malformed"], indice?.marked["src/code.js"].warnings.map((w) => w.kind));
  eq("hash del contenuto", "number", typeof indice?.marked["src/App.jsx"].hash);
}

console.log("\n== un file che non si parsa: manca, l'indice resta ==");
{
  const radice = progetto();
  writeFileSync(join(radice, "src", "Good.jsx"), 'export const g = "_%_buono_%_";\n');
  writeFileSync(join(radice, "src", "Bad.jsx"), 'const x = "_%_ciao_%_" +;\n');
  lancia(radice);
  const indice = readMarkerIndex(radice);
  eq("scan.json tolto (sync incompleta)", false, existsSync(scanPath(radice)));
  eq("l'indice c'è lo stesso", true, !!indice);
  eq("…senza il file rotto, né in files né in marked", [["src/Good.jsx"], ["src/Good.jsx"]], [Object.keys(indice?.files ?? {}), Object.keys(indice?.marked ?? {})]);
}

console.log("\n== --status non scrive, autoWrap come RegExp ==");
{
  const radice = progetto('{ localeDir: "locale", sourceLanguage: "it-IT", autoWrap: /^p$/i }');
  writeFileSync(join(radice, "src", "App.jsx"), "export const App = () => <p>_%_Ciao_%_</p>;\n");
  lancia(radice, ["--status"]);
  eq("--status: nessun indice", false, existsSync(markerIndexPath(radice)));
  lancia(radice);
  eq("autoWrap RegExp: la sua forma testuale", "/^p$/i", readMarkerIndex(radice)?.autoWrap);
  eq("autoWrapKey", [false, true, false, "/a/g"], [autoWrapKey(false), autoWrapKey(true), autoWrapKey("x"), autoWrapKey(/a/g)]);
}

console.log("\n== lettura e scrittura sicure ==");
{
  const radice = mkdtempSync(join(tmpdir(), "vt-markerindex-"));
  temporanee.push(radice);
  writeMarkerIndex(radice, { srcDir: "src", localeDir: "locale", autoWrap: false, files: {}, marked: {} });
  eq("senza node_modules: niente scritto", false, existsSync(markerIndexPath(radice)));
  mkdirSync(join(radice, "node_modules", ".viteTranslate"), { recursive: true });
  writeFileSync(markerIndexPath(radice), "{ rotto");
  eq("JSON rotto: nessun indice, nessun errore", null, readMarkerIndex(radice));
  writeFileSync(markerIndexPath(radice), JSON.stringify({ version: 99 }));
  eq("schema sconosciuto: nessun indice", null, readMarkerIndex(radice));
}

for (const d of temporanee) rmSync(d, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
