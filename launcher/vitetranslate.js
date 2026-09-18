#!/usr/bin/env node
// Architettura d'insieme: doc/structure.md § "Package distribution", "The global command: launcher/".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * `vitetranslate`: il comando che si installa una volta sola per tutti i progetti della
 * macchina (`npm i -g vitetranslate`). Non contiene la libreria e non dipende da niente: cerca
 * la copia di @sepoina/vitetranslate installata nel progetto in cui ci si trova e lancia il
 * comando di QUELLA copia, con gli stessi argomenti.
 *
 * Non fa niente da solo, di proposito. Il comando di sync legge vite.config.*, che importa il
 * plugin dalla node_modules del progetto, e comando e plugin scrivono gli stessi file: tabelle,
 * intestazione, record di --fastverify. Devono essere la stessa versione, e l'unica giusta è
 * quella del progetto, più nuova o più vecchia di questo launcher che sia. Per lo stesso motivo
 * il launcher non si aggiorna insieme alla libreria: cambia solo quando cambia lui.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PACCHETTO = "@sepoina/vitetranslate";
const DOCS = "https://github.com/sepoina/viteTranslate#readme";

/**
 * I nomi con cui le versioni pubblicate espongono il comando: `vtranslate-cli` dalla 4.1, quello
 * lungo dalla 2.0, `vitetranslate` in testa per quando lo esporrà anche la libreria. Si lancia il
 * primo che la copia dichiara, così un progetto fermo a una versione vecchia funziona come uno
 * aggiornato.
 */
const NOMI_COMANDO = ["vitetranslate", "vtranslate-cli", "vitetranslate-prepare-translation-table"];

/**
 * Accesa nell'ambiente del processo figlio. Ritrovarla qui vuol dire che il comando della copia
 * è a sua volta un launcher: senza questa guardia ognuno lancerebbe il successivo, un processo
 * dopo l'altro, senza fine.
 */
const GUARDIA = "VITETRANSLATE_LAUNCHER";

/**
 * Il gestore di pacchetti del progetto, riconosciuto dal lockfile: suggerire `npm i` in un
 * progetto pnpm vorrebbe dire fargli nascere accanto un package-lock.json. npm per ultimo, ed è
 * anche la risposta quando non si trova nessun lockfile.
 */
const GESTORI = [
  { lockfile: ["pnpm-lock.yaml"], aggiungi: "pnpm add -D", installa: "pnpm install" },
  { lockfile: ["yarn.lock"], aggiungi: "yarn add -D", installa: "yarn install" },
  { lockfile: ["bun.lock", "bun.lockb"], aggiungi: "bun add -d", installa: "bun install" },
  { lockfile: ["package-lock.json"], aggiungi: "npm i -D", installa: "npm install" },
];

const AIUTO = `
vitetranslate — runs the ${PACCHETTO} command of the project you are in

Usage:
  vitetranslate [options]

A launcher, nothing more: it looks for ${PACCHETTO} in ./node_modules
and in every folder above (the way Node does), then runs that copy's command
with the same options. The version that runs is always the project's own.

From here it finds no copy, so there are no project options to show: run it
from the root of a project that has one, and --help will show that project's.

Options of its own:
  --version    This launcher's version, and which copy it would run.
  --help, -h   This message, when there is no copy to ask.

Docs: ${DOCS}
`;

// Colori solo davanti a un terminale, e mai con NO_COLOR (https://no-color.org): nel log di una
// CI un codice ANSI è rumore, non colore.
const colori = process.stderr.isTTY && !("NO_COLOR" in process.env);
const rosso = (s) => (colori ? `\x1b[1;31m${s}\x1b[0m` : s);
const verde = (s) => (colori ? `\x1b[32m${s}\x1b[0m` : s);

/**
 * Come gli errori di vtranslate-cli: prefisso rosso, poi una riga `$ …` per ogni comando da dare.
 * `exitCode` e non `process.exit()`: il processo finisce da solo appena scritto il messaggio,
 * senza rischiare di troncarlo quando stderr è una pipe.
 */
function fermati(messaggio, comandi = []) {
  const righe = comandi.map((c) => `\n  $ ${verde(c)}`).join("");
  console.error(`\n${rosso("[vitetranslate]")} ${messaggio}${righe}\n`);
  process.exitCode = 1;
}

function esiste(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function leggiJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Da `da` verso la radice del disco: il primo risultato non nullo di `prova(cartella)`. */
function risali(da, prova) {
  for (let dir = da; ; dir = path.dirname(dir)) {
    const trovato = prova(dir);
    if (trovato) return trovato;
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * La cartella di @sepoina/vitetranslate che Node troverebbe partendo da `da`: `node_modules` qui,
 * poi in ogni cartella sopra. È la stessa ricerca che farà l'import del plugin dentro
 * vite.config, quindi comando e plugin escono dalla stessa copia.
 *
 * A mano invece che con `require.resolve(".../package.json")`: le prime 2.x non esportano
 * `./package.json`, e il resolver le darebbe per assenti proprio mentre ci sono.
 */
function trovaCopia(da) {
  return risali(da, (dir) => {
    // Node non cerca mai in `node_modules/node_modules`: partendo da dentro una node_modules,
    // quel livello si salta come fa lui.
    if (path.basename(dir) === "node_modules") return null;
    const copia = path.join(dir, "node_modules", ...PACCHETTO.split("/"));
    return esiste(path.join(copia, "package.json")) ? copia : null;
  });
}

/** Il comando che la copia dichiara, `{ nome, file }`, o `null` se non ne dichiara nessuno. */
function comandoDi(pkg) {
  const nome = NOMI_COMANDO.find((n) => typeof pkg.bin?.[n] === "string");
  return nome ? { nome, file: pkg.bin[nome] } : null;
}

/** Con quale gestore suggerire i comandi: si risale fino alla radice del monorepo, dove sta il lockfile. */
function gestoreDi(da) {
  return risali(da, (dir) => GESTORI.find((g) => g.lockfile.some((f) => esiste(path.join(dir, f)))))
    ?? GESTORI[GESTORI.length - 1];
}

/**
 * `--version`: la propria versione e la copia che lancerebbe, con il percorso. Il percorso non è
 * un dettaglio: la ricerca risale le cartelle, e una copia dimenticata in una node_modules più in
 * alto è esattamente la sorpresa che questa riga deve far vedere.
 */
function stampaVersioni(copia) {
  const proprio = leggiJson(new URL("./package.json", import.meta.url));
  console.log(`vitetranslate ${proprio?.version ?? "?"} (launcher)`);
  if (!copia) {
    console.log(`${PACCHETTO}: not installed here or in any folder above`);
    return;
  }
  const pkg = leggiJson(path.join(copia, "package.json"));
  if (pkg && pkg.name !== PACCHETTO) {
    console.log(`${PACCHETTO}: broken, "${copia}" holds "${pkg.name}"`);
    return;
  }
  const comando = pkg && comandoDi(pkg);
  console.log(`${PACCHETTO} ${pkg?.version ?? "?"}${comando ? ` (${comando.nome})` : ""}  ${copia}`);
}

/** Nessuna copia raggiungibile: dire perché, e che cosa scrivere per averne una. */
function spiegaAssenza(qui) {
  const radice = risali(qui, (dir) => (esiste(path.join(dir, "package.json")) ? dir : null));
  if (!radice) {
    fermati(
      `no project here: there is no package.json in "${qui}" or in any folder above it.\n` +
      "  Run this from the root of your project. Starting a new one? Create a Vite app, then add\n" +
      "  the package from inside it:",
      ["npm create vite@latest", `npm i -D ${PACCHETTO}`]
    );
    return;
  }

  // Con Plug'n'Play i pacchetti stanno negli zip di .yarn/cache e li trova solo il runtime di
  // Yarn: dire "non installato" a chi l'ha appena installato sarebbe falso e manderebbe a
  // reinstallare una cosa che c'è già.
  if (risali(radice, (dir) => [".pnp.cjs", ".pnp.js"].some((f) => esiste(path.join(dir, f))))) {
    fermati(
      `"${radice}" is a Yarn Plug'n'Play project: its packages are not in node_modules, so a\n` +
      "  global command cannot reach them. Run it through Yarn:",
      ["yarn vtranslate-cli"]
    );
    return;
  }

  const gestore = gestoreDi(radice);
  const pkg = leggiJson(path.join(radice, "package.json")) ?? {};
  const dichiarato = ["dependencies", "devDependencies", "optionalDependencies"].some((c) => pkg[c]?.[PACCHETTO]);
  if (dichiarato) {
    // Il caso di tutti i giorni: un clone appena fatto, prima del primo install.
    fermati(`${PACCHETTO} is in the package.json of "${radice}", but not installed:`, [gestore.installa]);
    return;
  }
  fermati(
    `${PACCHETTO} is not installed in "${radice}".\n` +
    "  This command only launches the copy installed in the project. Add it, then register the\n" +
    `  plugin in vite.config (${DOCS}):`,
    [`${gestore.aggiungi} ${PACCHETTO}`]
  );
}

/**
 * Il comando della copia, in un processo suo: è così che lo lancia npx, quindi ogni versione
 * pubblicata si comporta come si è sempre comportata. Il terminale resta condiviso (stdio
 * "inherit"): colori, domande di conferma e input nascosto di `--key set` funzionano come se il
 * launcher non ci fosse.
 */
function lancia(file, argv) {
  const figlio = spawn(process.execPath, [file, ...argv], {
    stdio: "inherit",
    env: { ...process.env, [GUARDIA]: "1" },
  });

  // Ctrl+C arriva dal terminale a tutto il gruppo, figlio compreso: al launcher tocca non uscire
  // prima di lui, o il prompt tornerebbe mentre il comando sta ancora scrivendo. Un segnale
  // mandato al solo launcher (kill, un process manager, una CI che annulla il job) va invece
  // girato al figlio. Così lo stesso Ctrl+C può arrivargli due volte, e col gestore predefinito
  // di Node basta il primo: se un giorno il comando gestirà SIGINT da sé ("premi di nuovo per
  // uscire"), questa è la riga da ripensare.
  const SEGNALI = ["SIGINT", "SIGTERM", "SIGHUP"];
  for (const s of SEGNALI) process.on(s, () => figlio.kill(s));

  figlio.on("error", (errore) => fermati(`could not start "${file}": ${errore.message}`));
  figlio.on("exit", (codice, segnale) => {
    if (segnale) {
      // Stessa fine del figlio: una shell o una CI distinguono "interrotto" da "fallito" dallo
      // stato d'uscita, e un 1 qualunque cancellerebbe la differenza. Il codice sotto resta solo
      // per il caso in cui il segnale fosse ignorato (nohup, per esempio).
      for (const s of SEGNALI) process.removeAllListeners(s);
      process.exitCode = 128 + (os.constants.signals[segnale] ?? 0);
      process.kill(process.pid, segnale);
      return;
    }
    process.exit(codice ?? 1);
  });
}

function main() {
  const argv = process.argv.slice(2);

  if (process.env[GUARDIA]) {
    fermati(
      `the command of the project's copy of ${PACCHETTO} is itself a launcher, so it would\n` +
      '  keep launching itself. Its "bin" must point at the real command, lib/dev/vite/cli.js.'
    );
    return;
  }

  const qui = process.cwd();
  const copia = trovaCopia(qui);

  // Prima di tutto, con o senza copia: il comando della libreria non conosce --version, e un
  // flag che non conosce non lo ferma — lo prende per una sync qualunque.
  if (argv.includes("--version")) {
    stampaVersioni(copia);
    return;
  }

  if (!copia) {
    if (argv.includes("--help") || argv.includes("-h")) console.log(AIUTO);
    else spiegaAssenza(qui);
    return;
  }

  const pkg = leggiJson(path.join(copia, "package.json"));
  if (!pkg) {
    fermati(
      `the package.json in "${copia}" cannot be read: that copy looks damaged.\n` +
      "  Delete that folder, then reinstall:",
      [gestoreDi(qui).installa]
    );
    return;
  }
  // Un link simbolico che porta nel posto sbagliato arriva a una cartella che esiste e ha un
  // package.json, ma di un altro pacchetto: il caso visto davvero è
  // `playEdge/node_modules/@sepoina/vitetranslate -> ../..`, cioè playEdge stesso. Node lo
  // importerebbe lo stesso, e senza questo controllo il messaggio sarebbe "versione senza
  // comando: aggiorna", che manda a cercare il guasto nel posto sbagliato.
  if (pkg.name !== PACCHETTO) {
    fermati(
      `"${copia}" holds "${pkg.name}", not ${PACCHETTO}: a broken link or a stale install.\n` +
      "  Delete that folder, then reinstall:",
      [gestoreDi(qui).installa]
    );
    return;
  }
  const comando = comandoDi(pkg);
  if (!comando) {
    fermati(`${PACCHETTO} ${pkg.version ?? ""} in "${copia}" has no command to run. Update it:`, [`${gestoreDi(qui).aggiungi} ${PACCHETTO}@latest`]);
    return;
  }
  const file = path.join(copia, comando.file);
  if (!esiste(file)) {
    fermati(
      `"${file}" is missing: the copy in "${copia}" looks damaged.\n` +
      "  Delete that folder, then reinstall:",
      [gestoreDi(qui).installa]
    );
    return;
  }

  lancia(file, argv);
}

main();
