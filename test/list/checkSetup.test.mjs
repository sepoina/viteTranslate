// Il controllo unico che decide se il dev server può cominciare a servire (o se la build può
// partire): una sourceLanguage leggibile in localeDir, sì o no, e perché no.
//
// Funzione pura sul filesystem: qui si guardano solo `ok`/`reason`/`detail`, mai una stampa —
// quella la fa chi chiama (vedi vitetranslate.js, configureServer/buildStart).
//
//   node test/list/checkSetup.test.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import checkSetup from "../../lib/dev/vite/uty/checkSetup.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function cartellaVuota() {
  const dir = mkdtempSync(join(tmpdir(), "vt-checksetup-"));
  temporanee.push(dir);
  return dir;
}
const scrivi = (dir, file, testo) => writeFileSync(join(dir, file), testo, "utf8");
const V = 260824;
const builder = (extra = "") => `__builder__: {"v":${V},"languageName":"x","incomplete":false${extra}}`;
const tabellaOk = (voci = []) => [builder(), ...voci].join("\n") + "\n";

// ------------------------------------------------------- ok
console.log("\n== sourceLanguage presente e leggibile: ok ==");
{
  const dir = cartellaVuota();
  scrivi(dir, "it-IT.yml", tabellaOk(['App_a: "ciao"']));
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("ok", true, r.ok);
}

console.log("\n== altre lingue non contano, basta che ci sia la sorgente ==");
{
  const dir = cartellaVuota();
  scrivi(dir, "it-IT.yml", tabellaOk());
  scrivi(dir, "fr-FR.yml", tabellaOk(['App_a: "salut"']));
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("ok", true, r.ok);
}

// ------------------------------------------------------- no-locale-dir
console.log("\n== localeDir che non esiste ancora: no-locale-dir ==");
{
  const dir = join(tmpdir(), "vt-checksetup-mai-creata-" + Date.now());
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("non ok", false, r.ok);
  eq("reason", "no-locale-dir", r.reason);
}

console.log("\n== localeDir che è un file, non una cartella: no-locale-dir ==");
{
  const dir = cartellaVuota();
  const comeFile = join(dir, "localeDir-come-file");
  writeFileSync(comeFile, "non sono una cartella", "utf8");
  const r = checkSetup({ localeDir: comeFile, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("non ok", false, r.ok);
  eq("reason", "no-locale-dir", r.reason);
}

// ------------------------------------------------------- no-language-file
console.log("\n== localeDir vuota: no-language-file ==");
{
  const dir = cartellaVuota();
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("non ok", false, r.ok);
  eq("reason", "no-language-file", r.reason);
}

// ------------------------------------------------------- source-missing
console.log("\n== altre lingue ci sono, la sorgente no: source-missing ==");
{
  const dir = cartellaVuota();
  scrivi(dir, "fr-FR.yml", tabellaOk(['App_a: "salut"']));
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("non ok", false, r.ok);
  eq("reason", "source-missing", r.reason);
}

// ------------------------------------------------------- source-case-mismatch
console.log("\n== il file c'è ma con un altro maiuscolo: source-case-mismatch ==");
{
  const dir = cartellaVuota();
  scrivi(dir, "it-it.yml", tabellaOk());
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("non ok", false, r.ok);
  eq("reason", "source-case-mismatch", r.reason);
  eq("detail nomina il tag trovato", "it-it", r.detail);
}

// ------------------------------------------------------- legacy-format
console.log("\n== solo file 3.x (.js): legacy-format, non source-missing ==");
{
  const dir = cartellaVuota();
  scrivi(dir, "it-IT.js", "export default {}\n");
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("non ok", false, r.ok);
  eq("reason", "legacy-format", r.reason);
  eq("detail elenca il file", "it-IT.js", r.detail.join());
}

// ------------------------------------------------------- source-invalid
console.log("\n== il file della sorgente c'è ma è vuoto: source-invalid ==");
{
  const dir = cartellaVuota();
  scrivi(dir, "it-IT.yml", "");
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("non ok", false, r.ok);
  eq("reason", "source-invalid", r.reason);
}

console.log("\n== il file della sorgente c'è ma non è nel formato: source-invalid ==");
{
  const dir = cartellaVuota();
  scrivi(dir, "it-IT.yml", "questa riga non è del formato\n");
  const r = checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  eq("non ok", false, r.ok);
  eq("reason", "source-invalid", r.reason);
}

// ------------------------------------------------------- sola lettura
console.log("\n== non scrive niente: è una domanda, non un comando ==");
{
  const dir = cartellaVuota();
  checkSetup({ localeDir: dir, localeDirLabel: "locale", sourceLanguage: "it-IT" });
  const { readdirSync } = await import("node:fs");
  eq("cartella ancora vuota", "", readdirSync(dir).join());
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
