// Estensione per l'editor (idePlugin): extension.mjs attivata davvero, con il modulo `vscode`
// sostituito da uno stub (idePluginVscodeStub.mjs) tramite `module.registerHooks`. Si prova la
// colla delle tre sezioni: Configs (elenco, selezione col clic, sparisce con un progetto solo),
// Details (passiva finché non si seleziona), Marked (con la sonda delle voci che usa la libreria
// di questo repo, un link in node_modules, e il suo filtro); id unici, refresh, Restricted Mode.
// L'aspetto nel pannello vero resta una verifica a mano (piano idePlugin_0_0_0, Fase 4).
//
//   node test/list/idePluginExtension.test.mjs
import module from "node:module";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
const SONDE = { [join("dist", "probe.mjs")]: SRC("probe.mjs"), [join("dist", "markedProbe.mjs")]: SRC("markedProbe.mjs") };
const memoria = new Map();
const workspaceState = { get: (k) => memoria.get(k), update: async (k, v) => void memoria.set(k, v) };
const context = { subscriptions: [], asAbsolutePath: (rel) => SONDE[rel] ?? rel, workspaceState, extensionUri: vscode.Uri.file(join(ws, "ext")) };
const { marked, tree } = activate(context);
const markedView = stato.treeViews.get("vitetranslate.results");
const detailsView = stato.treeViews.get("vitetranslate.details");
const mprovider = markedView.treeDataProvider;
const dprovider = detailsView.treeDataProvider;
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

// Results e Details non aspettano le sonde: il primo disegno è "Loading…", e quello vero arriva
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
eq("due TreeView, Results e Details", ["vitetranslate.results", "vitetranslate.details"], [...stato.treeViews.keys()]);
eq("Selector: una webview", "function", typeof selectorProvider?.resolveWebviewView);
eq("comandi registrati", [true, true, true], ["refresh", "select", "sync"].map((c) => stato.comandi.has(`vitetranslate.${c}`)));
eq("tutto sotto context.subscriptions", true, context.subscriptions.length >= 5);

const seleziona = (dir) => stato.comandi.get("vitetranslate.select")(dir);

console.log("\n== Selector: la pagina ==");
{
  eq("script abilitati, e solo dist/ raggiungibile", [true, [join(ws, "ext/dist")]], [webview.options.enableScripts, webview.options.localResourceRoots.map((u) => u.fsPath)]);
  eq("Config, Filter e Search, poi i tre bottoni", ["config", "filter", "search", "sync", "refresh", "openConfig"],
    [...webview.html.matchAll(/<section id="(\w+)"|<vscode-button data-cmd="(\w+)"/g)].map((m) => m[1] ?? m[2]));
  eq("gli elenchi: due vscode-tree", ["projects", "filters"], [...webview.html.matchAll(/<vscode-tree id="(\w+)"/g)].map((m) => m[1]));
  const nonce = /script-src 'nonce-([0-9a-f]+)'/.exec(webview.html)?.[1];
  eq("CSP col nonce, e lo script lo porta", true, !!nonce && webview.html.includes(`<script type="module" nonce="${nonce}" src="vscode-webview://x${join(ws, "ext/dist/webview.js")}">`));
  eq("niente default aperto", true, webview.html.includes("default-src 'none'"));
  eq("i codicons da dist/", true, webview.html.includes(`href="vscode-webview://x${join(ws, "ext/dist/codicon.css")}"`));
  eq("prima di ready: niente stato mandato", 0, pagina.stati.length);
}

console.log("\n== Selector: tutti i progetti, nessuno selezionato ==");
{
  await clic("ready");
  const s0 = pagina.stati.at(-1);
  eq("ready: lo stato arriva", "state", s0?.type);
  eq("Config: tutti e due, nome e cartella", [["my-app", "app"], ["other", "other"]], s0.projects.map((r) => [r.label, r.description]));
  eq("…col percorso del config nel tooltip", join(ws, "app/vite.config.js"), s0.projects[0].tooltip);
  eq("nessuno selezionato, Filter nascosto", [null, null, false], [s0.selected, s0.filters, s0.empty]);
  eq("contesto: ci sono progetti", { "vitetranslate.hasProjects": true }, stato.contesto);
  eq("Details passiva", [[], undefined], [await pieno(dprovider), detailsView.description]);
  eq("Results passiva", [[], undefined], [await pieno(mprovider), markedView.description]);
  const n = pagina.stati.length;
  await selectorProvider.push();
  eq("stato invariato: non si rimanda", n, pagina.stati.length);
}

console.log("\n== clic su my-app: Details e Results si accendono ==");
{
  const prima = cambi;
  await clic("select", join(ws, "app"));
  eq("un avviso solo", prima + 1, cambi);
  eq("Selector: my-app selezionato", join(ws, "app"), (await selettore()).selected);
  eq("selezione ricordata nel workspace", join(ws, "app"), memoria.get("vitetranslate.selected"));
  await clic("select", join(ws, "app"));
  eq("riselezionarlo non cambia niente", prima + 1, cambi);

  const figli = await pieno(dprovider);
  eq("Details: le righe del progetto", ["yml tables", "vitetranslate", "package.json", "vite.config.js"], figli.map((r) => r.label));
  eq("…yml tables: locale/ non c'è ancora (nessuna sync)", "locale/ not found", figli[0].description);
  eq("Details: intestazione", "my-app", detailsView.description);
  eq("vitetranslate", "it-IT → locale/", figli[1].description);
  const pkgItem = dprovider.getTreeItem(figli[2]);
  eq("clic su package.json lo apre", ["vscode.open", join(ws, "app/package.json")], [pkgItem.command.command, pkgItem.command.arguments[0].fsPath]);

  const righe = await tutto(undefined, [], dprovider);
  const ids = righe.map((r) => dprovider.getTreeItem(r).id);
  eq("id tutti presenti e unici", righe.length, new Set(ids.filter(Boolean)).size);
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
  eq("…messaggio in testa, le righe di prima restano", ["⏳ vite.config changed: updating…", "src"], [markedView.message, bloccate[0].label]);
  await pieno(mprovider);
  eq("…dopo: niente messaggio, tutto riparsato (overlay buttato)", [undefined, true], [markedView.message, /0 kept, 2 parsed/.test(stato.log.at(-1))]);
}

console.log("\n== ricalcolo senza cambiamenti: nessun avviso ==");
{
  const prima = cambi;
  await tree.relist(false);
  eq("stesso elenco: niente", prima, cambi);
}

console.log("\n== other dal comando: Details e Results lo seguono ==");
{
  seleziona(join(ws, "other"));
  eq("cambio progetto: Details subito vuota", ["Reading vite.config…"], (await dprovider.getChildren()).map((r) => r.label));
  eq("…Results subito vuota, mai le righe di app", [["Loading other…"], "other"], [(await mprovider.getChildren()).map((r) => r.label), markedView.description]);
  const s2 = await selettore();
  eq("Selector: other selezionato, Filter nascosto", [join(ws, "other"), null], [s2.selected, s2.filters]);
  eq("selezione ricordata", join(ws, "other"), memoria.get("vitetranslate.selected"));
  const figliOther = await pieno(dprovider);
  eq("other: vitetranslate non registrato", "not registered in vite.config", figliOther[1].description);
  eq("other: package.json assente", "no package.json next to vite.config", figliOther[2].description);
  eq("Results: plugin assente", ["vitetranslate is not registered in vite.config"], (await pieno(mprovider)).map((r) => r.label));
  eq("intestazioni col nome della cartella", ["other", "other"], [markedView.description, detailsView.description]);
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

console.log("\n== un progetto solo: Config sparisce, Details fisso ==");
stato.findFiles = async () => [vscode.Uri.file(join(ws, "app/vite.config.js"))];
{
  await stato.comandi.get("vitetranslate.refresh")();
  eq("Details: l'unico, anche se era selezionato other", "my-app", ((await pieno(dprovider)), detailsView.description));
  await pieno(mprovider);
  const s3 = await selettore();
  eq("Selector: niente Config, e l'unico è il selezionato", [null, join(ws, "app")], [s3.projects, s3.selected]);
  eq("…Filter di app", ["all", "notSynced"], s3.filters?.map((v) => v.value));
}

console.log("\n== Selector: i bottoni ==");
{
  const messaggio = (m) => pagina.ricevi(m);
  await messaggio({ cmd: "openConfig" });
  eq("Open vite.config: apre quello del progetto selezionato", ["vscode.open", join(ws, "app/vite.config.js")], [stato.eseguiti.at(-1)?.[0], stato.eseguiti.at(-1)?.[1].fsPath]);
  const scansioni = stato.log.filter((r) => /source scanned|vite\.config\.js: read/.test(r)).length;
  await messaggio({ cmd: "refresh" });
  await pieno(dprovider);
  eq("Refresh: rilegge il vite.config", true, stato.log.filter((r) => /source scanned|vite\.config\.js: read/.test(r)).length > scansioni);
  // Sync: il CLI della libreria installata nel progetto, in un task, col binario dell'editor.
  await messaggio({ cmd: "sync" });
  const task = stato.taskEseguiti.at(-1);
  eq("Sync: un task per app", [{ type: "vitetranslate", command: "sync", dir: join(ws, "app") }, "viteTranslate"], [task?.definition, task?.source]);
  eq("…nella cartella del workspace", ws, task?.scope?.uri?.fsPath);
  eq("…il CLI del progetto, col node in uso in modalità Node", [process.execPath, [join(REPO, "lib/dev/vite/cli.js")], join(ws, "app"), "1"],
    [task?.execution.process, task?.execution.args, task?.execution.options.cwd, task?.execution.options.env.ELECTRON_RUN_AS_NODE]);
  eq("…annotato nel canale", true, /app: sync started \(vtranslate-cli /.test(stato.log.at(-1)));
  stato.taskExecutions = [{ task }];
  await stato.comandi.get("vitetranslate.sync")();
  eq("un sync già in corso: nessun secondo task", [1, ["info", "A sync is already running for this project."]],
    [stato.taskEseguiti.length, stato.avvisi.at(-1)]);
  stato.taskExecutions = [];
  for (const f of stato.fineTask) f({ execution: { task }, exitCode: 0 });
  eq("fine con 0: annotata, nessun errore", [true, "info"], [/sync ended with exit code 0/.test(stato.log.at(-1)), stato.avvisi.at(-1)[0]]);
  for (const f of stato.fineTask) f({ execution: { task }, exitCode: 1 });
  eq("fine con errore: lo dice", "error", stato.avvisi.at(-1)[0]);

  await messaggio({ cmd: "boom" });
  eq("un comando sconosciuto: annotato, niente altro", true, /Selector: unknown command "boom"/.test(stato.log.at(-1)));
  const n = pagina.stati.length;
  await clic("ready");
  eq("una pagina ricreata (ready): lo stato si rimanda anche se uguale", n + 1, pagina.stati.length);
  pagina.chiudi();
  eq("chiusa: dimenticata", null, selectorProvider.view);
}

console.log("\n== badge delle righe: FileDecoration nel nostro schema ==");
{
  eq("un provider di decorazioni registrato", 1, stato.decorazioni.length);
  const item = dprovider.getTreeItem({ label: "en-US", open: join(ws, "app/locale/en-US.yml"), badge: { text: "12", tooltip: "12 missing" }, icon: "file", iconColor: "problemsWarningIcon.foreground" });
  eq("la riga col badge: resourceUri nel nostro schema, non file (niente badge nell'Explorer)", ["vitetranslate-badge", join(ws, "app/locale/en-US.yml")], [item.resourceUri?.scheme, item.resourceUri?.fsPath]);
  eq("…l'icona colorata resta la sua", ["file", "problemsWarningIcon.foreground"], [item.iconPath.id, item.iconPath.color?.id]);
  const dec = stato.decorazioni[0].provideFileDecoration(item.resourceUri);
  eq("…e la decorazione porta il badge", ["12", "12 missing"], [dec?.badge, dec?.tooltip]);
  eq("una riga senza badge: nessun resourceUri", undefined, dprovider.getTreeItem({ label: "it-IT", open: "/x/it-IT.yml" }).resourceUri);
  eq("un file senza badge registrato: nessuna decorazione", undefined, stato.decorazioni[0].provideFileDecoration(vscode.Uri.file("/x/y.yml").with({ scheme: "vitetranslate-badge" })));
}

console.log("\n== Restricted Mode ==");
stato.isTrusted = false;
{
  await stato.comandi.get("vitetranslate.refresh")();
  const figli = await pieno(dprovider);
  eq("config non eseguito", "not executed: Restricted Mode", figli[3].description);
  eq("package.json letto lo stesso", "my-app 0.1.0", figli[2].description);
  const mradici = await pieno(mprovider);
  eq("Results: nessuna scansione", ["Restricted Mode"], mradici.map((r) => r.label));
  const lanciati = stato.taskEseguiti.length;
  await stato.comandi.get("vitetranslate.sync")();
  eq("Sync: niente task, il perché in un avviso", [lanciati, "warning"], [stato.taskEseguiti.length, stato.avvisi.at(-1)[0]]);
}

console.log("\n== findCli: il comando del progetto ==");
{
  const { findCli } = await import("../../idePlugin/src/syncCommand.mjs");
  const app = findCli(join(ws, "app"));
  eq("app: vtranslate-cli della libreria installata", [true, "vtranslate-cli", join(REPO, "lib/dev/vite/cli.js")], [app.ok, app.name, app.cli]);
  const other = findCli(join(ws, "other"));
  eq("other, senza libreria: npm install", [false, true], [other.ok, /not installed in this project: run npm install/.test(other.error)]);
  scrivi("vecchio/node_modules/@sepoina/vitetranslate/package.json", JSON.stringify({ name: "@sepoina/vitetranslate", version: "1.0.0" }));
  scrivi("vecchio/package.json", "{}");
  eq("una libreria senza comandi: lo dice", [false, "@sepoina/vitetranslate 1.0.0 declares no command"], Object.values(findCli(join(ws, "vecchio"))));
}

for (const d of context.subscriptions) d.dispose?.();
rmSync(ws, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
