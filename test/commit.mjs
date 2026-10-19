// Il commit di una release: `npm run commit "Update messaggistica"`. Rigenera i file derivati, lancia tutti i
// controlli e le due build di publish.yml, e solo se è tutto ok fa `git add -A`, il commit col testo dato e il
// push. Se qui passa, la CI non ha motivo di fallire: vede esattamente quello che è stato controllato.
//
// Non è la suite (test/run.mjs scopre test/list/*.test.mjs e dice se il codice funziona): qui girano
// le verifiche di coerenza che si fanno prima di pubblicare — suite compresa, tema del sito,
// versioni (demo e lockfile), peso del README, peso del runtime, manuale, build della libreria e del sito.
// Ogni controllo è un file `test/release/*.check.mjs` che esporta `name` e `async run()` e risponde
// `{ level, lines }` ("ok" | "warn" | "ko"): aggiungerne uno è aggiungere un file, non toccare questo.
//
// Due fasi. Prima i `fix()`: i controlli che lo esportano rigenerano i file derivati che sanno rifare
// da soli (tema e favicon, versioni delle demo e del lockfile) — tutti prima di qualunque `run()`, perché la
// suite controlla anche quei file. Poi i `run()`. Quello che non si rigenera da solo (il sigillo del
// manuale, le cifre nel README, le traduzioni) resta KO: lo si sistema a mano, e il commit non parte.
//
// In un terminale si vedono due righe che si aggiornano: cosa sta girando, e una barra col tempo che manca,
// stimato sui tempi dell'ultimo giro riuscito (node_modules/.cache/viteTranslate/commitTimings.json; al primo
// giro, TEMPI_DI_PARTENZA). Il resto si stampa solo se qualcosa va storto. Fuori da un terminale, o con
// --verbose, si racconta riga per riga.
//
//   npm run commit "Update messaggistica"     # controlli, poi git add -A, commit e push
//   npm run commit -- --dry-run               # solo i controlli: niente commit (gli agenti usano questo)
//   npm run commit -- --dry-run --only docs   # solo i controlli il cui nome contiene "docs"
//   npm run commit -- --dry-run --check       # senza la fase dei fix: un file derivato vecchio è un KO
//   npm run commit -- --verbose "…"           # ogni passaggio su una riga, al posto della barra
//
// Esce con 1 se un controllo è KO o git fallisce, con 0 altrimenti (i warn non fanno fallire). Non è nel
// build del sito, nel `prepare` né nella CI.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARTELLA = join(RADICE, "test/release");
const FILE_TEMPI = join(RADICE, "node_modules/.cache/viteTranslate/commitTimings.json");

// Secondi, per passo: la stima finché non c'è un giro riuscito da cui prenderli.
export const TEMPI_DI_PARTENZA = {
  fetch: 1.5, fix: 0.5, suite: 60.5, theme: 0.1, demos: 0.1, readme: 0.1, "runtime-size": 0.5,
  docs: 1.8, "build-lib": 1.2, "build-site": 9.2, commit: 0.5, push: 3,
};

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
 * Lancia i controlli di una cartella. Un controllo esporta `name`, `run({ log, progress })` e, se vuole,
 * `description` (cosa verifica, in una riga) e `fix({ log })` (rigenera i file che `run` controlla; risponde le
 * righe di cosa ha riscritto). `log(testo)` è come racconta i passaggi mentre lavora, `progress(frazione)` quanto
 * ha fatto (0…1), se lo sa.
 * @param {string} [cartella] dove stanno i `*.check.mjs` (nei test, una cartella finta)
 * @param {{ only?: string, fix?: boolean, onFix?: (name: string, lines: string[]) => void, onStart?: (info: { name: string, description: string, index: number, total: number }) => void, onLog?: (name: string, testo: string) => void, onProgress?: (name: string, frazione: number) => void, onEnd?: (result: object) => void }} [opzioni]
 *   `only`: solo i controlli il cui nome contiene questa parola; `fix`: prima dei `run()`, tutti i `fix()`;
 *   gli `on…`: per mostrare l'avanzamento
 * @returns {Promise<{ results: { file: string, name: string, level: "ok" | "warn" | "ko", lines: string[], ms: number }[], code: number, fixMs: number }>}
 */
export async function lancia(cartella = CARTELLA, { only, fix = false, onFix, onStart, onLog, onProgress, onEnd } = {}) {
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
  // I fix tutti prima: un file rigenerato da un controllo può essere verificato da un altro che viene
  // prima in ordine di nome (la suite, per esempio, guarda anche la favicon).
  const inizioFix = Date.now();
  if (fix) {
    for (const voce of elenco) {
      if (voce.errore || typeof voce.modulo?.fix !== "function") continue;
      try {
        const righe = (await voce.modulo.fix({ log: (testo) => onLog?.(voce.name, String(testo)) })) ?? [];
        onFix?.(voce.name, righe);
      } catch (e) {
        voce.errore = new Error(`the fix crashed: ${e?.stack ?? e}`);
      }
    }
  }
  const fixMs = Date.now() - inizioFix;
  const results = [];
  for (const [i, { file, name, modulo, errore }] of elenco.entries()) {
    onStart?.({ name, description: modulo?.description ?? "", index: i + 1, total: elenco.length });
    const inizio = Date.now();
    let level;
    let lines;
    try {
      if (errore) throw errore;
      ({ level, lines } = await modulo.run({
        log: (testo) => onLog?.(name, String(testo)),
        progress: (frazione) => onProgress?.(name, frazione),
      }));
      if (!ETICHETTA[level]) throw new Error(`level "${level}" non valido (ok | warn | ko)`);
    } catch (e) {
      level = "ko";
      lines = [String(e?.message ?? "").startsWith("the fix crashed") ? e.message : `the check crashed: ${e?.stack ?? e}`];
    }
    const result = { file, name, level, lines: lines ?? [], ms: Date.now() - inizio };
    results.push(result);
    onEnd?.(result);
  }
  return { results, code: results.some((r) => r.level === "ko") ? 1 : 0, fixMs };
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

/**
 * I file del working tree che git vede diversi dal commit (modificati, nuovi, cancellati), con un'impronta
 * del contenuto: confrontando quella di prima e quella di dopo si sa cosa ha riscritto il giro.
 * @param {string} [radice] la radice di un repo git
 * @returns {Map<string, { stato: string, impronta: string }>} chiave: il percorso come lo stampa git
 */
export function instantanea(radice = RADICE) {
  const uscita = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: radice, encoding: "utf8" });
  const voci = new Map();
  const pezzi = uscita.split("\0");
  for (let i = 0; i < pezzi.length; i++) {
    const pezzo = pezzi[i];
    if (pezzo.length < 4) continue;
    const stato = pezzo.slice(0, 2);
    const percorso = pezzo.slice(3);
    // Una rinomina porta dopo di sé il percorso di partenza: non è un file a parte.
    if (stato[0] === "R" || stato[0] === "C") i++;
    const assoluto = join(radice, percorso);
    const impronta = existsSync(assoluto) && statSync(assoluto).isFile()
      ? createHash("sha256").update(readFileSync(assoluto)).digest("hex")
      : "(gone)";
    voci.set(percorso, { stato, impronta });
  }
  return voci;
}

/**
 * Cosa è cambiato tra due instantanee: i file riscritti (comparsi, o con un contenuto diverso) e quelli
 * che git non conosce ancora.
 * @returns {{ riscritti: string[], nonTracciati: string[] }} ordinati
 */
export function confronta(prima, dopo) {
  const riscritti = [];
  for (const [percorso, { impronta }] of dopo) if (prima.get(percorso)?.impronta !== impronta) riscritti.push(percorso);
  for (const percorso of prima.keys()) if (!dopo.has(percorso)) riscritti.push(percorso);
  const nonTracciati = [...dopo].filter(([, { stato }]) => stato === "??").map(([percorso]) => percorso);
  return { riscritti: riscritti.sort(), nonTracciati: nonTracciati.sort() };
}

/**
 * Gli argomenti di `npm run commit …`: il testo del commit è tutto ciò che non comincia con "--", unito da spazi
 * (così funziona anche senza virgolette). `npm run commit --dry-run`, senza il "--" davanti, npm se lo tiene
 * e lo passa come npm_config_dry_run: vale lo stesso.
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ messaggio: string, dryRun: boolean, verbose: boolean, check: boolean, only?: string, errore?: string }}
 */
export function leggiArgomenti(argv, env = {}) {
  const vero = (nome) => argv.includes(`--${nome}`) || env[`npm_config_${nome.replace(/-/g, "_")}`] === "true";
  const i = argv.indexOf("--only");
  // --only invece npm lo conosce (una sua opzione vecchia) e senza il "--" davanti lo inghiotte senza traccia.
  const only = i >= 0 ? argv[i + 1] : undefined;
  const parole = argv.filter((a, j) => !a.startsWith("--") && !(i >= 0 && j === i + 1));
  const opzioni = { messaggio: parole.join(" ").trim(), dryRun: vero("dry-run"), verbose: vero("verbose"), check: vero("check"), only };
  if (i >= 0 && !only) return { ...opzioni, errore: "--only wants a word: npm run commit -- --dry-run --only docs" };
  // Un commit fatto dopo una parte dei controlli, o senza i fix, non sarebbe quello che la CI si aspetta.
  if (!opzioni.dryRun && (only || opzioni.check)) return { ...opzioni, errore: "--only and --check go with --dry-run: a commit runs every check" };
  if (!opzioni.dryRun && !opzioni.messaggio) {
    return { ...opzioni, errore: 'no commit message: npm run commit "Update messaggistica" (or npm run commit -- --dry-run, to check only)' };
  }
  return opzioni;
}

/**
 * Quanto manca, dai tempi stimati dei passi: quelli finiti contano per intero, quello in corso per la parte fatta.
 * La parte fatta è la più alta tra quella che il passo dichiara e quella del tempo trascorso, che però non
 * arriva mai al 100 %: un passo più lento del previsto resta "quasi finito" invece di superare la stima.
 * @param {{ passi: string[], tempi: Record<string, number>, corrente: number, trascorsoMs: number, frazione?: number }} stato
 *   `corrente`: l'indice del passo in corso (passi.length a lavoro finito)
 * @returns {{ frazione: number, mancanoS: number }}
 */
export function stima({ passi, tempi, corrente, trascorsoMs, frazione = 0 }) {
  const durata = (passo) => tempi[passo] ?? 1;
  const totale = passi.reduce((s, p) => s + durata(p), 0) || 1;
  const fatti = passi.slice(0, corrente).reduce((s, p) => s + durata(p), 0);
  if (corrente >= passi.length) return { frazione: 1, mancanoS: 0 };
  const d = durata(passi[corrente]);
  const parte = Math.min(1, Math.max(frazione, Math.min(trascorsoMs / 1000 / d, 0.95)));
  const dopo = passi.slice(corrente + 1).reduce((s, p) => s + durata(p), 0);
  return { frazione: (fatti + d * parte) / totale, mancanoS: d * (1 - parte) + dopo };
}

/** La barra: `[████████░░░░░░░░]  48 %  ~31 s left`. */
export function barra(frazione, mancanoS, larghezza = 30) {
  const f = Math.min(1, Math.max(0, frazione));
  const pieni = Math.round(f * larghezza);
  const percento = String(Math.floor(f * 100)).padStart(3);
  return `[${"█".repeat(pieni)}${"░".repeat(larghezza - pieni)}] ${percento} %  ~${Math.ceil(mancanoS)} s left`;
}

function leggiTempi() {
  try {
    return { ...TEMPI_DI_PARTENZA, ...JSON.parse(readFileSync(FILE_TEMPI, "utf8")) };
  } catch {
    return { ...TEMPI_DI_PARTENZA };
  }
}

function scriviTempi(tempi) {
  try {
    mkdirSync(dirname(FILE_TEMPI), { recursive: true });
    writeFileSync(FILE_TEMPI, `${JSON.stringify(tempi, null, 2)}\n`);
  } catch {
    // Solo una stima per il giro dopo: se non si scrive, si riparte dai tempi di partenza.
  }
}

/** Le due righe in un terminale: si riscrivono al loro posto, dieci volte al secondo. */
function schermo(passi, tempi) {
  const tty = process.stdout.isTTY;
  let corrente = 0;
  let inizioPasso = Date.now();
  let frazione = 0;
  let nome = "";
  let descrizione = "";
  let disegnate = false;
  let timer = null;
  const disegna = () => {
    const { frazione: f, mancanoS } = stima({ passi, tempi, corrente, trascorsoMs: Date.now() - inizioPasso, frazione });
    const colonne = process.stdout.columns || 80;
    // Il taglio si fa sul testo senza colori: un codice ANSI spezzato a metà sporcherebbe la riga.
    const piano = `▶ ${nome}${descrizione ? ` — ${descrizione}` : ""}`;
    const riga1 = piano.length > colonne - 1 ? `${piano.slice(0, colonne - 2)}…` : `▶ ${nome}${descrizione ? tenue(` — ${descrizione}`) : ""}`;
    process.stdout.write(`${disegnate ? "\x1b[2A" : ""}\r\x1b[2K${riga1}\n\r\x1b[2K${barra(f, mancanoS, Math.max(10, Math.min(30, colonne - 30)))}\n`);
    disegnate = true;
  };
  return {
    tty,
    avvia() {
      if (!tty) return;
      process.stdout.write("\x1b[?25l");
      timer = setInterval(disegna, 100);
    },
    passo(n, d) {
      const i = passi.indexOf(n);
      if (i >= 0) corrente = i;
      inizioPasso = Date.now();
      frazione = 0;
      nome = n;
      descrizione = d ?? "";
      if (tty) disegna();
    },
    avanza(f) {
      frazione = f;
    },
    // Toglie le due righe: quello che si stampa dopo (errori, l'esito) prende il loro posto.
    chiudi() {
      if (!tty) return;
      clearInterval(timer);
      if (disegnate) process.stdout.write("\x1b[2A\r\x1b[2K\n\r\x1b[2K\x1b[1A\r");
      process.stdout.write("\x1b[?25h");
      disegnate = false;
    },
  };
}

/** `git <args>` senza bloccare: la barra continua a muoversi durante fetch e push. */
function git(args) {
  return new Promise((resolve) => {
    const figlio = spawn("git", args, { cwd: RADICE, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    for (const flusso of [figlio.stdout, figlio.stderr]) {
      flusso.setEncoding("utf8");
      flusso.on("data", (pezzo) => (out += pezzo));
    }
    figlio.on("error", (e) => resolve({ status: 1, out: `${out}${e.message}` }));
    figlio.on("close", (status) => resolve({ status: status ?? 1, out: out.trim() }));
  });
}

const gitSync = (...args) => execFileSync("git", args, { cwd: RADICE, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Si può fare commit e push? Ramo, upstream, e niente commit remoti che qui mancano. */
async function controllaGit(schermata) {
  let ramo;
  let upstream;
  try {
    ramo = gitSync("rev-parse", "--abbrev-ref", "HEAD");
    if (ramo === "HEAD") return "detached HEAD: check out a branch first";
    upstream = gitSync("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
  } catch {
    return `branch ${ramo ?? "?"} has no upstream: git push -u origin ${ramo ?? "<branch>"} once, then rerun`;
  }
  schermata.passo("fetch", `git fetch: is ${upstream} ahead of us?`);
  const f = await git(["fetch", "--quiet"]);
  if (f.status !== 0) return `git fetch failed:\n${f.out}`;
  const indietro = Number(gitSync("rev-list", "--count", "HEAD..@{u}"));
  if (indietro > 0) return `${upstream} has ${indietro} commit(s) you don't have: git pull --rebase, then rerun`;
  return null;
}

async function main() {
  const opzioni = leggiArgomenti(process.argv.slice(2), process.env);
  if (opzioni.errore) {
    console.error(rosso(opzioni.errore));
    process.exit(1);
  }
  const { messaggio, dryRun, only } = opzioni;
  const fix = !opzioni.check;
  const passi = scopri().map((f) => f.replace(/\.check\.mjs$/, ""));
  // I nomi dei passi: quelli dichiarati dai controlli, che coincidono col nome del file senza il numero.
  const nomi = passi.map((p) => p.replace(/^\d+-/, "")).filter((n) => !only || n.toLowerCase().includes(only.toLowerCase()));
  const elencoPassi = [...(dryRun ? [] : ["fetch"]), ...(fix ? ["fix"] : []), ...nomi, ...(dryRun ? [] : ["commit", "push"])];
  const tempi = leggiTempi();
  const verboso = opzioni.verbose || !process.stdout.isTTY;
  const schermata = verboso ? null : schermo(elencoPassi, tempi);
  const misurati = {};
  const inizio = Date.now();
  // Un Ctrl+C non deve lasciare il cursore nascosto.
  process.on("SIGINT", () => {
    schermata?.chiudi();
    process.exit(130);
  });
  schermata?.avvia();
  const racconta = verboso
    ? { passo: (nome, descrizione) => console.log(`\n▶ ${nome}${descrizione ? tenue(` — ${descrizione}`) : ""}`), avanza() {}, chiudi() {} }
    : schermata;

  if (!dryRun) {
    const t = Date.now();
    const problema = await controllaGit(racconta);
    misurati.fetch = (Date.now() - t) / 1000;
    if (problema) {
      racconta.chiudi();
      console.error(rosso(problema));
      process.exit(1);
    }
  }

  const prima = instantanea();
  if (fix) racconta.passo("fix", "regenerating the derived files the checks know how to rebuild");
  const { results, code, fixMs } = await lancia(CARTELLA, {
    only,
    fix,
    onFix: verboso ? (name, righe) => console.log(`  ${tenue(`${name}:`)} ${righe.length ? righe.join(", ") : tenue("nothing to do")}`) : undefined,
    onStart: ({ name, description }) => racconta.passo(name, description),
    onLog: verboso ? (_name, testo) => console.log(tenue(`    · ${testo}`)) : undefined,
    onProgress: (_name, frazione) => racconta.avanza(frazione),
    onEnd: verboso ? (r) => console.log(`  ${COLORE[r.level](`→ ${ETICHETTA[r.level]}`)}${r.lines[0] ? tenue(` ${r.lines[0]}`) : ""}  ${tenue(`(${(r.ms / 1000).toFixed(1)}s)`)}`) : undefined,
  });
  if (fix) misurati.fix = fixMs / 1000;
  for (const r of results) misurati[r.name] = r.ms / 1000;
  if (!results.length) {
    racconta.chiudi();
    console.log(rosso(only ? `no check matches "${only}": ${scopri().join(", ")}` : "no check found in test/release"));
    process.exit(1);
  }
  const { riscritti, nonTracciati } = confronta(prima, instantanea());
  const warn = results.filter((r) => r.level === "warn");

  // Qualcosa non va: la tabella completa, i dettagli, e niente commit.
  if (code) {
    racconta.chiudi();
    const ko = results.filter((r) => r.level === "ko").length;
    console.log(`${tenue("── summary " + "─".repeat(51))}`);
    console.log(formatta(results));
    if (riscritti.length) console.log(`\n${giallo("── rewritten by this run " + "─".repeat(37))}\n${riscritti.map((p) => `  ${p}`).join("\n")}`);
    console.log(rosso(`\n${ko} CHECK${ko === 1 ? "" : "S"} FAILED${dryRun ? "" : ": nothing committed"}`));
    process.exit(1);
  }
  const avvisi = warn.map((r) => giallo(`WARN ${r.name}: ${r.lines[0] ?? ""}`)).join("\n");

  if (dryRun) {
    racconta.chiudi();
    if (!only && fix) scriviTempi({ ...tempi, ...misurati });
    if (avvisi) console.log(avvisi);
    if (riscritti.length) console.log(`${giallo("rewritten by this run:")}\n${riscritti.map((p) => `  ${p}`).join("\n")}`);
    if (nonTracciati.length) console.log(`${giallo("untracked:")}\n${nonTracciati.map((p) => `  ${p}`).join("\n")}`);
    console.log(verde(`CHECKS OK (dry run, nothing committed)`) + tenue(`  ${((Date.now() - inizio) / 1000).toFixed(0)} s`));
    process.exit(0);
  }

  // Commit: tutto quello che c'è nel working tree, come vuole la CI.
  let t = Date.now();
  racconta.passo("commit", `git add -A, git commit -m "${messaggio}"`);
  const nuovi = nonTracciati;
  let r = await git(["add", "-A"]);
  const daCommit = r.status === 0 ? await git(["diff", "--cached", "--quiet"]) : null;
  let hash = null;
  if (r.status === 0 && daCommit.status !== 0) {
    r = await git(["commit", "--quiet", "-m", messaggio]);
    if (r.status === 0) hash = gitSync("rev-parse", "--short", "HEAD");
  }
  misurati.commit = (Date.now() - t) / 1000;
  if (r.status !== 0) {
    racconta.chiudi();
    console.error(rosso(`git commit failed:\n${r.out}`));
    process.exit(1);
  }
  const avanti = Number(gitSync("rev-list", "--count", "@{u}..HEAD"));
  if (avanti === 0) {
    racconta.chiudi();
    if (avvisi) console.log(avvisi);
    console.log(giallo("CHECKS OK, but nothing to commit and nothing to push"));
    process.exit(0);
  }

  t = Date.now();
  racconta.passo("push", `git push (${avanti} commit${avanti === 1 ? "" : "s"})`);
  r = await git(["push", "--quiet"]);
  misurati.push = (Date.now() - t) / 1000;
  racconta.chiudi();
  if (r.status !== 0) {
    console.error(rosso(`${hash ? `committed ${hash}, but ` : ""}git push failed:\n${r.out}`));
    process.exit(1);
  }
  scriviTempi({ ...tempi, ...misurati });
  if (avvisi) console.log(avvisi);
  if (nuovi.length) console.log(`${tenue("new files in this commit:")}\n${nuovi.map((p) => tenue(`  ${p}`)).join("\n")}`);
  const totale = ((Date.now() - inizio) / 1000).toFixed(0);
  console.log(verde(hash ? `✓ ${hash} "${messaggio}" committed and pushed` : `✓ nothing new to commit, ${avanti} commit(s) pushed`) + tenue(`  ${totale} s`));
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
