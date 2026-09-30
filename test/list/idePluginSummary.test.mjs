// Estensione per l'editor (idePlugin): dalle letture alle righe del pannello (summarize.mjs).
// Dati scritti a mano nella forma che producono readPackage.mjs e la sonda: qui si guarda solo
// cosa diventa ogni caso — valori, "default", errori, Restricted Mode.
//
//   node test/list/idePluginSummary.test.mjs
import { join } from "node:path";
import { projectRow, projectChildren, relativeLabel, errorLine } from "../../idePlugin/src/summarize.mjs";

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
  eq("niente segno né figli: li mette il ChoiceList", [undefined, undefined], [r.mark, r.children]);
  eq("senza name: il nome della cartella", "app", projectRow(project, { roots: [ROOT], name: null }).label);
  eq("radice: niente '.'", "workspace root", projectRow({ dir: ROOT, configFile: "vite.config.js" }, { roots: [ROOT] }).description);
}

console.log("\n== figli: ordine ==");
const figli = projectChildren({ project, pkg, probe });
eq("vitetranslate, package.json, vite.config.js", ["vitetranslate", "package.json", "vite.config.js"], figli.map((r) => r.label));

console.log("\n== vitetranslate ==");
{
  const vt = figli[0];
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
  const senzaLlm = projectChildren({ project, pkg, probe: { ...probe, vitetranslate: { ...probe.vitetranslate, llm: null } } })[0];
  eq("llm null", "not configured", desc(senzaLlm.children, "llm"));
  const nonRegistrato = projectChildren({ project, pkg, probe: { ...probe, vitetranslate: null } })[0];
  eq("plugin non registrato", ["not registered in vite.config", "warning"], [nonRegistrato.description, nonRegistrato.icon]);
}

console.log("\n== package.json ==");
{
  const p = figli[1];
  eq("description", "app 1.0.0", p.description);
  eq("dichiarata e installata", "^4.6.4 → 4.6.4", desc(p.children, "@sepoina/vitetranslate"));
  eq("dichiarata, non installata: avviso", ["^8.1.0 → not installed", "warning"], [desc(p.children, "vite"), p.children.find((r) => r.label === "vite").icon]);
  eq("installata, non dichiarata", "not declared → 7.29.7", desc(p.children, "@babel/core"));
  eq("scripts", "dev · build", desc(p.children, "scripts"));
  eq("clic apre il file", join(project.dir, "package.json"), p.open);
  const manca = projectChildren({ project, pkg: { ok: false, missing: true, error: "no package.json next to vite.config" }, probe })[1];
  eq("package.json assente: niente da aprire", [undefined, "warning"], [manca.open, manca.icon]);
}

console.log("\n== vite.config ==");
{
  const c = figli[2];
  eq("description", "3 plugins", c.description);
  eq("server", "port 3003 · host true", desc(c.children, "server"));
  eq("clic apre il config", join(project.dir, "vite.config.js"), c.open);
}
{
  const [vt, , c] = projectChildren({ project, pkg, probe: { ok: false, untrusted: true } });
  eq("Restricted Mode: config non eseguito", ["not executed: Restricted Mode", "shield"], [c.description, c.icon]);
  eq("Restricted Mode: vitetranslate sconosciuto", "unknown: vite.config not read", vt.description);
}
{
  const errore = { ok: false, code: "ERR_MODULE_NOT_FOUND", error: "Cannot find package 'vite' imported from /ws/site/app/vite.config.js", output: "" };
  eq("pacchetto mancante: frase utile", 'needs "vite": not installed', errorLine(errore));
  eq("altro errore: prima riga", "boom", errorLine({ ok: false, code: null, error: "boom\nstack" }));
  const c = projectChildren({ project, pkg, probe: errore })[2];
  eq("icona di errore", "error", c.icon);
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
