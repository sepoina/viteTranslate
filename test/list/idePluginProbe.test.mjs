// Estensione per l'editor (idePlugin): la sonda che legge un vite.config in un processo a parte
// (probe.mjs, lanciata da runProbe.mjs). Progetti veri in una cartella temporanea, con il plugin
// importato dai sorgenti di questo repo: la risposta è quella che vedrebbe il CLI.
//
//   node test/list/idePluginProbe.test.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import runProbe from "../../idePlugin/src/probes/runProbe.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const PROBE = fileURLToPath(new URL("../../idePlugin/src/probes/probe.mjs", import.meta.url));
const PLUGIN = pathToFileURL(fileURLToPath(new URL("../../lib/dev/vite/vitetranslate.js", import.meta.url))).href;
const radice = mkdtempSync(join(tmpdir(), "vt-ideprobe-"));
const progetto = (nome, file, testo) => {
  const dir = join(radice, nome);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), testo, "utf8");
  return dir;
};
const sonda = (dir, configFile, timeoutMs) => runProbe({ dir, configFile, probePath: PROBE, timeoutMs });

console.log("\n== config valido ==");
{
  const dir = progetto("ok", "vite.config.js", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
console.log("rumore del config");
export default { server: { port: 4000, host: true }, plugins: [false, [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT", preloadedLanguages: ["en-US"] })]] };
`);
  const r = await sonda(dir, "vite.config.js");
  eq("ok", true, r.ok);
  eq("plugin appiattiti, false scartato", ["vitetranslate:compile-locale", "vitetranslate"], r.plugins);
  eq("vite.port / host", [4000, true], [r.vite.port, r.vite.host]);
  eq("sourceLanguage / localeDir", ["it-IT", "locale"], [r.vitetranslate.sourceLanguage, r.vitetranslate.localeDir]);
  eq("preloadedLanguages", ["en-US"], r.vitetranslate.preloadedLanguages);
  eq("default risolti dal plugin", ["src", true, true, false], [r.vitetranslate.srcDir, r.vitetranslate.autoSyncDev, r.vitetranslate.autoSyncBuild, r.vitetranslate.autoWrap]);
  eq("baseDir = cartella del progetto", dir, r.vitetranslate.baseDir);
  eq("stdout del config raccolto, non mescolato alla risposta", "rumore del config", r.output);
}

console.log("\n== config-funzione, plugin in una Promise, autoWrap RegExp ==");
{
  const dir = progetto("fn", "vite.config.mjs", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
export default ({ command }) => ({ plugins: [Promise.resolve(vitetranslate({ localeDir: "l", sourceLanguage: command === "build" ? "it-IT" : "en-US", autoWrap: /^(p|li)$/ }))] });
`);
  const r = await sonda(dir, "vite.config.mjs");
  eq("chiamata come il CLI: command build", "it-IT", r.vitetranslate?.sourceLanguage);
  eq("RegExp descritta, non persa", { $regexp: "/^(p|li)$/" }, r.vitetranslate?.autoWrap);
}

console.log("\n== config esportato come Promise (come lo accetta Vite, e il CLI) ==");
{
  const dir = progetto("promessa", "vite.config.mjs", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
export default Promise.resolve({ plugins: [vitetranslate({ localeDir: "l", sourceLanguage: "fr-FR" })] });
`);
  const r = await sonda(dir, "vite.config.mjs");
  eq("letto: il plugin c'è", [true, "fr-FR"], [r.ok, r.vitetranslate?.sourceLanguage]);
}

console.log("\n== plugin non registrato ==");
{
  const dir = progetto("senza", "vite.config.js", `export default { plugins: [{ name: "altro" }] };`);
  const r = await sonda(dir, "vite.config.js");
  eq("ok, vitetranslate null", [true, null, ["altro"]], [r.ok, r.vitetranslate, r.plugins]);
}

console.log("\n== errori ==");
{
  const dir = progetto("lancia", "vite.config.js", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
export default { plugins: [vitetranslate({ localeDir: "locale" })] };
`);
  const r = await sonda(dir, "vite.config.js");
  eq("opzione mancante: il messaggio del plugin", [false, true], [r.ok, /sourceLanguage/.test(r.error)]);
}
{
  const dir = progetto("manca", "vite.config.js", `import x from "pacchetto-che-non-esiste"; export default {};`);
  const r = await sonda(dir, "vite.config.js");
  eq("pacchetto mancante: code", "ERR_MODULE_NOT_FOUND", r.code);
}
{
  const dir = progetto("appeso", "vite.config.js", `setInterval(() => {}, 1000); await new Promise(() => {}); export default {};`);
  const r = await sonda(dir, "vite.config.js", 800);
  eq("config che non risponde: timeout", [false, "TIMEOUT"], [r.ok, r.code]);
}
{
  const dir = progetto("esce", "vite.config.js", `process.exit(3); export default {};`);
  const r = await sonda(dir, "vite.config.js");
  eq("config che esce da solo: NO_ANSWER", [false, "NO_ANSWER"], [r.ok, r.code]);
}

console.log("\n== vite.config.ts (solo su un Node che toglie i tipi) ==");
if (process.features.typescript) {
  const dir = progetto("ts", "vite.config.ts", `
import vitetranslate from ${JSON.stringify(PLUGIN)};
const port: number = 5000;
export default { server: { port }, plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "en-US" })] };
`);
  const r = await sonda(dir, "vite.config.ts");
  eq("letto", [true, 5000, "en-US"], [r.ok, r.vite?.port, r.vitetranslate?.sourceLanguage]);
  // Un Node che non toglie i tipi (qui spento col flag, come su un editor vecchio): l'errore dice
  // cosa fare, sulla prima riga, quella che il pannello mostra. Senza IPC la sonda risponde su stdout.
  const senza = spawnSync(process.execPath, ["--no-experimental-strip-types", PROBE, "vite.config.ts"], { cwd: dir, encoding: "utf8" });
  const risposta = JSON.parse(senza.stdout.trim().split("\n").at(-1));
  eq("Node senza type stripping: l'aiuto sulla prima riga", [false, true],
    [risposta.ok, /can't read TypeScript: update the editor, or use a vite\.config\.js\.$/.test(risposta.error.split("\n")[0])]);
} else {
  console.log("  --  saltato: questo Node non toglie i tipi");
}

console.log("\n== 20 letture di fila: la risposta non si perde mai ==");
{
  const dir = join(radice, "ok");
  const esiti = await Promise.all(Array.from({ length: 20 }, () => sonda(dir, "vite.config.js")));
  eq("20 ok su 20", 20, esiti.filter((r) => r.ok).length);
}

rmSync(radice, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
