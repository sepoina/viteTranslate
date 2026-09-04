// Lo spazio dati fra sessioni: <baseDir>/node_modules/.viteTranslate/session.json.
//
// Il contratto è tutto nel "non deve mai far cadere niente": un errore di I/O, un JSON
// corrotto, una versione di schema sconosciuta valgono tutti "nessuna sessione precedente",
// e senza `node_modules` non si scrive nulla. Una cache che si fa notare quando è rotta è
// peggio che non averla (vedi il commento in cima a sessionStore.js).
//
//   node test/list/sessionStore.test.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionPath, readSession, writeSession } from "../../lib/dev/vite/uty/sessionStore.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
/** Un baseDir usa e getta, con node_modules già presente (il caso comune). */
function progetto({ conNodeModules = true } = {}) {
  const baseDir = mkdtempSync(join(tmpdir(), "vt-session-"));
  temporanee.push(baseDir);
  if (conNodeModules) mkdirSync(join(baseDir, "node_modules"), { recursive: true });
  return baseDir;
}

// ------------------------------------------------------- scrittura e rilettura
console.log("\n== scrive e rilegge ==");
{
  const baseDir = progetto();
  writeSession(baseDir, { localeDir: "locale", sourceLanguage: "it-IT" });
  const s = readSession(baseDir);

  eq("localeDir", "locale", s?.localeDir);
  eq("sourceLanguage", "it-IT", s?.sourceLanguage);
  eq("version la mette lo store", 1, s?.version);
  eq("pkgVersion presente", true, typeof s?.pkgVersion === "string" && s.pkgVersion.length > 0);
  eq("updatedAt è una data ISO", true, !Number.isNaN(Date.parse(s?.updatedAt ?? "")));
  eq("il file sta dove dice sessionPath", true, existsSync(sessionPath(baseDir)));
}

// ------------------------------------------------------- merge superficiale
console.log("\n== merge superficiale, non sostituzione ==");
{
  const baseDir = progetto();
  writeSession(baseDir, { localeDir: "locale", sourceLanguage: "it-IT" });
  writeSession(baseDir, { lastLanguage: "fr-FR" });
  const s = readSession(baseDir);

  eq("i campi vecchi restano", "locale", s?.localeDir);
  eq("il campo nuovo si aggiunge", "fr-FR", s?.lastLanguage);

  writeSession(baseDir, { localeDir: "src/altra" });
  const s2 = readSession(baseDir);
  eq("un campo sovrascritto cambia solo lui", "src/altra", s2?.localeDir);
  eq("gli altri campi non si perdono", "fr-FR", s2?.lastLanguage);
}

// ------------------------------------------------------- non lancia mai
console.log("\n== letture rotte: null, mai un'eccezione ==");
{
  const baseDir = progetto();
  mkdirSync(join(baseDir, "node_modules", ".viteTranslate"), { recursive: true });
  writeFileSync(sessionPath(baseDir), "{ questo non è json", "utf8");
  eq("JSON corrotto -> null", null, readSession(baseDir));

  const baseDir2 = progetto();
  eq("nessun file -> null", null, readSession(baseDir2));

  const baseDir3 = progetto();
  mkdirSync(join(baseDir3, "node_modules", ".viteTranslate"), { recursive: true });
  writeFileSync(sessionPath(baseDir3), JSON.stringify({ version: 999, localeDir: "x" }), "utf8");
  eq("version sconosciuta -> null", null, readSession(baseDir3));
}

// ------------------------------------------------------- node_modules assente
console.log("\n== senza node_modules: non scrive niente, non lancia ==");
{
  const baseDir = progetto({ conNodeModules: false });
  let lanciato = false;
  try {
    writeSession(baseDir, { localeDir: "locale", sourceLanguage: "it-IT" });
  } catch {
    lanciato = true;
  }
  eq("nessuna eccezione", false, lanciato);
  eq("node_modules non creata", false, existsSync(join(baseDir, "node_modules")));
  eq("readSession resta null", null, readSession(baseDir));
}

// ------------------------------------------------------- scrittura atomica
console.log("\n== scrittura atomica: nessun file temporaneo residuo ==");
{
  const baseDir = progetto();
  writeSession(baseDir, { localeDir: "locale", sourceLanguage: "it-IT" });
  const dentro = readdirSync(join(baseDir, "node_modules", ".viteTranslate"));
  eq("solo session.json, niente .tmp", "session.json", dentro.join());
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
