// Il lato estensione del pannello LLM: i controlli in background (llmCheck.mjs), lo stato della
// pagina (llmPanel.mjs) e le azioni --llm-* (LLM_ACTIONS), lanciate col CLI in un task come Sync.
//
// I controlli, uno per progetto: partono la prima volta che il pannello si apre su un progetto, e
// valgono finché non cambia il suo vite.config (forget), non si chiede "Check again" (recheck) o
// non finisce un --llm-key-set|clear. Uno solo alla volta per progetto.
import * as vscode from "vscode";
import path from "node:path";
import { findCli, LLM_ACTIONS } from "../../../core/syncCommand.mjs";
import { runLlmCheck } from "./llmCheck.mjs";
import { llmPanelState } from "./llmPanel.mjs";

const pingDetto = (ping) => (!ping ? "?" : ping.ok ? "ok" : ping.skipped ? "skipped" : `failed: ${ping.error}`);

export class LlmController {
  /**
   * @param {object} p
   * @param {import("../../../core/projects.mjs").Projects} p.projects
   * @param {import("../../../views/results/resultsView.mjs").ResultsView} p.results - le lingue di destinazione
   * @param {import("../../../core/cliTasks.mjs").CliTasks} p.cli
   * @param {(riga: string) => void} p.log
   * @param {() => void} p.onUpdate - un controllo ha qualcosa di nuovo da mostrare
   */
  constructor({ projects, results, cli, log, onUpdate }) {
    Object.assign(this, { projects, results, cli, log, onUpdate });
    this.checks = new Map(); // dir -> { stato, running, cancel, done? }
    // La chiave è cambiata nel keyring: il pannello la cerca di nuovo.
    this.ascolto = cli.onDidEnd((d) => {
      if (d.command !== "llm key-set" && d.command !== "llm key-clear") return;
      this.forget(d.dir);
      onUpdate();
    });
  }

  /** Lo stato della pagina per `progetto`, che ha il blocco `llm` in `opzioni`. */
  state(progetto, opzioni) {
    return llmPanelState({
      llm: opzioni.llm,
      // Dove il CLI cerca .env.local e .env: il baseDir del plugin, di solito il progetto.
      baseDir: opzioni.baseDir ? path.resolve(progetto.dir, opzioni.baseDir) : progetto.dir,
      check: this.check(progetto).stato,
      title: this.projects.titleOf(progetto),
    });
  }

  /** Il controllo di `progetto`: quello che c'è, o uno nuovo che parte. */
  check(progetto) {
    let voce = this.checks.get(progetto.dir);
    if (voce) return voce;
    const fermo = (error) => ({ stato: { error }, running: false, cancel() {} });
    const trovato = vscode.workspace.isTrusted ? findCli(progetto.dir) : null;
    if (!trovato) voce = fermo("Restricted Mode: trust the workspace to run the check.");
    else if (!trovato.ok) voce = fermo(trovato.error);
    else {
      voce = { stato: {}, running: true };
      const attuale = () => this.checks.get(progetto.dir) === voce;
      const giro = runLlmCheck({
        cli: trovato.cli,
        dir: progetto.dir,
        onUpdate: (stato) => {
          if (!attuale()) return;
          voce.stato = stato;
          this.onUpdate();
        },
      });
      voce.cancel = giro.cancel;
      voce.done = giro.done.then((stato) => {
        if (!attuale()) return;
        Object.assign(voce, { stato, running: false });
        this.log(`${progetto.dir}: llm check — key ${stato.key ?? "?"}, ping ${pingDetto(stato.ping)}${stato.error ? `, ${stato.error}` : ""}`);
        this.onUpdate();
      });
    }
    this.checks.set(progetto.dir, voce);
    return voce;
  }

  /** Dimentica il controllo di `dir`, o tutti senza argomenti; quelli in corso si fermano. */
  forget(dir) {
    for (const d of dir === undefined ? [...this.checks.keys()] : [dir]) {
      this.checks.get(d)?.cancel();
      this.checks.delete(d);
    }
  }

  /** "Check again": un controllo nuovo per il selezionato, se quello di prima è finito. */
  async recheck() {
    const progetto = await this.projects.selectedProject();
    if (progetto && !this.checks.get(progetto.dir)?.running) this.forget(progetto.dir);
  }

  /** Un'azione del pannello (LLM_ACTIONS): il CLI in un task. --llm-retranslate vuole le lingue. */
  async action(id) {
    const azione = LLM_ACTIONS.find((a) => a.id === id);
    if (!azione) return this.log(`LLM: unknown action ${JSON.stringify(id)}`);
    const progetto = await this.projects.selectedOrAsk();
    if (!progetto) return;
    let args = azione.args;
    if (azione.languages) {
      const lingue = this.results.tree.resultOf(progetto.dir)?.languages?.targets ?? [];
      if (!lingue.length) return vscode.window.showInformationMessage("No target language to retranslate yet: run the sync first.");
      const scelte = await vscode.window.showQuickPick(lingue, { title: `Retranslate · ${this.projects.titleOf(progetto)}`, placeHolder: "Which languages?", canPickMany: true });
      if (!scelte?.length) return;
      args = [...args, ...scelte];
    }
    return this.cli.run(progetto, args, `llm ${azione.args.map((a) => a.replace(/^--llm-/, "")).join(" ")}`);
  }

  dispose() {
    this.forget();
    this.ascolto.dispose();
  }
}
