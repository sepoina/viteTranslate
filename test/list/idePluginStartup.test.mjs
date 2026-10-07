// Estensione per l'editor (idePlugin): l'avvio. Con un progetto solo (quindi già selezionato),
// Selector, Results e Project restano nascoste (context key vitetranslate.ready) finché il suo
// vite.config non è letto e la prima scansione non è arrivata; intanto la sezione facoltativa, nel
// modo loading, dice cosa sta preparando, e poi lascia il posto. Un processo a parte da
// idePluginExtension.test.mjs: l'avvio si vede una volta sola per attivazione.
//
//   node test/list/idePluginStartup.test.mjs
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

const PLUGIN = pathToFileURL(fileURLToPath(new URL("../../lib/dev/vite/vitetranslate.js", import.meta.url))).href;
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const ws = mkdtempSync(join(tmpdir(), "vt-idestart-"));
const scrivi = (rel, testo) => {
  mkdirSync(dirname(join(ws, rel)), { recursive: true });
  writeFileSync(join(ws, rel), testo, "utf8");
};
scrivi("app/vite.config.js", `import vitetranslate from ${JSON.stringify(PLUGIN)};\nexport default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };\n`);
scrivi("app/package.json", JSON.stringify({ name: "my-app", version: "0.1.0" }));
scrivi("app/src/App.jsx", "export default () => <p>_%_Ciao_%_</p>;\n");
mkdirSync(join(ws, "app/node_modules/@sepoina"), { recursive: true });
symlinkSync(REPO, join(ws, "app/node_modules/@sepoina/vitetranslate"), "junction");
const APP = join(ws, "app");

stato.workspaceFolders = [{ uri: vscode.Uri.file(ws) }];
stato.findFiles = async () => [vscode.Uri.file(join(APP, "vite.config.js"))];
const SRC = (nome) => fileURLToPath(new URL(`../../idePlugin/src/${nome}`, import.meta.url));
const SONDE = { [join("dist", "probe.mjs")]: SRC("probes/probe.mjs"), [join("dist", "markedProbe.mjs")]: SRC("probes/markedProbe.mjs") };
const memoria = new Map();
const context = {
  subscriptions: [],
  asAbsolutePath: (rel) => SONDE[rel] ?? rel,
  workspaceState: { get: (k) => memoria.get(k), update: async (k, v) => void memoria.set(k, v) },
  extensionUri: vscode.Uri.file(join(ws, "ext")),
};

const { marked, tree, preparato, optional } = activate(context);
// La sezione facoltativa, aperta subito: all'avvio di VS Code è l'unica in vista.
const stati = [];
const vistaAvvio = {
  webview: {
    options: {}, html: "", cspSource: "vscode-webview://x",
    asWebviewUri: (uri) => `vscode-webview://x${uri.fsPath}`,
    onDidReceiveMessage: () => ({ dispose() {} }),
    postMessage: async (m) => void stati.push(m),
  },
  title: undefined,
  visible: true,
  onDidChangeVisibility: () => ({ dispose() {} }),
  onDidDispose: () => ({ dispose() {} }),
};
stato.webviews.get("vitetranslate.optional").resolveWebviewView(vistaAvvio);

console.log("\n== l'avvio con un progetto selezionato ==");
eq("subito: Selector, Results e Project nascoste", undefined, stato.contesto["vitetranslate.ready"]);
eq("…al loro posto la facoltativa, sull'avvio: Loading, il logo, la prima tappa", [true, "loading", "Loading", true, true],
  [stato.contesto["vitetranslate.optional"], optional.mode, vistaAvvio.title, vistaAvvio.webview.html.includes('<main id="loading"'), vistaAvvio.webview.html.includes("Looking for Vite projects…")]);
await preparato;
const passi = [...new Set(stati.map((s) => s.loading))];
eq("la facoltativa ha detto cosa preparava", ["Reading the vite.config of my-app…", "Scanning my-app for marked strings…"],
  passi.filter((p) => p !== "Looking for Vite projects…"));
eq("pronto: le sezioni si mostrano, la facoltativa lascia il posto", [true, false, null],
  [stato.contesto["vitetranslate.ready"], stato.contesto["vitetranslate.optional"], optional.mode]);
eq("…con vite.config già letto e la scansione già arrivata", [true, true], [!!tree.ready(APP), marked.resultOf(APP)?.ok]);
const [radice] = await stato.treeViews.get("vitetranslate.results").treeDataProvider.getChildren();
eq("Results disegna subito le righe vere, niente Loading", "src", radice?.label);

eq("il canale: in quanti ms è pronto", true, stato.log.some((r) => /startup: ready in \d+ ms/.test(r)));

console.log("\n== Project compare: le tappe ==");
{
  const pstati = [];
  let ricevi;
  const vista = {
    webview: {
      options: {}, html: "", cspSource: "vscode-webview://x",
      asWebviewUri: (uri) => `vscode-webview://x${uri.fsPath}`,
      onDidReceiveMessage: (f) => ((ricevi = f), { dispose() {} }),
      postMessage: async (m) => void pstati.push(m),
    },
    visible: true,
    onDidChangeVisibility: () => ({ dispose() {} }),
    onDidDispose: () => ({ dispose() {} }),
  };
  stato.webviews.get("vitetranslate.project").resolveWebviewView(vista);
  eq("la pagina resta invisibile finché non disegna", true, vista.webview.html.includes("body:not([data-drawn]) { visibility: hidden; }"));
  await ricevi({ cmd: "ready" });
  eq("al primo ready lo stato è già completo: Languages, non Reading", [null, true], [pstati[0]?.message, !!(pstati[0]?.languages ?? pstati[0]?.languagesNote)]);
  await ricevi({ cmd: "drawn" });
  await ricevi({ cmd: "drawn" });
  const tappe = stato.log.filter((r) => /startup: Project/.test(r)).map((r) => /startup: (.*) \+\d+ ms after ready/.exec(r)?.[1]);
  eq("…e le sue tappe nel canale, una volta sola", ["Project page created", "Project script loaded", "Project drawn"], tappe);
}

console.log("\n== Settings aperto durante l'avvio (dalla palette) ==");
{
  // Un'altra attivazione: un avvio nuovo, sullo stesso workspace.
  const context2 = { ...context, subscriptions: [] };
  const { preparato: preparato2, optional: opt } = activate(context2);
  const vista = { ...vistaAvvio, webview: { ...vistaAvvio.webview, postMessage: async () => {} }, title: undefined };
  stato.webviews.get("vitetranslate.optional").resolveWebviewView(vista);
  await stato.comandi.get("vitetranslate.settings")();
  eq("Settings sopra l'avvio", ["settings", "Settings", true], [opt.mode, vista.title, stato.contesto["vitetranslate.optional"]]);
  await stato.comandi.get("vitetranslate.closeOptional")();
  eq("…Back, con l'avvio non finito: si torna all'avvio", ["loading", "Loading", true], [opt.mode, vista.title, stato.contesto["vitetranslate.optional"]]);
  await stato.comandi.get("vitetranslate.settings")();
  await preparato2;
  eq("…riaperto e lasciato aperto: a pannello pronto resta Settings", ["settings", true], [opt.mode, stato.contesto["vitetranslate.optional"]]);
  await stato.comandi.get("vitetranslate.closeOptional")();
  eq("…e il suo Back, ad avvio finito, rimette Results e Project", [null, false], [opt.mode, stato.contesto["vitetranslate.optional"]]);
  for (const d of context2.subscriptions) d.dispose?.();
}

for (const d of context.subscriptions) d.dispose?.();
rmSync(ws, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
