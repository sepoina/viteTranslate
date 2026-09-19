// Allinea la dipendenza da @sepoina/vitetranslate delle demo che sono workspace (demo/Vite_8/*, site/*)
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
// Il test demoDeps (e --check) controlla che non resti indietro, ma con l'invariante vera e non
// con l'uguaglianza: basta che la versione della radice soddisfi il range della demo. "^4.6.2-rc.1"
// vale per 4.6.2-rc.2 e per 4.6.2, quindi fra rc dello stesso X.Y.Z, e fino alla stabile, non c'è
// niente da riallineare a mano; serve solo passando a un altro X.Y.Z (4.6.3-rc.1), ed è lì che
// `npm version` lo fa da sé. `npm run sync:demos` riscrive comunque il range esatto.
//
// Le demo sono i workspace della radice che stanno sotto demo/ o site/ (la landing e le pagine
// del sito): aggiungerne una a "workspaces" basta, questo file non va toccato. Fuori restano
// solo le demo che non sono workspace (demo/Vite_7/minimal): npm non le collega comunque alla
// radice, e la versione che dichiarano è una scelta loro.
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
    .filter((w) => w.startsWith("demo/") || w.startsWith("site/"))
    .flatMap((w) => (w.endsWith("/*") ? sottocartelle(w.slice(0, -2)) : [w]))
    .filter((rel) => existsSync(join(radice, rel, "package.json")))
    .sort();
}

const VERSIONE_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/;

function leggiVersione(testo) {
  const m = VERSIONE_RE.exec(testo);
  return m ? { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] } : null;
}

// Ordine di semver: una pre-release viene prima della stabile; gli identificatori numerici si
// confrontano come numeri e vengono prima di quelli alfanumerici; a parità, la più corta prima.
function confronta(a, b) {
  for (let i = 0; i < 3; i++) if (a.nums[i] !== b.nums[i]) return a.nums[i] < b.nums[i] ? -1 : 1;
  if (a.pre.length === 0 || b.pre.length === 0) return a.pre.length === b.pre.length ? 0 : a.pre.length === 0 ? 1 : -1;
  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const [x, y] = [a.pre[i], b.pre[i]];
    if (x === y) continue;
    const [nx, ny] = [/^\d+$/.test(x), /^\d+$/.test(y)];
    if (nx && ny) return +x < +y ? -1 : 1;
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return a.pre.length === b.pre.length ? 0 : a.pre.length < b.pre.length ? -1 : 1;
}

/**
 * `versione` soddisfa `range`? Solo la forma "^X.Y.Z[-pre]" che scrive questo script: qualunque
 * altra cosa vale "no", così una demo con un range di un'altra forma salta fuori invece di passare.
 * Come in semver, una pre-release soddisfa un caret solo se ha lo stesso X.Y.Z della base e la
 * base è a sua volta una pre-release: "^4.6.2-rc.1" prende 4.6.2-rc.2 e 4.6.2, non 4.6.3-rc.1.
 */
export function soddisfa(versione, range) {
  const v = leggiVersione(versione);
  const base = range?.startsWith("^") ? leggiVersione(range.slice(1)) : null;
  if (!v || !base) return false;

  if (confronta(v, base) < 0) return false;
  const [maj, min, pat] = base.nums;
  const sopra = maj > 0 ? [maj + 1, 0, 0] : min > 0 ? [0, min + 1, 0] : [0, 0, pat + 1];
  if (confronta(v, { nums: sopra, pre: ["0"] }) >= 0) return false;
  if (v.pre.length > 0 && !(base.pre.length > 0 && v.nums.every((n, i) => n === base.nums[i]))) return false;
  return true;
}

function versioneRadice(radice) {
  return JSON.parse(readFileSync(join(radice, "package.json"), "utf8")).version;
}

function dipendenza(radice, demo) {
  return JSON.parse(readFileSync(join(radice, demo, "package.json"), "utf8")).dependencies?.[PACCHETTO];
}

/**
 * Che cosa andrebbe riscritto: una voce per ogni demo il cui range non è esattamente
 * "^<versione>". È quello che scrive `sincronizza`.
 * @returns {{ demo: string, attuale: string | undefined, atteso: string }[]}
 */
export function differenze(radice = RADICE) {
  const atteso = `^${versioneRadice(radice)}`;
  return demoDirs(radice)
    .map((demo) => ({ demo, attuale: dipendenza(radice, demo), atteso }))
    .filter((d) => d.attuale !== d.atteso);
}

/**
 * Le demo che npm non collegherebbe alla radice: la versione della radice non soddisfa il loro
 * range. È quello che controllano il test e `--check`.
 * @returns {{ demo: string, attuale: string | undefined, atteso: string }[]}
 */
export function nonSoddisfatte(radice = RADICE) {
  const versione = versioneRadice(radice);
  return differenze(radice).filter((d) => !soddisfa(versione, d.attuale));
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
  const da = soloControllo ? nonSoddisfatte() : sincronizza();
  for (const { demo, attuale, atteso } of da) console.log(`${demo}: ${attuale ?? "(assente)"} -> ${atteso}`);
  if (da.length === 0) console.log(soloControllo ? "le demo accettano la versione della radice" : "demo già allineate alla versione della radice");
  if (soloControllo && da.length > 0) {
    console.log("\nnpm run sync:demos per allinearle");
    process.exit(1);
  }
}
