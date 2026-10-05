// Il CLI del progetto selezionato: quello della libreria installata lì (syncCommand.mjs), in un
// task — il pannello del terminale, coi colori del CLI, il suo codice d'uscita, e l'input (un
// --llm-translate chiede conferma, --llm-key-set la chiave). Col binario dell'editor in modalità
// Node, come le sonde: nessun `node` né `npx` richiesto nel PATH. Il CLI esegue vite.config,
// quindi non in Restricted Mode; un comando alla volta per progetto. Le tabelle che scrive le vede
// il watcher dei sorgenti, e Results si aggiorna da sé. Lo usano Sync (Project) e le azioni LLM.
import * as vscode from "vscode";
import { findCli } from "./syncCommand.mjs";

export class CliTasks {
  /**
   * @param {object} p
   * @param {import("./projects.mjs").Projects} p.projects - per il nome del task
   * @param {(riga: string) => void} p.log
   */
  constructor({ projects, log }) {
    this.projects = projects;
    this.log = log;
    // Un task finito: la sua definizione { type, command, dir }. Il pannello LLM ci ascolta i
    // --llm-key-set|clear.
    this.finito = new vscode.EventEmitter();
    this.onDidEnd = this.finito.event;
    this.ascolto = vscode.tasks.onDidEndTaskProcess((e) => {
      const d = e.execution.task.definition;
      if (d.type !== "vitetranslate") return;
      log(`${d.dir}: ${d.command} ended with exit code ${e.exitCode}`);
      if (e.exitCode) vscode.window.showErrorMessage(`viteTranslate: ${d.command} failed. See the terminal for why.`);
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
    const task = new vscode.Task(
      { type: "vitetranslate", command: nome, dir: progetto.dir },
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(progetto.dir)) ?? vscode.TaskScope.Workspace,
      `${nome} ${this.projects.titleOf(progetto)}`,
      "viteTranslate",
      new vscode.ProcessExecution(process.execPath, [trovato.cli, ...args], { cwd: progetto.dir, env: { ELECTRON_RUN_AS_NODE: "1" } })
    );
    task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, clear: true };
    this.log(`${progetto.dir}: ${nome} started (${trovato.name} ${trovato.version})`);
    return vscode.tasks.executeTask(task);
  }

  dispose() {
    this.ascolto.dispose();
  }
}
