// Il tema del sito vive in site/theme/ e si COPIA dentro ogni progetto che lo usa, in src/theme/.
// Una pagina deve restare autonoma (lo zip per StackBlitz, la cartella scaricata da GitHub), quindi
// non può importare da fuori della sua cartella. La copia è intera e identica byte per byte, e
// src/theme/ si riscrive tutta: i file tolti da site/theme/ spariscono anche dalle copie.
// Con il tema viaggiano i dati del sito che le pagine mostrano (EXTRA).
//
//   node site/syncTheme.mjs            # riscrive le copie (npm run site:theme; lo fa anche site:build)
//   node site/syncTheme.mjs --check    # non scrive: elenca le differenze, esce con 1 se ce ne sono
//   node site/syncTheme.mjs --watch    # riscrive a ogni modifica, per lavorare al tema con un dev server aperto
//
// Chi riceve il tema: site/landing, e ogni site/pages/* con "vitetranslateSite": { "theme": true }.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, watch } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// runtimeSize.json lo scrive `npm run estimateSize` in site/ (AGENTS.md lo cerca lì) e lo leggono le pagine.
const EXTRA = ["site/runtimeSize.json"];

/**
 * I file che ogni progetto riceve: quelli di site/theme/ più EXTRA.
 * @param {string} [radice] la radice del repo (nei test, una cartella finta)
 * @returns {{ name: string, from: string }[]} ordinati per nome
 */
export function themeSources(radice = RADICE) {
  const tema = readdirSync(join(radice, "site/theme"), { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => ({ name: d.name, from: join(radice, "site/theme", d.name) }));
  const extra = EXTRA.filter((rel) => existsSync(join(radice, rel))).map((rel) => ({ name: basename(rel), from: join(radice, rel) }));
  const tutti = [...tema, ...extra];
  const doppio = tutti.find((f, i) => tutti.findIndex((g) => g.name === f.name) !== i);
  if (doppio) throw new Error(`site/theme/${doppio.name}: il nome è già usato da un file che arriva da fuori (${EXTRA.join(", ")})`);
  return tutti.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * I progetti che ricevono il tema: la landing, poi le pagine che lo chiedono.
 * @param {string} [radice]
 * @returns {string[]} relativi alla radice, per esempio "site/pages/playground"
 */
export function themeTargets(radice = RADICE) {
  const pagine = [];
  const base = join(radice, "site/pages");
  if (existsSync(base)) {
    for (const d of readdirSync(base, { withFileTypes: true })) {
      const file = join(base, d.name, "package.json");
      if (!d.isDirectory() || !existsSync(file)) continue;
      if (JSON.parse(readFileSync(file, "utf8")).vitetranslateSite?.theme === true) pagine.push(`site/pages/${d.name}`);
    }
  }
  const landing = existsSync(join(radice, "site/landing/package.json")) ? ["site/landing"] : [];
  return [...landing, ...pagine.sort()];
}

/**
 * Le differenze fra la sorgente e le copie, una riga per file mancante, diverso o in più.
 * @param {string} [radice]
 * @returns {string[]} vuoto se tutto è allineato
 */
export function checkTheme(radice = RADICE) {
  const sorgenti = themeSources(radice);
  const nomi = sorgenti.map((f) => f.name);
  const diff = [];
  for (const t of themeTargets(radice)) {
    const dir = join(radice, t, "src/theme");
    const copie = existsSync(dir) ? readdirSync(dir).sort() : [];
    for (const { name, from } of sorgenti) {
      if (!copie.includes(name)) diff.push(`${t}/src/theme/${name}: manca`);
      else if (!readFileSync(join(dir, name)).equals(readFileSync(from))) diff.push(`${t}/src/theme/${name}: diverso`);
    }
    for (const name of copie) if (!nomi.includes(name)) diff.push(`${t}/src/theme/${name}: in più`);
  }
  return diff;
}

/**
 * Riscrive src/theme/ in ogni progetto che riceve il tema.
 * @param {string} [radice]
 * @returns {string[]} i progetti scritti
 */
export function syncTheme(radice = RADICE) {
  const sorgenti = themeSources(radice);
  const targets = themeTargets(radice);
  for (const t of targets) {
    const dir = join(radice, t, "src/theme");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const { name, from } of sorgenti) cpSync(from, join(dir, name));
  }
  return targets;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    const diff = checkTheme();
    for (const d of diff) console.error(d);
    if (diff.length) console.error("\ncopie del tema non allineate: npm run site:theme");
    process.exit(diff.length ? 1 : 0);
  }
  const scrivi = () => console.log(`tema copiato in ${syncTheme().join(", ")}`);
  scrivi();
  if (args.includes("--watch")) {
    let timer = 0;
    const ancora = () => {
      clearTimeout(timer);
      timer = setTimeout(scrivi, 100);
    };
    watch(join(RADICE, "site/theme"), ancora);
    for (const rel of EXTRA) if (existsSync(join(RADICE, rel))) watch(join(RADICE, rel), ancora);
    console.log("in ascolto su site/theme/ (Ctrl+C per uscire)");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
