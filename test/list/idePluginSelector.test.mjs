// Estensione per l'editor (idePlugin): lo stato della sezione Selector (selectorState.mjs), quello
// che l'estensione manda alla webview. Config solo con più di un progetto, Filter solo se oltre ad
// All c'è qualcosa da scegliere, e un filtro che non trova più niente mostrato come All.
//
//   node test/list/idePluginSelector.test.mjs
import { join } from "node:path";
import { selectorState } from "../../idePlugin/src/webViews/selector/selectorState.mjs";
import { selectorHtml } from "../../idePlugin/src/webViews/selector/selectorPage.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const ws = join("/", "ws");
const progetti = [{ dir: join(ws, "app"), configFile: "vite.config.js" }, { dir: ws, configFile: "vite.config.ts" }];
const nomi = { [join(ws, "app")]: "my-app" };
const base = { projects: progetti, selected: null, roots: [ws], nameOf: (d) => nomi[d] ?? null };
const scansione = { ok: true, files: [{ rel: "src/A.jsx", entries: [
  { id: "A_1", problems: [{ kind: "notSynced", detail: ["fr-FR"] }] },
  { id: "A_2", problems: [] },
] }] };

console.log("\n== Config ==");
{
  const s = selectorState(base);
  eq("due progetti: nome (o cartella) e dove sta", [["my-app", "app"], ["ws", "workspace root"]], s.projects.map((r) => [r.label, r.description]));
  eq("…il valore è la cartella, il tooltip il config", [join(ws, "app"), join(ws, "vite.config.ts")], [s.projects[0].value, s.projects[1].tooltip]);
  eq("nessuno selezionato, nessun filtro, non vuoto", [null, null, false], [s.selected, s.filters, s.empty]);
  eq("un progetto solo: niente Config", null, selectorState({ ...base, projects: [progetti[0]], selected: progetti[0].dir }).projects);
  const vuoto = selectorState({ ...base, projects: [] });
  eq("nessun progetto: vuoto, niente elenchi", [true, null, null], [vuoto.empty, vuoto.projects, vuoto.filters]);
}

console.log("\n== Filter ==");
{
  const s = selectorState({ ...base, selected: join(ws, "app"), marked: scansione });
  eq("le scelte che trovano qualcosa, coi conteggi", [["all", "2"], ["notSynced", "1 of 2"]], s.filters.map((v) => [v.value, v.description]));
  eq("di partenza All", "all", s.filter);
  eq("filtro scelto e presente", "notSynced", selectorState({ ...base, selected: join(ws, "app"), marked: scansione, filter: "notSynced" }).filter);
  eq("filtro scelto che non trova niente: si mostra All", "all", selectorState({ ...base, selected: join(ws, "app"), marked: scansione, filter: "untranslated" }).filter);
  const pulita = { ok: true, files: [{ rel: "src/A.jsx", entries: [{ id: "A_1", problems: [] }] }] };
  eq("tutto a posto: niente Filter", null, selectorState({ ...base, selected: join(ws, "app"), marked: pulita }).filters);
  eq("scansione fallita o assente: niente Filter", [null, null],
    [selectorState({ ...base, selected: join(ws, "app"), marked: { ok: false } }).filters, selectorState({ ...base, selected: join(ws, "app") }).filters]);
  eq("nessun selezionato: niente Filter anche con una scansione", null, selectorState({ ...base, marked: scansione }).filters);
}

console.log("\n== Search ==");
{
  const app = join(ws, "app");
  const s = selectorState({ ...base, selected: app, marked: scansione });
  eq("Results ha voci: Search si vede, vuoto", [true, ""], [s.searchVisible, s.search]);
  eq("col filtro scelto Results è vuoto: niente Search", false,
    selectorState({ ...base, selected: app, marked: { ok: true, files: [] } }).searchVisible);
  eq("…ma con un testo scritto resta (una ricerca a zero non lo nasconde)", [true, "zzz"],
    ((s) => [s.searchVisible, s.search])(selectorState({ ...base, selected: app, marked: { ok: true, files: [] }, search: "zzz" })));
  eq("nessun progetto selezionato: niente Search", false, selectorState({ ...base, marked: scansione }).searchVisible);
  eq("scansione fallita: niente Search", false, selectorState({ ...base, selected: app, marked: { ok: false } }).searchVisible);
}

console.log("\n== l'avvio ==");
{
  // Cosa si prepara lo dice la sezione facoltativa (loadingPage.mjs): Selector, all'avvio, non si vede.
  eq("niente avvio nello stato", false, "starting" in selectorState(base));
}

console.log("\n== la pagina ==");
{
  const html = selectorHtml({ scriptUri: "vscode-webview://x/webview.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" });
  eq("sezioni nascoste finché lo stato non arriva", 3, (html.match(/<section id="\w+" hidden>/g) ?? []).length);
  eq("…e niente riga dell'avvio", false, html.includes('id="starting"'));
  eq("niente barra dei comandi: sta in Project", [false, false], [html.includes("<footer"), html.includes("data-cmd=")]);
  eq("i codicons: il link che vscode-icon cerca, e il font ammesso dalla CSP", [true, true],
    [html.includes('<link id="vscode-codicon-stylesheet" rel="stylesheet" href="vscode-webview://x/codicon.css">'), html.includes("font-src vscode-webview://x;")]);
  eq("a destra del campo l'icona che lo svuota, nascosta all'inizio", true,
    /<vscode-textfield [^>]*id="query"[^>]*><\/vscode-textfield>\s*<vscode-icon id="clear" name="close" action-icon [^>]*aria-hidden="true"/.test(html));
  eq("Search: un vscode-textfield", true, /<section id="search" hidden>[\s\S]*<vscode-textfield [^>]*id="query"/.test(html));
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
