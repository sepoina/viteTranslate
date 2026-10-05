// L'intestazione del terminale di un task del CLI, prima del suo output: la scrive cliRunner.mjs,
// che la riceve già pronta (VT_HEADER). Di solito una riga sola, il comando equivalente da scrivere
// a mano, coi colori di una shell: `$ npx vtranslate-cli --llm-translate fr-FR`. Con l'impostazione
// `vitetranslate.detailCommand`, sotto, come lo si lancia davvero: la cartella, il runtime, il
// runner, il file del CLI. Nessun import di `vscode`.

const TENUE = "\x1b[2m";
const VERDE = "\x1b[32m";
const VERDE_FORTE = "\x1b[1;32m";
const CIANO = "\x1b[36m";
const GIALLO = "\x1b[33m"; // come `nome` del CLI: le lingue, i file
const FINE = "\x1b[0m";

/** Un argomento come lo si scriverebbe: tra virgolette solo se ha spazi o caratteri della shell. */
const quota = (a) => (/^[\w@%+=:,./\\-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);

/**
 * `$ npx <name> <args>`: il comando in verde, i flag in ciano, i valori (le lingue) in giallo.
 *
 * @param {string} name - il comando della libreria (findCli: vitetranslate, vtranslate-cli, …)
 * @param {string[]} args
 */
export function npxLine(name, args) {
  const argomenti = args.map((a) => `${a.startsWith("-") ? CIANO : GIALLO}${quota(a)}${FINE}`);
  return [`${TENUE}$${FINE}`, `${VERDE}npx${FINE}`, `${VERDE_FORTE}${name}${FINE}`, ...argomenti].join(" ");
}

/**
 * @param {object} p
 * @param {string} p.name - il comando della libreria
 * @param {string[]} p.args - gli argomenti del CLI
 * @param {boolean} [p.detail] - vitetranslate.detailCommand
 * @param {string} [p.dir] - la cartella del progetto
 * @param {string} [p.runtime] - il node che lo lancia (cliLaunch: node.exe, o il binario dell'editor)
 * @param {string} [p.runner] - dist/cliRunner.mjs
 * @param {string} [p.cli] - il file del CLI
 * @returns {string}
 */
export function cliHeader({ name, args, detail = false, dir, runtime, runner, cli }) {
  const righe = [npxLine(name, args)];
  if (detail) {
    const voce = (etichetta, valore) => `  ${TENUE}${etichetta.padEnd(9)}${FINE}${valore}`;
    righe.push(voce("folder:", dir), voce("runtime:", runtime), voce("runner:", runner), voce("command:", [cli, ...args].map(quota).join(" ")));
  }
  return righe.join("\n");
}
