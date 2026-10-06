// Il contratto fra la libreria e Results nell'estensione per l'editor: l'export
// `@sepoina/vitetranslate/ide/scan` (lib/ide/scan.js). La sonda di Results lo carica dalla libreria
// installata nel progetto, e una volta pubblicato non si torna indietro: gli export si aggiungono,
// non si tolgono. L'elenco dei nomi qui sotto è scritto apposta: chi ne aggiunge uno lo aggiorna,
// chi ne toglie uno se ne accorge.
//
//   node test/list/ideScanEntry.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "../../lib/ide/scan.js";
import { IDE_API_MIN } from "../../idePlugin/src/probes/markedScan.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const REPO = fileURLToPath(new URL("../../", import.meta.url));

console.log("\n== lib/ide/scan.js: i nomi e la versione del contratto ==");
{
  eq("gli export, esattamente questi", [
    "IDE_API", "autoWrapKey", "hash", "isLanguageFileName", "listFiles", "loadExtractMarkers", "mayHaveMarkers",
    "readLanguageFile", "readMarkerIndex", "tagFromFileName", "walkSource",
  ], Object.keys(S).sort());
  eq("IDE_API: un intero da 1 in su", true, Number.isInteger(S.IDE_API) && S.IDE_API >= 1);
  eq("l'estensione del repo non chiede più di quello che c'è", true, S.IDE_API >= IDE_API_MIN);
  eq("loadExtractMarkers: extractMarkers", "function", typeof (await S.loadExtractMarkers()));
}

console.log("\n== package.json: l'export dichiarato ==");
{
  const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
  eq("exports[\"./ide/scan\"]", "./lib/ide/scan.js", pkg.exports?.["./ide/scan"]);
  const viaPacchetto = await import("@sepoina/vitetranslate/ide/scan");
  eq("si risolve per nome (self-reference)", S.IDE_API, viaPacchetto.IDE_API);
}

console.log("\n== la sonda non importa la libreria del repo ==");
{
  // Le sonde girano nel progetto dell'utente: la libreria è quella installata lì, mai lib/ di qui.
  const dir = join(REPO, "idePlugin/src/probes");
  const dalRepo = readdirSync(dir)
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => /from\s+["'][^"']*\/lib\//.test(readFileSync(join(dir, f), "utf8")));
  eq("nessun import statico da lib/ in idePlugin/src/probes", [], dalRepo);
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
