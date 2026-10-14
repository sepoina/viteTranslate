// I controlli di chiusura di un bundle di release: `npm run testRelease`.
//
// Non è la suite (test/run.mjs scopre test/list/*.test.mjs e dice se il codice funziona): qui girano
// le verifiche di coerenza che si fanno prima di pubblicare — suite compresa, tema del sito,
// versioni delle demo, peso del README, peso del runtime, manuale. Ogni controllo è un file
// `test/release/*.check.mjs` che esporta `name` e `async run()` e risponde `{ level, lines }`
// ("ok" | "warn" | "ko"): aggiungerne uno è aggiungere un file, non toccare questo.
//
//   npm run testRelease                  # tutti, in ordine di nome
//   npm run testRelease -- --only docs   # solo quelli il cui nome contiene "docs"
//
// Esce con 1 se un controllo è KO, con 0 altrimenti (i warn non fanno fallire). Non è nel
// build del sito, nel `prepare` né nella CI: lo si lancia a mano alla chiusura di un bundle.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARTELLA = join(RADICE, "test/release");

const colora = process.stdout.isTTY ? (codice, testo) => `\x1b[${codice}m${testo}\x1b[0m` : (_codice, testo) => testo;
const verde = (t) => colora(32, t);
const rosso = (t) => colora(31, t);
const giallo = (t) => colora(33, t);
const tenue = (t) => colora(90, t);
const COLORE = { ok: verde, warn: giallo, ko: rosso };
let lanci = 0;
const ETICHETTA = { ok: "OK", warn: "WARN", ko: "KO" };

/** I file dei controlli di una cartella, in ordine di nome. */
export function scopri(cartella = CARTELLA) {
  return readdirSync(cartella).filter((f) => f.endsWith(".check.mjs")).sort();
}

/**
 * Lancia i controlli di una cartella. Un controllo esporta `name`, `run({ log })` e, se vuole, `description`
 * (cosa verifica, in una riga): `log(testo)` è come racconta i passaggi mentre lavora.
 * @param {string} [cartella] dove stanno i `*.check.mjs` (nei test, una cartella finta)
 * @param {{ only?: string, onStart?: (info: { name: string, description: string, index: number, total: number }) => void, onLog?: (name: string, testo: string) => void, onEnd?: (result: object) => void }} [opzioni]
 *   `only`: solo i controlli il cui nome contiene questa parola; `onStart`, `onLog`, `onEnd`: per mostrare l'avanzamento
 * @returns {Promise<{ results: { file: string, name: string, level: "ok" | "warn" | "ko", lines: string[], ms: number }[], code: number }>}
 */
export async function lancia(cartella = CARTELLA, { only, onStart, onLog, onEnd } = {}) {
  // Prima si caricano tutti (un modulo che non si carica è un KO al suo turno), poi si filtra e si lancia.
  const elenco = [];
  for (const file of scopri(cartella)) {
    let name = file.replace(/\.check\.mjs$/, "");
    let modulo = null;
    let errore = null;
    try {
      // `?run=` perché un test che riscrive lo stesso file non riceva il modulo già in cache
      modulo = await import(`${pathToFileURL(join(cartella, file)).href}?run=${++lanci}`);
      name = modulo.name ?? name;
    } catch (e) {
      errore = e;
    }
    if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
    elenco.push({ file, name, modulo, errore });
  }
  const results = [];
  for (const [i, { file, name, modulo, errore }] of elenco.entries()) {
    onStart?.({ name, description: modulo?.description ?? "", index: i + 1, total: elenco.length });
    const inizio = Date.now();
    let level;
    let lines;
    try {
      if (errore) throw errore;
      ({ level, lines } = await modulo.run({ log: (testo) => onLog?.(name, String(testo)) }));
      if (!ETICHETTA[level]) throw new Error(`level "${level}" non valido (ok | warn | ko)`);
    } catch (e) {
      level = "ko";
      lines = [`the check crashed: ${e?.stack ?? e}`];
    }
    const result = { file, name, level, lines: lines ?? [], ms: Date.now() - inizio };
    results.push(result);
    onEnd?.(result);
  }
  return { results, code: results.some((r) => r.level === "ko") ? 1 : 0 };
}

/** La tabella (nome, esito, prima riga) e, sotto, le righe di ogni controllo non ok. */
export function formatta(results) {
  const larghezza = Math.max(0, ...results.map((r) => r.name.length));
  const righe = results.map((r) => {
    const esito = COLORE[r.level](ETICHETTA[r.level].padEnd(4));
    const prima = r.lines[0] ? tenue(`  ${r.lines[0]}`) : "";
    return `${esito}  ${r.name.padEnd(larghezza)}${r.level === "ok" ? "" : prima}  ${tenue(`${(r.ms / 1000).toFixed(1)}s`)}`;
  });
  // La prima riga è già nella tabella: sotto vanno le altre, così nessuna riga compare due volte.
  for (const r of results.filter((x) => x.level !== "ok" && x.lines.length > 1)) {
    righe.push("", COLORE[r.level](`── ${r.name} ${"─".repeat(Math.max(0, 60 - r.name.length))}`), ...r.lines.slice(1));
  }
  return righe.join("\n");
}

async function main() {
  const argomenti = process.argv.slice(2);
  const i = argomenti.indexOf("--only");
  const only = i >= 0 ? argomenti[i + 1] : undefined;
  if (i >= 0 && !only) {
    console.error("--only wants a word: npm run testRelease -- --only docs");
    process.exit(1);
  }
  // Si racconta mentre si lavora: il nome e cosa verifica, i passaggi che il controllo comunica, l'esito.
  const { results, code } = await lancia(CARTELLA, {
    only,
    onStart: ({ name, description, index, total }) => console.log(`${index === 1 ? "" : "\n"}▶ [${index}/${total}] ${name}${description ? tenue(` — ${description}`) : ""}`),
    onLog: (_name, testo) => console.log(tenue(`    · ${testo}`)),
    onEnd: (r) => console.log(`  ${COLORE[r.level](`→ ${ETICHETTA[r.level]}`)}${r.lines[0] ? tenue(` ${r.lines[0]}`) : ""}  ${tenue(`(${(r.ms / 1000).toFixed(1)}s)`)}`),
  });
  if (!results.length) {
    console.log(rosso(only ? `no check matches "${only}": ${scopri().join(", ")}` : "no check found in test/release"));
    process.exit(1);
  }
  console.log(`\n${tenue("── summary " + "─".repeat(51))}`);
  console.log(formatta(results));
  const ko = results.filter((r) => r.level === "ko").length;
  const warn = results.filter((r) => r.level === "warn").length;
  console.log(code ? rosso(`\n${ko} CHECK${ko === 1 ? "" : "S"} FAILED`) + tenue(warn ? ` · ${warn} warning${warn === 1 ? "" : "s"}` : "") : verde("\nRELEASE CHECKS OK") + tenue(warn ? ` · ${warn} warning${warn === 1 ? "" : "s"}` : ""));
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
