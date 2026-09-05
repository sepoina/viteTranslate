// Il test che conta per --fastverify: la verifica in due stadi deve dire "fresh" quando e solo
// quando non c'è davvero nulla da rifare, e non lanciare mai qualunque cosa le si metta davanti.
//
//   node test/list/fastVerify.test.mjs
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, renameSync, utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fastVerify, { buildScanRecord } from "../../lib/dev/vite/uty/fastVerify.js";
import { writeScan, scanPath } from "../../lib/dev/vite/uty/scanRecord.js";
import walkSource from "../../lib/dev/vite/uty/walkSource.js";
import { hash } from "../../lib/dev/babel/markerCore.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(58), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
const MARCATO = 'export const a = "_%_ciao_%_";\n';
const NON_MARCATO = "export const b = 1;\n";
const futuro = () => new Date(Date.now() + 5000);

/** Il record coerente con lo stato attuale del disco, scritto con buildScanRecord + writeScan. */
function registra(baseDir) {
  const localeAbs = join(baseDir, "locale");
  const entries = walkSource(join(baseDir, "src"), localeAbs, baseDir);
  const marked = {};
  for (const e of entries) {
    const code = readFileSync(e.path, "utf8");
    if (code.includes("_%_")) marked[e.rel] = hash(code);
  }
  writeScan(baseDir, buildScanRecord({
    baseDir, srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT", simpleLog: false,
    keys: 1, warnings: 0, entries, marked,
  }));
}

/**
 * Un progetto temporaneo completo (config, node_modules, src con un file marcato e uno no,
 * locale con due tabelle). Il record dell'ultima "sync" è scritto di default, coerente con lo
 * stato su disco al momento della chiamata.
 */
function progetto({ conNodeModules = true, conRecord = true } = {}) {
  const baseDir = mkdtempSync(join(tmpdir(), "vt-fastverify-"));
  temporanee.push(baseDir);

  if (conNodeModules) mkdirSync(join(baseDir, "node_modules"), { recursive: true });
  writeFileSync(join(baseDir, "vite.config.js"), "export default {};\n", "utf8");
  mkdirSync(join(baseDir, "src"), { recursive: true });
  writeFileSync(join(baseDir, "src", "Marked.jsx"), MARCATO, "utf8");
  writeFileSync(join(baseDir, "src", "Plain.jsx"), NON_MARCATO, "utf8");
  mkdirSync(join(baseDir, "locale"), { recursive: true });
  writeFileSync(join(baseDir, "locale", "it-IT.yml"), "a: ciao\n", "utf8");
  writeFileSync(join(baseDir, "locale", "en-US.yml"), "a: hello\n", "utf8");

  if (conRecord) registra(baseDir);
  return baseDir;
}

/** Un progetto fresco, una mutazione, la verifica dell'esito. */
function caso(nome, mutazione, atteso) {
  const baseDir = progetto();
  mutazione(baseDir);
  const esito = fastVerify({ baseDir });
  eq(nome, atteso, esito.fresh ? "fresh" : esito.reason);
}

console.log("\n== niente cambiato ==");
caso("progetto intonso", () => {}, "fresh");

console.log("\n== file non marcato ==");
caso("touch di un file non marcato", (b) => {
  const p = join(b, "src", "Plain.jsx");
  utimesSync(p, futuro(), futuro());
}, "fresh");
caso("modifica di un file non marcato, senza _%_", (b) => {
  writeFileSync(join(b, "src", "Plain.jsx"), "export const b = 2;\n", "utf8");
}, "fresh");

console.log("\n== file marcato ==");
caso("riscrittura identica (mtime nuovo, stesso contenuto)", (b) => {
  writeFileSync(join(b, "src", "Marked.jsx"), MARCATO, "utf8");
}, "fresh");
caso("modifica di un file marcato", (b) => {
  writeFileSync(join(b, "src", "Marked.jsx"), 'export const a = "_%_ciao mondo_%_";\n', "utf8");
}, "source-changed");
caso("_%_ aggiunto a un file che non ne aveva", (b) => {
  writeFileSync(join(b, "src", "Plain.jsx"), 'export const b = "_%_nuovo_%_";\n', "utf8");
}, "source-changed");
caso("_%_ tolto da un file marcato", (b) => {
  writeFileSync(join(b, "src", "Marked.jsx"), "export const a = 1;\n", "utf8");
}, "markers-removed");
caso("file marcato cancellato", (b) => {
  rmSync(join(b, "src", "Marked.jsx"));
}, "source-gone");
caso("file marcato rinominato (mtime invariato)", (b) => {
  renameSync(join(b, "src", "Marked.jsx"), join(b, "src", "Renamed.jsx"));
}, "source-gone");
caso("file nuovo con _%_", (b) => {
  writeFileSync(join(b, "src", "New.jsx"), 'export const c = "_%_altro_%_";\n', "utf8");
}, "source-changed");
caso("file nuovo senza _%_", (b) => {
  writeFileSync(join(b, "src", "New.jsx"), "export const c = 3;\n", "utf8");
}, "fresh");

console.log("\n== locale ==");
caso("touch di un .yml", (b) => {
  utimesSync(join(b, "locale", "it-IT.yml"), futuro(), futuro());
}, "locale-changed");
caso(".yml aggiunto", (b) => {
  writeFileSync(join(b, "locale", "fr-FR.yml"), "a: bonjour\n", "utf8");
}, "locale-changed");
caso("localeDir cancellata", (b) => {
  rmSync(join(b, "locale"), { recursive: true, force: true });
}, "locale-changed");

console.log("\n== config ==");
caso("touch di vite.config.js", (b) => {
  utimesSync(join(b, "vite.config.js"), futuro(), futuro());
}, "config-changed");
caso("vite.config.js rinominato in .mjs", (b) => {
  renameSync(join(b, "vite.config.js"), join(b, "vite.config.mjs"));
}, "config-changed");

console.log("\n== record ==");
{
  const baseDir = progetto();
  const record = JSON.parse(readFileSync(scanPath(baseDir), "utf8"));
  writeFileSync(scanPath(baseDir), JSON.stringify({ ...record, pkgVersion: "0.0.0-non-esiste" }), "utf8");
  eq("pkgVersion del record alterato a mano", "version-changed", fastVerify({ baseDir }).reason);
}
{
  const baseDir = progetto({ conRecord: false });
  eq("record assente -> no-record", "no-record", fastVerify({ baseDir }).reason);
}
{
  const baseDir = progetto();
  writeFileSync(scanPath(baseDir), "{ questo non è json", "utf8");
  let lanciato = false;
  let esito;
  try {
    esito = fastVerify({ baseDir });
  } catch {
    lanciato = true;
  }
  eq("scan.json corrotto -> no-record", "no-record", esito?.reason);
  eq("senza eccezioni", false, lanciato);
}
{
  const baseDir = progetto({ conNodeModules: false, conRecord: false });
  const esito = fastVerify({ baseDir });
  eq("node_modules assente -> no-record", "no-record", esito.reason);
}

console.log("\n== fastVerify non lancia mai ==");
{
  // localeDir che è un FILE invece di una cartella.
  const baseDir = progetto();
  rmSync(join(baseDir, "locale"), { recursive: true, force: true });
  writeFileSync(join(baseDir, "locale"), "non è una cartella", "utf8");
  let lanciato = false;
  let esito;
  try {
    esito = fastVerify({ baseDir });
  } catch {
    lanciato = true;
  }
  eq("localeDir è un file: nessuna eccezione", false, lanciato);
  eq("localeDir è un file: fresh false", false, esito?.fresh);
}
{
  // srcDir che non esiste più.
  const baseDir = progetto();
  rmSync(join(baseDir, "src"), { recursive: true, force: true });
  let lanciato = false;
  let esito;
  try {
    esito = fastVerify({ baseDir });
  } catch {
    lanciato = true;
  }
  eq("srcDir assente: nessuna eccezione", false, lanciato);
  eq("srcDir assente: fresh false", false, esito?.fresh);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
