// Uno stub del modulo `vscode`, per idePluginExtension.test.mjs: solo le API che idePlugin/src
// (extension.mjs e i moduli delle sezioni) usa, e uno stato (`__stato`) che il test imposta e legge.
// Non è un test (il nome non finisce in .test.mjs): il lanciatore non lo esegue.
import path from "node:path";

export const __stato = {
  workspaceFolders: [],
  isTrusted: true,
  activeTextEditor: undefined,
  editori: [], // gli ascoltatori di onDidChangeActiveTextEditor: il test li chiama cambiando editor
  cursori: [], // gli ascoltatori di onDidChangeTextEditorSelection: il test li chiama spostando il cursore
  documenti: [], // gli ascoltatori di onDidChangeTextDocument: il test li chiama scrivendo
  chiusi: [], // gli ascoltatori di onDidCloseTextDocument
  textDocuments: [],
  progressi: [], // le viewId delle barre di avanzamento chieste
  webviews: new Map(), // id -> provider registrato con registerWebviewViewProvider
  scelte: [], // le Quick Pick mostrate: [items, opzioni]
  scegli: null, // (items, opzioni) => cosa sceglie l'utente
  eseguiti: [], // i comandi di VS Code eseguiti (non quelli registrati dall'estensione)
  esterni: [], // gli indirizzi aperti nel browser (env.openExternal)
  avvisi: [], // [tipo, testo] di showInformationMessage/showWarningMessage/showErrorMessage
  barra: [], // i testi di setStatusBarMessage
  taskEseguiti: [], // i task passati a tasks.executeTask
  taskExecutions: [], // quelli "in corso": il test li mette a mano
  fineTask: [], // gli ascoltatori di tasks.onDidEndTaskProcess
  treeView: null, // l'ultima creata
  treeViews: new Map(), // id -> TreeView
  comandi: new Map(),
  contesto: {}, // le chiavi date con setContext
  config: {}, // le impostazioni, "sezione.chiave" -> valore (workspace.getConfiguration)
  configWorkspace: {}, // quelle del workspace, per inspect(): "sezione.chiave" -> valore
  aggiornate: [], // le impostazioni scritte con update: ["sezione.chiave", valore, target]
  configurazioni: [], // gli ascoltatori di onDidChangeConfiguration
  visibleTextEditors: [], // gli editor in vista (window.visibleTextEditors)
  visibili: [], // gli ascoltatori di onDidChangeVisibleTextEditors
  decorazioni: [], // i tipi di createTextEditorDecorationType: { options, disposed }
  quickPick: null, // l'ultima di createQuickPick: il test la guida (attiva, accetta, chiudi)
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
export const OverviewRulerLane = { Left: 1, Center: 2, Right: 4, Full: 7 };
export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
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
// Il browser: l'indirizzo si annota in `esterni`.
export const env = { openExternal: async (u) => (__stato.esterni.push(String(u)), true) };

export const Uri = {
  file: (fsPath) => uri("file", path.resolve(fsPath)),
  parse: (testo) => ({ scheme: testo.split(":")[0], toString: () => testo }),
  joinPath: (base, ...parti) => Uri.file(path.join(base.fsPath, ...parti)),
};

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
  onDidChangeTextEditorSelection: (f) => (__stato.cursori.push(f), { dispose() {} }),
  withProgress: (opzioni, f) => (__stato.progressi.push(opzioni.location?.viewId), f({ report() {} })),
  registerWebviewViewProvider: (id, provider) => (__stato.webviews.set(id, provider), { dispose() {} }),
  showInformationMessage: async (testo) => void __stato.avvisi.push(["info", testo]),
  // La scelta la fa il test: __stato.scegli(items, opzioni) -> la voce (o le voci) scelte.
  showQuickPick: async (items, opzioni) => (__stato.scelte.push([items, opzioni]), __stato.scegli?.(items, opzioni)),
  showWarningMessage: async (testo) => void __stato.avvisi.push(["warning", testo]),
  setStatusBarMessage: (testo) => (__stato.barra.push(testo), { dispose() {} }),
  showErrorMessage: async (testo) => void __stato.avvisi.push(["error", testo]),
  get visibleTextEditors() {
    return __stato.visibleTextEditors;
  },
  onDidChangeVisibleTextEditors: (f) => (__stato.visibili.push(f), { dispose() {} }),
  createTextEditorDecorationType: (options) => {
    const tipo = { options, disposed: false, dispose: () => void (tipo.disposed = true) };
    __stato.decorazioni.push(tipo);
    return tipo;
  },
  // Una Quick Pick che il test guida: attiva(voce) come le frecce, accetta() come Invio, chiudi()
  // come Esc. hide() avvisa una volta sola, come VS Code.
  createQuickPick: () => {
    const ascolti = { attiva: [], accetta: [], chiusa: [] };
    const qp = {
      items: [], activeItems: [], title: "", placeholder: "", visible: false,
      onDidChangeActive: (f) => (ascolti.attiva.push(f), { dispose() {} }),
      onDidAccept: (f) => (ascolti.accetta.push(f), { dispose() {} }),
      onDidHide: (f) => (ascolti.chiusa.push(f), { dispose() {} }),
      show: () => void (qp.visible = true),
      hide: () => {
        if (!qp.visible) return;
        qp.visible = false;
        for (const f of ascolti.chiusa) f();
      },
      dispose() {},
      attiva: (voce) => {
        qp.activeItems = [voce];
        for (const f of ascolti.attiva) f([voce]);
      },
      accetta: () => ascolti.accetta.forEach((f) => f()),
      chiudi: () => qp.hide(),
    };
    __stato.quickPick = qp;
    return qp;
  },
};

export const workspace = {
  get workspaceFolders() {
    return __stato.workspaceFolders;
  },
  get isTrusted() {
    return __stato.isTrusted;
  },
  findFiles: (...argomenti) => __stato.findFiles(...argomenti),
  // Le impostazioni: quelle in __stato.config ("sezione.chiave"), o il default. update() scrive e
  // avvisa come VS Code, con affectsConfiguration.
  getConfiguration: (sezione) => ({
    get: (chiave, predefinito) => __stato.config[`${sezione}.${chiave}`] ?? predefinito,
    inspect: (chiave) => ({
      key: `${sezione}.${chiave}`,
      globalValue: __stato.config[`${sezione}.${chiave}`],
      workspaceValue: __stato.configWorkspace[`${sezione}.${chiave}`],
    }),
    update: async (chiave, valore, target) => {
      const id = `${sezione}.${chiave}`;
      __stato.config[id] = valore;
      __stato.aggiornate.push([id, valore, target]);
      for (const f of __stato.configurazioni) f({ affectsConfiguration: (s) => id === s || id.startsWith(`${s}.`) });
    },
  }),
  onDidChangeConfiguration: (f) => (__stato.configurazioni.push(f), { dispose() {} }),
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
