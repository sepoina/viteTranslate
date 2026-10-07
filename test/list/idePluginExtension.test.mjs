// Estensione per l'editor (idePlugin): extension.mjs attivata davvero, con il modulo `vscode`
// sostituito da uno stub (idePluginVscodeStub.mjs) tramite `module.registerHooks`. Si prova la
// colla delle tre sezioni: Configs (elenco, selezione col clic, sparisce con un progetto solo),
// Project (passivo finché non si seleziona), Marked (con la sonda delle voci che usa la libreria
// di questo repo, un link in node_modules, e il suo filtro); id unici, refresh, Restricted Mode.
// L'aspetto nel pannello vero resta una verifica a mano (piano idePlugin_0_0_0, Fase 4).
//
//   node test/list/idePluginExtension.test.mjs
import module from "node:module";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

if (typeof module.registerHooks !== "function") {
  console.log("  --  saltato: questo Node non ha module.registerHooks (serve 22.15+ o 23.5+)");
  process.exit(0);
}
const STUB = new URL("./idePluginVscodeStub.mjs", import.meta.url).href;
module.registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: STUB, shortCircuit: true } : next(specifier, context)),
});
const vscode = await import("vscode");
const { activate } = await import("../../idePlugin/src/extension.mjs");
const { READING, NO_SELECTION } = await import("../../idePlugin/src/webViews/project/projectState.mjs");
const stato = vscode.__stato;

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// Workspace temporaneo: app/ usa vitetranslate, other/ no, la radice non ha config.
const PLUGIN = pathToFileURL(fileURLToPath(new URL("../../lib/dev/vite/vitetranslate.js", import.meta.url))).href;
const ws = mkdtempSync(join(tmpdir(), "vt-ideext-"));
const scrivi = (rel, testo) => {
  mkdirSync(dirname(join(ws, rel)), { recursive: true });
  writeFileSync(join(ws, rel), testo, "utf8");
};
scrivi("app/vite.config.js", `import vitetranslate from ${JSON.stringify(PLUGIN)};\nexport default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };\n`);
scrivi("app/package.json", JSON.stringify({ name: "my-app", version: "0.1.0", scripts: { dev: "vite" } }));
const APP = `export default function App() {
  return (
    <main title="_%_Benvenuto_%_">
      <p>_%_Ciao mondo_%_</p>
    </main>
  );
}
`;
scrivi("app/src/App.jsx", APP);
scrivi("app/src/lib/deep/util.js", "export const x = 1;\n");
// La libreria come la troverebbe il progetto installato: `@sepoina/vitetranslate` risolto da app/.
const REPO = fileURLToPath(new URL("../../", import.meta.url));
mkdirSync(join(ws, "app/node_modules/@sepoina"), { recursive: true });
symlinkSync(REPO, join(ws, "app/node_modules/@sepoina/vitetranslate"), "junction");
scrivi("other/vite.config.js", "export default {};\n");
scrivi("README.md", "");

stato.workspaceFolders = [{ uri: vscode.Uri.file(ws) }];
stato.findFiles = async () => [vscode.Uri.file(join(ws, "other/vite.config.js")), vscode.Uri.file(join(ws, "app/vite.config.js"))];

// Le sonde dai sorgenti: nei test non c'è bisogno di `npm run ide:build`.
const SRC = (nome) => fileURLToPath(new URL(`../../idePlugin/src/${nome}`, import.meta.url));
const SONDE = { [join("dist", "probe.mjs")]: SRC("probes/probe.mjs"), [join("dist", "markedProbe.mjs")]: SRC("probes/markedProbe.mjs") };
const memoria = new Map();
const workspaceState = { get: (k) => memoria.get(k), update: async (k, v) => void memoria.set(k, v) };
// L'estensione in preview, come oggi: la pagina del guasto della libreria chiede il tag next. La
// versione la mostra VERSION, in Settings.
const extension = { id: "sepoina.vitetranslate-ide", packageJSON: { preview: true, version: "1.2.3" } };
const context = { subscriptions: [], asAbsolutePath: (rel) => SONDE[rel] ?? rel, workspaceState, extensionUri: vscode.Uri.file(join(ws, "ext")), extension };
const { marked, tree, controlli, preparato } = activate(context);
const markedView = stato.treeViews.get("vitetranslate.results");
const mprovider = markedView.treeDataProvider;
let cambi = 0; // quante volte Projects ha avvisato: elenco o selezione cambiati
tree.onDidChange(() => cambi++);

// Selector, come lo aprirebbe VS Code: una webview finta che tiene gli stati ricevuti.
const selectorProvider = stato.webviews.get("vitetranslate.selector");
const pagina = { stati: [], ricevi: null, visible: true, chiudi: null };
const webview = {
  options: {},
  html: "",
  cspSource: "vscode-webview://x",
  asWebviewUri: (uri) => `vscode-webview://x${uri.fsPath}`,
  onDidReceiveMessage: (f) => ((pagina.ricevi = f), { dispose() {} }),
  postMessage: async (m) => void pagina.stati.push(m),
};
selectorProvider.resolveWebviewView({
  webview,
  get visible() {
    return pagina.visible;
  },
  onDidChangeVisibility: () => ({ dispose() {} }),
  onDidDispose: (f) => ((pagina.chiudi = f), { dispose() {} }),
});
// Un clic nella pagina, e lo stato che la pagina mostra adesso.
const clic = (cmd, value) => pagina.ricevi({ cmd, value });
const selettore = async () => (await selectorProvider.push(), pagina.stati.at(-1));

// Project, allo stesso modo: la sua webview finta tiene gli stati e la descrizione nell'intestazione.
const projectProvider = stato.webviews.get("vitetranslate.project");
const progettoPagina = { stati: [], ricevi: null };
const projectView = {
  webview: {
    ...webview,
    options: {},
    html: "",
    onDidReceiveMessage: (f) => ((progettoPagina.ricevi = f), { dispose() {} }),
    postMessage: async (m) => void progettoPagina.stati.push(m),
  },
  visible: true,
  description: undefined,
  onDidChangeVisibility: () => ({ dispose() {} }),
  onDidDispose: () => ({ dispose() {} }),
};
projectProvider.resolveWebviewView(projectView);
// Project come lo vede l'utente a lettura del vite.config arrivata.
async function progetto() {
  for (let giro = 0; giro < 20; giro++) {
    await projectProvider.push();
    const s = progettoPagina.stati.at(-1);
    if (s?.message !== READING) return s;
    await tree.data(await tree.selectedProject());
  }
  throw new Error("Project still reading after 20 tries");
}

// La sezione facoltativa, come la aprirebbe VS Code: tiene gli stati, il titolo, la descrizione.
const optProvider = stato.webviews.get("vitetranslate.optional");
const optPagina = { stati: [], ricevi: null };
const optView = {
  webview: {
    ...webview,
    options: {},
    html: "",
    onDidReceiveMessage: (f) => ((optPagina.ricevi = f), { dispose() {} }),
    postMessage: async (m) => void optPagina.stati.push(m),
  },
  title: undefined,
  description: undefined,
  onDidDispose: () => ({ dispose() {} }),
};
optProvider.resolveWebviewView(optView);
// Settings come lo vede l'utente: aperto dall'ingranaggio, a lettura del vite.config arrivata. Poi
// si richiude, che Results torni al suo posto.
async function ispettore() {
  await progettoPagina.ricevi({ cmd: "settings" });
  try {
    for (let giro = 0; giro < 20; giro++) {
      await optProvider.push();
      const s = optPagina.stati.at(-1);
      if (s?.message !== READING) return s;
      await tree.data(await tree.selectedProject());
    }
    throw new Error("Settings still reading after 20 tries");
  } finally {
    await progettoPagina.ricevi({ cmd: "settings" });
  }
}
// Tutti gli id dell'albero di Settings.
const idsDi = (nodi, fuori = []) => {
  for (const n of nodi ?? []) fuori.push(n.id), idsDi(n.children, fuori);
  return fuori;
};

// Results, Project e Settings non aspettano le sonde: il primo disegno è "Loading…", e quello vero arriva
// con un ridisegno. Qui si fa quello che farebbe VS Code: si richiede finché niente è in arrivo.
// Una lettura veloce può arrivare prima che si guardi `pending`: conta anche la riga "Loading".
async function pieno(p, riga) {
  for (let giro = 0; giro < 20; giro++) {
    const righe = await p.getChildren(riga);
    const carica = righe.some((r) => r.icon === "loading~spin");
    if (!carica && !p.pending?.size) return righe;
    await p.idle();
  }
  throw new Error("still loading after 20 redraws");
}

// Tutto l'albero, aperto fino in fondo.
async function tutto(riga, fuori = [], p = mprovider) {
  for (const figlia of await pieno(p, riga)) {
    fuori.push(figlia);
    await tutto(figlia, fuori, p);
  }
  return fuori;
}

console.log("\n== attivazione ==");
eq("una TreeView, Results", ["vitetranslate.results"], [...stato.treeViews.keys()]);
eq("tre webview: Selector, Project, la facoltativa", ["vitetranslate.selector", "vitetranslate.project", "vitetranslate.optional"], [...stato.webviews.keys()]);
eq("Selector: una webview", "function", typeof selectorProvider?.resolveWebviewView);
eq("comandi registrati", [true, true, true, true, true, true], ["refresh", "select", "sync", "llm", "settings", "closeOptional"].map((c) => stato.comandi.has(`vitetranslate.${c}`)));
eq("…e non più Inspector e Highlight", [false, false], ["inspector", "highlight"].map((c) => stato.comandi.has(`vitetranslate.${c}`)));
eq("tutto sotto context.subscriptions", true, context.subscriptions.length >= 5);
{
  // Il manifest: la facoltativa si prende il pannello (via Results e Project), e si torna con ←.
  const manifest = JSON.parse(readFileSync(new URL("../../idePlugin/package.json", import.meta.url), "utf8"));
  const quando = Object.fromEntries(manifest.contributes.views.vitetranslate.map((v) => [v.id, v.when ?? null]));
  eq("facoltativa aperta (o all'avvio): Selector, Results e Project spariscono; Selector resta sul guasto con più progetti", {
    "vitetranslate.selector": "vitetranslate.ready && (!vitetranslate.optional || vitetranslate.libraryProblem && vitetranslate.manyProjects)",
    "vitetranslate.results": "vitetranslate.ready && !vitetranslate.optional",
    "vitetranslate.optional": "vitetranslate.optional || !vitetranslate.ready", "vitetranslate.project": "vitetranslate.ready && !vitetranslate.optional" }, quando);
  eq("…prima di essere risolta la facoltativa si chiama Loading: è l'avvio", "Loading",
    manifest.contributes.views.vitetranslate.find((v) => v.id === "vitetranslate.optional")?.name);
  eq("…la ← nel titolo e nella palette: non durante l'avvio, non sul guasto", Array(2).fill("vitetranslate.ready && !vitetranslate.libraryProblem"),
    [manifest.contributes.menus["view/title"], manifest.contributes.menus.commandPalette].map((m) => m.find((x) => x.command === "vitetranslate.closeOptional")?.when.replace(/^.*?vitetranslate\.optional && /, "")));
  const comando = (id) => manifest.contributes.commands.find((c) => c.command === id);
  eq("…la freccia nel titolo è Back, non Close; Settings con l'ingranaggio", [["Back", "$(arrow-left)"], ["Settings", "$(settings-gear)"]],
    ["vitetranslate.closeOptional", "vitetranslate.settings"].map((id) => [comando(id)?.title, comando(id)?.icon]));
  eq("…niente più Inspector e Highlight nel manifest", [undefined, undefined, undefined],
    [comando("vitetranslate.inspector"), comando("vitetranslate.highlight"), manifest.contributes.menus.commandPalette.find((m) => m.command === "vitetranslate.highlight")]);
}

const seleziona = (dir) => stato.comandi.get("vitetranslate.select")(dir);

console.log("\n== Selector: la pagina ==");
{
  eq("script abilitati, e solo dist/ raggiungibile", [true, [join(ws, "ext/dist")]], [webview.options.enableScripts, webview.options.localResourceRoots.map((u) => u.fsPath)]);
  eq("Config, Filter e Search, nessun bottone", ["config", "filter", "search"],
    [...webview.html.matchAll(/<section id="(\w+)"|<vscode-button [^>]*data-cmd="(\w+)"/g)].map((m) => m[1] ?? m[2]));
  eq("Project: la sua pagina, la barra dei comandi in fondo", [true, true],
    [projectView.webview.html.includes(`src="vscode-webview://x${join(ws, "ext/dist/projectWebview.js")}"`), /<\/main>\s*<footer class="actions">/.test(projectView.webview.html)]);
  eq("gli elenchi: due vscode-tree", ["projects", "filters"], [...webview.html.matchAll(/<vscode-tree id="(\w+)"/g)].map((m) => m[1]));
  const nonce = /script-src 'nonce-([0-9a-f]+)'/.exec(webview.html)?.[1];
  eq("CSP col nonce, e lo script lo porta", true, !!nonce && webview.html.includes(`<script type="module" nonce="${nonce}" src="vscode-webview://x${join(ws, "ext/dist/webview.js")}">`));
  eq("niente default aperto", true, webview.html.includes("default-src 'none'"));
  eq("i codicons da dist/", true, webview.html.includes(`href="vscode-webview://x${join(ws, "ext/dist/codicon.css")}"`));
  eq("prima di ready: niente stato mandato", 0, pagina.stati.length);
  eq("all'avvio la facoltativa dice cosa prepara, prima ancora dello stato", [true, "loading", "Loading"],
    [/<vscode-icon name="loading" spin><\/vscode-icon><span id="loadingText">Looking for Vite projects…/.test(optView.webview.html), optProvider.mode, optView.title]);
  eq("…al posto di Selector, Results e Project", [true, undefined], [stato.contesto["vitetranslate.optional"], stato.contesto["vitetranslate.ready"]]);
  await preparato;
  eq("nessun progetto selezionato: pronto appena c'è l'elenco, la facoltativa lascia il posto", [true, false, null],
    [stato.contesto["vitetranslate.ready"], stato.contesto["vitetranslate.optional"], optProvider.mode]);
}

console.log("\n== Selector: tutti i progetti, nessuno selezionato ==");
{
  await clic("ready");
  const s0 = pagina.stati.at(-1);
  eq("ready: lo stato arriva", "state", s0?.type);
  eq("Config: tutti e due, nome e cartella", [["my-app", "app"], ["other", "other"]], s0.projects.map((r) => [r.label, r.description]));
  eq("…col percorso del config nel tooltip", join(ws, "app/vite.config.js"), s0.projects[0].tooltip);
  eq("nessuno selezionato, Filter nascosto", [null, null, false], [s0.selected, s0.filters, s0.empty]);
  eq("contesto: ci sono progetti, più d'uno, e il pannello è pronto", { "vitetranslate.optional": false, "vitetranslate.hasProjects": true, "vitetranslate.manyProjects": true, "vitetranslate.ready": true }, stato.contesto);
  eq("…Selector non porta l'avvio", false, "starting" in s0);
  eq("Project passivo: lo dice", [NO_SELECTION, null, undefined], ((s) => [s.message, s.languages, projectView.description])(await progetto()));
  eq("…Settings anche", [NO_SELECTION, null], ((s) => [s.message, s.details])(await ispettore()));
  eq("Results passiva", [[], undefined], [await pieno(mprovider), markedView.description]);
  const n = pagina.stati.length;
  await selectorProvider.push();
  eq("stato invariato: non si rimanda", n, pagina.stati.length);
}

console.log("\n== clic su my-app: Project e Results si accendono ==");
{
  const prima = cambi;
  await clic("select", join(ws, "app"));
  eq("un avviso solo", prima + 1, cambi);
  eq("Selector: my-app selezionato", join(ws, "app"), (await selettore()).selected);
  eq("selezione ricordata nel workspace", join(ws, "app"), memoria.get("vitetranslate.selected"));
  await clic("select", join(ws, "app"));
  eq("riselezionarlo non cambia niente", prima + 1, cambi);

  const sp = await progetto();
  eq("…Languages: locale/ non c'è ancora (nessuna sync)", [null, "locale/ not found"], [sp.languages, sp.languagesNote?.text]);
  eq("Project: intestazione", "my-app", projectView.description);
  const si = await ispettore();
  eq("Settings: le righe del progetto", ["vitetranslate", "package.json", "vite.config.js"], si.details.map((r) => r.label));
  eq("…intestazione", "my-app", optView.description);
  eq("vitetranslate", "it-IT → locale/", si.details[0].description);
  await optPagina.ricevi({ cmd: "open", value: si.details[1].open });
  eq("clic su package.json lo apre", ["vscode.open", join(ws, "app/package.json")], [stato.eseguiti.at(-1)[0], stato.eseguiti.at(-1)[1].fsPath]);

  const ids = idsDi(si.details);
  eq("id tutti presenti e unici", ids.length, new Set(ids.filter(Boolean)).size);
  eq("sonda annotata nel canale", true, stato.log.some((r) => /vite\.config\.js: read in \d+ ms/.test(r)));
}

console.log("\n== Results, un progetto ==");
{
  const radici = await pieno(mprovider);
  eq("l'albero da src/, niente filtro in testa", ["src"], radici.map((r) => r.label));
  // Nessun file di lingua: le due voci sono da sincronizzare, e le altre scelte non si vedono.
  const s1 = await selettore();
  eq("Selector: Filter con le sole scelte che trovano qualcosa", [["all", "All", "2"], ["notSynced", "Not synced", "2 of 2"]],
    s1.filters?.map((v) => [v.value, v.label, v.description]));
  eq("…di partenza All", "all", s1.filter);
  eq("intestazione: progetto e conteggio", "my-app · 2 marked · 1 file · 2 to check", markedView.description);
  const src = mprovider.getTreeItem(radici[0]);
  eq("cartella aperta, icona del tema", [vscode.TreeItemCollapsibleState.Expanded, "folder", join(ws, "app/src")], [src.collapsibleState, src.iconPath.id, src.resourceUri.fsPath]);
  const [file] = await mprovider.getChildren(radici[0]);
  eq("solo i file marcati: App.jsx, 2 voci", ["App.jsx", "2"], [file.label, file.description]);
  eq("file chiuso", vscode.TreeItemCollapsibleState.Collapsed, mprovider.getTreeItem(file).collapsibleState);
  const voci = await mprovider.getChildren(file);
  eq("voci nell'ordine del sorgente, col glifo", [["🔄 Benvenuto", ":3"], ["🔄 Ciao mondo", ":4"]], voci.map((v) => [v.label, v.description]));
  const item = mprovider.getTreeItem(voci[1]);
  const [uri, opzioni] = item.command.arguments;
  eq("clic: apre il file sulla riga", [join(ws, "app/src/App.jsx"), 3, 9], [uri.fsPath, opzioni.selection.start.line, opzioni.selection.start.character]);
  const righe = [...radici, ...(await tutto(radici[0], [], mprovider))];
  const ids = righe.map((r) => mprovider.getTreeItem(r).id);
  eq("id tutti presenti e unici", righe.length, new Set(ids.filter(Boolean)).size);
  eq("scansione annotata nel canale", true, stato.log.some((r) => /source scanned in \d+ ms, 2 marked · 1 file/.test(r)));

  eq("salvataggio fuori da srcDir: ignorato", false, marked.forgetFile(join(ws, "app/vite.config.js")));

  // Un sorgente salvato: la sua riga si blocca subito, la scansione aspetta il refresh (in
  // activate, dopo 300 ms di calma).
  let ridisegniMarked = 0;
  mprovider.onDidChangeTreeData(() => ridisegniMarked++);
  scrivi("app/src/App.jsx", APP); // stesso contenuto, mtime nuovo
  eq("App.jsx salvato: scansione da rifare", true, marked.forgetFile(join(ws, "app/src/App.jsx")));
  eq("…e un ridisegno subito", 1, ridisegniMarked);
  const bloccate = await mprovider.getChildren();
  eq("…nessuna scansione partita prima del refresh", 0, mprovider.pending.size);
  const [fileBloccato] = await mprovider.getChildren(bloccate[0]);
  eq("…la riga del file col segno", "⏳ updating · 2", fileBloccato.description);
  const [voceBloccata] = await mprovider.getChildren(fileBloccato);
  eq("…le sue voci senza clic", undefined, mprovider.getTreeItem(voceBloccata).command);
  eq("…l'intestazione lo dice, senza messaggio in testa", ["my-app · 2 marked · 1 file · 2 to check · updating…", undefined], [markedView.description, markedView.message]);
  eq("…barra di avanzamento chiesta per Results", true, stato.progressi.includes("vitetranslate.results"));
  marked.refresh();
  const sbloccate = await pieno(mprovider);
  const [fileSbloccato] = await mprovider.getChildren(sbloccate[0]);
  eq("dopo la scansione: riga normale", "2", fileSbloccato.description);
  eq("…App.jsx ripreso dall'overlay: stesso contenuto, nessun parse", true, /0 from the index, 1 kept, 0 parsed, Babel warm\]/.test(stato.log.at(-1)));
  eq("…intestazione senza updating", "my-app · 2 marked · 1 file · 2 to check", markedView.description);

  // Una modifica non salvata: la riga si blocca finché il documento è sporco.
  const digita = (rel, isDirty) => stato.documenti.forEach((f) => f({ document: { uri: vscode.Uri.file(join(ws, rel)), isDirty } }));
  const prima = ridisegniMarked;
  digita("app/src/App.jsx", true);
  digita("app/src/App.jsx", true);
  eq("sporco: un ridisegno solo, anche a più tasti", prima + 1, ridisegniMarked);
  const [fileSporco] = await mprovider.getChildren((await pieno(mprovider))[0]);
  eq("…la riga col segno ✎", "✎ unsaved · 2", fileSporco.description);
  eq("…nessuna scansione", 0, mprovider.pending.size);
  digita("app/src/App.jsx", false);
  const [filePulito] = await mprovider.getChildren((await pieno(mprovider))[0]);
  eq("non più sporco: riga normale", "2", filePulito.description);
  digita("app/src/lib/deep/util.js", true);
  eq("sporco un file senza riga: nessun ridisegno", prima + 2, ridisegniMarked);
  digita("app/src/lib/deep/util.js", false);

  scrivi("app/src/lib/deep/util.js", 'export const x = "_%_Terza_%_";\n');
  eq("salvataggio in srcDir: scansione da rifare", true, marked.forgetFile(join(ws, "app/src/lib/deep/util.js")));
  marked.refresh();
  const dopo = await pieno(mprovider);
  const figli = await mprovider.getChildren(dopo[0]);
  eq("cartelle compatte prima dei file", ["lib/deep", "App.jsx"], figli.map((r) => r.label));
  eq("intestazione aggiornata", "my-app · 3 marked · 2 files · 3 to check", markedView.description);
  eq("…solo util.js parsato", true, /1 kept, 1 parsed/.test(stato.log.at(-1)));

  scrivi("app/locale/it-IT.yml", "");
  eq("un file di lingua salvato: scansione da rifare", true, marked.forgetFile(join(ws, "app/locale/it-IT.yml")));
  await mprovider.getChildren();
  eq("…messaggio in testa, clic lasciati (le righe non si spostano)", "⏳ Language files changed: updating…", markedView.message);
  marked.refresh();
  await pieno(mprovider);
  eq("…via dopo la scansione, senza parse", [undefined, true], [markedView.message, /2 kept, 0 parsed/.test(stato.log.at(-1))]);
  rmSync(join(ws, "app/locale"), { recursive: true, force: true });
  marked.forgetFile(join(ws, "app/locale/it-IT.yml"));
  marked.refresh();
  await pieno(mprovider);
}

console.log("\n== Selector: il filtro ==");
{
  const prima = cambi;
  const scansioni = stato.log.filter((r) => /source scanned/.test(r)).length;
  await clic("filter", "notSynced");
  eq("scelto 'Not synced': Selector lo mostra", "notSynced", (await selettore()).filter);
  eq("…Results filtrato", "notSynced", marked.filter);
  eq("ricordato nel workspace", "notSynced", memoria.get("vitetranslate.markedFilter"));
  const righe = await pieno(mprovider);
  eq("nessuna nuova scansione", scansioni, stato.log.filter((r) => /source scanned/.test(r)).length);
  eq("…e l'albero c'è (tutte da sincronizzare)", ["src"], righe.map((r) => r.label));
  eq("Projects non avvisa", prima, cambi);
  await clic("filter", "boom");
  eq("un filtro che non esiste: ignorato", "notSynced", marked.filter);
  // Un filtro che non trova più niente (qui: nessuna voce da tradurre) non si vede: si torna ad All.
  marked.setFilter("untranslated");
  await pieno(mprovider);
  eq("filtro senza voci: di nuovo All, e ricordato", ["all", "all"], [memoria.get("vitetranslate.markedFilter"), (await selettore()).filter]);
}

console.log("\n== Selector: la ricerca ==");
{
  eq("Results ha voci: Search si vede, vuoto", [true, ""], [(await selettore()).searchVisible, (await selettore()).search]);
  const scansioni = stato.log.filter((r) => /source scanned/.test(r)).length;
  await clic("search", "terza");
  const [cartella] = await pieno(mprovider);
  eq("cercato 'terza': solo util.js, cartelle compattate", ["src/lib/deep", ["util.js"]], [cartella.label, (await mprovider.getChildren(cartella)).map((r) => r.label)]);
  eq("…nessuna nuova scansione", scansioni, stato.log.filter((r) => /source scanned/.test(r)).length);
  eq("…l'intestazione lo dice", "my-app · 3 marked · 2 files · 3 to check · matching \"terza\"", markedView.description);
  eq("…e Selector ha il testo", "terza", (await selettore()).search);
  await clic("search", "zzz");
  eq("niente trovato: lo dice Results", ['nothing matches "zzz"'], (await pieno(mprovider)).map((r) => r.label));
  eq("…e Search resta visibile, col suo testo", [true, "zzz"], [(await selettore()).searchVisible, (await selettore()).search]);
  await clic("search", "");
  eq("testo cancellato: tutto di nuovo", ["src"], (await pieno(mprovider)).map((r) => r.label));
  eq("…intestazione senza ricerca", "my-app · 3 marked · 2 files · 3 to check", markedView.description);
}

console.log("\n== Results: il disegno non aspetta ==");
{
  // Due disegni di fila: il primo, superato, non tocca l'intestazione. Si contano le scritture.
  const scritte = [];
  let intestazione = markedView.description;
  Object.defineProperty(markedView, "description", { get: () => intestazione, set: (v) => (scritte.push(v), (intestazione = v)), configurable: true });
  await Promise.all([mprovider.getChildren(), mprovider.getChildren()]);
  eq("due disegni di fila: l'intestazione la scrive solo l'ultimo", ["my-app · 3 marked · 2 files · 3 to check"], scritte);

  // vite.config cambiato: disegno bloccato con messaggio, processo chiuso, overlay buttato.
  eq("prima: un processo acceso per app (Babel caldo)", true, marked.workers.get(join(ws, "app"))?.alive);
  marked.forget(join(ws, "app"));
  eq("config cambiata: processo chiuso", false, marked.workers.has(join(ws, "app")));
  const bloccate = await mprovider.getChildren();
  eq("…messaggio in testa, le righe di prima restano", ["⏳ Reading the project again: updating…", "src"], [markedView.message, bloccate[0].label]);
  await pieno(mprovider);
  eq("…dopo: niente messaggio, tutto riparsato (overlay buttato)", [undefined, true], [markedView.message, /0 kept, 2 parsed/.test(stato.log.at(-1))]);
}

console.log("\n== ricalcolo senza cambiamenti: nessun avviso ==");
{
  const prima = cambi;
  await tree.relist(false);
  eq("stesso elenco: niente", prima, cambi);
}

console.log("\n== other dal comando: Project e Results lo seguono ==");
{
  seleziona(join(ws, "other"));
  await projectProvider.push();
  eq("cambio progetto: Project subito vuoto", [READING, null], ((s) => [s.message, s.languages])(progettoPagina.stati.at(-1)));
  eq("…Results subito vuota, mai le righe di app", [["Loading other…"], "other"], [(await mprovider.getChildren()).map((r) => r.label), markedView.description]);
  const s2 = await selettore();
  eq("Selector: other selezionato, Filter nascosto", [join(ws, "other"), null], [s2.selected, s2.filters]);
  eq("selezione ricordata", join(ws, "other"), memoria.get("vitetranslate.selected"));
  await progetto();
  const figliOther = (await ispettore()).details;
  eq("other: vitetranslate non registrato", "not registered in vite.config", figliOther[0].description);
  eq("other: package.json assente", "no package.json next to vite.config", figliOther[1].description);
  eq("Results: plugin assente", ["vitetranslate is not registered in vite.config"], (await pieno(mprovider)).map((r) => r.label));
  eq("intestazioni col nome della cartella", ["other", "other"], [markedView.description, projectView.description]);
}

console.log("\n== il file attivo porta il pannello dove sta ==");
{
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
  // Cambia editor come farebbe l'utente, e aspetta l'attesa di seguiEditor.
  const apri = async (rel) => {
    stato.activeTextEditor = { document: { uri: vscode.Uri.file(join(ws, rel)) } };
    for (const f of stato.editori) f(stato.activeTextEditor);
    await pausa(200);
  };
  // VS Code rilegge Results dopo un ridisegno; qui lo si fa a mano, poi il reveal (setTimeout 0).
  const disegnaMarked = async () => {
    await tutto(undefined, [], mprovider);
    await pausa(10);
  };
  const app = join(ws, "app");
  const appJsx = join(ws, "app/src/App.jsx");

  const prima = cambi;
  await apri("app/src/App.jsx");
  eq("un file di app: app selezionato", app, tree.selected);
  eq("…un avviso solo", prima + 1, cambi);
  eq("…e Selector lo mostra", app, (await selettore()).selected);
  const rivelateMarked = markedView.rivelate.length;
  await disegnaMarked();
  const [rivelata] = markedView.rivelate.slice(rivelateMarked);
  eq("Results: la riga del file, aperta, senza focus", [appJsx, "file", true, true, false],
    [rivelata?.riga.resource, rivelata?.riga.kind, rivelata?.expand, rivelata?.select, rivelata?.focus]);
  const padre = mprovider.getParent(rivelata.riga);
  eq("getParent risale fino alla radice", ["src", undefined], [padre?.label, mprovider.getParent(padre)]);
  eq("getChildren: sempre le stesse righe", true, (await mprovider.getChildren(padre)).includes(rivelata.riga));

  const ancora = [cambi, markedView.rivelate.length];
  await apri("app/src/App.jsx");
  eq("stesso file: niente avvisi, niente reveal", ancora, [cambi, markedView.rivelate.length]);

  await apri("app/src/lib/deep/util.js");
  eq("un altro file dello stesso progetto: la sua riga", join(ws, "app/src/lib/deep/util.js"), markedView.selection[0]?.resource);
  // Da util.js, un clic su una voce di App.jsx apre App.jsx: il file attivo cambia.
  const [voce] = await mprovider.getChildren(rivelata.riga);
  markedView.clicca(voce);
  await apri("app/src/App.jsx");
  eq("cliccata una voce che apre il suo file: la selezione resta sulla voce", voce, markedView.selection[0]);

  const altre = [cambi, tree.selected];
  await apri("README.md");
  eq("un file fuori dai progetti: niente cambia", altre, [cambi, tree.selected]);
  await apri("app/node_modules/@sepoina/vitetranslate/package.json");
  eq("…né uno in node_modules", altre, [cambi, tree.selected]);

  await apri("other/vite.config.js");
  eq("un file di other: other selezionato", join(ws, "other"), tree.selected);
  eq("…e ricordato", join(ws, "other"), memoria.get("vitetranslate.selected"));

  // In other Results ha solo "not registered": la selezione di prima non c'è più.
  markedView.selection = [];
  markedView.visible = false;
  await apri("app/src/App.jsx");
  const nascosta = markedView.rivelate.length;
  await disegnaMarked();
  eq("Results nascosta: nessun reveal (la aprirebbe)", nascosta, markedView.rivelate.length);
  markedView.visible = true;
  marked.applyTarget();
  eq("…lo fa quando torna in vista", appJsx, markedView.rivelate.at(-1).riga.resource);
}

console.log("\n== un progetto solo: Config sparisce, Project fisso ==");
stato.findFiles = async () => [vscode.Uri.file(join(ws, "app/vite.config.js"))];
{
  await stato.comandi.get("vitetranslate.refresh")();
  eq("Project: l'unico, anche se era selezionato other", "my-app", ((await progetto()), projectView.description));
  await pieno(mprovider);
  const s3 = await selettore();
  eq("Selector: niente Config, e l'unico è il selezionato", [null, join(ws, "app")], [s3.projects, s3.selected]);
  eq("…Filter di app", ["all", "notSynced"], s3.filters?.map((v) => v.value));
}

console.log("\n== Project: i bottoni ==");
{
  // I bottoni stanno nella barra di Project.
  const messaggio = (m) => progettoPagina.ricevi(m);
  // Settings: l'ingranaggio apre la sezione facoltativa al posto di Results, con l'accordion
  // Highlight style e l'albero; un secondo clic la chiude.
  await messaggio({ cmd: "settings" });
  eq("Settings: al posto di Results, in primo piano, accordion e albero", [true, ["vitetranslate.optional.focus"], "Settings", true, true],
    [stato.contesto["vitetranslate.optional"], stato.eseguiti.at(-1), optView.title,
      optView.webview.html.includes('<details class="voce" id="highlight" name="config">'), optView.webview.html.includes('<vscode-tree id="tree"')]);
  await optPagina.ricevi({ cmd: "ready" });
  const impostazioni = optPagina.stati.at(-1);
  eq("…lo stato: l'albero di my-app, tutto chiuso; Off e i quindici stili, quello di serie segnato",
    [["vitetranslate", "package.json", "vite.config.js"], [false, false, false], "my-app", 16, "framed-box"],
    [impostazioni.details?.map((r) => r.label), impostazioni.details?.map((r) => r.expanded), optView.description, impostazioni.highlight?.styles.length, impostazioni.highlight?.current]);
  // VERSION: l'estensione, la libreria di app (quella del repo) e il suo IDE_API, dalla scansione.
  const repoVersion = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).version;
  eq("…VERSION: l'estensione, la libreria del progetto, il suo IDE_API, niente in giallo",
    ["1.2.3", [repoVersion, false], [String(marked.resultOf(join(ws, "app"))?.ideApi), false]],
    ((v) => [v?.extension, [v?.library.text, v?.library.old], [v?.ide.text, v?.ide.old]])(impostazioni.versions));
  // Highlight style: il clic su uno stile lo salva, e la pagina segna quello nuovo.
  const aggiornate = stato.aggiornate.length;
  await optPagina.ricevi({ cmd: "style", value: "pill" });
  await optProvider.inCorso;
  eq("…uno stile: l'impostazione, nelle impostazioni utente", [["vitetranslate.highlightStyle", "pill", vscode.ConfigurationTarget.Global]], stato.aggiornate.slice(aggiornate));
  eq("…e la pagina segna Pill", "pill", optPagina.stati.at(-1).highlight?.current);
  delete stato.config["vitetranslate.highlightStyle"];
  // La chiave inglese, accanto a Back: le impostazioni di VS Code filtrate su questa estensione.
  await optPagina.ricevi({ cmd: "extensionSettings" });
  eq("…la chiave inglese: impostazioni dell'estensione", ["workbench.action.openSettings", "@ext:sepoina.vitetranslate-ide"], stato.eseguiti.at(-1));
  await messaggio({ cmd: "settings" });
  eq("…secondo clic sull'ingranaggio: torna Results", false, stato.contesto["vitetranslate.optional"]);
  await messaggio({ cmd: "settings" });
  await optPagina.ricevi({ cmd: "close" });
  eq("…anche Back", false, stato.contesto["vitetranslate.optional"]);
  const scansioni = stato.log.filter((r) => /source scanned|vite\.config\.js: read/.test(r)).length;
  await messaggio({ cmd: "refresh" });
  await progetto();
  eq("Refresh: rilegge il vite.config", true, stato.log.filter((r) => /source scanned|vite\.config\.js: read/.test(r)).length > scansioni);
  // Sync: il CLI della libreria installata nel progetto, in un task.
  await messaggio({ cmd: "sync" });
  const task = stato.taskEseguiti.at(-1);
  eq("Sync: un task per app", [{ type: "vitetranslate", command: "sync", dir: join(ws, "app") }, "viteTranslate"], [task?.definition, task?.source]);
  eq("…nella cartella del workspace", ws, task?.scope?.uri?.fsPath);
  // Con cosa, lo decide cliLaunch (provato sotto): qui, che il task usi quello che dice.
  const { cliLaunch } = await import("../../idePlugin/src/core/syncCommand.mjs");
  const { cliHeader } = await import("../../idePlugin/src/core/cliHeader.mjs");
  const CLI_REPO = join(REPO, "lib/dev/vite/cli.js");
  const lancio = cliLaunch({ cli: CLI_REPO, args: [], runner: context.asAbsolutePath(join("dist", "cliRunner.mjs")), runAsNodeCmd: context.asAbsolutePath(join("dist", "runAsNode.cmd")) });
  const { VT_HEADER: testata, ...envTask } = task?.execution.options.env ?? {};
  eq("…il CLI del progetto, lanciato come dice cliLaunch", [lancio.command, lancio.args, join(ws, "app"), lancio.env],
    [task?.execution.process, task?.execution.args, task?.execution.options.cwd, envTask]);
  eq("…il CLI c'è; col runner niente Executing task, e il terminale lo chiude lui", [true, !lancio.runner, !!lancio.runner],
    [task?.execution.args.includes(CLI_REPO), task?.presentationOptions.echo, task?.presentationOptions.close]);
  eq("…l'intestazione per il runner: solo il comando npx, quello della documentazione, niente cartella", lancio.runner ? cliHeader({ name: "vitetranslate", args: [] }) : undefined, testata);
  eq("…annotato nel canale", true, /app: sync started \(vtranslate-cli /.test(stato.log.at(-1)));
  // Un task di app col terminale ancora aperto (il CLI che gira, o il runner che aspetta un tasto):
  // si chiede, e senza risposta non parte niente. terminate() fa quello che fa VS Code: la fine del
  // processo, poi quella del task.
  const aperto = {
    task,
    chiuso: 0,
    terminate() {
      aperto.chiuso++;
      stato.taskExecutions = [];
      for (const f of stato.fineTask) f({ execution: aperto, exitCode: 1 });
      for (const f of stato.fineTaskTutto) f({ execution: aperto });
    },
  };
  stato.taskExecutions = [aperto];
  await stato.comandi.get("vitetranslate.sync")();
  eq("un sync col terminale aperto: lo chiede, e senza risposta niente", [1, 0, "warning", true],
    [stato.taskEseguiti.length, aperto.chiuso, stato.avvisi.at(-1)[0], /A sync for this project still has its terminal open/.test(stato.avvisi.at(-1)[1])]);
  const avvisiChiusura = stato.avvisi.length;
  stato.rispondi = (_testo, bottoni) => bottoni[0];
  await stato.comandi.get("vitetranslate.sync")();
  stato.rispondi = null;
  eq("…Close it and run: chiuso, e il sync nuovo parte; la fine del vecchio non è un errore", [1, 2, []],
    [aperto.chiuso, stato.taskEseguiti.length, stato.avvisi.slice(avvisiChiusura).filter(([tipo]) => tipo === "error")]);
  eq("…nel canale: chiuso, non fallito", true, stato.log.some((r) => /app: sync closed, to run another command/.test(r)));
  const avvisiFine = stato.avvisi.length;
  for (const f of stato.fineTask) f({ execution: { task }, exitCode: 0 });
  eq("fine con 0: annotata, nessun errore", [true, 0], [/sync ended with exit code 0/.test(stato.log.at(-1)), stato.avvisi.length - avvisiFine]);
  for (const f of stato.fineTask) f({ execution: { task }, exitCode: 1 });
  eq("fine con errore: lo dice, col codice", ["error", true], [stato.avvisi.at(-1)[0], /sync failed \(exit code 1\)/.test(stato.avvisi.at(-1)[1])]);
  // vitetranslate.detailCommand: si legge a ogni lancio, e l'intestazione dice anche come.
  stato.config["vitetranslate.detailCommand"] = true;
  await messaggio({ cmd: "sync" });
  delete stato.config["vitetranslate.detailCommand"];
  const dettagli = stato.taskEseguiti.at(-1).execution.options.env.VT_HEADER ?? "";
  eq("detailCommand: anche cartella, runtime, runner e file del CLI", [true, true, true, true, true],
    [dettagli.includes("npx"), dettagli.includes(join(ws, "app")), dettagli.includes(lancio.command), dettagli.includes(lancio.runner), dettagli.includes(CLI_REPO)]);
  // Windows senza node nel PATH: l'editor via runAsNode.cmd, e l'avviso una volta sola.
  if (process.platform === "win32") {
    const path0 = process.env.PATH;
    const avvisi0 = stato.avvisi.length;
    process.env.PATH = "";
    await messaggio({ cmd: "sync" });
    await messaggio({ cmd: "sync" });
    process.env.PATH = path0;
    eq("Windows senza node: runAsNode.cmd, e l'avviso una volta sola", [true, 1, true],
      ((avvisi) => [/runAsNode\.cmd$/.test(stato.taskEseguiti.at(-1).execution.process), avvisi.length, /Node\.js is not in PATH/.test(avvisi[0])])(
        stato.avvisi.slice(avvisi0).filter(([tipo]) => tipo === "warning").map(([, m]) => m)));
    const t = stato.taskEseguiti.at(-1);
    eq("…senza runner: niente intestazione, la riga e il terminale di VS Code", [undefined, true, false],
      [t.execution.options.env.VT_HEADER, t.presentationOptions.echo, t.presentationOptions.close]);
  }

  // LLM: app non ha `llm` nelle opzioni. Il bottone ha il ?, e il clic apre Help al posto di Results.
  eq("LLM senza llm in vite.config: il ?", [false, "question"], ((s) => [s.llm, s.llmIcon])(await progetto()));
  const { LLM_ACTIONS, pluginCallPosition } = await import("../../idePlugin/src/core/syncCommand.mjs");
  const scelteFatte = stato.scelte.length;
  await messaggio({ cmd: "llm" });
  eq("…clic: la sezione facoltativa al posto di Results, in primo piano", [true, ["vitetranslate.optional.focus"], scelteFatte],
    [stato.contesto["vitetranslate.optional"], stato.eseguiti.at(-1), stato.scelte.length]);
  eq("Help: si chiama Help, script della sezione, solo dist/", ["Help", true, true, [join(ws, "ext/dist")]],
    [optView.title, optView.webview.html.includes("LLM translation is off"),
      optView.webview.html.includes(`src="vscode-webview://x${join(ws, "ext/dist/optionalWebview.js")}"`), optView.webview.options.localResourceRoots.map((u) => u.fsPath)]);
  await optPagina.ricevi({ cmd: "openPluginConfig" });
  eq("…Open the options: vite.config del progetto", ["vscode.open", join(ws, "app/vite.config.js")], [stato.eseguiti.at(-1)[0], stato.eseguiti.at(-1)[1].fsPath]);
  await optPagina.ricevi({ cmd: "close" });
  eq("…Close: torna Results", false, stato.contesto["vitetranslate.optional"]);
  await messaggio({ cmd: "llm" });
  await stato.comandi.get("vitetranslate.closeOptional")();
  eq("…anche la X nel titolo (vitetranslate.closeOptional)", false, stato.contesto["vitetranslate.optional"]);

  // Con un blocco llm: la freccia, e il clic apre il pannello LLM. La chiave sta in .env.local, il
  // modello è un indirizzo che non risponde: il controllo in background la trova, e il ping fallisce.
  scrivi("app/vite.config.js", `import vitetranslate from ${JSON.stringify(PLUGIN)};\nexport default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT", llm: { connection: { baseURL: "http://127.0.0.1:1/v1", model: "m", apiKeyEnv: "VT_IDE_TEST_KEY_NOPE", maxRetries: 0, timeoutMs: 2000 } } })] };\n`);
  scrivi("app/.env.local", "VT_IDE_TEST_KEY_NOPE=not-a-real-key\n");
  await messaggio({ cmd: "refresh" });
  await progetto();
  eq("LLM con llm in vite.config: la freccia", [true, "chevron-right"], ((s) => [s.llm, s.llmIcon])(await progetto()));
  await messaggio({ cmd: "llm" });
  eq("…clic: il pannello LLM, nessuna Quick Pick", [true, "LLM", true, scelteFatte],
    [stato.contesto["vitetranslate.optional"], optView.title, optView.webview.html.includes('<div id="checks">'), stato.scelte.length]);
  await optPagina.ricevi({ cmd: "ready" });
  eq("…subito: chiave e ping in corso, settings pronte", ["running", "ok", "running"], optPagina.stati.at(-1).checks.map((c) => c.state));
  eq("…il progetto nella descrizione", "my-app", optView.description);
  await controlli.get(join(ws, "app")).done;
  await optProvider.push();
  const pannello = optPagina.stati.at(-1);
  eq("…a controllo finito: la chiave in .env.local, il ping fallito", [["ok", "API key: .env.local"], ["error", "Ping: no answer"], false],
    [[pannello.checks[0].state, pannello.checks[0].text], [pannello.checks[2].state, pannello.checks[2].text], pannello.checking]);
  eq("…annotato nel canale, senza la chiave", [true, false], [/llm check — key \.env\.local, ping failed/.test(stato.log.join("\n")), stato.log.join("\n").includes("not-a-real-key")]);
  eq("…le azioni, tutte", LLM_ACTIONS.map((a) => a.id), pannello.actions.map((a) => a.id));
  eq("…qualcosa è andato male: trouble, il ? nella barra", true, pannello.trouble);
  // Il ?: Help nella variante "qualcosa non va". Non segue il progetto; Back chiude, non torna a LLM.
  await optPagina.ricevi({ cmd: "help" });
  eq("…clic sul ?: Help, la variante per chi ha il blocco", ["Help", true, false, true],
    [optView.title, optView.webview.html.includes("LLM check failed?"), optView.webview.html.includes("LLM translation is off"), stato.contesto["vitetranslate.optional"]]);
  await optProvider.follow();
  eq("…resta Help anche quando la sezione segue il progetto", ["trouble", "Help"], [optProvider.mode, optView.title]);
  await optPagina.ricevi({ cmd: "close" });
  eq("…Back: torna Results, il flusso normale", [false, null], [stato.contesto["vitetranslate.optional"], optProvider.mode]);
  await messaggio({ cmd: "llm" });
  eq("…e LLM riapre il pannello LLM", "LLM", optView.title);

  const lanciati = stato.taskEseguiti.length;
  await optPagina.ricevi({ cmd: "action", value: "translate" });
  const llmTask = stato.taskEseguiti.at(-1);
  eq("Translate: il CLI con --llm-translate, in un task suo", [lanciati + 1, "llm translate", [join(REPO, "lib/dev/vite/cli.js"), "--llm-translate"]],
    [stato.taskEseguiti.length, llmTask.definition.command, llmTask.execution.args.slice(-2)]);
  eq("…il pannello resta aperto", true, stato.contesto["vitetranslate.optional"]);
  await optPagina.ricevi({ cmd: "action", value: "dryRun" });
  eq("Estimate the cost: nome del task dai flag", "llm dry-run translate", stato.taskEseguiti.at(-1).definition.command);
  await optPagina.ricevi({ cmd: "action", value: "retranslate" });
  eq("Retranslate senza lingue di destinazione: lo dice, niente task", [lanciati + 2, "info"], [stato.taskEseguiti.length, stato.avvisi.at(-1)[0]]);
  await optPagina.ricevi({ cmd: "action", value: "boom" });
  eq("un'azione sconosciuta: annotata", true, /LLM: unknown action "boom"/.test(stato.log.at(-1)));

  // Check again: un controllo nuovo. Lo stesso dopo un --llm-key-set finito.
  const primo = controlli.get(join(ws, "app"));
  await optPagina.ricevi({ cmd: "recheck" });
  const secondo = controlli.get(join(ws, "app"));
  eq("Check again: un controllo nuovo", true, !!secondo && secondo !== primo);
  await secondo.done;
  const keySet = { definition: { type: "vitetranslate", command: "llm key-set", dir: join(ws, "app") } };
  for (const f of stato.fineTask) f({ execution: { task: keySet }, exitCode: 0 });
  await optProvider.push();
  eq("--llm-key-set finito: la chiave si cerca di nuovo", true, !!controlli.get(join(ws, "app")) && controlli.get(join(ws, "app")) !== secondo);
  await controlli.get(join(ws, "app")).done;
  await optPagina.ricevi({ cmd: "close" });
  eq("Close: torna Results", false, stato.contesto["vitetranslate.optional"]);

  // Vite config, in Settings: vite.config aperto sulla chiamata vitetranslate(…). Project non lo ha più.
  await messaggio({ cmd: "openPluginConfig" });
  eq("Project: niente più vite.config nella barra", true, /Project: unknown command "openPluginConfig"/.test(stato.log.at(-1)));
  await optPagina.ricevi({ cmd: "openPluginConfig" });
  const [cmdOpen, uriOpen, opzOpen] = stato.eseguiti.at(-1);
  const atteso = pluginCallPosition(readFileSync(join(ws, "app/vite.config.js"), "utf8"));
  eq("Vite config: apre vite.config sulla chiamata del plugin", ["vscode.open", join(ws, "app/vite.config.js"), atteso.line - 1, atteso.column - 1],
    [cmdOpen, uriOpen.fsPath, opzOpen.selection.start.line, opzOpen.selection.start.character]);
  eq("pluginCallPosition: la chiamata, non l'import", { line: 2, column: 28 },
    pluginCallPosition('import { vitetranslate } from "x";\nexport default { plugins: [vitetranslate({ a: 1 })] };\n'));
  eq("…null se non c'è", null, pluginCallPosition("export default {};"));
  // GitHub: il progetto, nel browser.
  await messaggio({ cmd: "github" });
  eq("GitHub: il progetto, nel browser", "https://github.com/sepoina/viteTranslate", stato.esterni.at(-1));

  await messaggio({ cmd: "boom" });
  eq("un comando sconosciuto: annotato, niente altro", true, /Project: unknown command "boom"/.test(stato.log.at(-1)));
  const n = pagina.stati.length;
  await clic("ready");
  eq("una pagina ricreata (ready): lo stato si rimanda anche se uguale", n + 1, pagina.stati.length);
  pagina.chiudi();
  eq("chiusa: dimenticata", null, selectorProvider.view);
}

console.log("\n== la voce selezionata in Results, e Languages ==");
{
  // Le voci di App.jsx, come le mostra Results.
  const fileRow = (await tutto(undefined, [])).find((r) => r.label === "App.jsx");
  const [voce, voce2] = await mprovider.getChildren(fileRow);
  eq("una voce porta la sua chiave", true, /^App_\w+$/.test(voce.keyId ?? ""));
  const yml = join(ws, "app/locale/en-US.yml");
  scrivi("app/locale/en-US.yml", `# header\n#\n${voce2.keyId}: "Hello world"\n${voce.keyId}: "Welcome"\n`);
  const lampo = async () => (await new Promise((r) => setTimeout(r, 0)), (await progetto()).jumpKey);
  const apri = async (file = yml) => {
    await progettoPagina.ricevi({ cmd: "openLanguage", value: file });
    const [, uri, opz] = stato.eseguiti.at(-1);
    return [uri.fsPath, opz?.selection.start.line ?? null];
  };

  markedView.selection = [];
  eq("nessuna voce selezionata: niente lampo, il file in cima", [null, [yml, null]], [await lampo(), await apri()]);
  markedView.clicca(voce);
  eq("una voce: il lampo, e la lingua si apre sulla sua chiave", [voce.keyId, [yml, 3]], [await lampo(), await apri()]);
  eq("…col cursore all'inizio del valore", voce.keyId.length + 2, stato.eseguiti.at(-1)[2].selection.start.character);
  eq("…non si salva da nessuna parte", undefined, memoria.get("vitetranslate.lastKey"));

  markedView.clicca(fileRow);
  eq("selezionato il file (o una cartella): pulito", [null, [yml, null]], [await lampo(), await apri()]);

  markedView.clicca(voce);
  marked.setSearch("zzz-nessuno");
  await mprovider.getChildren();
  eq("una ricerca toglie la voce dal disegno: pulito", [null, [yml, null]], [await lampo(), await apri()]);
  marked.setSearch("");
  await mprovider.getChildren();
  eq("…torna nel disegno (VS Code tiene la selezione per id): di nuovo il lampo", voce.keyId, await lampo());

  markedView.visible = false;
  eq("Results nascosta (chiusa, o coperta da LLM/Help): pulito", [null, [yml, null]], [await lampo(), await apri()]);
  markedView.visible = true;

  scrivi("app/locale/fr-FR.yml", "# header\n");
  eq("una lingua che non ha ancora la chiave: in cima, e il perché nella barra di stato", [[join(ws, "app/locale/fr-FR.yml"), null], true],
    [await apri(join(ws, "app/locale/fr-FR.yml")), new RegExp(`${voce.keyId} is not in fr-FR\\.yml yet`).test(stato.barra.at(-1))]);
  markedView.selection = [];
  rmSync(join(ws, "app/locale"), { recursive: true, force: true });
}

console.log("\n== la sonda inversa: il cursore nell'editor seleziona la voce ==");
{
  const app = join(ws, "app/src/App.jsx");
  const fileRow = (await tutto(undefined, [])).find((r) => r.label === "App.jsx");
  const [benvenuto, ciao] = fileRow.children;
  // Il cursore (riga e colonna da 0, come in VS Code), e l'attesa della sonda.
  const cursore = async (line, character, { file = app, dirty = false, text } = {}) => {
    const document = { uri: vscode.Uri.file(file), isDirty: dirty, ...(text === undefined ? {} : { getText: () => text }) };
    for (const f of stato.cursori) f({ textEditor: { document, selection: { active: { line, character } } } });
    await new Promise((r) => setTimeout(r, 200));
  };
  markedView.selection = [];
  const rivelate = markedView.rivelate.length;
  const comandi = stato.eseguiti.length;
  await cursore(benvenuto.line - 1, 20);
  eq("il cursore su una riga con una voce: Results la seleziona", benvenuto.id, markedView.selection[0]?.id);
  eq("…senza focus, e senza muovere l'editor (nessun comando: niente giro)", [false, comandi], [markedView.rivelate.at(-1).focus, stato.eseguiti.length]);
  await cursore(benvenuto.line - 1, 25);
  eq("…di nuovo sulla stessa voce: nessun altro reveal", rivelate + 1, markedView.rivelate.length);
  await cursore(0, 0);
  eq("una riga senza voci: niente cambia", [rivelate + 1, benvenuto.id], [markedView.rivelate.length, markedView.selection[0]?.id]);
  // Il clic su una voce in Results apre l'editor lì: il cursore che arriva ritrova la voce scelta.
  markedView.clicca(ciao);
  await cursore(ciao.line - 1, ciao.column - 1);
  eq("andata e ritorno (clic in Results → cursore): si ferma", [rivelate + 1, ciao.id], [markedView.rivelate.length, markedView.selection[0]?.id]);
  await cursore(benvenuto.line - 1, 20, { dirty: true });
  eq("documento con modifiche non salvate: niente (righe forse vecchie)", ciao.id, markedView.selection[0]?.id);
  marked.setFilter("notSynced");
  await mprovider.getChildren();
  await cursore(benvenuto.line - 1, 20);
  eq("Filter non su All: niente", ciao.id, markedView.selection[0]?.id);
  marked.setFilter("all");
  marked.setSearch("Ciao");
  await mprovider.getChildren();
  await cursore(benvenuto.line - 1, 20);
  eq("Search usata: niente", ciao.id, markedView.selection[0]?.id);
  marked.setSearch("");
  await tutto(undefined, []);
  markedView.visible = false;
  await cursore(benvenuto.line - 1, 20);
  eq("Results nascosta: niente (un reveal la aprirebbe)", ciao.id, markedView.selection[0]?.id);
  markedView.visible = true;
  await cursore(benvenuto.line - 1, 20, { file: join(ws, "app/src/lib/deep/util.js") });
  eq("un altro file, riga senza voci: niente", ciao.id, markedView.selection[0]?.id);
  // Una voce su più righe: il testo del documento dice dove finisce, e il cursore sotto risale fino
  // a lei. (Lo stesso App.jsx, con "Ciao mondo" che va a capo dopo l'inizio della voce.)
  const suPiùRighe = APP.replace("_%_Ciao mondo_%_", "_%_Ciao\n        mondo_%_");
  markedView.clicca(benvenuto);
  await cursore(ciao.line, 4, { text: suPiùRighe });
  eq("la riga sotto l'inizio di una voce su più righe: risale fino a lei", ciao.id, markedView.selection[0]?.id);
  markedView.clicca(benvenuto);
  await cursore(ciao.line + 1, 2, { text: suPiùRighe });
  eq("…ma non oltre la sua fine", benvenuto.id, markedView.selection[0]?.id);
  markedView.selection = [];
}

console.log("\n== la libreria troppo vecchia: l'avviso al posto di Results e Project ==");
{
  // guasto/ usa il plugin, ma la sua @sepoina/vitetranslate è una 4.6.3, di prima di ./ide/scan.
  scrivi("guasto/vite.config.js", `import vitetranslate from ${JSON.stringify(PLUGIN)};\nexport default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };\n`);
  scrivi("guasto/package.json", JSON.stringify({ name: "guasto", version: "0.1.0" }));
  scrivi("guasto/src/A.jsx", "export const A = () => <p>_%_Ciao_%_</p>;\n");
  const lib = "guasto/node_modules/@sepoina/vitetranslate";
  const libreria = (version, exports) => scrivi(`${lib}/package.json`, JSON.stringify({ name: "@sepoina/vitetranslate", version, type: "module", exports: { ...exports, "./package.json": "./package.json" } }));
  libreria("4.6.3", {});
  // Quello che fa VS Code da sé: aspettare che le scansioni arrivino e che la sezione decida.
  const finché = async (condizione) => {
    for (let giro = 0; giro < 100 && !condizione(); giro++) {
      await marked.idle();
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const fuochi = () => stato.eseguiti.filter(([id]) => id === "vitetranslate.optional.focus").length;
  stato.findFiles = async () => [vscode.Uri.file(join(ws, "app/vite.config.js")), vscode.Uri.file(join(ws, "guasto/vite.config.js"))];
  await stato.comandi.get("vitetranslate.refresh")();
  const prima = fuochi();
  await stato.comandi.get("vitetranslate.select")(join(ws, "guasto"));
  await pieno(mprovider);
  await finché(() => optProvider.mode === "library");
  eq("guasto: la facoltativa al posto di Results e Project, senza focus", [true, true, "library", "Library", prima],
    [stato.contesto["vitetranslate.optional"], stato.contesto["vitetranslate.libraryProblem"], optProvider.mode, optView.title, fuochi()]);
  eq("…la pagina: niente Back, Check again", [false, true], [optView.webview.html.includes('data-cmd="close"'), optView.webview.html.includes('data-cmd="refresh"')]);
  eq("…due progetti: Selector resta, per passare all'altro (il suo when)", true, stato.contesto["vitetranslate.manyProjects"]);
  // In VS Code Results ora è nascosta: nessun disegno la scansiona più.
  markedView.visible = false;
  await optPagina.ricevi({ cmd: "ready" });
  const s = optPagina.stati.at(-1);
  eq("…lo stato: il guasto, la versione, il comando (in preview: next), il progetto", ["This viteTranslate is too old", true, "npm install @sepoina/vitetranslate@next", "guasto"],
    [s.library?.heading, s.library?.intro.includes("4.6.3"), s.library?.command, optView.description]);
  await stato.comandi.get("vitetranslate.closeOptional")();
  eq("…closeOptional non lo toglie: non c'è dove tornare", "library", optProvider.mode);
  await optPagina.ricevi({ cmd: "settings" });
  eq("…l'ingranaggio: Settings sopra il guasto, con la freccia", ["settings", false], [optProvider.mode, stato.contesto["vitetranslate.libraryProblem"]]);
  await optPagina.ricevi({ cmd: "ready" });
  eq("…VERSION: la 4.6.3 in giallo, e niente IDE API (l'export non c'è)", [["4.6.3", true], ["none", true]],
    ((v) => [[v?.library.text, v?.library.old], [v?.ide.text, v?.ide.old]])(optPagina.stati.at(-1).versions));
  await optPagina.ricevi({ cmd: "close" });
  eq("…e Back da Settings torna al guasto", ["library", true, true], [optProvider.mode, stato.contesto["vitetranslate.optional"], stato.contesto["vitetranslate.libraryProblem"]]);

  // Aggiornata: una libreria con ./ide/scan (la lib/ del repo). Check again rilegge e riscansiona
  // da solo, con Results nascosta; la scansione buona rimette Results e Project.
  symlinkSync(join(REPO, "lib"), join(ws, lib, "lib"), "junction");
  libreria("4.6.4-rc.3", { "./ide/scan": "./lib/ide/scan.js" });
  await optPagina.ricevi({ cmd: "refresh" });
  await finché(() => optProvider.mode === null);
  eq("Check again, riparata: tornano Results e Project", [null, false, false], [optProvider.mode, stato.contesto["vitetranslate.optional"], stato.contesto["vitetranslate.libraryProblem"]]);
  markedView.visible = true;
  eq("…Results: la voce di guasto/, con la sua riga", true, (await tutto()).some((r) => r.label.endsWith(" Ciao") && r.description === ":1"));

  stato.findFiles = async () => [vscode.Uri.file(join(ws, "app/vite.config.js"))];
  await stato.comandi.get("vitetranslate.refresh")();
  await progetto();
}

console.log("\n== Restricted Mode ==");
stato.isTrusted = false;
{
  await stato.comandi.get("vitetranslate.refresh")();
  await progetto();
  const figli = (await ispettore()).details;
  eq("config non eseguito", "not executed: Restricted Mode", figli[2].description);
  eq("package.json letto lo stesso", "my-app 0.1.0", figli[1].description);
  const mradici = await pieno(mprovider);
  eq("Results: nessuna scansione", ["Restricted Mode"], mradici.map((r) => r.label));
  const lanciati = stato.taskEseguiti.length;
  await stato.comandi.get("vitetranslate.sync")();
  eq("Sync: niente task, il perché in un avviso", [lanciati, "warning"], [stato.taskEseguiti.length, stato.avvisi.at(-1)[0]]);
}

console.log("\n== findCli: il comando del progetto ==");
{
  const { findCli } = await import("../../idePlugin/src/core/syncCommand.mjs");
  const app = findCli(join(ws, "app"));
  eq("app: vtranslate-cli della libreria installata", [true, "vtranslate-cli", join(REPO, "lib/dev/vite/cli.js")], [app.ok, app.name, app.cli]);
  const other = findCli(join(ws, "other"));
  eq("other, senza libreria: npm install", [false, true], [other.ok, /not installed in this project: run npm install/.test(other.error)]);
  scrivi("vecchio/node_modules/@sepoina/vitetranslate/package.json", JSON.stringify({ name: "@sepoina/vitetranslate", version: "1.0.0" }));
  scrivi("vecchio/package.json", "{}");
  eq("una libreria senza comandi: lo dice", [false, "@sepoina/vitetranslate 1.0.0 declares no command"], Object.values(findCli(join(ws, "vecchio"))));
}

console.log("\n== cliLaunch: con cosa si lancia il CLI nel terminale ==");
{
  const { cliLaunch, nodeOnPath } = await import("../../idePlugin/src/core/syncCommand.mjs");
  const base = { cli: "/lib/cli.js", args: ["--status"], runner: "/ext/dist/cliRunner.mjs", runAsNodeCmd: "/ext/dist/runAsNode.cmd", execPath: "/editor/Code" };
  const conNode = join(ws, "bin con spazi");
  scrivi("bin con spazi/node.exe", "");
  const senza = join(ws, "vuota");
  scrivi("vuota/x.txt", "");
  const campi = (l) => [l.command, l.args, l.env, l.via, l.interactive, l.runner];
  eq("macOS e Linux: l'editor in modalità Node, col runner",
    ["/editor/Code", ["/ext/dist/cliRunner.mjs", "/lib/cli.js", "--status"], { ELECTRON_RUN_AS_NODE: "1" }, "editor", true, "/ext/dist/cliRunner.mjs"],
    campi(cliLaunch({ ...base, platform: "linux", env: { PATH: conNode } })));
  eq("Windows col node nel PATH: quello, col runner, niente ELECTRON_RUN_AS_NODE",
    [join(conNode, "node.exe"), ["/ext/dist/cliRunner.mjs", "/lib/cli.js", "--status"], {}, "node", true, "/ext/dist/cliRunner.mjs"],
    campi(cliLaunch({ ...base, platform: "win32", env: { Path: `${senza};"${conNode}"` } })));
  eq("Windows senza node: runAsNode.cmd, senza runner, niente input",
    ["/ext/dist/runAsNode.cmd", ["/lib/cli.js", "--status"], { ELECTRON_RUN_AS_NODE: "1", VT_EDITOR_EXE: "/editor/Code" }, "cmd", false, null],
    campi(cliLaunch({ ...base, platform: "win32", env: { PATH: `${senza};;` } })));
  eq("nodeOnPath: Path o PATH, voci vuote o tra virgolette, null senza", [join(conNode, "node.exe"), join(conNode, "node.exe"), null, null],
    [nodeOnPath({ PATH: `;${conNode}` }), nodeOnPath({ Path: `"${conNode}"` }), nodeOnPath({ PATH: senza }), nodeOnPath({})]);
  const cmd = readFileSync(join(REPO, "idePlugin/src/core/runAsNode.cmd"), "utf8");
  eq("runAsNode.cmd: l'editor con gli argomenti, e il suo codice d'uscita", [true, true],
    [cmd.includes('@"%VT_EDITOR_EXE%" %*'), cmd.includes("@exit /b %errorlevel%")]);
}

for (const d of context.subscriptions) d.dispose?.();
rmSync(ws, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
