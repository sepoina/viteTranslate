// Lo spazio dati del record di --fastverify: <baseDir>/node_modules/.viteTranslate/scan.json.
//
// Stesso contratto di sessionStore.test.mjs, e per lo stesso motivo (vedi il commento in cima a
// scanRecord.js): un errore di I/O, un JSON corrotto, una versione di schema sconosciuta valgono
// tutti "nessun record precedente", e senza `node_modules` non si scrive nulla.
//
//   node test/list/scanRecord.test.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanPath, readScan, writeScan, clearScan } from "../../lib/dev/vite/uty/scanRecord.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
/** Un baseDir usa e getta, con node_modules già presente (il caso comune). */
function progetto({ conNodeModules = true } = {}) {
  const baseDir = mkdtempSync(join(tmpdir(), "vt-scan-"));
  temporanee.push(baseDir);
  if (conNodeModules) mkdirSync(join(baseDir, "node_modules"), { recursive: true });
  return baseDir;
}

// ------------------------------------------------------- scrittura e rilettura
console.log("\n== scrive e rilegge ==");
{
  const baseDir = progetto();
  writeScan(baseDir, { srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT", keys: 3 });
  const s = readScan(baseDir);

  eq("srcDir", "src", s?.srcDir);
  eq("keys", 3, s?.keys);
  eq("version la mette lo store", 1, s?.version);
  eq("pkgVersion presente", true, typeof s?.pkgVersion === "string" && s.pkgVersion.length > 0);
  eq("updatedAt è una data ISO", true, !Number.isNaN(Date.parse(s?.updatedAt ?? "")));
  eq("il file sta dove dice scanPath", true, existsSync(scanPath(baseDir)));
}

// ------------------------------------------------------- sostituzione, non merge
console.log("\n== writeScan sostituisce, non fa merge ==");
{
  const baseDir = progetto();
  writeScan(baseDir, { srcDir: "src", localeDir: "locale", keys: 3, files: { "src/A.jsx": [1, 2] } });
  writeScan(baseDir, { srcDir: "src", localeDir: "locale", keys: 5 });
  const s = readScan(baseDir);

  eq("il campo nuovo c'è", 5, s?.keys);
  eq("i campi non ripassati spariscono (niente merge)", undefined, s?.files);
}

// ------------------------------------------------------- clearScan
console.log("\n== clearScan ==");
{
  const baseDir = progetto();
  writeScan(baseDir, { srcDir: "src", localeDir: "locale" });
  eq("il record c'è prima di clearScan", true, readScan(baseDir) !== null);
  clearScan(baseDir);
  eq("il record sparisce dopo clearScan", null, readScan(baseDir));

  let lanciato = false;
  try {
    clearScan(baseDir); // il file non c'è più: non deve lanciare
  } catch {
    lanciato = true;
  }
  eq("clearScan su un file assente non lancia", false, lanciato);
}

// ------------------------------------------------------- non lancia mai
console.log("\n== letture rotte: null, mai un'eccezione ==");
{
  const baseDir = progetto();
  mkdirSync(join(baseDir, "node_modules", ".viteTranslate"), { recursive: true });
  writeFileSync(scanPath(baseDir), "{ questo non è json", "utf8");
  eq("JSON corrotto -> null", null, readScan(baseDir));

  const baseDir2 = progetto();
  eq("nessun file -> null", null, readScan(baseDir2));

  const baseDir3 = progetto();
  mkdirSync(join(baseDir3, "node_modules", ".viteTranslate"), { recursive: true });
  writeFileSync(scanPath(baseDir3), JSON.stringify({ version: 999, srcDir: "x" }), "utf8");
  eq("version sconosciuta -> null", null, readScan(baseDir3));
}

// ------------------------------------------------------- node_modules assente
console.log("\n== senza node_modules: non scrive niente, non lancia ==");
{
  const baseDir = progetto({ conNodeModules: false });
  let lanciato = false;
  try {
    writeScan(baseDir, { srcDir: "src", localeDir: "locale" });
  } catch {
    lanciato = true;
  }
  eq("nessuna eccezione", false, lanciato);
  eq("node_modules non creata", false, existsSync(join(baseDir, "node_modules")));
  eq("readScan resta null", null, readScan(baseDir));
}

// ------------------------------------------------------- scrittura atomica
console.log("\n== scrittura atomica: nessun file temporaneo residuo ==");
{
  const baseDir = progetto();
  writeScan(baseDir, { srcDir: "src", localeDir: "locale" });
  const dentro = readdirSync(join(baseDir, "node_modules", ".viteTranslate"));
  eq("solo scan.json, niente .tmp", "scan.json", dentro.join());
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
