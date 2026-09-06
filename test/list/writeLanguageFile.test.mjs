// writeLanguageFileIfChanged ordina, serializza e scrive un file di lingua — ma solo se i byte
// sono davvero cambiati (a parte la riga "processed:", che cambia a ogni sync anche a contenuto
// identico). Era la stessa terna ordina/serializza/confronta ripetuta in quattro punti.
//
//   node test/list/writeLanguageFile.test.mjs
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import writeLanguageFileIfChanged from "../../lib/dev/vite/uty/writeLanguageFile.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

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
    filePath, tag: "it-IT", isSource: true, table: { App_a: "Ciao" },
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
    filePath: join(dir, "riferimento.yml"), tag: "it-IT", isSource: true, table: { App_a: "Ciao" },
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
    filePath: join(dir, "riferimento.yml"), tag: "it-IT", isSource: true, table: { App_a: "Ciao" },
  });
  const oldTextConAltroConteggio = riferimento.text.replace(/missing key: \d+/, "missing key: 999");

  const filePath = join(dir, "it-IT.yml");
  const { written } = writeLanguageFileIfChanged({
    filePath, tag: "it-IT", isSource: true, table: { App_a: "Ciao" }, oldText: oldTextConAltroConteggio,
  });
  eq("written", true, written);
  eq("il file viene creato", true, existsSync(filePath));
}

console.log("\n== isUntranslated: omesso vale \"valore null\", passato decide lui ==");
{
  const dir = cartella();
  const table = { App_a: "Ciao", App_b: null };

  const conDefault = writeLanguageFileIfChanged({
    filePath: join(dir, "default.yml"), tag: "it-IT", isSource: false, table,
  });
  eq("default: App_b è untranslated", 1, conDefault.untranslated.length);
  eq("default: la chiave è App_b", "App_b", conDefault.untranslated[0][0]);

  // Un criterio esplicito che dice "tutto tradotto" ignora il valore null.
  const conCriterio = writeLanguageFileIfChanged({
    filePath: join(dir, "criterio.yml"), tag: "it-IT", isSource: false, table, isUntranslated: () => false,
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

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
