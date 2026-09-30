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
const context = { subscriptions: [], asAbsolutePath: (rel) => SONDE[rel] ?? rel, workspaceState };
const { marked } = activate(context);
const configsView = stato.treeViews.get("vitetranslate.project");
const markedView = stato.treeViews.get("vitetranslate.marked");
const detailsView = stato.treeViews.get("vitetranslate.details");
const provider = configsView.treeDataProvider;
const mprovider = markedView.treeDataProvider;
const dprovider = detailsView.treeDataProvider;
let ridisegni = 0;
let ridisegnate; // cosa ha chiesto l'ultimo ridisegno di Configs: undefined = tutto
provider.onDidChangeTreeData((x) => (ridisegni++, (ridisegnate = x)));

// Tutto l'albero, aperto fino in fondo.
async function tutto(riga, fuori = [], p = provider) {
  for (const figlia of await p.getChildren(riga)) {
    fuori.push(figlia);
    await tutto(figlia, fuori, p);
  }
  return fuori;
}

console.log("\n== attivazione ==");
eq("tre sezioni registrate", ["vitetranslate.project", "vitetranslate.marked", "vitetranslate.details"], [...stato.treeViews.keys()]);
eq("comandi registrati", [true, true], [stato.comandi.has("vitetranslate.refresh"), stato.comandi.has("vitetranslate.select")]);
eq("tutto sotto context.subscriptions", true, context.subscriptions.length >= 5);

const segni = async () => (await provider.getChildren()).map((r) => `${r.mark === "selected" ? "▶" : "○"} ${r.label}`);
const seleziona = (dir) => stato.comandi.get("vitetranslate.select")(dir);

console.log("\n== Configs: tutti i progetti, nessuno selezionato ==");
{
  const radici = await provider.getChildren();
  eq("tutti e due, nome e cartella", [["my-app", "app"], ["other", "other"]], radici.map((r) => [r.label, r.description]));
  eq("nessun segno pieno", ["○ my-app", "○ other"], await segni());
  const app = provider.getTreeItem(radici[0]);
  eq("righe semplici: niente figli", [vscode.TreeItemCollapsibleState.None, 0], [app.collapsibleState, (await provider.getChildren(radici[0])).length]);
  eq("nessun comando sulla riga: seleziona la selezione", undefined, app.command);
  eq("icona: codicon col suo colore di tema", ["circle-small-filled", "disabledForeground"], [app.iconPath.id, app.iconPath.color.id]);
  eq("elenco piatto: nessun padre", undefined, provider.getParent(radici[0]));
  eq("contesto: più progetti", { "vitetranslate.singleProject": false, "vitetranslate.hasProjects": true }, stato.contesto);
  eq("Details passiva", [[], undefined], [await dprovider.getChildren(), detailsView.description]);
  eq("Marked passiva", [[], undefined], [await mprovider.getChildren(), markedView.description]);
}

console.log("\n== clic su my-app: Details e Marked si accendono ==");
{
  const prima = ridisegni;
  const radici = await provider.getChildren();
  configsView.clicca(radici[0]);
  eq("ridisegnata solo la riga cliccata", [prima + 1, [radici[0]]], [ridisegni, ridisegnate]);
  eq("…cambiata sul posto: segno pieno subito", "selected", radici[0].mark);
  eq("clic: nessun reveal, il focus è già lì", 0, configsView.rivelate.length);
  eq("segno su my-app", ["▶ my-app", "○ other"], await segni());
  eq("selezione ricordata nel workspace", join(ws, "app"), memoria.get("vitetranslate.selected"));
  configsView.clicca((await provider.getChildren())[0]);
  eq("riselezionarlo non ridisegna", prima + 1, ridisegni);

  const figli = await dprovider.getChildren();
  eq("Details: le righe del progetto", ["vitetranslate", "package.json", "vite.config.js"], figli.map((r) => r.label));
  eq("Details: intestazione", "my-app", detailsView.description);
  eq("vitetranslate", "it-IT → locale/", figli[0].description);
  const pkgItem = dprovider.getTreeItem(figli[1]);
  eq("clic su package.json lo apre", ["vscode.open", join(ws, "app/package.json")], [pkgItem.command.command, pkgItem.command.arguments[0].fsPath]);

  const righe = await tutto(undefined, [], dprovider);
  const ids = righe.map((r) => dprovider.getTreeItem(r).id);
  eq("id tutti presenti e unici", righe.length, new Set(ids.filter(Boolean)).size);
  eq("sonda annotata nel canale", true, stato.log.some((r) => /vite\.config\.js: read in \d+ ms/.test(r)));
}

console.log("\n== Marked, un progetto ==");
{
  const [problemi, tutte, ...radici] = await mprovider.getChildren();
  eq("in testa il filtro, poi l'albero da src/", ["Problematic only", "All", "src"], [problemi.label, tutte.label, ...radici.map((r) => r.label)]);
  eq("filtro: lo stesso elenco a scelta singola, di partenza tutte", ["idle", "selected"], [problemi.mark, tutte.mark]);
  eq("filtro: niente caselle", [undefined, undefined], [mprovider.getTreeItem(problemi).checkboxState, markedView.manageCheckboxStateManually]);
  // Nessun file di lingua: le due voci sono da sincronizzare.
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
  const righe = [problemi, tutte, ...radici, ...(await tutto(radici[0], [], mprovider))];
  const ids = righe.map((r) => mprovider.getTreeItem(r).id);
  eq("id tutti presenti e unici", righe.length, new Set(ids.filter(Boolean)).size);
  eq("scansione annotata nel canale", true, stato.log.some((r) => /source scanned in \d+ ms, 2 marked · 1 file/.test(r)));

  eq("salvataggio fuori da srcDir: ignorato", false, marked.forgetFile(join(ws, "app/vite.config.js")));
  scrivi("app/src/lib/deep/util.js", 'export const x = "_%_Terza_%_";\n');
  eq("salvataggio in srcDir: scansione da rifare", true, marked.forgetFile(join(ws, "app/src/lib/deep/util.js")));
  const dopo = await mprovider.getChildren();
  const figli = await mprovider.getChildren(dopo[2]);
  eq("cartelle compatte prima dei file", ["lib/deep", "App.jsx"], figli.map((r) => r.label));
  eq("intestazione aggiornata", "my-app · 3 marked · 2 files · 3 to check", markedView.description);
  eq("un file di lingua salvato: scansione da rifare", true, marked.forgetFile(join(ws, "app/locale/it-IT.yml")));
}

console.log("\n== Marked: il filtro ==");
{
  const [problemi] = await mprovider.getChildren();
  const prima = ridisegni;
  const scansioni = stato.log.filter((r) => /source scanned/.test(r)).length;
  markedView.clicca(problemi);
  eq("il segno passa subito sulla riga cliccata", "selected", problemi.mark);
  const righe = await mprovider.getChildren();
  eq("scelto 'Problematic only'", ["selected", "idle"], [righe[0].mark, righe[1].mark]);
  eq("ricordato nel workspace", "problems", memoria.get("vitetranslate.markedFilter"));
  eq("nessuna nuova scansione", scansioni, stato.log.filter((r) => /source scanned/.test(r)).length);
  eq("Configs non si ridisegna", prima, ridisegni);
  const [, , ...albero] = righe;
  const [file] = await mprovider.getChildren(albero[0]);
  markedView.clicca(file);
  eq("cliccare un file non tocca il filtro", "problems", memoria.get("vitetranslate.markedFilter"));
  markedView.clicca(righe[1]);
  eq("di nuovo tutte", "all", memoria.get("vitetranslate.markedFilter"));
}

console.log("\n== ricalcolo senza cambiamenti: nessun ridisegno ==");
{
  const prima = ridisegni;
  await provider.relist(false);
  eq("stesso elenco, stesso albero", prima, ridisegni);
}

console.log("\n== clic su other: Details e Marked lo seguono ==");
{
  const [app, other] = await provider.getChildren();
  seleziona(join(ws, "other"));
  eq("dal comando: ridisegnate le due righe", [app, other], ridisegnate);
  eq("un solo segno pieno", ["○ my-app", "▶ other"], await segni());
  eq("dal comando: evidenziazione e focus portati sulla riga", [[other.id, true, true]], configsView.rivelate.map((r) => [r.riga.id, r.select, r.focus]));
  eq("selezione ricordata", join(ws, "other"), memoria.get("vitetranslate.selected"));
  const figliOther = await dprovider.getChildren();
  eq("other: vitetranslate non registrato", "not registered in vite.config", figliOther[0].description);
  eq("other: package.json assente", "no package.json next to vite.config", figliOther[1].description);
  eq("Marked: plugin assente", ["vitetranslate is not registered in vite.config"], (await mprovider.getChildren()).map((r) => r.label));
  eq("intestazioni col nome della cartella", ["other", "other"], [markedView.description, detailsView.description]);
}

console.log("\n== un progetto solo: Configs sparisce, Details fisso ==");
stato.findFiles = async () => [vscode.Uri.file(join(ws, "app/vite.config.js"))];
{
  await stato.comandi.get("vitetranslate.refresh")();
  eq("contesto: progetto unico", { "vitetranslate.singleProject": true, "vitetranslate.hasProjects": true }, stato.contesto);
  eq("Details: l'unico, anche se era selezionato other", "my-app", ((await dprovider.getChildren()), detailsView.description));
}

console.log("\n== Restricted Mode ==");
stato.isTrusted = false;
{
  await stato.comandi.get("vitetranslate.refresh")();
  const figli = await dprovider.getChildren();
  eq("config non eseguito", "not executed: Restricted Mode", figli[2].description);
  eq("package.json letto lo stesso", "my-app 0.1.0", figli[1].description);
  const mradici = await mprovider.getChildren();
  eq("Marked: nessuna scansione", ["Restricted Mode"], mradici.map((r) => r.label));
}

for (const d of context.subscriptions) d.dispose?.();
rmSync(ws, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
