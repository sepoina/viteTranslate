// Il contratto nuovo introdotto dal piano 4.0.7: il layout dell'intestazione generata da
// buildLanguageHeader diventa parte del formato che parseLanguageFile riconosce (la riga
// TableVersion), invece di essere pura decorazione. Senza questo test, chi riallinea le
// colonne dell'intestazione o sposta quella riga rompe in silenzio la lettura della versione:
// il file resterebbe comunque leggibile come testo, solo senza più dire a quale formato
// appartiene.
//
// Copre anche `sameIgnoringProcessed`, che vive nello stesso file: è la funzione su cui la
// sincronizzazione decide se riscrivere un file (vedi updateLanguage.js, updateAllSubLanguages.js).
//
//   node test/list/headerContract.test.mjs
import buildLanguageHeader, { sameIgnoringProcessed } from "../../lib/dev/vite/uty/buildLanguageHeader.js";
import parseLanguageFile from "../../lib/dev/vite/uty/parseLanguageFile.js";
import { BUILDER_VERSION } from "../../lib/dev/vite/uty/builderVersion.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

console.log("\n== buildLanguageHeader produce una riga che parseLanguageFile riconosce ==");
{
  const header = buildLanguageHeader({ tag: "it-IT", isSource: true, missingCount: 3, now: new Date(2026, 0, 2, 3, 4) });
  const { table, meta } = parseLanguageFile(`${header}\nApp_a: "x"\n`, "x.yml");
  eq("la versione scritta è quella letta", BUILDER_VERSION, meta.tableVersion);
  // La riga di respiro finale (un "#" da solo) è decorazione: un commento come le altre, non
  // deve mai finire in tabella né confondersi con TableVersion.
  eq("l'ultima riga dell'intestazione è un commento vuoto", true, header.endsWith("\n#"));
  eq("...e non finisce in tabella", 1, Object.keys(table).length);
  eq("il conteggio è nell'intestazione", true, /missing key: 3/.test(header));
  eq("il tag è nell'intestazione", true, header.includes("code: it-IT"));
  eq("marcata come sourceLanguage", true, header.includes("(sourceLanguage)"));
}
{
  const header = buildLanguageHeader({ tag: "en-US", isSource: false, missingCount: 0, now: new Date(2026, 0, 2, 3, 4) });
  eq("una sub-lingua non è marcata come sourceLanguage", false, header.includes("(sourceLanguage)"));
}

console.log("\n== sameIgnoringProcessed: maschera solo la riga del timestamp ==");
{
  const a = buildLanguageHeader({ tag: "it-IT", isSource: true, missingCount: 1, now: new Date(2026, 0, 2, 3, 4) });
  const b = buildLanguageHeader({ tag: "it-IT", isSource: true, missingCount: 1, now: new Date(2026, 5, 20, 18, 59) });
  eq("stesso contenuto, solo il timestamp cambia -> uguali", true, sameIgnoringProcessed(a, b));

  const c = buildLanguageHeader({ tag: "it-IT", isSource: true, missingCount: 2, now: new Date(2026, 0, 2, 3, 4) });
  // "missing key" è il segnale che deve far scattare la riscrittura quando cambia solo la
  // classificazione tradotto/da tradurre: è il lavoro che faceva "incomplete" prima del piano
  // 4.0.7, e mascherare l'intestazione intera lo renderebbe cieco esattamente qui.
  eq("missing key diverso -> diversi", false, sameIgnoringProcessed(a, c));

  eq("un corpo diverso dopo intestazioni uguali -> diversi", false, sameIgnoringProcessed(`${a}\nApp_a: "x"`, `${a}\nApp_a: "y"`));
  eq("stesso corpo, solo il timestamp diverso -> uguali", true, sameIgnoringProcessed(`${a}\nApp_a: "x"`, `${b}\nApp_a: "x"`));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
