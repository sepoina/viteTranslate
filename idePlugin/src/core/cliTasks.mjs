// Il CLI del progetto selezionato: quello della libreria installata lì (syncCommand.mjs), in un
// task — il pannello del terminale, coi colori del CLI, il suo codice d'uscita, e l'input (un
// --llm-translate chiede conferma, --llm-key-set la chiave). Con cosa lo si lancia lo decide
// cliLaunch: il binario dell'editor in modalità Node su macOS e Linux, il node del PATH su Windows
// (lì l'editor nel terminale perde l'output), e se manca l'editor via dist/runAsNode.cmd, senza
// input: lo si dice una volta. Coi primi due il CLI passa da dist/cliRunner.mjs, che a fine corsa
// chiude il terminale dopo un conto alla rovescia (o resta, su errore, fino a un tasto): il task
// finisce allora, non quando finisce il CLI. In testa al terminale il runner scrive il comando
// equivalente (`$ npx vitetranslate …`, cliHeader.mjs) al posto della riga "Executing task" di VS
// Code; con vitetranslate.detailCommand anche cartella, runtime, runner e file del CLI. Il CLI
// esegue vite.config, quindi non in Restricted
// Mode; un comando alla volta per progetto (uno rimasto col terminale aperto lo si chiude, se
// l'utente lo chiede: chiudi). Le tabelle che scrive le vede il watcher dei sorgenti,
// e Results si aggiorna da sé. Lo usano Sync (Project) e le azioni LLM.
import * as vscode from "vscode";
import { findCli, cliLaunch } from "./syncCommand.mjs";
import { cliHeader } from "./cliHeader.mjs";

/** L'avviso, una volta per sessione, quando su Windows non c'è un node nel PATH. */
const NO_NODE = "Node.js is not in PATH: viteTranslate runs its CLI with the editor's own runtime. The output shows, but nothing can be typed in: Translate can't ask before spending, and Set the API key can't read the key. Install Node.js, or add it to PATH, and restart the editor.";

// Il comando nell'intestazione del terminale: quello che la documentazione fa scrivere (il
// launcher, che trova da sé il CLI del progetto), non il nome del bin della libreria.
const COMANDO = "vitetranslate";

/** Il bottone che chiude il terminale di un task rimasto aperto e lancia quello nuovo. */
export const CLOSE_AND_RUN = "Close it and run";
// Quanto si aspetta che VS Code dia per finito il task chiuso, prima di lanciare comunque.
const ATTESA_CHIUSURA_MS = 5000;

export class CliTasks {
  /**
   * @param {object} p
   * @param {string} p.runner - dist/cliRunner.mjs
   * @param {string} p.runAsNodeCmd - dist/runAsNode.cmd
   * @param {import("./projects.mjs").Projects} p.projects - per il nome del task
   * @param {(riga: string) => void} p.log
   */
  constructor({ runner, runAsNodeCmd, projects, log }) {
    this.runner = runner;
    this.runAsNodeCmd = runAsNodeCmd;
    this.projects = projects;
    this.log = log;
    this.avvisato = false; // NO_NODE già detto
    this.chiusi = new WeakSet(); // le esecuzioni chiuse da CLOSE_AND_RUN: la loro fine non è un errore
    // Un task finito: la sua definizione { type, command, dir }. Il pannello LLM ci ascolta i
    // --llm-key-set|clear.
    this.finito = new vscode.EventEmitter();
    this.onDidEnd = this.finito.event;
    this.ascolto = vscode.tasks.onDidEndTaskProcess((e) => {
      const d = e.execution.task.definition;
      if (d.type !== "vitetranslate") return;
      if (this.chiusi.delete(e.execution)) log(`${d.dir}: ${d.command} closed, to run another command`);
      else {
        log(`${d.dir}: ${d.command} ended with exit code ${e.exitCode}`);
        // Senza "see the terminal": col runner il task finisce quando il terminale si è già chiuso.
        if (e.exitCode) vscode.window.showErrorMessage(`viteTranslate: ${d.command} failed (exit code ${e.exitCode}).`);
      }
      this.finito.fire(d);
    });
  }

  /**
   * Un task dello stesso progetto ha ancora il terminale aperto. Col runner il task vive quanto il
   * terminale (cliRunner.mjs): il CLI può star girando, ma anche essere finito da un pezzo, con il
   * runner che aspetta un tasto (dopo un errore, o "Kept open") o la fine del conto alla rovescia.
   * Non lo si distingue da qui: lo si chiude solo se l'utente lo chiede, e il comando nuovo parte
   * quando VS Code lo dà per finito. Vero se si può lanciare.
   *
   * @param {vscode.TaskExecution} inCorso
   * @param {string} nome - il comando nuovo
   */
  async chiudi(inCorso, nome) {
    const { command, dir } = inCorso.task.definition;
    const scelta = await vscode.window.showWarningMessage(
      `A ${command} for this project still has its terminal open: it may be running, or waiting for a key. Close it and run ${nome}?`,
      CLOSE_AND_RUN
    );
    if (scelta !== CLOSE_AND_RUN) return false;
    this.chiusi.add(inCorso);
    await new Promise((resolve) => {
      const fine = () => {
        clearTimeout(timer);
        ascolto.dispose();
        resolve();
      };
      const ascolto = vscode.tasks.onDidEndTask((e) => {
        const d = e.execution.task.definition;
        if (d.type === "vitetranslate" && d.dir === dir) fine();
      });
      const timer = setTimeout(fine, ATTESA_CHIUSURA_MS);
      inCorso.terminate();
    });
    return true;
  }

  /**
   * @param {{ dir: string }} progetto
   * @param {string[]} args - gli argomenti del CLI
   * @param {string} nome - del task e del comando nei messaggi ("sync", "llm translate", …)
   */
  async run(progetto, args, nome) {
    if (!vscode.workspace.isTrusted) return vscode.window.showWarningMessage(`Trust the workspace to run ${nome}: it executes vite.config.`);
    const trovato = findCli(progetto.dir);
    if (!trovato.ok) return vscode.window.showErrorMessage(`viteTranslate: ${trovato.error}`);
    const inCorso = vscode.tasks.taskExecutions.find((e) => e.task.definition.type === "vitetranslate" && e.task.definition.dir === progetto.dir);
    if (inCorso && !(await this.chiudi(inCorso, nome))) return;
    const lancio = cliLaunch({ cli: trovato.cli, args, runner: this.runner, runAsNodeCmd: this.runAsNodeCmd });
    const env = { ...lancio.env };
    // L'impostazione si legge a ogni lancio: cambiarla vale dal comando dopo, senza ricaricare.
    if (lancio.runner) {
      const detail = vscode.workspace.getConfiguration("vitetranslate").get("detailCommand", false);
      env.VT_HEADER = cliHeader({ name: COMANDO, args, detail, dir: progetto.dir, runtime: lancio.command, runner: lancio.runner, cli: trovato.cli });
    }
    const task = new vscode.Task(
      { type: "vitetranslate", command: nome, dir: progetto.dir },
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(progetto.dir)) ?? vscode.TaskScope.Workspace,
      `${nome} ${this.projects.titleOf(progetto)}`,
      "viteTranslate",
      new vscode.ProcessExecution(lancio.command, lancio.args, { cwd: progetto.dir, env })
    );
    // Col runner: niente "Executing task" (l'intestazione la scrive lui) e il terminale lo chiude lui.
    task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, clear: true, echo: !lancio.runner, close: !!lancio.runner };
    this.log(`${progetto.dir}: ${nome} started (${trovato.name} ${trovato.version}, via ${lancio.via === "node" ? lancio.command : lancio.via})`);
    if (!lancio.interactive && !this.avvisato) {
      this.avvisato = true;
      vscode.window.showWarningMessage(NO_NODE);
    }
    return vscode.tasks.executeTask(task);
  }

  dispose() {
    this.ascolto.dispose();
  }
}
