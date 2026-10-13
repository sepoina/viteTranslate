// La riga di comando dei video. Da site/video:
//
//   node commons/cli/run.mjs <progetto> check              # storyboard.yaml è allineato a storyboard.md?
//   node commons/cli/run.mjs <progetto> stamp              # sì: lo dichiara, dopo averlo adattato
//   node commons/cli/run.mjs <progetto>                    # tts, record, compose
//   node commons/cli/run.mjs <progetto> tts record preview # i passi scelti, in quest'ordine
//   node commons/cli/run.mjs <progetto> all                # tts, record, preview, compose
//
//   --silent       voce muta della durata stimata: prove senza chiave e senza spesa
//   --force        rigenera tutte le voci, anche quelle già in cache
//   --headed       Chrome visibile durante la ripresa
//   --rebuild-ide  ricostruisce il .vsix dell'estensione prima di installarlo
//   --stale        gira anche se storyboard.yaml è indietro rispetto a storyboard.md (solo prove)
//   --full         record gira tutte le scene; senza, solo dalla prima cambiata (record.mjs)
//   --from <id>    record gira da quella scena, tenendo le clip di prima così come sono
//   --to <id>      record si ferma dopo quella scena
//   --probe        record: sotto ogni scena, il diario delle sonde (dove arriva il clic, i tempi di reazione)
//   --strict       record: il primo avviso delle sonde ferma la ripresa
//
// Ogni passo si rilancia da solo e legge quello che il precedente ha lasciato su disco. Tutto
// quello che si stampa finisce anche in projects/<progetto>/log/run.log, con l'ora: commons/cli/live.mjs
// lo segue dal vivo, e se nessuno lo segue i passi lunghi le aprono una finestra.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { format } from "node:util";
import { compose } from "./compose.mjs";
import { apriVistaDalVivo } from "./live.mjs";
import { record } from "./record.mjs";
import { loadProject, projectPaths } from "./storyboard.mjs";
import { alignment, describe, stamp } from "./subject.mjs";
import { runTts } from "./tts.mjs";

const PASSI = ["tts", "record", "preview", "compose"];
const COMANDI = ["check", "stamp"];
const USO =
  "usage: node commons/cli/run.mjs <project> [check|stamp|tts|record|preview|compose|all]... [--silent] [--force] [--headed] [--rebuild-ide] [--stale] [--full] [--from <scene>] [--to <scene>] [--probe] [--strict]";
// Le opzioni che vogliono un valore: `--from translate` o `--from=translate`.
const CON_VALORE = ["--from", "--to"];

/** Gli argomenti in passi e opzioni: il valore di un'opzione non è un passo. */
function leggiArgomenti(args) {
  const parole = [];
  const opzioni = {};
  for (let i = 0; i < args.length; i++) {
    const [chiave, uguale] = args[i].split(/=(.*)/s);
    if (CON_VALORE.includes(chiave)) {
      const valore = uguale ?? args[++i];
      if (!valore || valore.startsWith("--")) throw new Error(`${chiave} needs a scene id\n${USO}`);
      opzioni[chiave] = valore;
    } else if (args[i].startsWith("--")) opzioni[args[i]] = true;
    else parole.push(args[i]);
  }
  return { parole, opzioni };
}

/** console.* anche su log/run.log: una cartella di log per progetto aiuta a capire cosa è andato storto. */
function registraIn(fileLog) {
  appendFileSync(fileLog, `\n=== ${new Date().toLocaleString("sv-SE")} node commons/cli/run.mjs ${process.argv.slice(2).join(" ")}\n`);
  for (const livello of ["log", "warn", "error"]) {
    const originale = console[livello].bind(console);
    console[livello] = (...args) => {
      originale(...args);
      const ora = new Date().toTimeString().slice(0, 8);
      appendFileSync(fileLog, format(...args).split("\n").map((r) => `${ora} ${r}`).join("\n") + "\n");
    };
  }
}

async function main() {
  const { parole, opzioni } = leggiArgomenti(process.argv.slice(2));
  const flag = (f) => opzioni[f] === true;
  const [nome, ...resto] = parole;
  if (!nome) {
    console.error(USO);
    process.exit(1);
  }
  const passi = resto.length === 0 ? ["tts", "record", "compose"] : resto.flatMap((p) => (p === "all" ? PASSI : [p]));
  const sconosciuti = passi.filter((p) => !PASSI.includes(p) && !COMANDI.includes(p));
  if (sconosciuti.length) throw new Error(`unknown step: ${sconosciuti.join(", ")}\n${USO}`);

  const paths = projectPaths(nome);
  mkdirSync(paths.log, { recursive: true });
  registraIn(join(paths.log, "run.log"));
  // I passi lunghi si guardano mentre girano: se nessuno segue i log, si apre la vista dal vivo.
  if (passi.some((p) => PASSI.includes(p))) {
    const vista = apriVistaDalVivo();
    if (vista) console.log(`  ${vista}`);
  }

  let project = null;
  let avvisato = false;
  for (const passo of passi) {
    const t0 = performance.now();
    console.log(`\n▶ ${passo}`);

    if (passo === "check") {
      for (const riga of describe(alignment(paths), nome)) console.log(`  ${riga}`);
      continue;
    }
    if (passo === "stamp") {
      loadProject(nome); // uno YAML che non si carica non si timbra
      const n = stamp(paths, nome);
      console.log(`  storyboard.yaml stamped against storyboard.md (${n} scenes)`);
      project = null;
      continue;
    }

    // storyboard.md prevale: niente voce, ripresa o montaggio da uno YAML rimasto indietro.
    const a = alignment(paths);
    if (!a.aligned) {
      const righe = describe(a, nome);
      if (!flag("--stale")) throw new Error(["storyboard.yaml is behind storyboard.md:", ...righe, "(--stale runs anyway, for rehearsals)"].join("\n"));
      if (!avvisato) console.warn(["  ! --stale: storyboard.yaml is behind storyboard.md", ...righe.map((r) => `  ${r}`)].join("\n"));
      avvisato = true;
    }
    project ??= loadProject(nome);
    if (passo === "tts") await runTts(project, { silent: flag("--silent"), force: flag("--force") });
    if (passo === "record")
      await record(project, { headed: flag("--headed"), rebuildIde: flag("--rebuild-ide"), full: flag("--full"), from: opzioni["--from"], to: opzioni["--to"], probe: flag("--probe"), strict: flag("--strict") });
    if (passo === "preview" || passo === "compose") {
      const { video, duration } = await compose(project, { preview: passo === "preview" });
      console.log(`  ${video} (${duration.toFixed(1)} s)`);
    }
    console.log(`  done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
