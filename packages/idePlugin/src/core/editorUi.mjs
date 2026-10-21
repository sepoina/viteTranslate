// Piccoli gesti sull'editor che più sezioni fanno uguali: aprire un file a una posizione, aprire
// vite.config sulle opzioni del plugin, la barra di avanzamento di una sezione.
import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import { pluginCallPosition } from "./syncCommand.mjs";

/** Il testo di `file`, o null se non si legge (lo aprirà comunque l'editor, che dirà lui perché). */
export function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** Apre `file`; con `pos` ({ line, column }, da 1) il cursore va lì. */
export function openFile(file, pos) {
  const uri = vscode.Uri.file(file);
  if (!pos) return vscode.commands.executeCommand("vscode.open", uri);
  const punto = new vscode.Position(pos.line - 1, pos.column - 1);
  return vscode.commands.executeCommand("vscode.open", uri, { selection: new vscode.Range(punto, punto) });
}

/** La chiave inglese: vite.config aperto sulla chiamata vitetranslate(…), le opzioni del plugin. */
export function openPluginConfig(project) {
  const file = path.join(project.dir, project.configFile);
  const testo = readText(file);
  return openFile(file, (testo !== null && pluginCallPosition(testo)) || { line: 1, column: 1 });
}

// La barra di avanzamento di una sezione: VS Code la mostra da sé solo mentre getChildren aspetta,
// e qui getChildren non aspetta mai (né c'è un getChildren, nelle webview).
export const progressIn = (viewId) => (promessa) => vscode.window.withProgress({ location: { viewId } }, () => promessa);
