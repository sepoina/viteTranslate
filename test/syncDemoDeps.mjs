// Allinea la dipendenza da @sepoina/vitetranslate delle demo che sono workspace (demo/Vite_8/*)
// alla versione della radice: "^<versione>".
//
//   node test/syncDemoDeps.mjs           # riscrive i package.json delle demo e il lockfile
//   node test/syncDemoDeps.mjs --check   # non scrive niente, esce con 1 se qualcosa non torna
//
// La stessa riga serve due persone diverse:
//   - qui, nel repo, le demo sono workspace: npm le collega alla libreria della radice (il link in
//     node_modules/@sepoina/vitetranslate), ma solo se la versione della radice soddisfa il range.
//     Se non lo soddisfa, npm install scarica da npm la versione che lo soddisfa e la mette in
//     demo/.../node_modules: la demo smette di vedere il codice in sviluppo, in silenzio. Succede
//     sempre con una pre-release, che nessun range senza suffisso accetta: "^4.5.0" non prende
//     4.6.0-rc.1.
//   - chi scarica la sola cartella della demo non ha la radice: npm risolve lo stesso range sul
//     registro e prende la più alta che lo soddisfa, cioè almeno la versione con cui la demo è
//     stata pubblicata.
// "^<versione della radice>" va bene a entrambi. Gira da solo a ogni `npm version` (script
// "version" in package.json, che aggiunge al commit i file toccati); a mano, `npm run sync:demos`.
// Il test demoDeps controlla che non resti indietro.
//
// Le demo sono i workspace della radice che stanno sotto demo/: aggiungerne una a "workspaces"
// basta, questo file non va toccato. Fuori restano playground e playEdge, che dipendono da
// "file:.." e non si scaricano da sole, e le demo che non sono workspace (demo/Vite_7/minimal):
// npm non le collega comunque alla radice, e la versione che dichiarano è una scelta loro.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACCHETTO = "@sepoina/vitetranslate";
const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Le demo come percorsi relativi alla radice ("demo/Vite_8/minimal"), quelli del lockfile. */
export function demoDirs(radice = RADICE) {
  const { workspaces = [] } = JSON.parse(readFileSync(join(radice, "package.json"), "utf8"));
  const sottocartelle = (dir) =>
    existsSync(join(radice, dir))
      ? readdirSync(join(radice, dir), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `${dir}/${d.name}`)
      : [];
  // Solo le due forme che "workspaces" usa qui: una cartella, o "cartella/*".
  return workspaces
    .filter((w) => w.startsWith("demo/"))
    .flatMap((w) => (w.endsWith("/*") ? sottocartelle(w.slice(0, -2)) : [w]))
    .filter((rel) => existsSync(join(radice, rel, "package.json")))
    .sort();
}

/**
 * Che cosa andrebbe cambiato: una voce per ogni demo il cui range non è "^<versione>".
 * @returns {{ demo: string, attuale: string | undefined, atteso: string }[]}
 */
export function differenze(radice = RADICE) {
  const atteso = `^${JSON.parse(readFileSync(join(radice, "package.json"), "utf8")).version}`;
  return demoDirs(radice)
    .map((demo) => {
      const pkg = JSON.parse(readFileSync(join(radice, demo, "package.json"), "utf8"));
      return { demo, attuale: pkg.dependencies?.[PACCHETTO], atteso };
    })
    .filter((d) => d.attuale !== d.atteso);
}

function sincronizza(radice = RADICE) {
  const da = differenze(radice);
  if (da.length === 0) return da;
  for (const { demo, attuale, atteso } of da) {
    // Sostituzione della sola riga, non JSON.stringify: i package.json delle demo non sono tutti
    // formattati come lo riscriverebbe JSON, e il diff deve restare di una riga.
    const file = join(radice, demo, "package.json");
    const testo = readFileSync(file, "utf8");
    const letterale = (s) => JSON.stringify(s).replace(/[.^$*+?()[\]{}|\\/]/g, "\\$&");
    const riga = attuale === undefined ? null : new RegExp(`(${letterale(PACCHETTO)}\\s*:\\s*)${letterale(attuale)}`);
    if (!riga || !riga.test(testo)) throw new Error(`${demo}/package.json: nessuna dipendenza ${PACCHETTO} da aggiornare`);
    writeFileSync(file, testo.replace(riga, `$1${JSON.stringify(atteso)}`));
  }
  // Il lockfile ripete le dipendenze di ogni workspace: lasciarlo indietro vorrebbe dire un
  // npm ci che rifiuta di partire. Qui JSON.stringify va bene: è npm stesso a scriverlo così.
  const lock = join(radice, "package-lock.json");
  if (existsSync(lock)) {
    const dati = JSON.parse(readFileSync(lock, "utf8"));
    for (const { demo, atteso } of da) {
      const voce = dati.packages?.[demo]?.dependencies;
      if (voce && PACCHETTO in voce) voce[PACCHETTO] = atteso;
    }
    writeFileSync(lock, `${JSON.stringify(dati, null, 2)}\n`);
  }
  // Lanciato da npm version: i file toccati vanno nel commit che npm sta per fare, come
  // package.json. Solo quelli, non "git add demo": nelle demo può esserci altro in sospeso.
  // Con --no-git-tag-version non c'è commit, e restano soltanto in stage.
  if (process.env.npm_lifecycle_event === "version") {
    const toccati = da.map(({ demo }) => `${demo}/package.json`);
    if (existsSync(lock)) toccati.push("package-lock.json");
    execFileSync("git", ["add", "--", ...toccati], { cwd: radice, stdio: "inherit" });
  }
  return da;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const soloControllo = process.argv.includes("--check");
  const da = soloControllo ? differenze() : sincronizza();
  for (const { demo, attuale, atteso } of da) console.log(`${demo}: ${attuale ?? "(assente)"} -> ${atteso}`);
  if (da.length === 0) console.log("demo già allineate alla versione della radice");
  if (soloControllo && da.length > 0) {
    console.log("\nnpm run sync:demos per allinearle");
    process.exit(1);
  }
}
