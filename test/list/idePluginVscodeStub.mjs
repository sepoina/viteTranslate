// Uno stub del modulo `vscode`, per idePluginExtension.test.mjs: solo le API che
// idePlugin/src/extension.mjs usa, e uno stato (`__stato`) che il test imposta e legge.
// Non è un test (il nome non finisce in .test.mjs): il lanciatore non lo esegue.
import path from "node:path";

export const __stato = {
  workspaceFolders: [],
  isTrusted: true,
  activeTextEditor: undefined,
  editori: [], // gli ascoltatori di onDidChangeActiveTextEditor: il test li chiama cambiando editor
  documenti: [], // gli ascoltatori di onDidChangeTextDocument: il test li chiama scrivendo
  chiusi: [], // gli ascoltatori di onDidCloseTextDocument
  textDocuments: [],
  progressi: [], // le viewId delle barre di avanzamento chieste
  webviews: new Map(), // id -> provider registrato con registerWebviewViewProvider
  decorazioni: [], // i provider di registerFileDecorationProvider
  eseguiti: [], // i comandi di VS Code eseguiti (non quelli registrati dall'estensione)
  avvisi: [], // [tipo, testo] di showInformationMessage/showWarningMessage/showErrorMessage
  taskEseguiti: [], // i task passati a tasks.executeTask
  taskExecutions: [], // quelli "in corso": il test li mette a mano
  fineTask: [], // gli ascoltatori di tasks.onDidEndTaskProcess
  treeView: null, // l'ultima creata
  treeViews: new Map(), // id -> TreeView
  comandi: new Map(),
  contesto: {}, // le chiavi date con setContext
  log: [],
  findFiles: async () => [],
};

export class EventEmitter {
  constructor() {
    this.ascoltatori = [];
    this.event = (f) => (this.ascoltatori.push(f), { dispose() {} });
  }
  fire(valore) {
    for (const f of this.ascoltatori) f(valore);
  }
}

export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
export const TreeItemCheckboxState = { Unchecked: 0, Checked: 1 };

export class TreeItem {
  constructor(label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  constructor(id, color) {
    this.id = id;
    this.color = color;
  }
}

export class ThemeColor {
  constructor(id) {
    this.id = id;
  }
}
ThemeIcon.File = new ThemeIcon("file");
ThemeIcon.Folder = new ThemeIcon("folder");

export class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

export class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

const uri = (scheme, fsPath) => ({
  scheme,
  fsPath,
  with: (cambi) => uri(cambi.scheme ?? scheme, fsPath),
  toString: () => `${scheme}://${fsPath}`,
});
export const Uri = {
  file: (fsPath) => uri("file", path.resolve(fsPath)),
  joinPath: (base, ...parti) => Uri.file(path.join(base.fsPath, ...parti)),
};

export class FileDecoration {
  constructor(badge, tooltip, color) {
    Object.assign(this, { badge, tooltip, color });
  }
}

const evento = () => () => ({ dispose() {} });

export const window = {
  get activeTextEditor() {
    return __stato.activeTextEditor;
  },
  createOutputChannel: () => ({ appendLine: (riga) => __stato.log.push(riga), dispose() {} }),
  createTreeView: (id, opzioni) => {
    // onDidChangeCheckboxState e onDidChangeSelection tengono l'ascoltatore: il test li chiama
    // come farebbe un clic (spunta, clicca). reveal() si annota in `rivelate` e sposta la selezione.
    const spunte = [];
    const selezioni = [];
    const vista = {
      id, ...opzioni, visible: true, message: undefined, description: undefined,
      selection: [],
      rivelate: [],
      onDidChangeVisibility: evento(),
      onDidChangeCheckboxState: (f) => (spunte.push(f), { dispose() {} }),
      onDidChangeSelection: (f) => (selezioni.push(f), { dispose() {} }),
      spunta: (items) => spunte.forEach((f) => f({ items })),
      clicca: (riga) => {
        vista.selection = [riga];
        selezioni.forEach((f) => f({ selection: [riga] }));
      },
      reveal: async (riga, opzioniReveal) => {
        vista.rivelate.push({ riga, ...opzioniReveal });
        if (opzioniReveal?.select) vista.clicca(riga);
      },
      dispose() {},
    };
    __stato.treeView = vista;
    __stato.treeViews.set(id, __stato.treeView);
    return __stato.treeView;
  },
  onDidChangeActiveTextEditor: (f) => (__stato.editori.push(f), { dispose() {} }),
  withProgress: (opzioni, f) => (__stato.progressi.push(opzioni.location?.viewId), f({ report() {} })),
  registerWebviewViewProvider: (id, provider) => (__stato.webviews.set(id, provider), { dispose() {} }),
  registerFileDecorationProvider: (provider) => (__stato.decorazioni.push(provider), { dispose() {} }),
  showInformationMessage: async (testo) => void __stato.avvisi.push(["info", testo]),
  showWarningMessage: async (testo) => void __stato.avvisi.push(["warning", testo]),
  showErrorMessage: async (testo) => void __stato.avvisi.push(["error", testo]),
};

export const workspace = {
  get workspaceFolders() {
    return __stato.workspaceFolders;
  },
  get isTrusted() {
    return __stato.isTrusted;
  },
  findFiles: (...argomenti) => __stato.findFiles(...argomenti),
  getWorkspaceFolder: (uri) => __stato.workspaceFolders.find((f) => uri.fsPath.startsWith(f.uri.fsPath)),
  get textDocuments() {
    return __stato.textDocuments;
  },
  onDidChangeTextDocument: (f) => (__stato.documenti.push(f), { dispose() {} }),
  onDidCloseTextDocument: (f) => (__stato.chiusi.push(f), { dispose() {} }),
  createFileSystemWatcher: () => ({ onDidChange: evento(), onDidCreate: evento(), onDidDelete: evento(), dispose() {} }),
  onDidChangeWorkspaceFolders: evento(),
  onDidGrantWorkspaceTrust: evento(),
};

export const TaskScope = { Global: 1, Workspace: 2 };
export const TaskRevealKind = { Always: 1, Silent: 2, Never: 3 };

export class Task {
  constructor(definition, scope, name, source, execution) {
    Object.assign(this, { definition, scope, name, source, execution });
  }
}

export class ProcessExecution {
  constructor(process, args, options) {
    Object.assign(this, { process, args, options });
  }
}

export const tasks = {
  get taskExecutions() {
    return __stato.taskExecutions;
  },
  executeTask: async (task) => (__stato.taskEseguiti.push(task), { task }),
  onDidEndTaskProcess: (f) => (__stato.fineTask.push(f), { dispose() {} }),
};

export const commands = {
  registerCommand: (id, f) => (__stato.comandi.set(id, f), { dispose() {} }),
  executeCommand: async (id, ...argomenti) => {
    if (id === "setContext") __stato.contesto[argomenti[0]] = argomenti[1];
    else if (__stato.comandi.has(id)) return __stato.comandi.get(id)(...argomenti);
    else __stato.eseguiti.push([id, ...argomenti]);
  },
};
