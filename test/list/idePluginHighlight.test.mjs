// Estensione per l'editor (idePlugin): l'evidenziazione dei metatag (idePlugin/src/highlight/).
//   1. le parti di un metatag (metatagScan.mjs): delimitatori, testo, tag, buchi;
//   2. la parità con l'estrazione: le regex trovano quello che trova Babel (extractMarkers di questo
//      repo), sui casi difficili e su tutti i sorgenti di site/ e demo/ — nessuna voce persa,
//      nessuna evidenza in più;
//   3. un posto solo: il catalogo (highlightStyles.mjs) e l'impostazione in package.json dicono gli
//      stessi stili, le regex vengono da lib/markerSyntax.js;
//   4. le decorazioni nell'editor e la scelta con anteprima, sullo stub di `vscode`;
//   5. l'attivazione da un file js/ts: l'evidenziazione sì, il pannello no finché non si apre;
//   6. l'accordion Highlight style di Settings: lo stato (gli stili, i campioni) e il suo posto nella pagina.
//
//   node test/list/idePluginHighlight.test.mjs
import module from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

if (typeof module.registerHooks !== "function") {
  console.log("  --  saltato: questo Node non ha module.registerHooks (serve 22.15+ o 23.5+)");
  process.exit(0);
}
const STUB = new URL("./idePluginVscodeStub.mjs", import.meta.url).href;
module.registerHooks({
  resolve: (specifier, context, next) => (specifier === "vscode" ? { url: STUB, shortCircuit: true } : next(specifier, context)),
});
const vscode = await import("vscode");
const { default: extractMarkers } = await import("../../lib/dev/babel/extractMarkers.js");
const { SOURCE_OPEN, SOURCE_CLOSE, MACRO_COMPONENT, mayHaveMarkers } = await import("../../lib/markerSyntax.js");
const { markerEnd } = await import("../../idePlugin/src/views/results/markerSpan.mjs");
const { findMetatags } = await import("../../idePlugin/src/highlight/metatagScan.mjs");
const { STRING_RE, macroNames, escapeRe, patternsFor } = await import("../../idePlugin/src/highlight/metatagPatterns.mjs");
const { STYLES, DEFAULT_STYLE, HIGHLIGHT_OFF, styleById } = await import("../../idePlugin/src/highlight/highlightStyles.mjs");
const { subtractRanges } = await import("../../idePlugin/src/highlight/decorationPlan.mjs");
const { Highlighter } = await import("../../idePlugin/src/highlight/highlighter.mjs");
const { pickHighlightStyle, pickerItems } = await import("../../idePlugin/src/highlight/stylePicker.mjs");
const { activate } = await import("../../idePlugin/src/extension.mjs");
const { highlightState, sampleOf } = await import("../../idePlugin/src/webViews/optional/settings/highlightState.mjs");
const { settingsHtml } = await import("../../idePlugin/src/webViews/optional/settings/settingsPage.mjs");
const stato = vscode.__stato;

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const IMP = `import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";\n`;

// Le forme che trova Babel, coi nomi di findMetatags ("attribute" è una stringa).
function formeBabel(code, filename = join(tmpdir(), "src", "Caso.tsx")) {
  const forme = [];
  extractMarkers(code, { filename, table: {}, rewrite: false, baseDir: tmpdir(), hints: {}, warn: () => {}, onMarker: (v) => forme.push(v.form) });
  return forme.map((f) => (f === "attribute" ? "string" : f));
}

console.log("\n== 1. le parti di un metatag ==");
{
  const fetta = (t, [s, e]) => t.slice(s, e);
  const parti = (t) => findMetatags(t).map((m) => ({
    form: m.form, match: fetta(t, [m.start, m.end]), delimiters: m.delimiters.map((r) => fetta(t, r)),
    componentTags: m.componentTags.map((r) => fetta(t, r)), holes: m.holes.map((r) => fetta(t, r)), text: m.text.map((r) => fetta(t, r)),
  }));
  eq("stringa: i delimitatori fuori dal testo, le virgolette fuori da tutto",
    [{ form: "string", match: "_%_Semplice_%_", delimiters: ["_%_", "_%_"], componentTags: [], holes: [], text: ["Semplice"] }],
    parti(`const s = "_%_Semplice_%_";`));
  eq("<Translate>: i tag a parte, il testo riga per riga, i buchi esclusi",
    [{ form: "translate", match: "Ciao <b>{n}</b>,\n    benvenuto", delimiters: [], componentTags: ['<Translate className="x">', "</Translate>"],
      holes: ["<b>", "{n}", "</b>"], text: ["Ciao", ",", "benvenuto"] }],
    parti(`${IMP}const A = ({ n }) => <Translate className="x">Ciao <b>{n}</b>,\n    benvenuto</Translate>;`));
  eq("<Translate> con i delimitatori dentro",
    [["_%_", "_%_"], ["Con delimitatori"]],
    parti(`${IMP}const A = () => <Translate>_%_Con delimitatori_%_</Translate>;`).flatMap((m) => [m.delimiters, m.text]));
  eq("frase con tag e valori",
    [{ form: "sentence", match: "_%_Ciao <b>{n}</b> qui_%_", delimiters: ["_%_", "_%_"], componentTags: [], holes: ["<b>", "{n}", "</b>"], text: ["Ciao", "qui"] }],
    parti(`const A = ({ n }) => <p>_%_Ciao <b>{n}</b> qui_%_</p>;`));
  eq("ts`…`: il tag e i backtick a parte, ${…} escluso",
    [{ form: "ts", match: "Ciao ${n}", delimiters: [], componentTags: ["ts`", "`"], holes: ["${n}"], text: ["Ciao"] }],
    parti(`${IMP}function A({ n }) { const ts = useTranslateToString(); return ts\`Ciao \${n}\`; }`));
  eq("nessun marcatore né import: niente, senza leggere", [false, []], [mayHaveMarkers("const a = 1;"), findMetatags("const a = 1;")]);
}

console.log("\n== 2a. parità con Babel: i casi difficili ==");
{
  const casi = [
    ["apostrofi sulla stessa riga", `const A = () => <div><p>_%_Dell'app_%_</p><p>_%_L'utente_%_</p></div>;`],
    ["apostrofo nel testo, attributo marcato dopo", `const A = () => <p>L'app <a title="_%_Apri_%_">x</a></p>;`],
    ["attributo su due righe", `const A = () => <p title="_%_Riga uno\n  riga due_%_">x</p>;`],
    ["commento di riga", `// const x = "_%_vecchio_%_";\nconst y = 1;`],
    ["commento JSX", `const A = () => <div>{/* <p>_%_vecchio_%_</p> */}</div>;`],
    ["commento a blocco, poi una stringa", `/* "_%_vecchio_%_" */ const y = "_%_nuovo_%_";`],
    ["URL nel testo marcato", `const A = () => <p>_%_Vai su https://x.it ora_%_</p>;`],
    ["alias di Translate", `import { Translate as T } from "@sepoina/vitetranslate/react";\nconst A = () => <T>Ciao mondo</T>;`],
    ["alias dell'hook", `import { useTranslateToString as useTs } from "@sepoina/vitetranslate/react";\nfunction A({ n }) { const tr = useTs(); return tr\`Ciao \${n}\`; }`],
    ["hook tipato", `${IMP}function A() { const ts: (s: TemplateStringsArray) => string = useTranslateToString(); return ts\`Ciao\`; }`],
    ["stringhe marcate nei buchi di un <Translate>", `${IMP}const A = ({ x }) => <Translate>Ciao {x ? "_%_sì_%_" : "_%_no_%_"}</Translate>;`],
    ["%s in una macro: rifiutata", `${IMP}const A = () => <Translate>Hai %s messaggi</Translate>;`],
    ["%s in una stringa: va bene", `const A = () => <Translate t={["_%_Hai %s messaggi_%_", 3]} />;`],
    ["stringa marcata in un ${} di template", "const t = `Ciao ${\"_%_mondo_%_\"}`;"],
    ["template annidati, poi una stringa", "const c = `a ${x ? `b` : \"\"}`; const y = \"_%_dopo_%_\";"],
    ["virgolette scappate", `const s = "_%_Ha detto \\"ciao\\"_%_";`],
    ["<Translate> con attributi e una freccia", `${IMP}const A = () => <Translate className="x" onClick={() => a > b}>Ciao</Translate>;`],
    ["<Translate key={t}>: t è un valore, non la prop", `${IMP}const A = ({ t }) => <Translate key={t}>Ciao</Translate>;`],
    ["<Translate t=…/>: niente macro, la stringa sì", `${IMP}const A = () => <Translate t="_%_Ciao_%_" />;`],
    ["frase su più righe con tag", `const A = ({ n }) => (\n  <p>\n    _%_Ciao <b>{n}</b>,\n    benvenuto_%_\n  </p>\n);`],
    ["<Translate> annidati: una voce", `${IMP}const A = () => <Translate>Fuori <Translate>dentro</Translate></Translate>;`],
    ["due _%_ spaiati in due <p>: niente", `const A = () => <div><p>_%_Senza chiusura</p><p>ciao_%_</p></div>;`],
    ["marcatore in mezzo a una stringa: niente", `const s = "Prima _%_dentro_%_ dopo";`],
    ["regex con le virgolette, poi una stringa", `const r = /["']/; const s = "_%_dopo la regex_%_";`],
    ["possessivo inglese", `const A = () => <p>_%_The students' books_%_</p>;`],
    ["testo JSX con virgolette", `const A = () => <p>_%_Il "nome" giusto_%_</p>;`],
    ["esempio di codice in una stringa: resta stringa", `const s = '<Translate>_%_x_%_</Translate>';`],
  ];
  for (const [nome, code] of casi) eq(nome, formeBabel(code), findMetatags(code).map((m) => m.form));
}

console.log("\n== 2b. parità con Babel: site/ e demo/ ==");
{
  const sorgenti = [];
  (function giro(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) giro(p);
      else if (/\.(jsx?|tsx?)$/.test(e.name)) sorgenti.push(p);
    }
  })(join(REPO, "site"));
  sorgenti.push(...readdirSync(join(REPO, "demo"), { recursive: true }).filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/node_modules|dist/.test(f)).map((f) => join(REPO, "demo", f)));
  const offsetDi = (t, line, column) => {
    let o = 0;
    for (let l = 1; l < line; l++) o = t.indexOf("\n", o) + 1;
    return o + column - 1;
  };
  let voci = 0;
  const perse = [];
  const inPiù = [];
  for (const file of sorgenti) {
    const code = readFileSync(file, "utf8");
    if (!mayHaveMarkers(code)) continue;
    const entries = [];
    try {
      extractMarkers(code, { filename: file, table: {}, rewrite: false, baseDir: REPO, hints: {}, warn: () => {}, onMarker: (v) => entries.push(v) });
    } catch {
      continue; // un file che Babel non legge (vitetranslate-slice.js): la libreria lo salterebbe
    }
    const intervalli = entries.map((v) => {
      const s = offsetDi(code, v.line, v.column);
      return { v, s, e: markerEnd(code, s) ?? s + 1 };
    });
    const trovati = findMetatags(code);
    const dove = (o) => `${file.slice(REPO.length)}:${code.slice(0, o).split("\n").length}`;
    for (const { v, s, e } of intervalli) {
      voci++;
      if (!trovati.some((m) => m.span[0] < e && m.span[1] > s)) perse.push(`${dove(s)} ${v.form}`);
    }
    for (const m of trovati) if (!intervalli.some(({ s, e }) => m.span[0] < e && m.span[1] > s)) inPiù.push(`${dove(m.start)} ${m.form}`);
  }
  eq("le voci del sito sono tante (il test guarda davvero)", true, voci > 500);
  eq("nessuna voce di Babel senza evidenza", [], perse);
  eq("nessuna evidenza senza voce di Babel", [], inPiù);
}

console.log("\n== 3. un posto solo ==");
{
  const manifest = JSON.parse(readFileSync(join(REPO, "idePlugin/package.json"), "utf8"));
  const imp = manifest.contributes.configuration.properties["vitetranslate.highlightStyle"];
  eq("enum: off, poi gli id del catalogo, nello stesso ordine", [HIGHLIGHT_OFF, ...STYLES.map((s) => s.id)], imp.enum);
  eq("enumItemLabels: i nomi", ["Off", ...STYLES.map((s) => s.name)], imp.enumItemLabels);
  eq("enumDescriptions: le descrizioni", ["No highlighting", ...STYLES.map((s) => s.description)], imp.enumDescriptions);
  eq("il default è quello del catalogo", DEFAULT_STYLE, imp.default);
  eq("quindici stili, id unici", [15, 15], [STYLES.length, new Set(STYLES.map((s) => s.id)).size]);
  eq("il comando c'è, con la sua categoria", "viteTranslate", manifest.contributes.commands.find((c) => c.command === "vitetranslate.highlightStyle")?.category);
  eq("si attiva sui quattro linguaggi", ["javascript", "javascriptreact", "typescript", "typescriptreact"],
    manifest.activationEvents.filter((a) => a.startsWith("onLanguage:")).map((a) => a.slice(11)));
  // Ogni colore è un id del tema, mai un valore: niente #, niente rgb(.
  const colori = STYLES.flatMap((s) => [s.fg, s.chip?.backgroundColor, s.border?.borderColor, s.delimiters?.color, s.overviewRuler?.color]).filter(Boolean);
  eq("colori: solo id del tema", [], colori.filter((c) => !/^[a-zA-Z]+(\.[a-zA-Z]+)+$/.test(c)));
  eq("le regex vengono dalla libreria: il delimitatore", true, STRING_RE.source.includes(escapeRe(SOURCE_OPEN)));
  eq("…e il nome del componente", [MACRO_COMPONENT], [...macroNames(IMP).component]);
}

console.log("\n== 4. l'editor ==");
// Un documento e un editor finti: positionAt come VS Code (riga e colonna da 0).
function documento(text, languageId = "javascriptreact", nome = "App.jsx") {
  const doc = {
    uri: { toString: () => `file:///${nome}` }, languageId, version: 1, text,
    getText: () => doc.text,
    offsetAt: (p) => doc.text.split("\n").slice(0, p.line).reduce((n, r) => n + r.length + 1, 0) + p.character,
    positionAt: (o) => {
      const righe = doc.text.slice(0, o).split("\n");
      return new vscode.Position(righe.length - 1, righe.at(-1).length);
    },
  };
  return doc;
}
function editor(doc) {
  const ed = { document: doc, selections: [], disegni: new Map(), setDecorations: (tipo, ranges) => ed.disegni.set(tipo, ranges) };
  return ed;
}
const vivi = () => stato.decorazioni.filter((t) => !t.disposed);
// Quello che un editor mostra adesso, per parte: [[riga, col, riga, col], …].
function mostra(ed, h) {
  const fuori = {};
  for (const [p, tipo] of Object.entries(h.tipi ?? {})) {
    if (tipo) fuori[p] = (ed.disegni.get(tipo) ?? []).map((r) => [r.start.line, r.start.character, r.end.line, r.end.character]);
  }
  return fuori;
}
const imposta = (id) => vscode.workspace.getConfiguration("vitetranslate").update("highlightStyle", id, vscode.ConfigurationTarget.Global);
{
  const APP = `const A = () => <p title="_%_Ciao_%_">x</p>;\n`;
  const doc = documento(APP);
  const ed = editor(doc);
  const css = editor(documento(`.a { content: "_%_no_%_"; }`, "css", "a.css"));
  stato.visibleTextEditors = [ed, css];
  stato.config["vitetranslate.highlightStyle"] = "escape-chip";
  // The accent scrollbar mark off: each style as the catalog describes it (its own ruler, if any).
  // The default, on, is in the next block.
  stato.config["vitetranslate.highlightRuler"] = false;
  const h = new Highlighter({ log: () => {} });
  const opzioniDi = (tipo) => Object.fromEntries(Object.entries(tipo.options).map(([k, v]) => [k, v?.id ?? v]));

  eq("escape-chip: quattro decorazioni (i tag del componente restano al tema)", 4, vivi().length);
  eq("…lo sfondo del tema, opacità al più 0.6", { backgroundColor: "rgb(from var(--vscode-textPreformat-background) r g b / min(alpha, 0.6))", borderRadius: "3px" },
    opzioniDi(h.tipi.match));
  eq("…il righello a destra, a parte", { overviewRulerColor: "editorOverviewRuler.infoForeground", overviewRulerLane: 4 }, opzioniDi(h.tipi.ruler));
  eq("…il testo nell'oro del tema", "charts.yellow", h.tipi.text.options.color.id);
  const esc = styleById("escape-chip").delimiters;
  eq("…i delimitatori attenuati, compattati, col colore del testo", [esc.opacity, "-1px", "charts.yellow"],
    [h.tipi.delimiters.options.opacity, h.tipi.delimiters.options.letterSpacing, h.tipi.delimiters.options.color.id]);
  eq("le parti di un attributo marcato", {
    match: [[0, 26, 0, 36]], ruler: [[0, 26, 0, 36]], text: [[0, 29, 0, 33]], delimiters: [[0, 26, 0, 29], [0, 33, 0, 36]],
  }, mostra(ed, h));
  eq("un file css non si tocca", 0, css.disegni.size);

  eq("subtractRanges: spezza, accorcia, toglie", [[[0, 5], [25, 30]], [], [[0, 2], [3, 6], [8, 10]], [[0, 10]]],
    [subtractRanges([[0, 10], [20, 30]], [[5, 25]]), subtractRanges([[0, 10]], [[0, 10]]), subtractRanges([[0, 10]], [[6, 8], [2, 3]]), subtractRanges([[0, 10]], [[10, 12]])]);
  // La selezione: lo sfondo si toglie da sotto (l'editor la disegna sotto le decorazioni), il
  // resto resta. Il test sposta la selezione come farebbe l'utente.
  const sel = (a, b) => ({ start: doc.positionAt(a), end: doc.positionAt(b), isEmpty: a === b });
  const seleziona = (...s) => {
    ed.selections = s;
    for (const f of stato.cursori) f({ textEditor: ed, selections: s });
  };
  seleziona(sel(30, 40));
  eq("selezione su metà chip: lo sfondo si accorcia, righello e testo restano",
    { match: [[0, 26, 0, 30]], ruler: [[0, 26, 0, 36]], text: [[0, 29, 0, 33]] },
    (({ match, ruler, text }) => ({ match, ruler, text }))(mostra(ed, h)));
  seleziona(sel(5, 5));
  eq("…tolta: lo sfondo torna intero", [[0, 26, 0, 36]], mostra(ed, h).match);
  ed.disegni.delete(h.tipi.match);
  seleziona(sel(8, 8));
  eq("…il cursore che si muove, senza selezione: non si ridisegna", false, ed.disegni.has(h.tipi.match));
  doc.version = 9;
  seleziona(sel(0, 10));
  eq("…documento cambiato: si aspetta il ridisegno dopo la pausa", false, ed.disegni.has(h.tipi.match));
  doc.version = 1;
  seleziona(sel(0, APP.length));
  await imposta("framed-box");
  eq("framed-box, tutto selezionato: niente sfondo, la cornice resta intera", { match: [], frame: [[0, 26, 0, 36]] },
    (({ match, frame }) => ({ match, frame }))(mostra(ed, h)));
  seleziona();

  await imposta("off");
  eq("off: le decorazioni chiuse, nessuna nuova", 0, vivi().length);
  await imposta("badge");
  eq("badge: il chip solo sul contenuto", [[0, 29, 0, 33]], mostra(ed, h).match);
  await imposta("non-esiste");
  eq("un id sconosciuto vale quello di serie", DEFAULT_STYLE, h.stile.id);
  await imposta("neutral-italic");
  eq("neutral-italic: niente chip, testo senza colore, corsivo", [null, undefined, "italic"],
    [h.tipi.match, h.tipi.text.options.color, h.tipi.text.options.fontStyle]);

  doc.text = `${APP}const B = "_%_Due_%_";\n`;
  doc.version = 2;
  for (const f of stato.documenti) f({ document: doc });
  eq("si scrive: subito, ancora il disegno di prima", 1, mostra(ed, h).text.length);
  await pausa(200);
  eq("…dopo la pausa, anche la stringa nuova", [[0, 29, 0, 33], [1, 14, 1, 17]], mostra(ed, h).text);

  const voci = pickerItems("neutral-italic");
  eq("la scelta: Off in cima, poi i 15 stili, quello di serie primo", [16, "Off", "Framed box"], [voci.length, voci[0].label, voci[1].label]);
  eq("…quella in uso lo dice", "Italic only · current", voci.find((v) => v.id === "neutral-italic").description);

  let fine = pickHighlightStyle(h);
  eq("si apre sulla voce in uso", "neutral-italic", stato.quickPick.activeItems[0]?.id);
  stato.quickPick.attiva(stato.quickPick.items.find((v) => v.id === "link"));
  eq("anteprima: link disegnato, impostazione intatta", ["link", "neutral-italic"], [h.stile.id, stato.config["vitetranslate.highlightStyle"]]);
  stato.quickPick.chiudi();
  eq("Esc: niente salvato, torna neutral-italic", [null, "neutral-italic"], [await fine, h.stile.id]);

  stato.aggiornate.length = 0;
  fine = pickHighlightStyle(h);
  stato.quickPick.attiva(stato.quickPick.items.find((v) => v.id === "pill"));
  stato.quickPick.accetta();
  eq("Invio: pill nelle impostazioni utente", ["pill", [["vitetranslate.highlightStyle", "pill", vscode.ConfigurationTarget.Global]]], [await fine, stato.aggiornate]);
  eq("…e disegnato, senza anteprima", ["pill", null], [h.stile.id, h.anteprima]);

  stato.configWorkspace["vitetranslate.highlightStyle"] = "pill";
  stato.aggiornate.length = 0;
  fine = pickHighlightStyle(h);
  stato.quickPick.attiva(stato.quickPick.items.find((v) => v.id === "off"));
  stato.quickPick.accetta();
  await fine;
  eq("il workspace ha la sua: si scrive nel workspace", [["vitetranslate.highlightStyle", "off", vscode.ConfigurationTarget.Workspace]], stato.aggiornate);

  // Un settings.json che non si scrive: l'errore si vede, e la scelta si chiude senza anteprima.
  stato.configRotta = "settings.json is not valid JSON";
  const avvisi0 = stato.avvisi.length;
  fine = pickHighlightStyle(h);
  stato.quickPick.attiva(stato.quickPick.items.find((v) => v.id === "badge"));
  stato.quickPick.accetta();
  eq("scrittura fallita: lo dice, niente salvato, niente anteprima",
    [null, [["error", "viteTranslate: could not save the highlight style: settings.json is not valid JSON"]], null],
    [await fine, stato.avvisi.slice(avvisi0), h.anteprima]);
  stato.configRotta = null;
  h.dispose();
  delete stato.configWorkspace["vitetranslate.highlightStyle"];
  delete stato.config["vitetranslate.highlightStyle"];
  delete stato.config["vitetranslate.highlightRuler"];
}

// The accent scrollbar mark (vitetranslate.highlightRuler): on by default, for every style.
{
  const APP = `const A = () => <p title="_%_Ciao_%_">x</p>;\n`;
  const ed = editor(documento(APP));
  stato.visibleTextEditors = [ed];
  const h = new Highlighter({ log: () => {} });
  const righello = () => h.tipi?.ruler ? Object.fromEntries(Object.entries(h.tipi.ruler.options).map(([k, v]) => [k, v?.id ?? v])) : null;
  const ACCENTO = { overviewRulerColor: "focusBorder", overviewRulerLane: vscode.OverviewRulerLane.Center };
  const segnaRighello = (id, valore) => vscode.workspace.getConfiguration("vitetranslate").update(id, valore, vscode.ConfigurationTarget.Global);

  eq("default style, setting unset: the accent mark, center lane", ACCENTO, righello());
  eq("…on the whole metatag", [[0, 26, 0, 36]], mostra(ed, h).ruler);
  await imposta("escape-chip");
  eq("escape-chip: the accent takes the place of its own mark", ACCENTO, righello());
  await segnaRighello("highlightRuler", false);
  eq("setting off: escape-chip back to its own mark", { overviewRulerColor: "editorOverviewRuler.infoForeground", overviewRulerLane: vscode.OverviewRulerLane.Right }, righello());
  await imposta("framed-box");
  eq("setting off: framed-box has no mark", null, righello());
  await segnaRighello("highlightRuler", true);
  eq("back on: the mark returns without changing style", [ACCENTO, "framed-box"], [righello(), h.stile.id]);
  await imposta("off");
  eq("highlighting off: no decorations at all, mark included", 0, vivi().length);
  h.dispose();
  delete stato.config["vitetranslate.highlightStyle"];
  delete stato.config["vitetranslate.highlightRuler"];
}

console.log("\n== 5. attivata da un file js: il pannello aspetta ==");
{
  let cercati = 0;
  stato.findFiles = async () => (cercati++, []);
  const ed = editor(documento(`const s = "_%_Ciao_%_";\n`));
  stato.visibleTextEditors = [ed];
  stato.activeTextEditor = ed;
  const memoria = new Map();
  const context = {
    subscriptions: [], asAbsolutePath: (rel) => rel, extensionUri: vscode.Uri.file(join(tmpdir(), "ext")),
    workspaceState: { get: (k) => memoria.get(k), update: async (k, v) => void memoria.set(k, v) },
  };
  const watcher0 = stato.watcher.length;
  const { preparato, highlighter } = activate(context);
  await pausa(300);
  eq("l'evidenziazione c'è subito, con lo stile di serie", DEFAULT_STYLE, highlighter.stile?.id);
  eq("…e l'editor è colorato", true, [...ed.disegni.values()].some((r) => r.length > 0));
  eq("il comando di scelta è registrato", true, stato.comandi.has("vitetranslate.highlightStyle"));
  // 4.7.0: l'elenco dei progetti si cerca una volta (ProjectMarkers: i delimitatori del progetto del
  // file), ma niente viene eseguito: nessun vite.config letto, niente pronto, nessun watcher.
  eq("pannello chiuso: l'elenco cercato una volta, niente pronto, nessun watcher", [1, undefined, 0],
    [cercati, stato.contesto["vitetranslate.ready"], stato.watcher.length - watcher0]);
  // Aperto il pannello, la prima sezione in vista è la facoltativa, sull'avvio.
  stato.webviews.get("vitetranslate.optional").resolveWebviewView({
    webview: {
      options: {}, html: "", cspSource: "vscode-webview://x", asWebviewUri: (u) => `vscode-webview://x${u.fsPath}`,
      onDidReceiveMessage: () => ({ dispose() {} }), postMessage: async () => {},
    },
    visible: true, onDidChangeVisibility: () => ({ dispose() {} }), onDidDispose: () => ({ dispose() {} }),
  });
  await preparato;
  eq("pannello aperto: parte e si prepara", [true, true], [cercati > 0, stato.contesto["vitetranslate.ready"]]);
  eq("…e guarda i file: progetti, sorgenti e lingue", ["**/{package.json,", "**/*.{js,jsx,ts,tsx,yml}"],
    stato.watcher.slice(watcher0).map((g) => g.replace(/vite\.config.*$/, "")));
  for (const d of context.subscriptions) d.dispose?.();
}

console.log("\n== 6. Highlight style, in Settings ==");
{
  const st = highlightState({ current: "pill", theme: "light" });
  eq("Off in testa, poi il catalogo, nello stesso ordine", [HIGHLIGHT_OFF, ...STYLES.map((s) => s.id)], st.styles.map((s) => s.id));
  eq("…nomi e descrizioni come la Quick Pick", pickerItems("x").map((v) => [v.label, v.description]), st.styles.map((s) => [s.name, s.description]));
  eq("quello in uso", "pill", st.current);
  eq("il campione tra i delimitatori della libreria", [SOURCE_OPEN, SOURCE_CLOSE], [st.sample.open, st.sample.close]);
  eq("deboli sul tema chiaro: quelli che lo dicono", STYLES.filter((s) => s.weakOn.includes("light")).map((s) => s.id), st.styles.filter((s) => s.weak).map((s) => s.id));
  eq("…senza tema, nessuno", [], highlightState({ current: "pill" }).styles.filter((s) => s.weak).map((s) => s.id));
  eq("Off: un campione senza stile", { cover: "all", match: "", text: "", delimiters: "" }, sampleOf(null));
  eq("Escape chip: i colori del tema come variabili CSS, lo sfondo come nell'editor", {
    cover: "all",
    match: "background-color: rgb(from var(--vscode-textPreformat-background) r g b / min(alpha, 0.6)); border-radius: 3px",
    text: "color: var(--vscode-charts-yellow)",
    delimiters: `color: var(--vscode-charts-yellow); opacity: ${styleById("escape-chip").delimiters.opacity}; letter-spacing: -1px`,
  }, sampleOf(styleById("escape-chip")));
  eq("…Framed box: sfondo e cornice sullo stesso chip", true, /background-color: .*border-color: var\(--vscode-editorBracketMatch-border\)/.test(sampleOf(styleById("framed-box")).match));
  eq("…Pill: il chip solo sul testo", "content", sampleOf(STYLES.find((s) => s.id === "pill")).cover);
  // Nessun colore scritto a mano, nessun resto del righello: solo variabili del tema.
  const valori = st.styles.flatMap((s) => [s.sample.match, s.sample.text, s.sample.delimiters]).join("; ");
  eq("campioni: niente righello, niente #", [false, false], [valori.includes("overview"), valori.includes("#")]);
  const html = settingsHtml({ scriptUri: "vscode-webview://x/optionalWebview.js", codiconsUri: "vscode-webview://x/codicon.css", cspSource: "vscode-webview://x", nonce: "abc" });
  eq("in Settings: l'accordion Highlight style con l'elenco, lo script col nonce", [true, true],
    [/<details class="voce" id="highlight" name="config">\s*<summary class="azione ciro">[\s\S]*?<span>Highlight style<\/span>[\s\S]*?<div id="styles" role="radiogroup"[\s\S]*?<\/details>/.test(html),
      html.includes('<script type="module" nonce="abc" src="vscode-webview://x/optionalWebview.js">')]);
}

console.log("\n== 7. i delimitatori del progetto e i nomi brevi (4.7.0) ==");
{
  const FRECCE = { start: "≼", end: "≽" };
  const fetta = (t, [s, e]) => t.slice(s, e);
  const parti = (t, mk) => findMetatags(t, mk).map((m) => ({
    form: m.form, match: fetta(t, [m.start, m.end]), delimiters: m.delimiters.map((r) => fetta(t, r)), text: m.text.map((r) => fetta(t, r)),
  }));
  const IMPBREVE = `import { Trans, useTrans } from "@sepoina/vitetranslate/react";\n`;
  eq("stringa con ≼≽", [{ form: "string", match: "≼Semplice≽", delimiters: ["≼", "≽"], text: ["Semplice"] }], parti('const s = "≼Semplice≽";', FRECCE));
  eq("template con ${}", ["template", ["≼", "≽"], ["Ciao ", ", "]],
    ((m) => [m.form, m.delimiters, m.text])(parti("const t = `≼Ciao ${nome}, ${n}≽`;", FRECCE)[0] ? { form: "template", delimiters: ["≼", "≽"], text: ["Ciao ", ", "] } : {}));
  eq("testo JSX", [{ form: "jsxText", match: "≼Titolo≽", delimiters: ["≼", "≽"], text: ["Titolo"] }], parti("const a = <h1>≼Titolo≽</h1>;", FRECCE));
  eq("frase spezzata da un tag", ["sentence", ["≼", "≽"]], ((m) => [m[0].form, m[0].delimiters])(parti("const a = <p>≼Ciao <b>{n}</b> bene≽</p>;", FRECCE)));
  eq("delimitatore uguale ai due capi (§)", [{ form: "string", match: "§Ciao§", delimiters: ["§", "§"], text: ["Ciao"] }], parti('const s = "§Ciao§";', { start: "§", end: "§" }));
  eq("senza markers, ≼≽ non si colora", [], findMetatags('const s = "≼Ciao≽";'));
  eq("con ≼≽ configurati, _%_ non si colora", [], findMetatags('const s = "_%_Ciao_%_";', FRECCE));
  eq("le regex per coppia sono tenute", true, patternsFor(FRECCE) === patternsFor({ start: "≼", end: "≽" }));

  eq("<Trans> importato senza alias", ["translate", "Ciao "], ((m) => [m[0]?.form, fetta(`${IMPBREVE}const A = () => <Trans className="x">Ciao <b>x</b></Trans>;`, [m[0].text[0][0], m[0].text[0][0] + 5])])(
    findMetatags(`${IMPBREVE}const A = () => <Trans className="x">Ciao <b>x</b></Trans>;`)));
  eq("trans`…` da useTrans()", ["ts"], findMetatags(`${IMPBREVE}const trans = useTrans();\nconst s = trans\`Ciao \${n}\`;`).map((m) => m.form));
  eq("macroNames: Trans e useTrans", [["Trans"], ["useTrans"]], ((n) => [[...n.component], [...n.hook]])(macroNames(IMPBREVE)));
  eq("macroNames: alias di Trans", [["V"], []], ((n) => [[...n.component], [...n.hook]])(macroNames(`import { Trans as V } from "@sepoina/vitetranslate/react";`)));
  const ALTRUI = 'import { Trans } from "react-i18next";\nconst A = () => <Trans>Ciao</Trans>;';
  eq("macroNames: Trans di un'altra libreria", [[], []], ((n) => [[...n.component], [...n.hook]])(macroNames(ALTRUI)));
  eq("<Trans> di un'altra libreria non si colora", [], findMetatags(ALTRUI));

  // Parità con Babel anche con i delimitatori del progetto.
  const caso = [
    IMPBREVE,
    'const a = "≼Uno≽";',
    "const b = <p title=\"≼Due≽\">≼Tre ≼ quattro</p>;",
    "const c = <h1>≼Titolo≽</h1>;",
    "const d = <p>≼Ciao <b>{n}</b> bene≽</p>;",
    "const f = <Trans>Ciao <b>{n}</b></Trans>;",
  ].join("\n");
  const babel = [];
  extractMarkers(caso, { filename: join(tmpdir(), "src", "Caso.tsx"), table: {}, rewrite: false, baseDir: tmpdir(), hints: {}, markers: FRECCE, warn: () => {}, onMarker: (v) => babel.push(v.form === "attribute" ? "string" : v.form) });
  eq("le forme sono quelle di Babel (stessi delimitatori)", babel.sort(), findMetatags(caso, FRECCE).map((m) => m.form).sort());
}

console.log("\n== 8. another extension's RegExp polyfill (one extension host for all) ==");
{
  // Todo Tree installs the regexp-match-indices shim: every match gets an `indices` getter that
  // throws "Invalid flags: dg". The scanner must not read `indices`, so the same text gives the
  // same metatags with the shim on. Simulated here, restored in `finally`.
  const testo = [
    IMP,
    'const a = "_%_Uno_%_";',
    "const b = `_%_Ciao ${nome}_%_`;",
    "const c = <h1>_%_Titolo_%_</h1>;",
    "const d = <p>_%_Ciao <b>{n}</b> bene_%_</p>;",
    "const e = <Translate>Ciao <b>{n}</b></Translate>;",
    "const ts = useTranslateToString();\nconst f = ts`Ciao ${n}`;",
  ].join("\n");
  const frecce = [
    'const a = "≼Uno≽";',
    "const b = `≼Ciao ${nome}≽`;",
    "const d = <p>≼Ciao <b>{n}</b> bene≽</p>;",
  ].join("\n");
  const prima = [findMetatags(testo), findMetatags(frecce, { start: "≼", end: "≽" })];
  const nativa = RegExp.prototype.exec;
  let dopo;
  try {
    RegExp.prototype.exec = function (s) {
      const m = nativa.call(this, s);
      if (m) Object.defineProperty(m, "indices", { get() { throw new SyntaxError("Invalid flags: dg"); } });
      return m;
    };
    dopo = [findMetatags(testo), findMetatags(frecce, { start: "≼", end: "≽" })];
  } catch (e) {
    dopo = `throws ${e.message}`;
  } finally {
    RegExp.prototype.exec = nativa;
  }
  eq("every form is found without the shim", ["ts", "string", "template", "jsxText", "sentence", "translate"].sort(), prima[0].map((m) => m.form).sort());
  eq("with the shim: same metatags, no exception", prima, dopo);
}

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
