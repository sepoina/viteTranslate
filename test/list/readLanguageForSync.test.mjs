// readLanguageForSync classifica lo stato di un file di lingua per la sincronizzazione, senza
// decidere cosa farne (quello resta ai chiamanti: updateLanguage.js e
// updateAllSubLanguages.js). L'invariante che deve garantire: `oldText` è il testo su disco
// SOLO quando `status === "ok"`, `null` in ogni altro caso — è quel `null` che più a valle
// forza la riscrittura del file.
//
//   node test/list/readLanguageForSync.test.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readLanguageForSync from "../../lib/dev/vite/uty/readLanguageForSync.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function cartella() {
  const dir = mkdtempSync(join(tmpdir(), "vt-sync-"));
  temporanee.push(dir);
  return dir;
}

console.log("\n== file non creato -> \"missing\" ==");
{
  const dir = cartella();
  const esito = readLanguageForSync(join(dir, "it-IT.yml"));
  eq("status", "missing", esito.status);
  eq("oldText", null, esito.oldText);
}

console.log("\n== una cartella con quel nome -> \"unreadable\" ==");
{
  const dir = cartella();
  const filePath = join(dir, "it-IT.yml");
  mkdirSync(filePath);
  const esito = readLanguageForSync(filePath);
  eq("status", "unreadable", esito.status);
  eq("oldText", null, esito.oldText);
  eq("error presente", true, esito.error instanceof Error);
}

console.log("\n== una riga fuori formato -> \"corrupted\" ==");
{
  const dir = cartella();
  const testo = "questa non è una riga valida\n";
  const filePath = join(dir, "it-IT.yml");
  writeFileSync(filePath, testo, "utf8");
  const esito = readLanguageForSync(filePath);
  eq("status", "corrupted", esito.status);
  eq("oldText", null, esito.oldText);
  eq("error.sourceText è il testo del file", testo, esito.error?.sourceText);
}

console.log("\n== file vuoto (zero byte) -> \"empty\" ==");
{
  const dir = cartella();
  const filePath = join(dir, "it-IT.yml");
  writeFileSync(filePath, "", "utf8");
  const esito = readLanguageForSync(filePath);
  eq("status", "empty", esito.status);
  eq("oldText", null, esito.oldText);
}

console.log("\n== file valido -> \"ok\", con table e meta.tableVersion ==");
{
  const dir = cartella();
  const testo = '# TableVersion: 1\nApp_a: "Ciao"\n';
  const filePath = join(dir, "it-IT.yml");
  writeFileSync(filePath, testo, "utf8");
  const esito = readLanguageForSync(filePath);
  eq("status", "ok", esito.status);
  eq("table.App_a", "Ciao", esito.table?.App_a);
  eq("meta.tableVersion", 1, esito.meta?.tableVersion);
  eq("oldText è il testo su disco", testo, esito.oldText);
}

console.log("\n== l'invariante: oldText è null ovunque tranne \"ok\" ==");
{
  const dir = cartella();
  const casi = [
    join(dir, "missing.yml"),
  ];
  const cartellaFinta = join(dir, "cartella.yml");
  mkdirSync(cartellaFinta);
  casi.push(cartellaFinta);
  const corrotto = join(dir, "corrotto.yml");
  writeFileSync(corrotto, "riga non valida\n", "utf8");
  casi.push(corrotto);
  const vuoto = join(dir, "vuoto.yml");
  writeFileSync(vuoto, "", "utf8");
  casi.push(vuoto);

  for (const filePath of casi) {
    const esito = readLanguageForSync(filePath);
    eq(`${esito.status} · oldText null`, null, esito.oldText);
  }
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
