// Estensione per l'editor (idePlugin): dalle letture alle righe del pannello (summarize.mjs).
// Dati scritti a mano nella forma che producono readPackage.mjs e la sonda: qui si guarda solo
// cosa diventa ogni caso — valori, "default", errori, Restricted Mode.
//
//   node test/list/idePluginSummary.test.mjs
import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { projectRow, projectChildren, tablesRow, relativeLabel, errorLine } from "../../idePlugin/src/summarize.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
// La descrizione della riga `label` fra `righe`.
const desc = (righe, label) => righe.find((r) => r.label === label)?.description;

const ROOT = join("/", "ws");
const project = { dir: join(ROOT, "site", "app"), configFile: "vite.config.js" };
const pkg = {
  ok: true,
  name: "app",
  version: "1.0.0",
  scripts: { dev: "vite", build: "vite build" },
  deps: [
    { name: "@sepoina/vitetranslate", wanted: "^4.6.4", installed: "4.6.4" },
    { name: "vite", wanted: "^8.1.0", installed: null },
    { name: "@babel/core", wanted: null, installed: "7.29.7" },
  ],
};
const probe = {
  ok: true,
  ms: 250,
  plugins: ["vite:react-babel", "vitetranslate:compile-locale", "vitetranslate"],
  vite: { port: 3003, host: true },
  vitetranslate: {
    localeDir: "locale",
    sourceLanguage: "it-IT",
    autoWrap: { $regexp: "/^p$/" },
    baseDir: project.dir,
    srcDir: "src",
    simpleLog: false,
    autoSyncDev: true,
    autoSyncBuild: false,
    llm: {
      connection: { baseURL: "https://api.deepseek.com", model: "deepseek-flash", apiKeyEnv: "KEY", costMillionInput: 0.6, costMillionOutput: 1.2, costUnity: "$", modelClass: { name: "standard" } },
      budget: { maxCostPerRun: 1, maxCostPerDay: 5, preset: "normal" },
      context: { mode: "auto" },
    },
  },
};

console.log("\n== riga del progetto ==");
eq("relativeLabel", join("site", "app"), relativeLabel(project.dir, [ROOT]));
eq("relativeLabel della radice", ".", relativeLabel(ROOT, [ROOT]));
eq("relativeLabel fuori dal workspace", "/altrove", relativeLabel("/altrove", [ROOT]));
{
  const r = projectRow(project, { roots: [ROOT], name: "my-app" });
  eq("label = name del package.json", "my-app", r.label);
  eq("description = cartella", join("site", "app"), r.description);
  eq("niente segno né figli", [undefined, undefined], [r.mark, r.children]);
  eq("senza name: il nome della cartella", "app", projectRow(project, { roots: [ROOT], name: null }).label);
  eq("radice: niente '.'", "workspace root", projectRow({ dir: ROOT, configFile: "vite.config.js" }, { roots: [ROOT] }).description);
}

console.log("\n== figli: ordine ==");
const figli = projectChildren({ project, pkg, probe });
eq("yml tables, vitetranslate, package.json, vite.config.js", ["yml tables", "vitetranslate", "package.json", "vite.config.js"], figli.map((r) => r.label));
eq("al primo disegno chiuse vitetranslate, package.json e vite.config (si apre solo yml tables)", [undefined, undefined, undefined], figli.slice(1).map((r) => r.expanded));

console.log("\n== yml tables ==");
{
  const dir = mkdtempSync(join(tmpdir(), "vt-idetables-"));
  const conLocale = { ...probe, vitetranslate: { ...probe.vitetranslate, baseDir: dir, localeDir: "locale", sourceLanguage: "it-IT" } };
  eq("cartella che non c'è: lo dice", ["yml tables", "locale/ not found", "warning"], ((r) => [r.label, r.description, r.icon])(tablesRow(conLocale, dir)));
  mkdirSync(join(dir, "locale"));
  eq("cartella vuota: niente lingue", "none in locale/", tablesRow(conLocale, dir).description);
  for (const f of ["zh-CN.yml", "en-US.yml", "it-IT.yml", "note.txt"]) writeFileSync(join(dir, "locale", f), "");
  const tre = tablesRow(conLocale, dir).description;
  writeFileSync(join(dir, "locale", "fr.yml"), "");
  eq("una lingua in più: si vede al disegno dopo", ["3 languages", "4 languages"], [tre, tablesRow(conLocale, dir).description]);
  mkdirSync(join(dir, "locale", ".llm"));
  const t = tablesRow(conLocale, dir);
  eq("il numero di lingue, aperta", ["4 languages", true], [t.description, t.expanded]);
  eq("la sorgente prima, poi le altre in ordine; solo i .yml", ["it-IT", "en-US", "fr", "zh-CN"], t.children.map((r) => r.label));
  eq("codice e nome della lingua nella lingua stessa", ["italiano (Italia) · source", "American English"], t.children.slice(0, 2).map((r) => r.description));
  eq("clic: apre il file", join(dir, "locale", "it-IT.yml"), t.children[0].open);
  eq("senza scansione: verde la sorgente (la dice il vite.config), le altre neutre, niente badge", [["testing.iconPassed"], []],
    [t.children.map((r) => r.iconColor).filter(Boolean), t.children.map((r) => r.badge).filter(Boolean)]);
  const stats = { "it-IT": { keys: 120, missing: 0 }, "en-US": { keys: 120, missing: 12 }, "zh-CN": { keys: 120, missing: 0 }, fr: { error: "bad indentation (line 3)" } };
  const [it, en, fr, zh] = tablesRow(conLocale, dir, stats).children;
  eq("sorgente verde, senza badge", ["it-IT", "testing.iconPassed", undefined], [it?.label, it?.iconColor, it?.badge]);
  eq("…col numero di voci nel tooltip", true, /source language · 120 entries$/.test(it?.tooltip));
  eq("mancano traduzioni: gialla, badge col numero", ["problemsWarningIcon.foreground", { text: "12", tooltip: "12 missing" }], [en?.iconColor, en?.badge]);
  eq("…e il tooltip dice di quante", true, /12 of 120 entries missing$/.test(en?.tooltip));
  eq("illeggibile: rossa, niente badge, il perché nel tooltip", ["problemsErrorIcon.foreground", undefined, true], [fr?.iconColor, fr?.badge, /cannot be read: bad indentation/.test(fr?.tooltip)]);
  eq("completa: colore normale, niente badge", [undefined, undefined, true], [zh?.iconColor, zh?.badge, /complete$/.test(zh?.tooltip)]);
  eq("oltre 99 mancanti: il badge resta di due caratteri", "99", tablesRow(conLocale, dir, { ...stats, "en-US": { keys: 500, missing: 345 } }).children[1].badge.text);

  const conBase = { ...probe, vitetranslate: { ...probe.vitetranslate, baseDir: join(dir, ".."), localeDir: join(dir.split("/").at(-1), "locale") } };
  eq("baseDir assoluto: localeDir sotto di lui", "4 languages", tablesRow(conBase, dir).description);
  eq("vite.config non letto o plugin assente", ["unknown: vite.config not read", "not registered in vite.config"],
    [tablesRow({ ok: false, untrusted: true }, dir).description, tablesRow({ ok: true, vitetranslate: null }, dir).description]);
  rmSync(dir, { recursive: true, force: true });
}

console.log("\n== vitetranslate ==");
{
  const vt = figli[1];
  eq("description", "it-IT → locale/", vt.description);
  eq("sourceLanguage", "it-IT", desc(vt.children, "sourceLanguage"));
  eq("preloadedLanguages assente → default", "none · default", desc(vt.children, "preloadedLanguages"));
  eq("srcDir src → default", "src · default", desc(vt.children, "srcDir"));
  eq("baseDir = progetto → default", ". · default", desc(vt.children, "baseDir"));
  eq("autoSyncDev acceso → default", "on · default", desc(vt.children, "autoSyncDev"));
  eq("autoSyncBuild spento", "off", desc(vt.children, "autoSyncBuild"));
  eq("includeFallback assente", "dev only · default", desc(vt.children, "includeFallback"));
  eq("autoWrap RegExp", "/^p$/", desc(vt.children, "autoWrap"));
  eq("icu.timeZone assente", "runtime · default", desc(vt.children, "icu.timeZone"));
  eq("errorSolve assente", "built-in · default", desc(vt.children, "errorSolve"));
  const llm = vt.children.find((r) => r.label === "llm");
  eq("llm: modello @ host", "deepseek-flash @ api.deepseek.com", llm.description);
  eq("llm: solo il nome della variabile", "KEY", desc(llm.children, "apiKeyEnv"));
  eq("llm: prezzo", "$0.6 in · $1.2 out, per 1M tokens", desc(llm.children, "price"));
  eq("llm: budget", "normal", desc(llm.children, "budget"));
}
{
  const senzaLlm = projectChildren({ project, pkg, probe: { ...probe, vitetranslate: { ...probe.vitetranslate, llm: null } } })[1];
  eq("llm null", "not configured", desc(senzaLlm.children, "llm"));
  const nonRegistrato = projectChildren({ project, pkg, probe: { ...probe, vitetranslate: null } })[1];
  eq("plugin non registrato", ["not registered in vite.config", "warning"], [nonRegistrato.description, nonRegistrato.icon]);
}

console.log("\n== package.json ==");
{
  const p = figli[2];
  eq("description", "app 1.0.0", p.description);
  eq("dichiarata e installata", "^4.6.4 → 4.6.4", desc(p.children, "@sepoina/vitetranslate"));
  eq("dichiarata, non installata: avviso", ["^8.1.0 → not installed", "warning"], [desc(p.children, "vite"), p.children.find((r) => r.label === "vite").icon]);
  eq("installata, non dichiarata", "not declared → 7.29.7", desc(p.children, "@babel/core"));
  eq("scripts", "dev · build", desc(p.children, "scripts"));
  eq("clic apre il file", join(project.dir, "package.json"), p.open);
  const manca = projectChildren({ project, pkg: { ok: false, missing: true, error: "no package.json next to vite.config" }, probe })[2];
  eq("package.json assente: niente da aprire", [undefined, "warning"], [manca.open, manca.icon]);
}

console.log("\n== vite.config ==");
{
  const c = figli[3];
  eq("description", "3 plugins", c.description);
  eq("server", "port 3003 · host true", desc(c.children, "server"));
  eq("clic apre il config", join(project.dir, "vite.config.js"), c.open);
}
{
  const [, vt, , c] = projectChildren({ project, pkg, probe: { ok: false, untrusted: true } });
  eq("Restricted Mode: config non eseguito", ["not executed: Restricted Mode", "shield"], [c.description, c.icon]);
  eq("Restricted Mode: vitetranslate sconosciuto", "unknown: vite.config not read", vt.description);
}
{
  const errore = { ok: false, code: "ERR_MODULE_NOT_FOUND", error: "Cannot find package 'vite' imported from /ws/site/app/vite.config.js", output: "" };
  eq("pacchetto mancante: frase utile", 'needs "vite": not installed', errorLine(errore));
  eq("altro errore: prima riga", "boom", errorLine({ ok: false, code: null, error: "boom\nstack" }));
  const c = projectChildren({ project, pkg, probe: errore })[3];
  eq("icona di errore", "error", c.icon);
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
