// Le forme di vite.config che Vite accetta e che il CLI deve leggere come lui: un oggetto, una
// funzione, una Promise; plugin annidati, falsi o dentro una Promise (resolveViteConfig.js, usato da
// loadConfig.js). La sonda dell'estensione ne ha una copia, provata sulle stesse forme in
// idePluginProbe.test.mjs. Progetti veri in una cartella temporanea, con il plugin importato dai
// sorgenti di questo repo.
//
//   node test/list/loadConfigShapes.test.mjs
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import loadConfig from "../../lib/dev/vite/uty/loadConfig.js";
import { resolveUserConfig, flattenPlugins, CONFIG_ENV } from "../../lib/dev/vite/uty/resolveViteConfig.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

console.log("\n== resolveUserConfig ==");
eq("un oggetto: com'è", { a: 1 }, await resolveUserConfig({ a: 1 }));
eq("una Promise: attesa", { a: 2 }, await resolveUserConfig(Promise.resolve({ a: 2 })));
eq("una funzione: chiamata con l'ambiente di vite build", CONFIG_ENV, await resolveUserConfig((env) => env));
eq("una funzione async: attesa", "production", await resolveUserConfig(async ({ mode }) => mode));

console.log("\n== flattenPlugins ==");
const p = (name) => ({ name });
eq("annidati, falsi scartati", ["a", "b", "c"], (await flattenPlugins([p("a"), false, [null, [p("b")], undefined], p("c")])).map((x) => x.name));
eq("Promise a ogni livello, anche di un array", ["a", "b", "c"],
  (await flattenPlugins([Promise.resolve(p("a")), Promise.resolve([p("b"), Promise.resolve([p("c")])])])).map((x) => x.name));
eq("niente plugins: vuoto", [], await flattenPlugins(undefined));

console.log("\n== loadConfig: le stesse forme, dal file ==");
const PLUGIN = pathToFileURL(fileURLToPath(new URL("../../lib/dev/vite/vitetranslate.js", import.meta.url))).href;
const radice = mkdtempSync(join(tmpdir(), "vt-loadconfig-"));
const cwd0 = process.cwd();
const leggi = async (nome, testo) => {
  const dir = join(radice, nome);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "vite.config.mjs"), `import vitetranslate from ${JSON.stringify(PLUGIN)};\n${testo}\n`, "utf8");
  process.chdir(dir);
  try {
    return (await loadConfig()).sourceLanguage;
  } catch (error) {
    return `errore: ${error.message.split("\n")[0]}`;
  } finally {
    process.chdir(cwd0);
  }
};
const opzioni = `{ localeDir: "locale", sourceLanguage: "it-IT" }`;
try {
  eq("oggetto", "it-IT", await leggi("oggetto", `export default { plugins: [vitetranslate(${opzioni})] };`));
  eq("funzione", "it-IT", await leggi("funzione", `export default () => ({ plugins: [vitetranslate(${opzioni})] });`));
  eq("Promise", "it-IT", await leggi("promise", `export default Promise.resolve({ plugins: [vitetranslate(${opzioni})] });`));
  eq("plugin in una Promise", "it-IT", await leggi("pluginPromise", `export default { plugins: [false, Promise.resolve(vitetranslate(${opzioni}))] };`));
  eq("plugin assente: il messaggio di sempre", true,
    /vitetranslate was not found among the "plugins"/.test(await leggi("assente", `export default { plugins: [] };`)));
} finally {
  rmSync(radice, { recursive: true, force: true });
}

if (fail) console.log(`\n${fail} KO`);
process.exit(fail ? 1 : 0);
