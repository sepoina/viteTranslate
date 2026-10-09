// Estensione per l'editor (idePlugin): la sezione Project (projectState.mjs, projectPage.mjs) e le
// pagine di Help (helpPage.mjs) e Settings (settingsPage.mjs, inspectorState.mjs). Lo stato: un
// messaggio finché non c'è niente da mostrare, poi le lingue (righe piatte, colore e badge); il
// bottone LLM col sottomenu o col ?. L'albero di vitetranslate, package.json e vite.config sta in
// Settings. La pagina: le due zone, le lingue che scorrono sopra e la barra dei comandi ferma sotto.
//
//   node test/list/idePluginProject.test.mjs
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectState, keyPosition, NO_PROJECTS, NO_SELECTION, READING } from "../../idePlugin/src/webViews/project/projectState.mjs";
import { ACTION_CSS, OPTIONAL_CSS } from "../../idePlugin/src/webViews/pageCommon.mjs";
import { projectHtml } from "../../idePlugin/src/webViews/project/projectPage.mjs";
import { ACTIONS, ICONS, LLM_OFF, LLM_ICON, BACK_LABEL, COMMAND_BAR_CSS, PROJECT_URL } from "../../idePlugin/src/webViews/commandBar/commandBar.mjs";
import { wrapsBelow } from "../../idePlugin/src/webViews/commandBar/commandBarScript.mjs";
import { accordionHtml, ACCORDION_CSS } from "../../idePlugin/src/webViews/accordion/accordion.mjs";
import { rememberAccordions } from "../../idePlugin/src/webViews/accordion/accordionScript.mjs";
import { TOOLTIP_CSS, tooltipHtml } from "../../idePlugin/src/webViews/tooltip/tooltip.mjs";
import { placeTooltip, adoptTitle } from "../../idePlugin/src/webViews/tooltip/tooltipScript.mjs";
import { selectorHtml } from "../../idePlugin/src/webViews/selector/selectorPage.mjs";
import { helpHtml, LLM_DOC_URL } from "../../idePlugin/src/webViews/optional/help/helpPage.mjs";
import { inspectorState, versionsState, olderThan } from "../../idePlugin/src/webViews/optional/settings/inspectorState.mjs";
import { LIB_MIN, IDE_API_MIN } from "../../idePlugin/src/probes/markedScan.mjs";
import { settingsHtml, SECTIONS, VERSION_ROWS } from "../../idePlugin/src/webViews/optional/settings/settingsPage.mjs";
import { llmHtml } from "../../idePlugin/src/webViews/optional/llm/llmPage.mjs";
import { libraryHtml, libraryState } from "../../idePlugin/src/webViews/optional/library/libraryPage.mjs";
import { loadingHtml, FIRST_STEP } from "../../idePlugin/src/webViews/optional/loading/loadingPage.mjs";

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
  eq("nessun progetto nel workspace", [NO_PROJECTS, null], ((s) => [s.message, s.languages])(projectState({ hasProjects: false, project: null })));
  eq("nessuno selezionato", [NO_SELECTION, null], ((s) => [s.message, s.title])(projectState({ hasProjects: true, project: null, title: "x" })));
  eq("lettura non arrivata: mai le righe di prima", [READING, "app", null], ((s) => [s.message, s.title, s.languages])(projectState({ hasProjects: true, project, title: "app" })));
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

console.log("\n== Settings: lo stato dell'albero ==");
{
  eq("Project non ha più l'albero", false, "details" in projectState({ hasProjects: true, project, title: "app", dati }));
  const s = inspectorState({ hasProjects: true, project, title: "app", dati });
  eq("l'albero: vitetranslate, package.json, vite.config", ["vitetranslate", "package.json", "vite.config.js"], s.details.map((n) => n.label));
  eq("id: il percorso delle etichette", `${dir}/vitetranslate/sourceLanguage`, s.details[0].children[0].id);
  eq("package.json: si apre col clic", join(dir, "package.json"), s.details[1].open);
  eq("una foglia non ha children", undefined, s.details[0].children[0].children);
  const rami = (nodi) => nodi.flatMap((n) => (n.children ? [[n.label, n.expanded], ...rami(n.children)] : []));
  const conLlm = { ...dati, probe: { ...probe, vitetranslate: { ...probe.vitetranslate, llm: { connection: { baseURL: "https://x/v1", model: "m", apiKeyEnv: "K" } } } } };
  eq("tutto chiuso: ogni riga coi figli, a ogni livello", [["vitetranslate", false], ["llm", false], ["package.json", false], ["vite.config.js", false]],
    rami(inspectorState({ hasProjects: true, project, title: "app", dati: conLlm }).details));
  eq("niente messaggio, il titolo del progetto", [null, "app"], [s.message, s.title]);
  eq("i messaggi di Project, senza albero", [[NO_PROJECTS, null], [NO_SELECTION, null], [READING, null]],
    [inspectorState({ hasProjects: false, project: null }), inspectorState({ hasProjects: true, project: null }), inspectorState({ hasProjects: true, project, title: "app" })].map((x) => [x.message, x.details]));
}

console.log("\n== Settings: il logo e VERSION ==");
{
  eq("olderThan: major.minor.patch, l'rc vale la versione", [true, false, false, true, false],
    [olderThan("4.6.3", "4.6.4"), olderThan("4.6.4-rc.3", "4.6.4"), olderThan("4.10.0", "4.6.4"), olderThan("3.99.99", "4.6.4"), olderThan("5.0.0", "4.6.4")]);
  const lib = (library, selected) => versionsState({ library, selected }).library;
  eq("la libreria: installata, vecchia, mancante, nessun progetto", [["4.7.0", false], ["4.6.3", true], ["not installed", true], ["—", false]],
    [lib("4.7.0"), lib("4.6.3"), lib(null), lib(null, false)].map((v) => [v.text, v.old]));
  eq("…la vecchia dice la minima nel fumetto", true, lib("4.6.3").tip.includes(LIB_MIN));
  const ide = (marked, selected) => versionsState({ library: "4.7.0", marked, selected }).ide;
  eq("l'IDE_API: dalla scansione, vecchia, assente, illeggibile, non ancora scansionato, nessun progetto",
    [[String(IDE_API_MIN), false], [String(IDE_API_MIN - 1), true], ["none", true], ["none", true], ["?", true], ["—", false], ["—", false]],
    [ide({ ok: true, ideApi: IDE_API_MIN }), ide({ ok: false, code: "TOO_OLD", ideApi: IDE_API_MIN - 1 }), ide({ ok: false, code: "TOO_OLD" }),
      ide({ ok: false, code: "NO_LIBRARY" }), ide({ ok: false, code: "UNREADABLE_LIBRARY" }), ide(null), ide(null, false)].map((v) => [v.text, v.old]));
  eq("…la vecchia dice la minima nel fumetto", true, ide({ ok: false, code: "TOO_OLD", ideApi: IDE_API_MIN - 1 }).tip.includes(`Older than ${IDE_API_MIN}`));
  eq("l'estensione: la sua versione, o un trattino", ["1.2.3", "—"], [versionsState({ extension: "1.2.3" }).extension, versionsState().extension]);
  eq("inspectorState porta le versioni, anche senza lettura", ["4.7.0", "1.2.3", String(IDE_API_MIN)],
    ((v) => [v.library.text, v.extension, v.ide.text])(inspectorState({ hasProjects: true, project, title: "app", cli: "4.7.0", extension: "1.2.3", marked: { ok: true, ideApi: IDE_API_MIN } }).versions));
  const html = settingsHtml({ scriptUri: "s.js", codiconsUri: "c.css", cspSource: "x", nonce: "n" });
  eq("la pagina: in testa solo il logo, poi Config, poi Version", [true, false, true],
    [/<header class="testata">\s*<svg class="logo"[^]*?<\/svg>\s*<\/header>\s*<section>\s*<h2>Config/.test(html), html.includes('id="cliVersion"'),
      /<h2>Config<\/h2>[^]*<section id="versions">\s*<h2>Version<\/h2>/.test(html)]);
  eq("VERSION: quattro righe, nell'ordine", ["VS Code extension", "Project library", "Min. required by extension", "IDE API present/required"], VERSION_ROWS.map((r) => r.title));
  eq("…i posti per lo stato e le minime, fisse", [true, true, true, true, true, true],
    [...["extensionVersion", "libraryVersion", "ideVersion", "libraryRow", "ideRow"].map((id) => html.includes(`id="${id}"`)),
      html.includes(`<span class="valore">${LIB_MIN}</span>`) && html.includes(`<span id="ideVersion">—</span>/${IDE_API_MIN}</span>`)]);
}

console.log("\n== le pagine facoltative: più aria sopra i capitoli ==");
{
  const p = { scriptUri: "s.js", codiconsUri: "c.css", cspSource: "x", nonce: "n" };
  eq("h2 a 22px (OPTIONAL_CSS) in Help, LLM, Settings e Library", [true, [true, true, true, true]],
    [OPTIONAL_CSS.includes("h2 { margin-top: 22px; }"), [helpHtml, llmHtml, settingsHtml, libraryHtml].map((f) => f(p).includes(OPTIONAL_CSS))]);
}

console.log("\n== Loading: l'avvio ==");
{
  const html = loadingHtml({ scriptUri: "s.js", codiconsUri: "c.css", cspSource: "x", nonce: "n" });
  eq("il logo, e la prima tappa con la rotella, prima ancora dello stato", [true, true],
    [/<main id="loading"[^>]*>\s*<svg class="logo"/.test(html), html.includes(`<vscode-icon name="loading" spin></vscode-icon><span id="loadingText">${FIRST_STEP}</span>`)]);
  eq("niente barra dei comandi, niente sfondo tinto, lo script col nonce", [false, false, true],
    [html.includes("<footer"), html.includes(OPTIONAL_CSS.trim()), html.includes('<script type="module" nonce="n" src="s.js">')]);
}

console.log("\n== Library: il guasto della libreria ==");
{
  const stato = (code, extra = {}, preview = false) => libraryState({ title: "app", dir: join("/", "p"), marked: { ok: false, code, error: "riga uno\nriga due", ...extra }, preview });
  const manca = stato("NO_LIBRARY");
  eq("manca: il comando, il nome del progetto, dove", ["npm install @sepoina/vitetranslate@latest", true, `Run it in ${join("/", "p")}, then Check again.`, "app"],
    [manca.library.command, manca.library.intro.startsWith("app "), manca.library.where, manca.title]);
  eq("vecchia e illeggibile: lo stesso comando, con la versione installata", [["npm install @sepoina/vitetranslate@latest", true], ["npm install @sepoina/vitetranslate@latest", true]],
    [stato("TOO_OLD", { version: "4.6.3" }), stato("UNREADABLE_LIBRARY", { version: "4.6.4" })].map((s, i) => [s.library.command, s.library.intro.includes(["4.6.3", "4.6.4"][i])]));
  eq("…troppo vecchia dice la minima", true, stato("TOO_OLD", { version: "4.6.3" }).library.intro.includes(`${LIB_MIN} or later`));
  eq("estensione in preview: il tag next", "npm install @sepoina/vitetranslate@next", stato("TOO_OLD", { version: "4.6.3" }, true).library.command);
  eq("…l'errore, solo la prima riga", "riga uno", manca.library.detail);
  const html = libraryHtml({ scriptUri: "s.js", codiconsUri: "c.css", cspSource: "x", nonce: "n" });
  eq("la pagina: niente Back, Check again e l'ingranaggio, i posti per i testi", [false, true, true, true],
    [html.includes('data-cmd="close"'), html.includes('data-cmd="refresh"'), html.includes('data-cmd="settings"'),
      ["library", "libHeading", "libIntro", "libCommand", "libWhere", "libDetail"].every((id) => html.includes(`id="${id}"`))]);
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
  eq("Translations, col cuore accanto (nascosto) e subito le lingue", true,
    /<h2>Translations <span id="jump" class="suggerito" role="img" hidden><vscode-icon name="heart-filled" size="12"><\/vscode-icon>[\s\S]*?<\/h2>\s*<vscode-tree id="langs"/.test(html));
  eq("…nel colore del titolo; batte (scale), ma non con le animazioni ridotte", [true, true, true],
    [/#jump vscode-icon \{[^}]*color: var\(--vscode-chat-linesAddedForeground\)/.test(html), /@keyframes battito \{[^@]*scale\(1\.4\)/.test(html),
      /prefers-reduced-motion: reduce\) \{ #jump\.nuovo vscode-icon \{ animation: none; \}/.test(html)]);
  eq("…il tooltip di tooltip.mjs: tre righe, la chiave in mezzo in rilievo", ["Click a translation file to open it at", "the entry picked in Results", true],
    ((m) => [m?.[1], m?.[2], html.includes(TOOLTIP_CSS)])(
      /<span class="fumetto" aria-hidden="true"><span>([^<]+)<\/span><span id="jumpKey" class="rilievo"><\/span><span>([^<]+)<\/span><\/span>/.exec(html)));
  eq("Languages nascosta finché lo stato non arriva, e niente Details", ["languages"], [...html.matchAll(/<section id="(\w+)" hidden>/g)].map((m) => m[1]));
  eq("…un vscode-tree: le lingue senza frecce, come Config", [["langs", " hide-arrows"]],
    [...html.matchAll(/<vscode-tree id="(\w+)"( hide-arrows)?/g)].map((m) => [m[1], m[2] ?? ""]));
  eq("la barra: Sync e LLM, poi le icone GitHub, ingranaggio (Settings), refresh", ["sync", "llm", "github", "settings", "refresh"],
    [...html.matchAll(/data-cmd="(\w+)"/g)].map((m) => m[1]));
  eq("…tutte codicon: GitHub è github-inverted, niente più logo in linea", [["github-inverted", "settings-gear", "refresh"], false],
    [ICONS.map((i) => i.icon), html.includes('class="logo"')]);
  const manifesto = JSON.parse(readFileSync(new URL("../../idePlugin/package.json", import.meta.url), "utf8"));
  eq("…GitHub apre la homepage del manifest", manifesto.homepage.replace(/#.*$/, ""), PROJECT_URL);
  eq("…icone-bottone, dopo i bottoni", true, /<div class="bottoni">[\s\S]*<\/div>\s*<div class="icone">\s*<vscode-icon data-cmd="github" name="github-inverted" action-icon/.test(html));
  eq("LLM parte col ? e il perché nel tooltip, mai disabilitato", [true, true, false],
    [html.includes(`data-cmd="llm" title="${LLM_OFF}"`), /data-cmd="llm"[^>]* icon-after="question">LLM</.test(html), /data-cmd="llm"[^>]*disabled/.test(html)]);
  eq("Sync e LLM, primari tutti e due", [["sync", "llm"], false], [ACTIONS.filter((a) => !a.secondary).map((a) => a.cmd), /<vscode-button [^>]*secondary/.test(html)]);
}

console.log("\n== il tooltip ==");
{
  eq("colori invertiti: sfondo il testo del pannello, testo il suo sfondo; il bordo dell'alto contrasto", [true, true, true],
    [/\.fumetto\.mobile \{[^}]*color: var\(--vscode-sideBar-background, var\(--vscode-editor-background\)\);\s*background: var\(--vscode-foreground\);/.test(TOOLTIP_CSS),
      /border: 1px solid var\(--vscode-contrastBorder, transparent\)/.test(TOOLTIP_CSS), /\.fumetto\.mobile \{[^}]*flex-direction: column; align-items: center;[^}]*text-align: center;/.test(TOOLTIP_CSS)]);
  eq("…un fumetto solo, fisso, sopra a tutto, che non prende i clic; i \\n vanno a capo; i modelli nascosti", [true, true, true],
    [/\.fumetto\.mobile \{[^}]*position: fixed;[^}]*pointer-events: none/.test(TOOLTIP_CSS), /white-space: pre-line/.test(TOOLTIP_CSS), TOOLTIP_CSS.includes(".suggerito > .fumetto { display: none; }")]);
  eq("tooltipHtml: righe di testo (escape), una con id e rilievo", '<span class="fumetto" aria-hidden="true"><span>a &lt;b&gt;</span><span id="k" class="rilievo">x</span><span></span></span>',
    tooltipHtml(["a <b>", { id: "k", strong: true, text: "x" }, { text: "" }]));

  // Dove va: sotto, da sinistra; sopra se sotto non c'è posto (la barra dei comandi); mai fuori.
  const finestra = { width: 300, height: 400 };
  const fumetto = { width: 120, height: 40 };
  eq("placeTooltip: sotto l'elemento, allineato a sinistra", { left: 20, top: 34, above: false }, placeTooltip({ left: 20, top: 10, bottom: 30 }, fumetto, finestra));
  eq("…in fondo alla pagina: sopra", { left: 20, top: 326, above: true }, placeTooltip({ left: 20, top: 370, bottom: 390 }, fumetto, finestra));
  eq("…verso il bordo destro: rientra", 174, placeTooltip({ left: 280, top: 10, bottom: 30 }, fumetto, finestra).left);
  eq("…nessun posto né sotto né sopra: sotto", false, placeTooltip({ left: 0, top: 20, bottom: 380 }, fumetto, finestra).above);

  // Il title diventa data-tip (e aria-description): quello nativo non parte. Vuoto: niente tooltip.
  const elemento = (title) => {
    const a = new Map(title === undefined ? [] : [["title", title]]);
    return { a, getAttribute: (k) => a.get(k) ?? null, setAttribute: (k, v) => a.set(k, v), removeAttribute: (k) => a.delete(k) };
  };
  const conTitolo = elemento("Run the sync");
  adoptTitle(conTitolo);
  eq("adoptTitle: il title diventa data-tip e aria-description", [["data-tip", "Run the sync"], ["aria-description", "Run the sync"]], [...conTitolo.a]);
  const svuotato = elemento("");
  svuotato.a.set("data-tip", "vecchio");
  adoptTitle(svuotato);
  eq("…un title vuoto toglie il tooltip", [], [...svuotato.a]);

  // In ogni pagina: lo stile, e lo script che lo installa.
  const p = { scriptUri: "vscode-webview://x/s.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" };
  const pagine = { selector: selectorHtml(p), project: projectHtml(p), help: helpHtml(p), llm: llmHtml(p), settings: settingsHtml(p) };
  eq("tutte le pagine hanno lo stile del fumetto", Object.keys(pagine), Object.entries(pagine).filter(([, h]) => h.includes(TOOLTIP_CSS)).map(([k]) => k));
  const script = (f) => readFileSync(new URL(`../../idePlugin/src/webViews/${f}`, import.meta.url), "utf8");
  eq("…e tutti gli script lo installano", [true, true, true],
    ["selector/webview.mjs", "project/projectWebview.mjs", "optional/optionalWebview.mjs"].map((f) => /^installTooltips\(\);/m.test(script(f))));
}

console.log("\n== Help ==");
{
  const html = helpHtml({ scriptUri: "vscode-webview://x/helpWebview.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" });
  eq("CSP col nonce, e lo script suo", [true, true],
    [html.includes("script-src 'nonce-abc'"), html.includes('<script type="module" nonce="abc" src="vscode-webview://x/helpWebview.js">')]);
  eq("nella barra: Back, poi le opzioni del plugin", ["close", "openPluginConfig"], [...html.matchAll(/data-cmd="(\w+)"/g)].map((m) => m[1]));
  eq("…col fulmine, come Vite config in Settings: la chiave inglese è delle impostazioni", true, /data-cmd="openPluginConfig" icon="zap"/.test(html));
  eq("…una colonna: il testo scorre, la barra ferma", true, /<main>[\s\S]*<\/main>\s*<footer class="actions">[\s\S]*data-cmd="openPluginConfig"/.test(html));
  eq("…e lo sfondo tinto", true, html.includes("background: color-mix(in srgb, var(--vscode-sideBar-background), var(--vscode-focusBorder) 14%)"));
  eq("il blocco llm da copiare, e il link alla doc", [true, true], [/llm: \{\s*connection: \{/.test(html), html.includes(`href="${LLM_DOC_URL}"`)]);
  const guasto = helpHtml({ scriptUri: "vscode-webview://x/s.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc", trouble: true });
  const titolo = (h) => /<h2>([^<]+)<\/h2>/.exec(h)?.[1];
  eq("trouble: un altro titolo, niente Restricted Mode, rimanda a Check again", ["LLM translation is off", "LLM check failed? Go through the setup", false, true],
    [titolo(html), titolo(guasto), guasto.includes("Restricted Mode"), guasto.includes("<i>Check again</i>")]);
  eq("…gli stessi passi e la stessa barra", [true, ["close", "openPluginConfig"]],
    [/llm: \{\s*connection: \{/.test(guasto) && guasto.includes(".env.local"), [...guasto.matchAll(/data-cmd="(\w+)"/g)].map((m) => m[1])]);
}

console.log("\n== Settings: la pagina ==");
{
  const html = settingsHtml({ scriptUri: "vscode-webview://x/optionalWebview.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" });
  eq("CSP col nonce, e lo script della sezione", [true, true],
    [html.includes("script-src 'nonce-abc'"), html.includes('<script type="module" nonce="abc" src="vscode-webview://x/optionalWebview.js">')]);
  // Le voci di CONFIG, nell'ordine: [tipo, id o comando, icona, nome, dettaglio]. Gli accordion sono
  // <details> del gruppo "config", le azioni righe con role="button" e il loro data-cmd.
  const voci = [...html.matchAll(/<details class="voce" id="(\w+)" name="config">\s*<summary class="azione ciro"><vscode-icon name="([\w-]+)"><\/vscode-icon><span>([^<]+)<\/span><span class="desc">([^<]+)<\/span><\/summary>|<div class="azione ciro" role="button" tabindex="0" data-cmd="(\w+)"><vscode-icon name="([\w-]+)"><\/vscode-icon><span>([^<]+)<\/span><span class="desc">([^<]+)<\/span><\/div>/g)]
    .map((m) => (m[1] ? ["accordion", m[1], m[2], m[3], m[4]] : ["azione", m[5], m[6], m[7], m[8]]));
  eq("CONFIG: Highlight style, Vite config, Detailed config, Local file status; come le azioni di LLM", [
    true,
    ["accordion", "highlight", "symbol-color", "Highlight style", SECTIONS.highlight.detail],
    ["azione", "openPluginConfig", "zap", "Vite config", SECTIONS.vite.detail],
    ["azione", "extensionSettings", "wrench", "Detailed config", SECTIONS.detailed.detail],
    ["accordion", "status", "file-code", "Local file status", SECTIONS.status.detail],
  ], [/<section>\s*<h2>Config<\/h2>\s*<details class="voce"/.test(html), ...voci]);
  eq("…lo stile delle azioni di LLM, lo stesso", [true, true], [html.includes(ACTION_CSS), llmHtml({ scriptUri: "s", codiconsUri: "c", cspSource: "x", nonce: "n" }).includes(ACTION_CSS)]);
  eq("…Highlight style con gli stili, Local file status con l'albero (nascosto finché lo stato non arriva)", [true, true],
    [/id="highlight"[^>]*>[\s\S]*?<div id="styles" role="radiogroup"[\s\S]*?<\/details>/.test(html), /id="status"[^>]*>[\s\S]*?<p id="message" hidden><\/p>\s*<vscode-tree id="tree" indent-guides="onHover" hidden>[\s\S]*?<\/details>/.test(html)]);
  eq("…partono chiusi: nessun open nell'HTML", false, /<details[^>]* open/.test(html));
  eq("…lo sfondo dell'editor solo nel campione", [1, true],
    [html.match(/background: var\(--vscode-editor-background\)/g)?.length, /\.campione \{[^}]*background: var\(--vscode-editor-background\)/.test(html)]);
  const barraSettings = /<footer class="actions">[\s\S]*<\/footer>/.exec(html)?.[0] ?? "";
  eq("la barra: Back solo, e Return to project", [["close"], true], [[...barraSettings.matchAll(/data-cmd="(\w+)"/g)].map((m) => m[1]), barraSettings.includes(BACK_LABEL)]);
  eq("…e lo sfondo tinto", true, html.includes("background: color-mix(in srgb, var(--vscode-sideBar-background), var(--vscode-focusBorder) 14%)"));
}

console.log("\n== l'accordion ==");
{
  eq("accordionHtml: una riga-azione che si apre; nome e dettaglio con escape; il gruppo nel name",
    '<details class="voce" id="a" name="g">\n      <summary class="azione ciro"><vscode-icon name="gear"></vscode-icon><span>A &lt;b&gt;</span><span class="desc">d &amp; e</span></summary>\n      <div class="corpo">\n        <p>x</p>\n      </div>\n    </details>',
    accordionHtml({ id: "a", group: "g", title: "A <b>", icon: "gear", detail: "d & e", body: "<p>x</p>" }));
  eq("…senza gruppo, niente name", true, accordionHtml({ id: "a", title: "A", icon: "gear", detail: "d", body: "" }).startsWith('<details class="voce" id="a">'));
  eq("ACCORDION_CSS: niente marcatore del browser; la voce aperta in evidenza, come una riga selezionata", [true, true],
    [ACCORDION_CSS.includes("::-webkit-details-marker { display: none; }"),
      /\.voce\[open\] > summary\.ciro \{\s*background: var\(--vscode-list-inactiveSelectionBackground\);\s*border-left: 2px solid/.test(ACCORDION_CSS)]);
  // Lo stato degli accordion, su un documento finto: chiusi la prima volta, poi come li ha lasciati
  // l'utente; nello stesso gruppo uno aperto alla volta.
  const voce = (id, name) => {
    const d = { id, open: false, ascolti: [], getAttribute: (k) => (k === "name" ? name : null), addEventListener: (_, f) => d.ascolti.push(f) };
    return d;
  };
  const dettagli = [voce("a", "g"), voce("b", "g"), voce("c", null)];
  const documento = { querySelectorAll: () => dettagli };
  const memoria = { aperte: { b: true, c: true } };
  let salvate = 0;
  rememberAccordions(memoria, () => salvate++, documento);
  eq("rememberAccordions: riapre quelli aperti, gli altri chiusi", [false, true, true], dettagli.map((d) => d.open));
  dettagli[0].open = true;
  dettagli[0].ascolti.forEach((f) => f());
  eq("…aprirne uno chiude l'altro del gruppo, non quelli fuori; si salva", [[true, false, true], true, 1],
    [dettagli.map((d) => d.open), memoria.aperte.a, salvate]);
}

console.log("\n== la barra dei comandi: una sola ==");
{
  const p = { scriptUri: "vscode-webview://x/s.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" };
  const project = projectHtml(p);
  const facoltative = { help: helpHtml(p), llm: llmHtml(p), settings: settingsHtml(p) };
  const barra = (html) => /<footer class="actions">[\s\S]*<\/footer>/.exec(html)?.[0] ?? "";
  const sinistra = (html) => /<div class="bottoni">([\s\S]*?)<\/div>/.exec(barra(html))?.[1] ?? "";
  const destra = (html) => /<div class="icone">([\s\S]*?)<\/div>/.exec(barra(html))?.[1] ?? "";
  const tutte = [project, ...Object.values(facoltative)];
  eq("lo stesso stile in Project e nelle pagine facoltative", [true, true, true, true], tutte.map((h) => h.includes(COMMAND_BAR_CSS)));
  eq("…e una barra sola per pagina", [1, 1, 1, 1], tutte.map((h) => h.match(/<footer/g).length));
  eq("a sinistra Back, poi i comandi della pagina", { help: ["close", "openPluginConfig"], llm: ["close", "recheck", "help"], settings: ["close"] },
    Object.fromEntries(Object.entries(facoltative).map(([k, h]) => [k, [...sinistra(h).matchAll(/data-cmd="(\w+)"/g)].map((m) => m[1])])));
  eq("…tutti primari, come Sync", [false, false, false], Object.values(facoltative).map((h) => /secondary/.test(barra(h))));
  eq("a destra l'icona della pagina", { help: "question", llm: "sparkle", settings: "settings-gear" },
    Object.fromEntries(Object.entries(facoltative).map(([k, h]) => [k, /<vscode-icon class="pagina" name="([\w-]+)"/.exec(destra(h))?.[1]])));
  eq("…preceduta da Return to project solo se Back è solo (Settings)", { help: false, llm: false, settings: true },
    Object.fromEntries(Object.entries(facoltative).map(([k, h]) => [k, new RegExp(`<span class="ritorno">${BACK_LABEL}</span>\\s*<vscode-icon class="pagina"`).test(destra(h))])));
  eq("Project: niente Back né scritta", [false, false], [barra(project).includes('data-cmd="close"'), barra(project).includes(BACK_LABEL)]);

  // Stretta, la barra va a capo: le icone sulla seconda riga, tutta loro, margini ampi, spazi uguali.
  eq("wrapsBelow: icone accanto ai bottoni, no; sotto, sì", [false, false, true],
    [wrapsBelow({ top: 10, height: 26 }, { top: 12 }), wrapsBelow({ top: 10, height: 26 }, { top: 22 }), wrapsBelow({ top: 10, height: 26 }, { top: 42 })]);
  eq("…a capo: la riga intera, margini al 10%, distribuite; nelle facoltative centrate", [true, true],
    [/\.actions\.a-capo \.icone \{[^}]*flex: 1 1 100%;[^}]*padding: 0 10%; justify-content: space-between;/.test(COMMAND_BAR_CSS),
      COMMAND_BAR_CSS.includes(".actions.a-capo .icone:has(> .pagina) { justify-content: center; }")]);
  const sorgente = (f) => readFileSync(new URL(`../../idePlugin/src/webViews/${f}`, import.meta.url), "utf8");
  eq("…la misura la installano le pagine con la barra", [true, true],
    ["project/projectWebview.mjs", "optional/optionalWebview.mjs"].map((f) => /^watchCommandBar\(\);/m.test(sorgente(f))));
}

rmSync(dir, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
