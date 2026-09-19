// Il launcher globale `vitetranslate` (launcher/vitetranslate.js): trova la copia di
// @sepoina/vitetranslate risalendo da cwd, ne lancia il comando con gli stessi argomenti e ne
// restituisce l'esito; quando non c'è niente da lanciare, dice che cosa scrivere.
//
// La copia qui è finta, un package.json e uno script che stampa che cosa ha ricevuto: la cosa da
// verificare è il launcher, non la libreria.
//
//   node test/list/launcher.test.mjs
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const salta = (perche) => console.log("  --  ", `saltato: ${perche}`);

const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCHER = join(resolve(HERE, "../.."), "launcher/vitetranslate.js");

const temporanee = [];

// realpath: su macOS tmpdir() passa da un link (/var -> /private/var), e i percorsi che il
// launcher legge da process.cwd() non sarebbero quelli con cui il test li confronta.
function cartella() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "vt-launcher-")));
  temporanee.push(dir);
  return dir;
}

/**
 * Una copia finta di @sepoina/vitetranslate in `radice/node_modules`. Ogni comando dichiarato in
 * `bin` stampa una riga "ESEGUITO {json}" (con che nome è stato chiamato, gli argomenti, la
 * cartella) ed esce con 7, un codice che il launcher non produce mai da solo.
 */
function copiaFinta(radice, { versione = "9.9.9", bin = { "vtranslate-cli": "cli.js" }, script } = {}) {
  const dir = join(radice, "node_modules", "@sepoina", "vitetranslate");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@sepoina/vitetranslate", version: versione, bin }));
  for (const [nome, file] of Object.entries(bin ?? {})) {
    writeFileSync(join(dir, file), script ??
      `console.log("ESEGUITO " + JSON.stringify({ comando: ${JSON.stringify(nome)}, argv: process.argv.slice(2), cwd: process.cwd() }));\n` +
      "process.exitCode = 7;\n");
  }
  return dir;
}

const lancia = (cwd, argv = [], env = {}) => {
  const esito = spawnSync(process.execPath, [LAUNCHER, ...argv], { cwd, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", ...env } });
  return { ...esito, uscita: (esito.stdout ?? "") + (esito.stderr ?? "") };
};

/** Che cosa ha ricevuto il comando finto, o `null` se non è stato lanciato. */
const eseguito = (uscita) => {
  const riga = /ESEGUITO (.*)/.exec(uscita);
  return riga ? JSON.parse(riga[1]) : null;
};

/** C'è `relativo` in `da` o in una cartella sopra? Serve a sapere se tmpdir() è un posto neutro. */
function sopra(da, relativo) {
  for (let dir = da; ; dir = dirname(dir)) {
    if (existsSync(join(dir, relativo))) return true;
    if (dirname(dir) === dir) return false;
  }
}
const TMP = realpathSync(tmpdir());
const copiaSopraTmp = sopra(TMP, "node_modules/@sepoina/vitetranslate/package.json");
const progettoSopraTmp = sopra(TMP, "package.json");

// ------------------------------------------------------- la delega
console.log("\n== una copia nel progetto: gira quella, con gli stessi argomenti ==");
{
  const radice = cartella();
  writeFileSync(join(radice, "package.json"), "{}");
  copiaFinta(radice);
  const esito = lancia(radice, ["--add", "fr-FR", "de-DE"]);
  const ricevuto = eseguito(esito.uscita);
  eq("lancia il comando della copia", "vtranslate-cli", ricevuto?.comando);
  eq("con gli argomenti così come sono", JSON.stringify(["--add", "fr-FR", "de-DE"]), JSON.stringify(ricevuto?.argv));
  eq("nella cartella da cui è stato chiamato", radice, ricevuto?.cwd);
  eq("e ne restituisce il codice d'uscita", 7, esito.status);
}

console.log("\n== da una sottocartella: risale come Node, senza cambiare cartella ==");
{
  const radice = cartella();
  writeFileSync(join(radice, "package.json"), "{}");
  copiaFinta(radice);
  const profonda = join(radice, "src", "components");
  mkdirSync(profonda, { recursive: true });
  const ricevuto = eseguito(lancia(profonda, ["--status"]).uscita);
  eq("trova la copia due livelli sopra", "vtranslate-cli", ricevuto?.comando);
  eq("il comando parte dalla sottocartella", profonda, ricevuto?.cwd);
}

console.log("\n== quale comando, fra quelli che la copia dichiara ==");
{
  const nuova = cartella();
  copiaFinta(nuova, { bin: { "vtranslate-cli": "a.js", vitetranslate: "b.js" } });
  eq("vitetranslate prima di vtranslate-cli", "vitetranslate", eseguito(lancia(nuova).uscita)?.comando);

  const vecchia = cartella();
  copiaFinta(vecchia, { versione: "2.0.0", bin: { "vitetranslate-prepare-translation-table": "cli.js" } });
  eq("una 2.x: il nome lungo", "vitetranslate-prepare-translation-table", eseguito(lancia(vecchia).uscita)?.comando);
}

// ------------------------------------------------------- le opzioni sue
console.log("\n== --help e --version ==");
{
  const radice = cartella();
  copiaFinta(radice);
  eq("--help con una copia: lo gira alla copia", JSON.stringify(["--help"]), JSON.stringify(eseguito(lancia(radice, ["--help"]).uscita)?.argv));

  const versione = lancia(radice, ["--version"]);
  eq("--version: esce 0", 0, versione.status);
  eq("--version: non lancia la copia (farebbe una sync)", null, eseguito(versione.uscita));
  eq("--version: la propria", true, /vitetranslate \d+\.\d+\.\d+ \(launcher\)/.test(versione.uscita));
  eq("--version: quale copia, con che comando, dove", true,
    versione.uscita.includes("@sepoina/vitetranslate 9.9.9 (vtranslate-cli)") && versione.uscita.includes(join(radice, "node_modules")));

  if (copiaSopraTmp) salta(`c'è una copia di @sepoina/vitetranslate sopra ${TMP}`);
  else {
    const vuota = cartella();
    const aiuto = lancia(vuota, ["--help"]);
    eq("--help senza copia: esce 0", 0, aiuto.status);
    eq("--help senza copia: il proprio", true, aiuto.uscita.includes("Options of its own"));
    const sola = lancia(vuota, ["--version"]);
    eq("--version senza copia: esce 0", 0, sola.status);
    eq("--version senza copia: lo dice", true, sola.uscita.includes("not installed"));
  }
}

// ------------------------------------------------------- niente da lanciare
console.log("\n== niente da lanciare: che cosa scrivere ==");
if (copiaSopraTmp) salta(`c'è una copia di @sepoina/vitetranslate sopra ${TMP}`);
else {
  const clone = cartella();
  writeFileSync(join(clone, "package.json"), JSON.stringify({ devDependencies: { "@sepoina/vitetranslate": "^4.5.0" } }));
  const appenaClonato = lancia(clone, ["--status"]);
  eq("in package.json ma non installato: esce 1", 1, appenaClonato.status);
  eq("...e dice di installare", true, appenaClonato.uscita.includes("but not installed") && appenaClonato.uscita.includes("$ npm install"));

  const senza = cartella();
  writeFileSync(join(senza, "package.json"), "{}");
  const assente = lancia(senza);
  eq("non dichiarato: esce 1", 1, assente.status);
  eq("...e suggerisce npm i", true, assente.uscita.includes("$ npm i @sepoina/vitetranslate"));

  const conPnpm = cartella();
  writeFileSync(join(conPnpm, "package.json"), "{}");
  writeFileSync(join(conPnpm, "pnpm-lock.yaml"), "");
  eq("con pnpm-lock.yaml: pnpm add", true, lancia(conPnpm).uscita.includes("$ pnpm add @sepoina/vitetranslate"));

  // Monorepo: il lockfile sta alla radice, il comando parte dal pacchetto.
  const monorepo = cartella();
  writeFileSync(join(monorepo, "package.json"), "{}");
  writeFileSync(join(monorepo, "yarn.lock"), "");
  const app = join(monorepo, "packages", "app");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, "package.json"), "{}");
  eq("lockfile alla radice del monorepo: yarn add", true, lancia(app).uscita.includes("$ yarn add @sepoina/vitetranslate"));

  const pnp = cartella();
  writeFileSync(join(pnp, "package.json"), JSON.stringify({ devDependencies: { "@sepoina/vitetranslate": "^4.5.0" } }));
  writeFileSync(join(pnp, "yarn.lock"), "");
  writeFileSync(join(pnp, ".pnp.cjs"), "");
  const plugnplay = lancia(pnp);
  eq("Yarn PnP: non dice 'not installed'", false, plugnplay.uscita.includes("not installed"));
  eq("...e rimanda a yarn", true, plugnplay.uscita.includes("Plug'n'Play") && plugnplay.uscita.includes("$ yarn vtranslate-cli"));

  if (progettoSopraTmp) salta(`c'è un package.json sopra ${TMP}`);
  else {
    const nessuno = lancia(cartella());
    eq("nessun progetto: esce 1", 1, nessuno.status);
    eq("...e dice da dove lanciarlo", true, nessuno.uscita.includes("no project here"));
  }
}

// ------------------------------------------------------- copie rovinate
console.log("\n== copie rovinate: lo dice, e non lancia niente ==");
{
  const senzaFile = cartella();
  rmSync(join(copiaFinta(senzaFile), "cli.js"));
  const manca = lancia(senzaFile);
  eq("file del comando mancante: esce 1", 1, manca.status);
  eq("...e lo dice", true, manca.uscita.includes("is missing"));

  const senzaBin = cartella();
  copiaFinta(senzaBin, { bin: null });
  const nessunComando = lancia(senzaBin);
  eq("nessun comando dichiarato: esce 1", 1, nessunComando.status);
  eq("...e dice di aggiornare", true, nessunComando.uscita.includes("@sepoina/vitetranslate@latest"));

  const rotta = cartella();
  writeFileSync(join(copiaFinta(rotta), "package.json"), "{ non è json");
  const illeggibile = lancia(rotta);
  eq("package.json illeggibile: esce 1", 1, illeggibile.status);
  eq("...e lo dice", true, illeggibile.uscita.includes("cannot be read"));

  // Un link che porta al pacchetto sbagliato: il caso vero era node_modules/@sepoina/vitetranslate
  // -> ../.. dentro site/pages/playEdge, cioè playEdge stesso.
  const altrui = cartella();
  writeFileSync(join(copiaFinta(altrui), "package.json"), JSON.stringify({ name: "un-altro-pacchetto", version: "0.0.0" }));
  const sbagliata = lancia(altrui);
  eq("contiene un altro pacchetto: esce 1", 1, sbagliata.status);
  eq("...e lo nomina", true, sbagliata.uscita.includes('holds "un-altro-pacchetto"'));
  eq("--version: lo dice invece di una versione", true, lancia(altrui, ["--version"]).uscita.includes("broken"));
}

console.log("\n== la guardia: un launcher che lancia se stesso si ferma ==");
{
  const radice = cartella();
  copiaFinta(radice);
  const esito = lancia(radice, [], { VITETRANSLATE_LAUNCHER: "1" });
  eq("esce 1", 1, esito.status);
  eq("non lancia niente", null, eseguito(esito.uscita));
}

// ------------------------------------------------------- segnali
console.log("\n== segnali: stessa fine del figlio, e quelli del launcher arrivano al figlio ==");
if (process.platform === "win32") salta("su Windows i segnali POSIX non esistono");
else {
  const radice = cartella();
  copiaFinta(radice, { script: 'process.kill(process.pid, "SIGTERM");\nsetTimeout(() => {}, 5000);\n' });
  eq("figlio morto di SIGTERM: il launcher pure", "SIGTERM", lancia(radice).signal);

  const attesa = cartella();
  copiaFinta(attesa, {
    script: 'process.on("SIGTERM", () => { console.log("PRESO"); process.exit(42); });\n' +
      'console.log("PRONTO");\nsetTimeout(() => {}, 10000);\n',
  });
  const esito = await new Promise((fine) => {
    const figlio = spawn(process.execPath, [LAUNCHER], { cwd: attesa, env: { ...process.env, NO_COLOR: "1" } });
    let uscita = "";
    let mandato = false;
    figlio.stdout.on("data", (pezzo) => {
      uscita += pezzo;
      // Solo quando il comando finto è partito davvero: prima, il SIGTERM lo troverebbe senza gestore.
      if (!mandato && uscita.includes("PRONTO")) {
        mandato = true;
        figlio.kill("SIGTERM");
      }
    });
    figlio.on("exit", (codice) => fine({ codice, uscita }));
  });
  eq("SIGTERM al solo launcher: il figlio lo riceve", true, esito.uscita.includes("PRESO"));
  eq("...e il launcher esce col codice del figlio", 42, esito.codice);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
