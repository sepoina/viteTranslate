// Estensione per l'editor (idePlugin): quali progetti elenca il pannello (pickProject.mjs), su un
// albero di cartelle vero, creato in una cartella temporanea.
//
//   node test/list/idePluginPick.test.mjs
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { dedupeConfigs, inNodeModules, CONFIG_GLOB, projectOf, pathKey } from "../../idePlugin/src/pickProject.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const radice = mkdtempSync(join(tmpdir(), "vt-idepick-"));
const tocca = (rel) => {
  const file = join(radice, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "", "utf8");
  return file;
};
//   radice/
//     lib/y.js                      nessun config
//     a/vite.config.js, a/src/deep/x.jsx
//     b/vite.config.ts, b/vite.config.js      due config: vince .js (ordine di CONFIG_FILES)
//     node_modules/pkg/vite.config.js, node_modules/pkg/i.js
tocca("lib/y.js");
tocca("a/vite.config.js");
const x = tocca("a/src/deep/x.jsx");
tocca("b/vite.config.ts");
tocca("b/vite.config.js");
tocca("node_modules/pkg/vite.config.js");
const nm = tocca("node_modules/pkg/i.js");
const tutti = [
  join(radice, "b/vite.config.ts"),
  join(radice, "b/vite.config.js"),
  join(radice, "a/vite.config.js"),
  join(radice, "node_modules/pkg/vite.config.js"),
];

console.log("\n== node_modules ==");
eq("file in node_modules", true, inNodeModules(nm));
eq("file fuori", false, inNodeModules(x));

console.log("\n== l'elenco: dedupe e ordine ==");
eq(
  "un progetto per cartella, .js prima di .ts, niente node_modules",
  [
    { dir: join(radice, "a"), configFile: "vite.config.js" },
    { dir: join(radice, "b"), configFile: "vite.config.js" },
  ],
  dedupeConfigs(tutti)
);
eq("glob per findFiles", "**/{vite.config.js,vite.config.mjs,vite.config.ts,vite.config.cjs,vite.config.mts,vite.config.cts}", CONFIG_GLOB);

console.log("\n== il progetto del file attivo ==");
{
  const r = join("/", "ws");
  const progetti = [{ dir: join(r, "app") }, { dir: join(r, "app", "packages", "ui") }, { dir: join(r, "application") }];
  const di = (rel, caseless = false) => projectOf(progetti, join(r, rel), caseless)?.dir ?? null;
  eq("il file sta nel suo progetto", join(r, "app"), di("app/src/App.jsx"));
  eq("progetti annidati: vince il più profondo", join(r, "app", "packages", "ui"), di("app/packages/ui/src/Button.jsx"));
  eq("una cartella col nome che comincia uguale non conta", join(r, "application"), di("application/src/x.js"));
  eq("fuori da ogni progetto: null", null, di("README.md"));
  eq("la cartella stessa non è un suo file", null, projectOf(progetti, join(r, "application"), false)?.dir ?? null);
  eq("senza maiuscole, se richiesto (Windows)", join(r, "app"), di("APP/src/App.jsx", true));
  eq("pathKey normalizza", pathKey(join(r, "app", "src"), false), pathKey(join(r, "app", "lib", "..", "src"), false));
}

rmSync(radice, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
