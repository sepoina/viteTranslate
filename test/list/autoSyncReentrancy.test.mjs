// La guardia G3: la rientranza si decide sulla CONFIG, non su un booleano di processo. Un
// booleano sopravviverebbe al restart del dev server — Vite reimporta solo vite.config.*, il
// modulo autoSync.js resta nella cache di Node — e bloccherebbe proprio la risincronizzazione
// che serve subito dopo un cambio di sourceLanguage. Conservare la PROMISE (non un booleano)
// fa anche sì che due chiamanti concorrenti aspettino la stessa esecuzione invece di scriverne due.
//
//   node test/list/autoSyncReentrancy.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBabel } from "../../lib/dev/babel/extractMarkers.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function progetto() {
  const radice = mkdtempSync(join(tmpdir(), "vt-autosync-reentry-"));
  temporanee.push(radice);
  mkdirSync(join(radice, "src"), { recursive: true });
  writeFileSync(join(radice, "src", "App.jsx"), 'export const a = "_%_Ciao_%_";\n');
  return {
    baseDir: radice,
    config: (extra = {}) => ({
      baseDir: radice, srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT",
      autoSyncDev: true, autoSyncBuild: true, ...extra,
    }),
  };
}

async function zitto(fn) {
  const originali = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, originali);
  }
}

/** Un contatore di esecuzioni VERE: probeBabel gira solo dentro `esegui`, mai su un ritorno
 * dalla Map di rientranza — quindi conta quante volte la sincronizzazione è partita davvero. */
function contaEsecuzioni() {
  let n = 0;
  return { probe: () => { n++; ensureBabel(); }, letto: () => n };
}

// Ogni caso importa un'istanza NUOVA di autoSync.js: nella realtà ogni "run" di questo test
// corrisponde a un riavvio del dev server, cioè a un processo Node nuovo con una Map vuota.
// Bustare la cache dei moduli con una query diversa ottiene lo stesso isolamento qui, senza
// dover lanciare un processo per caso.
let contatoreImport = 0;
async function autoSyncFresh() {
  contatoreImport++;
  const modulo = await import(`../../lib/dev/vite/autoSync.js?vt-reentry=${contatoreImport}`);
  return modulo.default;
}

console.log("\n== stessa config, stesso command: la seconda chiamata non risincronizza ==");
{
  const p = progetto();
  const autoSync = await autoSyncFresh();
  const { probe, letto } = contaEsecuzioni();
  const r1 = await zitto(() => autoSync({ config: p.config(), env: { command: "serve" }, probeBabel: probe }));
  const r2 = await zitto(() => autoSync({ config: p.config(), env: { command: "serve" }, probeBabel: probe }));
  eq("la prima chiamata sincronizza", true, r1.ran);
  eq("la seconda torna lo stesso esito (promise già risolta)", r1.reason, r2.reason);
  eq("una sola esecuzione vera", 1, letto());
}

console.log("\n== sourceLanguage diverso: risincronizza (il caso del restart dopo la modifica) ==");
{
  const p = progetto();
  const autoSync = await autoSyncFresh();
  const { probe, letto } = contaEsecuzioni();
  await zitto(() => autoSync({ config: p.config(), env: { command: "serve" }, probeBabel: probe }));
  const r2 = await zitto(() => autoSync({ config: p.config({ sourceLanguage: "en-US" }), env: { command: "serve" }, probeBabel: probe }));
  eq("la seconda sincronizza davvero", true, r2.ran);
  eq("due esecuzioni vere", 2, letto());
}

console.log("\n== stessa config, command diverso (build dopo serve): risincronizza ==");
{
  const p = progetto();
  const autoSync = await autoSyncFresh();
  const { probe, letto } = contaEsecuzioni();
  await zitto(() => autoSync({ config: p.config(), env: { command: "serve" }, probeBabel: probe }));
  const r2 = await zitto(() => autoSync({ config: p.config(), env: { command: "build" }, probeBabel: probe }));
  eq("la build risincronizza anche se il dev l'aveva già fatto", true, r2.ran);
  eq("due esecuzioni vere", 2, letto());
}

console.log("\n== due chiamate concorrenti, senza await in mezzo: una sola esecuzione ==");
{
  const p = progetto();
  const autoSync = await autoSyncFresh();
  const { probe, letto } = contaEsecuzioni();
  const [r1, r2] = await zitto(() => Promise.all([
    autoSync({ config: p.config(), env: { command: "serve" }, probeBabel: probe }),
    autoSync({ config: p.config(), env: { command: "serve" }, probeBabel: probe }),
  ]));
  eq("entrambe si risolvono con lo stesso esito", r1.reason, r2.reason);
  eq("una sola esecuzione vera", 1, letto());
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
