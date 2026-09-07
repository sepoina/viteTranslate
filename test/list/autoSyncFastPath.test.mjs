// La convivenza fra autoSync e vtranslate-cli, e le guardie G12/G13: in dev si passa dalla
// verifica veloce (nessun costo per chi già lancia "predev" a mano), in build mai, e il record
// che fastVerify legge è messo in croce con la config VIVA — non solo con l'mtime di
// vite.config.* — perché quella config può cambiare senza che il file cambi.
//
//   node test/list/autoSyncFastPath.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(66), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(resolve(HERE, "../.."), "lib/dev/vite/cli.js");
const PLUGIN = pathToFileURL(join(resolve(HERE, "../.."), "lib/index.js")).href;

const temporanee = [];

/** Un progetto completo, sincronizzabile sia dalla CLI (come vtranslate-cli --fastverify
 * farebbe da "predev") sia da autoSync — stesso identico schema di fastVerifyCli.test.mjs. */
function progetto() {
  const radice = mkdtempSync(join(tmpdir(), "vt-autosync-fastpath-"));
  temporanee.push(radice);
  mkdirSync(join(radice, "node_modules"));
  mkdirSync(join(radice, "src"));
  writeFileSync(join(radice, "package.json"), '{ "type": "module" }');
  writeFileSync(join(radice, "src", "App.jsx"), 'export const a = "_%_Ciao dal fastpath_%_";\n');
  writeFileSync(join(radice, "vite.config.mjs"),
    `import { vitetranslate } from ${JSON.stringify(PLUGIN)};\n` +
    `export default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };\n`);
  return radice;
}

const lanciaCli = (radice, argv = []) => spawnSync(process.execPath, [CLI, ...argv], { cwd: radice, encoding: "utf8" });

const config = (radice, extra = {}) => ({
  baseDir: radice, srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT",
  autoSyncDev: true, autoSyncBuild: true, ...extra,
});

/** mtime di ogni file dentro `dir`, ricorsivo — stesso schema di fastVerifyCli.test.mjs. */
function fotografia(dir) {
  const righe = [];
  const cammina = (d) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome);
      const s = statSync(p);
      if (s.isDirectory()) cammina(p);
      else righe.push(`${p}:${s.mtimeMs}:${s.size}`);
    }
  };
  try {
    cammina(dir);
  } catch {
    return "<assente>";
  }
  return righe.sort().join("\n");
}

/** Zitta la funzione ma restituisce il testo che avrebbe stampato, più il suo valore di ritorno:
 * serve a verificare sia il `reason` sia il silenzio del percorso `fresh`. */
async function cattura(fn) {
  const originali = { log: console.log, warn: console.warn, error: console.error };
  let testo = "";
  const raccogli = (...pezzi) => { testo += pezzi.join(" ") + "\n"; };
  console.log = console.warn = console.error = raccogli;
  let valore;
  try {
    valore = await fn();
  } finally {
    Object.assign(console, originali);
  }
  return { testo, valore };
}

// Ogni chiamata usa un'istanza NUOVA di autoSync.js: nella realtà ogni chiamata qui sotto
// corrisponde a un avvio diverso del dev server (o della build), cioè a un processo Node nuovo
// con una Map di rientranza vuota — non allo stesso processo che richiama autoSync due volte
// per lo stesso comando (quello lo copre autoSyncReentrancy.test.mjs).
let contatoreImport = 0;
async function autoSyncFresh() {
  contatoreImport++;
  const modulo = await import(`../../lib/dev/vite/autoSync.js?vt-fastpath=${contatoreImport}`);
  return modulo.default;
}

// ------------------------------------------------------- chi tiene il predev non paga due volte
console.log("\n== un progetto già sincronizzato dalla CLI: il dev non rifà il lavoro ==");
{
  const radice = progetto();
  const cli = lanciaCli(radice);
  eq("la sync via CLI è andata a buon fine", 0, cli.status);

  const prima = fotografia(join(radice, "locale"));
  const autoSync = await autoSyncFresh();
  const { testo, valore } = await cattura(() => autoSync({ config: config(radice), env: { command: "serve" } }));
  const dopo = fotografia(join(radice, "locale"));

  eq("fresh: non risincronizza", "fresh", valore.reason);
  eq("fresh: nessuna scrittura in locale/", prima, dopo);
  eq("fresh: nessun output a schermo", "", testo);
}

// ------------------------------------------------------- in build non si passa mai dal veloce
console.log("\n== stessa fixture, ma in build: mai la verifica veloce ==");
{
  const radice = progetto();
  lanciaCli(radice);

  const autoSync = await autoSyncFresh();
  const { valore } = await cattura(() => autoSync({ config: config(radice), env: { command: "build" } }));
  eq("build: sincronizza comunque", true, valore.ran);
  eq("build: motivo = synced", "synced", valore.reason);
}

// ------------------------------------------------------- un sorgente toccato fa risincronizzare
console.log("\n== un sorgente marcato modificato dopo la CLI: il dev risincronizza ==");
{
  const radice = progetto();
  lanciaCli(radice);
  writeFileSync(join(radice, "src", "App.jsx"), 'export const a = "_%_Ciao dal fastpath, di nuovo_%_";\n');

  const autoSync = await autoSyncFresh();
  const { valore } = await cattura(() => autoSync({ config: config(radice), env: { command: "serve" } }));
  eq("il sorgente cambiato fa risincronizzare", true, valore.ran);

  const tabella = readdirSync(join(radice, "locale")).includes("it-IT.yml")
    && statSync(join(radice, "locale", "it-IT.yml")).size > 0;
  eq("la tabella su disco esiste ancora", true, tabella);
}

// ------------------------------------------------------- G13: la config viva batte il record
console.log("\n== G13: una config diversa, senza toccare vite.config.*, non è \"fresca\" ==");
{
  const radice = progetto();
  lanciaCli(radice); // il record dice localeDir: "locale"

  const autoSync = await autoSyncFresh();
  // Stessa vite.config.mjs sul disco (non la tocchiamo): solo la config PASSATA ad autoSync
  // dice un'altra localeDir, come farebbe un secondo progetto in monorepo che condivide lo
  // stesso node_modules e quindi lo stesso scan.json.
  const { valore } = await cattura(() => autoSync({ config: config(radice, { localeDir: "altro" }), env: { command: "serve" } }));
  eq("config diversa -> non fresca", true, valore.ran);
  eq("scrive nella localeDir che le è stata passata, non in quella del record", true,
    readdirSync(join(radice, "altro")).includes("it-IT.yml"));
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
