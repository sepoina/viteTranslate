// La vista dal vivo: segue il log/run.log di ogni progetto e stampa le righe nuove mentre la
// generazione gira, così chi ha chiesto il video la vede andare. Da site/video:
//
//   node commons/cli/live.mjs
//
// La lancia il task "video: live" di VS Code (.vscode/tasks.json alla radice del repo), che parte
// con la cartella. Se all'inizio di un run nessuno la sta guardando, run.mjs apre una finestra di
// Windows Terminal che la lancia (apriVistaDalVivo). Per sapere se c'è, un battito: ogni secondo
// la vista riscrive .cache/live.beat.
//
// LINKED-DATA: il task in .vscode/tasks.json, la chiamata in run.mjs, README.md § "Watching a run".
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE_DIR, PROJECTS_DIR, VIDEO_DIR } from "./storyboard.mjs";

const BATTITO = join(CACHE_DIR, "live.beat");
const BATTITO_OGNI = 1000; // ms
const BATTITO_VECCHIO = 3000; // ms: oltre, la vista non c'è più
const GIRO = 250; // ms tra un'occhiata ai log e l'altra
export const TITOLO = "video: live";

/** C'è una vista dal vivo aperta? Il suo battito è recente. */
export function vistaAperta() {
  try {
    return Date.now() - statSync(BATTITO).mtimeMs < BATTITO_VECCHIO;
  } catch {
    return false;
  }
}

/**
 * Apre la vista dal vivo in una finestra, se nessuno guarda già questo run.
 * @returns {string | null} cosa ha fatto, da stampare; null se non serviva
 */
export function apriVistaDalVivo() {
  if (process.stdout.isTTY) return null; // lanciato da un terminale: chi l'ha lanciato lo sta guardando
  if (vistaAperta()) return null;
  if (process.platform !== "win32") return `live: nobody is following, run \`node commons/cli/live.mjs\` in a terminal`;
  const dir = VIDEO_DIR.replace(/[\\/]$/, ""); // senza la barra finale: davanti a una virgolette la scapperebbe
  const comando = [process.execPath, fileURLToPath(import.meta.url)];
  const conWt = spawnSync("where.exe", ["wt.exe"], { stdio: "ignore" }).status === 0;
  const figlio = conWt
    ? spawn("wt.exe", ["-w", "video-live", "new-tab", "--title", TITOLO, "-d", dir, ...comando], { detached: true, stdio: "ignore" })
    : spawn("cmd.exe", ["/c", `start "${TITOLO}" /d "${dir}" ${comando.map((c) => `"${c}"`).join(" ")}`], {
        detached: true,
        stdio: "ignore",
        windowsVerbatimArguments: true,
      });
  figlio.on("error", () => {}); // senza finestra il run va avanti lo stesso
  figlio.unref();
  return `live: opened a ${conWt ? "Windows Terminal" : "console"} window, "${TITOLO}" (nobody was following)`;
}

/** I run.log dei progetti che ne hanno uno. */
function registri() {
  if (!existsSync(PROJECTS_DIR)) return [];
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ progetto: d.name, file: join(PROJECTS_DIR, d.name, "log", "run.log") }))
    .filter((r) => existsSync(r.file));
}

/** I byte di un file da `da` in poi. */
function leggiDa(file, da) {
  const fd = openSync(file, "r");
  try {
    const n = statSync(file).size - da;
    const buf = Buffer.alloc(Math.max(0, n));
    if (n > 0) readSync(fd, buf, 0, n, da);
    return buf;
  } finally {
    closeSync(fd);
  }
}

const colori = process.stdout.isTTY;
const tinta = (codice, riga) => (colori ? `\x1b[${codice}m${riga}\x1b[0m` : riga);

function stampa(riga) {
  if (riga.startsWith("=== ")) return console.log(tinta("1", riga)); // l'inizio di un run
  if (riga.includes("✖")) return console.log(tinta("31", riga)); // l'errore che l'ha fermato
  if (/^[\d:]+ +! /.test(riga)) return console.log(tinta("33", riga)); // un avviso
  if (/^[\d:]+ ▶ /.test(riga)) return console.log(tinta("36;1", riga)); // un passo
  console.log(riga);
}

function segui() {
  const letti = new Map(); // file → fin dove è stato stampato
  let ultimo = null;

  /** Stampa le righe intere da `da` in poi; restituisce fin dove è arrivata. */
  const mostra = ({ progetto, file }, buf, da) => {
    const fine = buf.lastIndexOf(0x0a) + 1; // solo righe intere: un \n non cade mai dentro un carattere UTF-8
    if (!fine) return da;
    if (ultimo && ultimo !== file) console.log(tinta("2", `── ${progetto} ──`));
    ultimo = file;
    for (const riga of buf.subarray(0, fine).toString("utf8").replace(/\r?\n$/, "").split(/\r?\n/)) stampa(riga);
    return da + fine;
  };

  console.log(tinta("2", `${TITOLO}: every run of commons/cli/run.mjs, as it happens. Ctrl+C closes it.`));
  // L'ultimo run del log più recente, dall'inizio: aperta a run partito, la vista lo mostra intero.
  const tutti = registri();
  for (const r of tutti) letti.set(r.file, statSync(r.file).size);
  const recente = tutti.sort((a, b) => statSync(b.file).mtimeMs - statSync(a.file).mtimeMs)[0];
  if (recente) {
    const buf = leggiDa(recente.file, 0);
    const inizio = Math.max(0, buf.lastIndexOf("\n=== ") + 1);
    console.log(tinta("2", `── ${recente.progetto}, the last run ──`));
    ultimo = recente.file;
    letti.set(recente.file, mostra(recente, buf.subarray(inizio), inizio));
  }

  setInterval(() => {
    for (const r of registri()) {
      let da = letti.get(r.file) ?? 0; // un log nato dopo: dall'inizio
      const size = statSync(r.file).size;
      if (size < da) da = 0; // riscritto da capo
      if (size > da) letti.set(r.file, mostra(r, leggiDa(r.file, da), da));
    }
  }, GIRO);

  mkdirSync(CACHE_DIR, { recursive: true });
  const batti = () => writeFileSync(BATTITO, String(process.pid));
  batti();
  setInterval(batti, BATTITO_OGNI);
  const chiudi = () => {
    rmSync(BATTITO, { force: true });
    process.exit(0);
  };
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(s, chiudi);
}

// Lanciato, non importato da run.mjs. Le maiuscole non contano: VS Code passa d:\…, Node risolve D:\…
const io = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
if (process.argv[1] && io(resolve(process.argv[1])) === io(fileURLToPath(import.meta.url))) segui();
