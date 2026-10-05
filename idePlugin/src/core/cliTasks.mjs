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
// Mode; un comando alla volta per progetto. Le tabelle che scrive le vede il watcher dei sorgenti,
// e Results si aggiorna da sé. Lo usano Sync (Project) e le azioni LLM.
import * as vscode from "vscode";
import { findCli, cliLaunch } from "./syncCommand.mjs";
import { cliHeader } from "./cliHeader.mjs";

/** L'avviso, una volta per sessione, quando su Windows non c'è un node nel PATH. */
export const NO_NODE = "Node.js is not in PATH: viteTranslate runs its CLI with the editor's own runtime. The output shows, but nothing can be typed in: Translate can't ask before spending, and Set the API key can't read the key. Install Node.js, or add it to PATH, and restart the editor.";

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
    // Un task finito: la sua definizione { type, command, dir }. Il pannello LLM ci ascolta i
    // --llm-key-set|clear.
    this.finito = new vscode.EventEmitter();
    this.onDidEnd = this.finito.event;
    this.ascolto = vscode.tasks.onDidEndTaskProcess((e) => {
      const d = e.execution.task.definition;
      if (d.type !== "vitetranslate") return;
      log(`${d.dir}: ${d.command} ended with exit code ${e.exitCode}`);
      // Senza "see the terminal": col runner il task finisce quando il terminale si è già chiuso.
      if (e.exitCode) vscode.window.showErrorMessage(`viteTranslate: ${d.command} failed (exit code ${e.exitCode}).`);
      this.finito.fire(d);
    });
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
    if (inCorso) return vscode.window.showInformationMessage(`A ${inCorso.task.definition.command} is already running for this project.`);
    const lancio = cliLaunch({ cli: trovato.cli, args, runner: this.runner, runAsNodeCmd: this.runAsNodeCmd });
    const env = { ...lancio.env };
    // L'impostazione si legge a ogni lancio: cambiarla vale dal comando dopo, senza ricaricare.
    if (lancio.runner) {
      const detail = vscode.workspace.getConfiguration("vitetranslate").get("detailCommand", false);
      env.VT_HEADER = cliHeader({ name: trovato.name, args, detail, dir: progetto.dir, runtime: lancio.command, runner: lancio.runner, cli: trovato.cli });
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
