// Il lanciatore dei controlli di release (test/testRelease.mjs): scoperta, ordine, tabella e codice di uscita.
//
// Perché è un test: è il cancello della chiusura di un bundle. Se un controllo che crasha venisse
// contato come "ok", o se un KO non cambiasse il codice di uscita, la release passerebbe con un manuale o
// un README fuori posto. Gira su una cartella finta di controlli (il lanciatore la prende come parametro).
//
//   node test/list/testRelease.test.mjs
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { formatta, lancia, scopri } from "../../test/testRelease.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(64), ok ? "" : `-> ${JSON.stringify(ottenuto)} (atteso ${JSON.stringify(atteso)})`);
};

const tmp = mkdtempSync(join(tmpdir(), "vt-release-"));
const controllo = (file, nome, corpo) => writeFileSync(join(tmp, file), `export const name = ${JSON.stringify(nome)};\nexport async function run() { ${corpo} }\n`);
try {
  // ------------------------------------------------------- scoperta e ordine
  console.log("\n== scoperta ==");
  controllo("20-ok.check.mjs", "beta", 'return { level: "ok", lines: [] };');
  controllo("10-warn.check.mjs", "alfa", 'return { level: "warn", lines: ["un avviso", "dettaglio"] };');
  writeFileSync(join(tmp, "altro.mjs"), "export {};\n");
  writeFileSync(join(tmp, "note.md"), "x\n");
  eq("scopri: solo *.check.mjs, in ordine di nome", ["10-warn.check.mjs", "20-ok.check.mjs"], scopri(tmp));

  let r = await lancia(tmp);
  eq("lancia: un ok e un warn → uscita 0", [0, ["alfa", "beta"], ["warn", "ok"]], [r.code, r.results.map((x) => x.name), r.results.map((x) => x.level)]);
  eq("lancia: porta le righe del controllo", ["un avviso", "dettaglio"], r.results[0].lines);

  // ------------------------------------------------------- KO, crash, esito non valido
  console.log("\n== KO e crash ==");
  controllo("30-ko.check.mjs", "gamma", 'return { level: "ko", lines: ["rotto"] };');
  r = await lancia(tmp);
  eq("un KO → uscita 1", 1, r.code);
  controllo("30-ko.check.mjs", "gamma", 'throw new Error("boom");');
  r = await lancia(tmp);
  eq("un controllo che lancia è un KO, non un ok", ["ko", 1], [r.results.find((x) => x.name === "gamma").level, r.code]);
  eq("…e dice che è andato in crash, con il messaggio", true, r.results.find((x) => x.name === "gamma").lines[0].includes("crashed") && r.results.find((x) => x.name === "gamma").lines[0].includes("boom"));
  controllo("30-ko.check.mjs", "gamma", 'return { level: "forse", lines: [] };');
  r = await lancia(tmp);
  eq("un level che non è ok|warn|ko è un KO", "ko", r.results.find((x) => x.name === "gamma").level);
  writeFileSync(join(tmp, "30-ko.check.mjs"), "export const name = 'rotto'; export async function run( {\n");
  r = await lancia(tmp);
  eq("un controllo che non si carica è un KO", ["ko", 1], [r.results.find((x) => x.file === "30-ko.check.mjs").level, r.code]);
  rmSync(join(tmp, "30-ko.check.mjs"));

  // ------------------------------------------------------- --only
  console.log("\n== --only ==");
  r = await lancia(tmp, { only: "ALF" });
  eq("only: filtra per nome, senza badare alle maiuscole", ["alfa"], r.results.map((x) => x.name));
  r = await lancia(tmp, { only: "nessuno" });
  eq("only: nessun controllo corrisponde", [], r.results);

  // ------------------------------------------------------- la tabella
  console.log("\n== tabella ==");
  r = await lancia(tmp);
  const testo = formatta(r.results);
  eq("tabella: una riga per controllo, con esito, nome e prima riga", true, /^WARN\s+alfa\s+un avviso/m.test(testo) && /^OK\s+beta/m.test(testo));
  eq("tabella: le righe di un controllo non ok vengono dopo", true, testo.includes("── alfa") && testo.includes("dettaglio"));
  eq("tabella: nessuna riga compare due volte (la prima sta solo nella tabella)", 1, testo.split("un avviso").length - 1);
  eq("tabella: un controllo ok non ripete le sue righe", false, testo.includes("── beta"));
  eq("lo URL del modulo è file: (il lanciatore importa per URL)", true, pathToFileURL(join(tmp, "20-ok.check.mjs")).href.startsWith("file:"));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
