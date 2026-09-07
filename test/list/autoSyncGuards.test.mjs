// La matrice delle guardie di autoSync (vedi doc/ImplementationPlans/4_2_0.md, § "Le quattordici
// guardie"): ognuna deve rispondere col `reason` giusto, senza mai toccare il disco — tranne
// l'ultima riga, che non ha nessuna guardia attiva ed è la prova che la sincronizzazione avviene
// per davvero quando nulla la ferma.
//
//   node test/list/autoSyncGuards.test.mjs
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import autoSync from "../../lib/dev/vite/autoSync.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(62), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];

/** Un progetto finto, con un solo file sorgente marcato. Ogni caso ne usa uno suo, così le
 * chiavi della Map di rientranza (config + command) non si toccano fra un caso e l'altro. */
function progetto() {
  const radice = mkdtempSync(join(tmpdir(), "vt-autosync-guards-"));
  temporanee.push(radice);
  mkdirSync(join(radice, "src"), { recursive: true });
  writeFileSync(join(radice, "src", "App.jsx"), 'export const a = "_%_Ciao_%_";\n');
  return {
    baseDir: radice,
    localeDir: join(radice, "locale"),
    config: (extra = {}) => ({
      baseDir: radice, srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT",
      autoSyncDev: true, autoSyncBuild: true, ...extra,
    }),
  };
}

/** Esegue zitta una funzione rumorosa (i warning/log delle guardie non interessano qui). */
async function zitto(fn) {
  const originali = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, originali);
  }
}

/** Snapshot di localeDir: "<assente>" se non esiste ancora, altrimenti i nomi ordinati. */
const localeSnapshot = (dir) => {
  try {
    return readdirSync(dir).sort().join(",");
  } catch {
    return "<assente>";
  }
};

/** process.env[nome] = valore per la durata di fn, poi ripristinato com'era (anche assente). */
async function conEnv(nome, valore, fn) {
  const prima = Object.prototype.hasOwnProperty.call(process.env, nome) ? process.env[nome] : undefined;
  process.env[nome] = valore;
  try {
    return await fn();
  } finally {
    if (prima === undefined) delete process.env[nome];
    else process.env[nome] = prima;
  }
}

// -------------------------------------------------------------- guardie a costo zero
console.log("\n== G8 / G9 / G4 / G5: le guardie che non toccano mai il disco ==");
{
  const p = progetto();

  const g8 = await conEnv("VITETRANSLATE_NO_SYNC", "1", () =>
    zitto(() => autoSync({ config: p.config(), env: { command: "serve" } })));
  eq("G8: env-off", "env-off", g8.reason);

  const g9 = await conEnv("VITEST", "1", () =>
    zitto(() => autoSync({ config: p.config(), env: { command: "serve" } })));
  eq("G9: vitest", "vitest", g9.reason);

  const g4 = await zitto(() => autoSync({ config: p.config(), env: { command: "serve", isPreview: true } }));
  eq("G4: preview", "preview", g4.reason);

  const g5 = await zitto(() => autoSync({ config: p.config(), env: { command: "build", isSsrBuild: true } }));
  eq("G5: ssr-build", "ssr-build", g5.reason);

  eq("nessuna delle quattro ha creato localeDir", "<assente>", localeSnapshot(p.localeDir));
}

// -------------------------------------------------------------- G6
console.log("\n== G6: le opzioni spengono solo il proprio comando ==");
{
  const p1 = progetto();
  const dev = await zitto(() => autoSync({ config: p1.config({ autoSyncDev: false }), env: { command: "serve" } }));
  eq("autoSyncDev: false in serve -> option-off", "option-off", dev.reason);

  const p2 = progetto();
  const build = await zitto(() => autoSync({ config: p2.config({ autoSyncBuild: false }), env: { command: "build" } }));
  eq("autoSyncBuild: false in build -> option-off", "option-off", build.reason);

  const p3 = progetto();
  const serveNonostanteBuildOff = await zitto(() =>
    autoSync({ config: p3.config({ autoSyncBuild: false }), env: { command: "serve" } }));
  eq("autoSyncBuild: false NON spegne il dev", true, serveNonostanteBuildOff.ran);
}

// -------------------------------------------------------------- G10
console.log("\n== G10: senza @babel/core si degrada, non si azzera ==");
{
  const p = progetto();
  const erroreBabel = () => {
    const e = new Error("no babel");
    e.code = "VT_NO_BABEL";
    throw e;
  };
  const g10 = await zitto(() => autoSync({ config: p.config(), env: { command: "serve" }, probeBabel: erroreBabel }));
  eq("G10: no-babel", "no-babel", g10.reason);
  eq("G10: nessun localeDir creato", "<assente>", localeSnapshot(p.localeDir));
}

// -------------------------------------------------------------- G11
console.log("\n== G11: file 3.x senza il .yml della sourceLanguage ==");
{
  const p = progetto();
  mkdirSync(p.localeDir, { recursive: true });
  writeFileSync(join(p.localeDir, "it-IT.js"), "export default { A_1: \"uno\" };\n");
  const prima = localeSnapshot(p.localeDir);

  const g11 = await zitto(() => autoSync({ config: p.config(), env: { command: "serve" } }));
  eq("G11: legacy-format", "legacy-format", g11.reason);
  eq("G11: localeDir non toccata", prima, localeSnapshot(p.localeDir));
}

// -------------------------------------------------------------- nessuna guardia
console.log("\n== nessuna guardia attiva: la sincronizzazione avviene per davvero ==");
{
  const p = progetto();
  const esito = await zitto(() => autoSync({ config: p.config(), env: { command: "build" } }));
  eq("ran: true", true, esito.ran);
  eq("reason: synced", "synced", esito.reason);
  eq("i file di lingua sono stati scritti", true, localeSnapshot(p.localeDir).includes("it-IT.yml"));
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
