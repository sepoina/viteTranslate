// Uno stub del modulo `vscode`, per idePluginExtension.test.mjs: solo le API che
// idePlugin/src/extension.mjs usa, e uno stato (`__stato`) che il test imposta e legge.
// Non è un test (il nome non finisce in .test.mjs): il lanciatore non lo esegue.
import path from "node:path";

export const __stato = {
  workspaceFolders: [],
  isTrusted: true,
  activeTextEditor: undefined,
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

export const Uri = { file: (fsPath) => ({ scheme: "file", fsPath: path.resolve(fsPath) }) };

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
  onDidChangeActiveTextEditor: evento(),
};

export const workspace = {
  get workspaceFolders() {
    return __stato.workspaceFolders;
  },
  get isTrusted() {
    return __stato.isTrusted;
  },
  findFiles: (...argomenti) => __stato.findFiles(...argomenti),
  createFileSystemWatcher: () => ({ onDidChange: evento(), onDidCreate: evento(), onDidDelete: evento(), dispose() {} }),
  onDidChangeWorkspaceFolders: evento(),
  onDidGrantWorkspaceTrust: evento(),
};

export const commands = {
  registerCommand: (id, f) => (__stato.comandi.set(id, f), { dispose() {} }),
  executeCommand: async (id, ...argomenti) => {
    if (id === "setContext") __stato.contesto[argomenti[0]] = argomenti[1];
    else return __stato.comandi.get(id)?.(...argomenti);
  },
};
