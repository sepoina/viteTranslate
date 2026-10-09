// writeLanguageFileIfChanged ordina, serializza e scrive un file di lingua — ma solo se i byte
// sono davvero cambiati (a parte la riga "processed:", che cambia a ogni sync anche a contenuto
// identico). Era la stessa terna ordina/serializza/confronta ripetuta in quattro punti.
//
//   node test/list/writeLanguageFile.test.mjs
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import writeLanguageFileIfChanged, { prepareLanguageFile } from "../../lib/dev/vite/uty/writeLanguageFile.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// 4.7.1: a write needs the snapshot of the read (`expected`). These files never existed, so the
// snapshot is "absent". Passing it is what lets the writer refuse to overwrite a file that
// appeared in the meantime (see atomicWrite.test.mjs for the conflict cases).
const ABSENT = { kind: "absent" };

const temporanee = [];
function cartella() {
  const dir = mkdtempSync(join(tmpdir(), "vt-write-"));
  temporanee.push(dir);
  return dir;
}

console.log("\n== oldText omesso: scrive sempre, e il file si rilegge ==");
{
  const dir = cartella();
  const filePath = join(dir, "it-IT.yml");
  const { written, text } = writeLanguageFileIfChanged({
    filePath, tag: "it-IT", isSource: true, table: { App_a: "Ciao" }, expected: ABSENT,
  });
  eq("written", true, written);
  eq("il file esiste", true, existsSync(filePath));
  eq("il file su disco è il testo prodotto", text, readFileSync(filePath, "utf8"));
}

console.log("\n== oldText uguale tranne \"processed:\": non scrive ==");
{
  const dir = cartella();
  // Un primo giro serve solo a farsi produrre il testo di riferimento, su un file a parte,
  // così il file di questo caso non esiste affatto: se writeLanguageFileIfChanged scrivesse
  // per errore lo si vede dalla sua sola comparsa, senza bisogno di controllare l'mtime.
  const riferimento = writeLanguageFileIfChanged({
    filePath: join(dir, "riferimento.yml"), tag: "it-IT", isSource: true, table: { App_a: "Ciao" }, expected: ABSENT,
  });
  const oldTextConAltroTimestamp = riferimento.text.replace(/processed: .*/, "processed: 1999-01-01 00:00");

  const filePath = join(dir, "it-IT.yml");
  const { written } = writeLanguageFileIfChanged({
    filePath, tag: "it-IT", isSource: true, table: { App_a: "Ciao" }, oldText: oldTextConAltroTimestamp,
  });
  eq("written", false, written);
  eq("il file non viene creato", false, existsSync(filePath));
}

console.log("\n== oldText che differisce su \"missing key\": scrive ==");
{
  const dir = cartella();
  const riferimento = writeLanguageFileIfChanged({
    filePath: join(dir, "riferimento.yml"), tag: "it-IT", isSource: true, table: { App_a: "Ciao" }, expected: ABSENT,
  });
  const oldTextConAltroConteggio = riferimento.text.replace(/missing key: \d+/, "missing key: 999");

  const filePath = join(dir, "it-IT.yml");
  const { written } = writeLanguageFileIfChanged({
    filePath, tag: "it-IT", isSource: true, table: { App_a: "Ciao" }, oldText: oldTextConAltroConteggio, expected: ABSENT,
  });
  eq("written", true, written);
  eq("il file viene creato", true, existsSync(filePath));
}

console.log("\n== isUntranslated: omesso vale \"valore null\", passato decide lui ==");
{
  const dir = cartella();
  const table = { App_a: "Ciao", App_b: null };

  const conDefault = writeLanguageFileIfChanged({
    filePath: join(dir, "default.yml"), tag: "it-IT", isSource: false, table, expected: ABSENT,
  });
  eq("default: App_b è untranslated", 1, conDefault.untranslated.length);
  eq("default: la chiave è App_b", "App_b", conDefault.untranslated[0][0]);

  // Un criterio esplicito che dice "tutto tradotto" ignora il valore null.
  const conCriterio = writeLanguageFileIfChanged({
    filePath: join(dir, "criterio.yml"), tag: "it-IT", isSource: false, table, isUntranslated: () => false, expected: ABSENT,
  });
  eq("criterio esplicito: nessuna chiave untranslated", 0, conCriterio.untranslated.length);
}

console.log("\n== una chiave fuori formato: lancia, non cattura ==");
{
  const dir = cartella();
  let lanciato = false;
  try {
    writeLanguageFileIfChanged({
      filePath: join(dir, "it-IT.yml"), tag: "it-IT", isSource: true, table: { "chiave non valida": "x" },
    });
  } catch {
    lanciato = true;
  }
  eq("lancia un errore", true, lanciato);
}

console.log("\n== 4.7.1: the snapshot is required to write, never to skip a write ==");
{
  const dir = cartella();
  const filePath = join(dir, "it-IT.yml");
  let error = null;
  try {
    writeLanguageFileIfChanged({ filePath, tag: "it-IT", isSource: true, table: { App_a: "Ciao" } });
  } catch (e) { error = e; }
  eq("no `expected`: TypeError", "TypeError", error?.name);
  eq("nothing was written", false, existsSync(filePath));

  // A file appeared after the read (snapshot said "absent"): refused, and the file is intact.
  writeFileSync(filePath, "someone else wrote this\n", "utf8");
  error = null;
  try {
    writeLanguageFileIfChanged({ filePath, tag: "it-IT", isSource: true, table: { App_a: "Ciao" }, expected: ABSENT });
  } catch (e) { error = e; }
  eq("stale snapshot: VT_FILE_CHANGED", "VT_FILE_CHANGED", error?.code);
  eq("the other edit is untouched", "someone else wrote this\n", readFileSync(filePath, "utf8"));
}

console.log("\n== prepareLanguageFile is pure ==");
{
  const p = prepareLanguageFile({ tag: "it-IT", isSource: true, table: { App_a: "Ciao" } });
  eq("changed without oldText", true, p.changed);
  eq("text is a language table", true, /TableVersion: \d+/.test(p.text));
  const again = prepareLanguageFile({ tag: "it-IT", isSource: true, table: { App_a: "Ciao" }, oldText: p.text.replace(/processed: .*/, "processed: 1999-01-01 00:00") });
  eq("unchanged ignoring processed", false, again.changed);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
