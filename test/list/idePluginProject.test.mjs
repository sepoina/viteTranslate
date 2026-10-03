// Estensione per l'editor (idePlugin): la sezione Project (projectState.mjs, projectPage.mjs) e la
// pagina di Help (helpPage.mjs). Lo stato: un messaggio finché non c'è niente da mostrare, poi le
// lingue (righe piatte, colore e badge) e l'albero di Details; il bottone LLM col sottomenu o col ?.
// La pagina: le due zone, i dettagli che scorrono sopra e la barra dei comandi ferma sotto.
//
//   node test/list/idePluginProject.test.mjs
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectState, keyPosition, NO_PROJECTS, NO_SELECTION, READING } from "../../idePlugin/src/projectState.mjs";
import { projectHtml, ACTIONS, ICONS, LLM_OFF, LLM_ICON } from "../../idePlugin/src/projectPage.mjs";
import { helpHtml, LLM_DOC_URL } from "../../idePlugin/src/helpPage.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const dir = mkdtempSync(join(tmpdir(), "vt-ideproject-"));
const project = { dir, configFile: "vite.config.js" };
const pkg = { ok: true, name: "app", version: "1.0.0", scripts: { dev: "vite" }, deps: [] };
const probe = { ok: true, ms: 10, plugins: ["vitetranslate"], vite: {}, vitetranslate: { localeDir: "locale", sourceLanguage: "it-IT" } };
const dati = { pkg, probe };

console.log("\n== i messaggi ==");
{
  eq("nessun progetto nel workspace", [NO_PROJECTS, null, null], ((s) => [s.message, s.languages, s.details])(projectState({ hasProjects: false, project: null })));
  eq("nessuno selezionato", [NO_SELECTION, null], ((s) => [s.message, s.title])(projectState({ hasProjects: true, project: null, title: "x" })));
  eq("lettura non arrivata: mai le righe di prima", [READING, "app", null], ((s) => [s.message, s.title, s.details])(projectState({ hasProjects: true, project, title: "app" })));
}

console.log("\n== Languages ==");
{
  const s0 = projectState({ hasProjects: true, project, title: "app", dati });
  eq("locale/ assente: niente righe, la frase in una nota", [null, "locale/ not found", "warning"],
    [s0.languages, s0.languagesNote?.text, s0.languagesNote?.icon]);
  eq("…e niente lampo: non c'è una lingua da cliccare", null, projectState({ hasProjects: true, project, dati, jumpKey: "App_1" }).jumpKey);
  mkdirSync(join(dir, "locale"));
  for (const f of ["it-IT.yml", "en-US.yml", "fr-FR.yml"]) writeFileSync(join(dir, "locale", f), "");
  const stats = { "it-IT": { keys: 10, missing: 0 }, "en-US": { keys: 10, missing: 4 }, "fr-FR": { error: "bad" } };
  const s = projectState({ hasProjects: true, project, title: "app", dati, stats });
  eq("una riga per lingua, la sorgente prima", ["it-IT", "en-US", "fr-FR"], s.languages.map((r) => r.label));
  eq("…il clic apre il file", join(dir, "locale", "en-US.yml"), s.languages[1].value);
  eq("…il colore di tema come variabile CSS", ["var(--vscode-testing-iconPassed)", "var(--vscode-problemsWarningIcon-foreground)", "var(--vscode-problemsErrorIcon-foreground)"],
    s.languages.map((r) => r.color));
  eq("…il badge dei mancanti", [undefined, "4", undefined], s.languages.map((r) => r.badge?.text));
  eq("…nessuna nota, e la cartella nel tooltip", [null, join(dir, "locale")], [s.languagesNote, s.languagesTooltip]);
  eq("una chiave scelta in Results: il lampo", ["App_1", null], [projectState({ hasProjects: true, project, dati, jumpKey: "App_1" }).jumpKey, s.jumpKey]);
}

console.log("\n== Details ==");
{
  const s = projectState({ hasProjects: true, project, title: "app", dati });
  eq("l'albero: vitetranslate, package.json, vite.config", ["vitetranslate", "package.json", "vite.config.js"], s.details.map((n) => n.label));
  eq("id: il percorso delle etichette", `${dir}/vitetranslate/sourceLanguage`, s.details[0].children[0].id);
  eq("package.json: si apre col clic", join(dir, "package.json"), s.details[1].open);
  eq("una foglia non ha children", undefined, s.details[0].children[0].children);
  eq("niente messaggio", null, s.message);
}

console.log("\n== keyPosition: la chiave nel file di lingua ==");
{
  const yml = '# intestazione\n#\nApp_1: "Ciao"\nApp_10:   "Dieci"\n#  ----to be translated----\nApp_2: null\n';
  eq("la riga, e la colonna del valore", { line: 3, column: 8 }, keyPosition(yml, "App_1"));
  eq("…non confonde App_1 con App_10, e salta gli spazi", { line: 4, column: 11 }, keyPosition(yml, "App_10"));
  eq("…anche sotto 'to be translated'", { line: 6, column: 8 }, keyPosition(yml, "App_2"));
  eq("…null se non c'è, e mai in un commento", [null, null], [keyPosition(yml, "App_3"), keyPosition("# App_1: x\n", "App_1")]);
}

console.log("\n== il bottone LLM ==");
{
  eq("progetto con llm: la freccia del sottomenu", [true, "chevron-right"], ((s) => [s.llm, s.llmIcon])(projectState({ hasProjects: true, project, dati, llm: true })));
  eq("senza llm, o senza selezione: il ?, col perché", [false, "question", false, "question", LLM_OFF],
    [...((s) => [s.llm, s.llmIcon])(projectState({ hasProjects: true, project, dati })),
      ...((s) => [s.llm, s.llmIcon, s.llmOff])(projectState({ hasProjects: true, project: null, llm: true }))]);
  eq("LLM_ICON: chevron-right e question", { on: "chevron-right", off: "question" }, LLM_ICON);
}

console.log("\n== la pagina ==");
{
  const html = projectHtml({ scriptUri: "vscode-webview://x/projectWebview.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" });
  eq("CSP col nonce, e lo script suo", [true, true],
    [html.includes("script-src 'nonce-abc'"), html.includes('<script type="module" nonce="abc" src="vscode-webview://x/projectWebview.js">')]);
  eq("in alto <main> (scorre), poi la barra in <footer>", true, /<main>[\s\S]*<\/main>\s*<footer class="actions">[\s\S]*<\/footer>/.test(html));
  eq("…main scorre, la barra non si restringe", [true, true], [/main \{[^}]*overflow-y: auto/.test(html), /footer \{ flex: none;/.test(html)]);
  eq("il lampo accanto a Languages, nascosto e passivo", true, /<h2>Languages <vscode-icon id="jump" name="zap" size="12" hidden><\/vscode-icon><\/h2>/.test(html));
  eq("Languages e Details nascosti finché lo stato non arriva", ["languages", "details"], [...html.matchAll(/<section id="(\w+)" hidden>/g)].map((m) => m[1]));
  eq("…due vscode-tree: le lingue senza frecce, come Config", [["langs", " hide-arrows"], ["tree", ""]],
    [...html.matchAll(/<vscode-tree id="(\w+)"( hide-arrows)?/g)].map((m) => [m[1], m[2] ?? ""]));
  eq("la barra: Sync e LLM, poi le icone refresh, vite, chiave inglese, ingranaggio", ["sync", "llm", "refresh", "openConfig", "openPluginConfig", "settings"],
    [...html.matchAll(/data-cmd="(\w+)"/g)].map((m) => m[1]));
  eq("…le icone sono codicon", ["refresh", "zap", "wrench", "settings-gear"], ICONS.map((i) => i.icon));
  eq("…icone-bottone, dopo i bottoni", true, /<div class="bottoni">[\s\S]*<\/div>\s*<div class="icone">\s*<vscode-icon data-cmd="refresh" name="refresh" action-icon/.test(html));
  eq("LLM parte col ? e il perché nel tooltip, mai disabilitato", [true, true, false],
    [html.includes(`data-cmd="llm" title="${LLM_OFF}"`), /data-cmd="llm"[^>]* icon-after="question">LLM</.test(html), /data-cmd="llm"[^>]*disabled/.test(html)]);
  eq("Sync e LLM, primari tutti e due", [["sync", "llm"], false], [ACTIONS.filter((a) => !a.secondary).map((a) => a.cmd), /<vscode-button [^>]*secondary/.test(html)]);
}

console.log("\n== Help ==");
{
  const html = helpHtml({ scriptUri: "vscode-webview://x/helpWebview.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" });
  eq("CSP col nonce, e lo script suo", [true, true],
    [html.includes("script-src 'nonce-abc'"), html.includes('<script type="module" nonce="abc" src="vscode-webview://x/helpWebview.js">')]);
  eq("i bottoni: opzioni del plugin e Close", ["openPluginConfig", "close"], [...html.matchAll(/data-cmd="(\w+)"/g)].map((m) => m[1]));
  eq("il blocco llm da copiare, e il link alla doc", [true, true], [/llm: \{\s*connection: \{/.test(html), html.includes(`href="${LLM_DOC_URL}"`)]);
}

rmSync(dir, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
