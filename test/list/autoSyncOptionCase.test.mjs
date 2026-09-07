// La guardia G7 vive in vitetranslate.js, non in autoSync.js: le due opzioni autoSyncDev e
// autoSyncBuild si leggono case-insensitive, come già simpleLog. La ragione è più seria che per
// simpleLog: un refuso su un flag booleano non produce nessun errore, e il valore che resta è il
// default `true` — cioè si continua a SCRIVERE SU DISCO proprio a chi aveva chiesto il contrario.
//
//   node test/list/autoSyncOptionCase.test.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vitetranslate from "../../lib/dev/vite/vitetranslate.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(60), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function baseDir() {
  const radice = mkdtempSync(join(tmpdir(), "vt-optioncase-"));
  temporanee.push(radice);
  return radice;
}

/** Opzioni minime valide, più quelle passate: nessun file su disco serve, la config si legge
 * senza mai sincronizzare (non chiamiamo l'hook `config`, solo la factory). */
const opzioni = (extra = {}) => ({ localeDir: "locale", sourceLanguage: "it-IT", baseDir: baseDir(), ...extra });

/** Trova il plugin "vitetranslate" fra i due che la factory restituisce — lo stesso modo in cui
 * lo trova la CLI dopo un flat(Infinity) (vedi uty/loadConfig.js), che è anche il motivo per cui
 * questo test è utile: verifica cosa legge davvero chi consuma vitetranslateConfig da fuori. */
const configDi = (opz) => vitetranslate(opz).flat(Infinity).find((p) => p?.name === "vitetranslate").vitetranslateConfig;

eq("autoSyncDev: false", false, configDi(opzioni({ autoSyncDev: false })).autoSyncDev);
eq("autosyncdev: false (tutto minuscolo)", false, configDi(opzioni({ autosyncdev: false })).autoSyncDev);
eq("AutoSyncDev: false (maiuscole diverse)", false, configDi(opzioni({ AutoSyncDev: false })).autoSyncDev);

{
  const c = configDi(opzioni({ autoSyncBuild: false }));
  eq("autoSyncBuild: false -> autoSyncBuild spento", false, c.autoSyncBuild);
  eq("autoSyncBuild: false -> autoSyncDev resta acceso", true, c.autoSyncDev);
}

{
  const c = configDi(opzioni());
  eq("nessuna delle due opzioni -> autoSyncDev acceso di default", true, c.autoSyncDev);
  eq("nessuna delle due opzioni -> autoSyncBuild acceso di default", true, c.autoSyncBuild);
}

eq("autoSyncDev: 0 -> resta acceso (solo false spegne)", true, configDi(opzioni({ autoSyncDev: 0 })).autoSyncDev);
eq("autoSyncDev: \"no\" -> resta acceso (solo false spegne)", true, configDi(opzioni({ autoSyncDev: "no" })).autoSyncDev);

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
