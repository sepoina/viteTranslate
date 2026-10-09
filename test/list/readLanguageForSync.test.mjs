// readLanguageForSync classifica lo stato di un file di lingua per la sincronizzazione, senza
// decidere cosa farne (quello resta ai chiamanti: updateLanguage.js e
// updateAllSubLanguages.js). L'invariante che deve garantire: `oldText` è il testo su disco
// SOLO quando `status === "ok"`, `null` in ogni altro caso — è quel `null` che più a valle
// forza la riscrittura del file.
//
//   node test/list/readLanguageForSync.test.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync, chmodSync, realpathSync, statSync } from "node:fs";
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

// ---- 4.7.1: the snapshot (doc/ImplementationPlans/4_7_1.md § S2) ----------------------------
console.log("\n== snapshot: absent / file / null ==");
{
  const dir = cartella();
  eq("missing -> { kind: absent }", "absent", readLanguageForSync(join(dir, "none.yml")).snapshot?.kind);

  const folderPath = join(dir, "folder.yml");
  mkdirSync(folderPath);
  eq("unreadable -> null", null, readLanguageForSync(folderPath).snapshot);

  const text = '# TableVersion: 1\nApp_a: "Ciao"\n';
  const filePath = join(dir, "ok.yml");
  writeFileSync(filePath, text, "utf8");
  if (process.platform !== "win32") chmodSync(filePath, 0o640);
  const ok = readLanguageForSync(filePath);
  eq("ok -> kind file", "file", ok.snapshot.kind);
  eq("ok -> bytes are the file", text, ok.snapshot.bytes.toString("utf8"));
  eq("ok -> bytes is a Buffer", true, Buffer.isBuffer(ok.snapshot.bytes));
  eq("ok -> realPath", realpathSync(filePath), ok.snapshot.realPath);
  eq("ok -> mode", statSync(filePath).mode & 0o7777, ok.snapshot.mode);

  const empty = join(dir, "empty.yml");
  writeFileSync(empty, "");
  const e = readLanguageForSync(empty);
  eq("zero bytes -> status empty", "empty", e.status);
  eq("zero bytes -> still a file snapshot", "file", e.snapshot.kind);
  eq("zero bytes -> empty Buffer", 0, e.snapshot.bytes.length);

  const bad = join(dir, "bad.yml");
  writeFileSync(bad, Buffer.from([0xff, 0xfe, 0x00, 0x41]));
  const c = readLanguageForSync(bad);
  eq("corrupted -> file snapshot", "file", c.snapshot.kind);
  eq("corrupted -> the exact bytes", "fffe0041", c.snapshot.bytes.toString("hex"));
  eq("oldText never derived from the snapshot", null, c.oldText);
}

console.log("\n== a dangling symlink is unreadable, not missing ==");
{
  const dir = cartella();
  const link = join(dir, "en-US.yml");
  let linked = true;
  try {
    symlinkSync(join(dir, "nowhere.yml"), link);
  } catch (error) {
    if (error.code !== "EPERM") throw error;
    linked = false;
    console.log("  skip  dangling symlink: cannot create one here (EPERM)");
  }
  if (linked) {
    const esito = readLanguageForSync(link);
    eq("status", "unreadable", esito.status);
    eq("snapshot", null, esito.snapshot);
    eq("error.unreadable", true, esito.error?.unreadable);
  }
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
