// Estensione per l'editor (idePlugin): la sezione Marked. La sonda delle voci (markedProbe.mjs,
// lanciata da runProbe.mjs) su progetti veri in una cartella temporanea, con la libreria di questo
// repo linkata in node_modules; poi le righe (markedRows.mjs) sui casi che un progetto vero
// produce di rado: errori, libreria senza righe, testi lunghi o ripetuti.
//
//   node test/list/idePluginMarked.test.mjs
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import runProbe from "../../idePlugin/src/probes/runProbe.mjs";
import { ScanWorker } from "../../idePlugin/src/probes/scanWorker.mjs";
import { IDE_API } from "../../lib/ide/scan.js";
import { markedInput, markedChildren, markedSummary, glyphsOf, filterItems, PASSED, loadingRow, frozenRows, searchFiles, shownCount } from "../../idePlugin/src/views/results/markedRows.mjs";
import { pathKey } from "../../idePlugin/src/core/pickProject.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const PROBE = fileURLToPath(new URL("../../idePlugin/src/probes/markedProbe.mjs", import.meta.url));
const REPO = fileURLToPath(new URL("../../", import.meta.url));
const radice = mkdtempSync(join(tmpdir(), "vt-idemarked-"));
const scrivi = (rel, testo) => {
  mkdirSync(dirname(join(radice, rel)), { recursive: true });
  writeFileSync(join(radice, rel), testo, "utf8");
};
const conLibreria = (nome) => {
  mkdirSync(join(radice, nome, "node_modules/@sepoina"), { recursive: true });
  symlinkSync(REPO, join(radice, nome, "node_modules/@sepoina/vitetranslate"), "junction");
};
const sonda = (nome, input) => runProbe({ dir: join(radice, nome), probePath: PROBE, args: [JSON.stringify(input)], what: "the source scan" });

console.log("\n== sonda: macro, localeDir esclusa, baseDir, autoWrap come RegExp descritta ==");
{
  conLibreria("app");
  scrivi("app/web/src/Page.jsx", `import { Translate } from "@sepoina/vitetranslate/react";
export const Page = ({ n }) => (
  <div>
    <Translate>Hai {n} messaggi</Translate>
    <p>_%_Ciao_%_</p>
  </div>
);
`);
  scrivi("app/web/src/plain.js", "export const nulla = 1;\n");
  scrivi("app/web/src/locale/old.js", 'export default { a: "_%_residuo_%_" };\n');
  const r = await sonda("app", { baseDir: "web", srcDir: "src", localeDir: "src/locale", autoWrap: { $regexp: "/^p$/i" } });
  eq("ok", true, r.ok);
  eq("file letti: localeDir esclusa", 2, r.scanned);
  eq("solo i file marcati, rel da baseDir", ["src/Page.jsx"], r.files.map((f) => f.rel));
  eq("macro e marcatore, con le righe", [["Hai {n} messaggi", 4], ["Ciao", 5]], r.files[0].entries.map((e) => [e.text, e.line]));
  eq("…e la forma di ciascuno", ["translate", "jsxText"], r.files[0].entries.map((e) => e.form));
  eq("versione della libreria", true, typeof r.version === "string" && r.version.length > 0);
  eq("letta dall'export ./ide/scan", IDE_API, r.ideApi);
}

console.log("\n== sonda: libreria senza ./ide/scan, letta per percorso ==");
{
  // Una libreria pubblicata prima dell'export: il suo package.json non lo dichiara, lib/ è quella del repo.
  const pkg = join(radice, "vecchia/node_modules/@sepoina/vitetranslate");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@sepoina/vitetranslate", version: "4.6.4-rc.2", type: "module", exports: { "./package.json": "./package.json" } }));
  symlinkSync(join(REPO, "lib"), join(pkg, "lib"), "junction");
  scrivi("vecchia/src/A.jsx", "export const A = () => <p>_%_Ciao_%_</p>;\n");
  const r = await sonda("vecchia", { baseDir: ".", srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT", autoWrap: false });
  eq("ok, senza api, la sua versione", [true, null, "4.6.4-rc.2"], [r.ok, r.ideApi, r.version]);
  eq("la voce, con la riga", [["Ciao", 1]], r.files?.[0]?.entries.map((e) => [e.text, e.line]));
}

console.log("\n== sonda: IDE_API sotto il minimo ==");
{
  const pkg = join(radice, "troppoVecchia/node_modules/@sepoina/vitetranslate");
  mkdirSync(join(pkg, "ide"), { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@sepoina/vitetranslate", version: "9.0.0", type: "module", exports: { "./ide/scan": "./ide/scan.js", "./package.json": "./package.json" } }));
  writeFileSync(join(pkg, "ide/scan.js"), "export const IDE_API = 0;\n");
  scrivi("troppoVecchia/src/A.jsx", "export const A = () => <p>_%_Ciao_%_</p>;\n");
  const r = await sonda("troppoVecchia", { baseDir: ".", srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT", autoWrap: false });
  eq("TOO_OLD, con la versione nel messaggio", [false, "TOO_OLD", true], [r.ok, r.code, String(r.error).includes("9.0.0")]);
}

console.log("\n== sonda: i problemi di ogni voce ==");
{
  conLibreria("stati");
  scrivi("stati/src/S.jsx", `export const S = () => (
  <div>
    <p>_%_Uno_%_</p>
    <p>_%_Due_%_</p>
    <p>_%_Tre_%_</p>
    <p>_%_Quattro_%_</p>
    <p title="_%_spaiato">x</p>
  </div>
);
`);
  const input = { srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT" };
  const vuoto = await sonda("stati", input);
  eq("senza file di lingua: tutte da sincronizzare", [true, true, true, true],
    vuoto.files[0].entries.filter((e) => e.id).map((e) => e.problems[0].kind === "notSynced"));
  const [uno, due, tre, quattro] = vuoto.files[0].entries.filter((e) => e.id).map((e) => e.id);
  const yml = (righe) => righe.map(([k, v]) => `${k}: ${v === null ? "null" : JSON.stringify(v)}`).join("\n") + "\n";
  scrivi("stati/locale/it-IT.yml", yml([[uno, "Uno"], [due, "Due"], [tre, "Tre"], [quattro, "Quattro"]]));
  scrivi("stati/locale/en-US.yml", yml([[uno, "One"], [due, null], [tre, null], [quattro, "Four"]]));
  scrivi("stati/locale/fr-FR.yml", yml([[uno, "Un"], [due, "Deux"], [tre, null]]));
  const r = await sonda("stati", input);
  eq("lingue lette", { source: "it-IT", targets: ["en-US", "fr-FR"] }, { source: r.languages.source, targets: r.languages.targets });
  eq("per lingua: voci della sorgente e quante mancano (null o assenti)",
    [{ keys: 4, missing: 0 }, { keys: 4, missing: 2 }, { keys: 4, missing: 2 }], ["it-IT", "en-US", "fr-FR"].map((t) => r.languages.stats[t]));
  scrivi("stati/locale/de-DE.yml", "a: [rotto\n");
  const conRotto = await sonda("stati", input);
  eq("una tabella che non si legge: il perché, e non è fra le destinazioni", [true, false],
    [typeof conRotto.languages.stats["de-DE"]?.error === "string", conRotto.languages.targets.includes("de-DE")]);
  rmSync(join(radice, "stati/locale/de-DE.yml"));
  const per = Object.fromEntries(r.files[0].entries.map((e) => [e.text.slice(0, 12), e.problems.map((p) => `${p.kind}:${Array.isArray(p.detail) ? p.detail.join("+") : "…"}`)]));
  eq("tradotta ovunque: nessun problema", [], per.Uno);
  eq("manca in una lingua: notFullyTranslated", ["notFullyTranslated:en-US"], per.Due);
  eq("manca in tutte: untranslated", ["untranslated:en-US+fr-FR"], per.Tre);
  eq("assente da un file: notSynced", ["notSynced:fr-FR"], per.Quattro);
  const spaiato = r.files[0].entries.find((e) => e.id === null);
  eq("marcatore spaiato: voce senza chiave, malformed, con la riga", ["malformed", 7], [spaiato?.problems[0].kind, spaiato?.line]);
  eq("…e il testo dell'avviso senza il file", true, /^malformed marker: /.test(spaiato?.text));
}

console.log("\n== sonda: i guasti ==");
{
  scrivi("nolib/src/App.jsx", "");
  const r = await sonda("nolib", { srcDir: "src", localeDir: "locale" });
  eq("libreria non installata", [false, "NO_LIBRARY"], [r.ok, r.code]);

  conLibreria("nosrc");
  const s = await sonda("nosrc", { srcDir: "src", localeDir: "locale" });
  eq("srcDir che non c'è", [false, "NO_SRCDIR", "srcDir not found: src"], [s.ok, s.code, s.error]);

  conLibreria("rotto");
  scrivi("rotto/src/Bad.jsx", 'const x = "_%_ciao_%_" +;\n');
  scrivi("rotto/src/Good.jsx", 'const y = "_%_buono_%_";\n');
  const t = await sonda("rotto", { srcDir: "src", localeDir: "locale" });
  eq("un file non parsabile non ferma gli altri", [true, 2], [t.ok, t.files.length]);
  eq("il file rotto porta l'errore", [true, 0], [typeof t.files[0].error === "string", t.files[0].entries.length]);
}

console.log("\n== sonda: l'indice della sync e l'overlay ==");
{
  // La sync vera (il CLI di questo repo) scrive node_modules/.viteTranslate/markers.json.
  conLibreria("indice");
  const PLUGIN = pathToFileURL(join(REPO, "lib/index.js")).href;
  scrivi("indice/package.json", '{ "type": "module" }');
  scrivi("indice/vite.config.mjs", `import { vitetranslate } from ${JSON.stringify(PLUGIN)};\nexport default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };\n`);
  scrivi("indice/src/A.jsx", 'export const A = () => <p title="_%_Titolo_%_">_%_Ciao_%_</p>;\n');
  scrivi("indice/src/B.jsx", 'export const B = () => <p>_%_Uno_%_ e <b>_%_spezzato</b>_%_</p>;\n');
  scrivi("indice/src/plain.js", "export const nulla = 1;\n");
  const sync = spawnSync(process.execPath, [join(REPO, "lib/dev/vite/cli.js")], { cwd: join(radice, "indice"), encoding: "utf8" });
  eq("sync riuscita, indice scritto", [0, true], [sync.status, existsSync(join(radice, "indice/node_modules/.viteTranslate/markers.json"))]);

  const input = { srcDir: "src", localeDir: "locale", sourceLanguage: "it-IT" };
  const conIndice = await sonda("indice", input);
  eq("tutto dall'indice: nessun parse, Babel mai caricato", ["used", { index: 2, overlay: 0, parsed: 0 }, false], [conIndice.index, conIndice.origin, conIndice.babel]);
  eq("…le voci con righe e forma", [["Titolo", 1, "attribute"], ["Ciao", 1, "jsxText"]], conIndice.files[0].entries.map((e) => [e.text, e.line, e.form]));
  eq("…giudicate sulle tabelle appena scritte: nessun problema", [], conIndice.files[0].entries.flatMap((e) => e.problems));
  eq("…overlay vuoto: niente letto fuori dall'indice", {}, conIndice.overlay);

  // Stesso risultato della scansione completa (indice tolto).
  rmSync(join(radice, "indice/node_modules/.viteTranslate/markers.json"));
  const senza = await sonda("indice", input);
  eq("senza indice: tutto parsato", ["none", 2, true], [senza.index, senza.origin.parsed, senza.babel]);
  eq("…stesse voci e stessi avvisi", JSON.stringify([conIndice.files, conIndice.warnings]), JSON.stringify([senza.files, senza.warnings]));
  spawnSync(process.execPath, [join(REPO, "lib/dev/vite/cli.js")], { cwd: join(radice, "indice"), encoding: "utf8" });

  const altroWrap = await sonda("indice", { ...input, autoWrap: true });
  eq("autoWrap diverso da quello della sync: indice ignorato", ["mismatch", 2], [altroWrap.index, altroWrap.origin.parsed]);

  // Il processo che resta vivo, con l'overlay ripassato come fa l'estensione.
  const worker = new ScanWorker({ dir: join(radice, "indice"), probePath: PROBE, idleMs: 60000 });
  const r1 = await worker.request(input, {});
  eq("worker: dall'indice, e si chiude subito (niente Babel)", [{ index: 2, overlay: 0, parsed: 0 }, false], [r1.origin, worker.alive]);
  scrivi("indice/src/A.jsx", 'export const A = () => <p title="_%_Titolo_%_">_%_Ciao a tutti_%_</p>;\n');
  const r2 = await worker.request(input, r1.overlay);
  eq("un file cambiato dopo la sync: parsato solo lui", [{ index: 1, overlay: 0, parsed: 1 }, true], [r2.origin, r2.babel]);
  eq("…e il processo resta vivo (Babel caldo)", true, worker.alive);
  eq("…la voce nuova, non ancora nelle tabelle", ["Ciao a tutti", "notSynced"], [r2.files[0].entries[1].text, r2.files[0].entries[1].problems[0]?.kind]);
  eq("…l'overlay lo contiene", ["src/A.jsx"], Object.keys(r2.overlay));
  const r3 = await worker.request(input, r2.overlay);
  eq("con l'overlay: niente da parsare", { index: 1, overlay: 1, parsed: 0 }, r3.origin);
  scrivi("indice/src/A.jsx", 'export const A = () => <p title="_%_Titolo_%_">_%_Ciao a tutti_%_</p>;\n');
  const r4 = await worker.request(input, r3.overlay);
  eq("salvato identico (mtime nuovo): riconosciuto dall'hash", { index: 1, overlay: 1, parsed: 0 }, r4.origin);
  scrivi("indice/src/plain.js", "export const nulla = 2;\n");
  const r5 = await worker.request(input, r4.overlay);
  eq("un file senza marcatori cambiato: letto, niente parse, ricordato", [{ index: 1, overlay: 1, parsed: 0 }, { none: true }], [r5.origin, { none: r5.overlay["src/plain.js"]?.none }]);
  worker.dispose();
  eq("dispose: processo chiuso", false, worker.alive);
}

console.log("\n== righe: ingresso dalla sonda del vite.config ==");
{
  eq("Restricted Mode", ["Restricted Mode"], markedInput({ ok: false, untrusted: true }).rows.map((r) => r.label));
  eq("vite.config non letto", "vite.config not read", markedInput({ ok: false, error: "boom\nstack" }).rows[0].label);
  eq("plugin assente", "vitetranslate is not registered in vite.config", markedInput({ ok: true, vitetranslate: null }).rows[0].label);
  eq("default di baseDir e srcDir", { baseDir: ".", srcDir: "src", localeDir: "locale", autoWrap: false },
    markedInput({ ok: true, vitetranslate: { localeDir: "locale" } }).input);
}

console.log("\n== righe: i casi limite ==");
{
  const input = { baseDir: ".", srcDir: "src" };
  const dir = join("/", "p");
  const errore = markedChildren({ dir, input, marked: { ok: false, code: "NO_LIBRARY", error: "@sepoina/vitetranslate is not installed in this project" } });
  eq("errore: una riga col rimedio", ["@sepoina/vitetranslate is not installed in this project", "run npm install in the project"], [errore[0].label, errore[0].description]);
  const tooOld = markedChildren({ dir, input, marked: { ok: false, code: "TOO_OLD", error: "@sepoina/vitetranslate 9.0.0 is too old for this extension" } });
  eq("troppo vecchia: il comando che la aggiorna", [1, true, "error"], [tooOld.length, tooOld[0].description.includes("npm install @sepoina/vitetranslate@latest"), tooOld[0].icon]);

  const vuoto = markedChildren({ dir, input, marked: { ok: true, scanned: 7, files: [] } });
  eq("niente di marcato", ["nothing marked yet", "7 files scanned in src/"], [vuoto[0].label, vuoto[0].description]);
  eq("riassunto assente se la scansione è fallita", undefined, markedSummary({ ok: false }));

  const lungo = "parola ".repeat(30);
  const file = { rel: "src/A.jsx", path: join(dir, "src/A.jsx"), entries: [
    { id: "A_1", text: "Ciao", line: 3, column: 5 },
    { id: "A_1", text: "Ciao", line: 9, column: 5 },
    { id: "A_2", text: `${lungo}\n  fine`, line: 12, column: 1 },
  ] };
  const [src] = markedChildren({ dir, input, marked: { ok: true, version: "4.6.4", scanned: 1, files: [file] } });
  const voci = src.children[0].children;
  eq("stesso testo due volte: chiavi diverse", ["A_1@3:5", "A_1@9:5"], voci.slice(0, 2).map((v) => v.key));
  // Il testo tagliato a 80, dopo il glifo verde e lo spazio.
  const testo = voci[2].label.slice(voci[2].label.indexOf(" ") + 1);
  eq("testo lungo: una riga, 80 caratteri", [80, false, true], [testo.length, testo.includes("\n"), testo.endsWith("…")]);
  eq("nessuna icona: basta il glifo", [undefined, undefined], [voci[0].icon, voci[2].icon]);
  eq("tooltip: testo intero e chiave", true, voci[2].tooltip.startsWith(lungo) && voci[2].tooltip.endsWith("A_2"));

  const vecchia = markedChildren({ dir, input, marked: { ok: true, version: "4.6.3", scanned: 1, files: [{ ...file, entries: [{ id: "A_1", text: "Ciao", line: null, column: null }] }] } });
  const [voce] = vecchia[0].children[0].children;
  eq("libreria senza righe: niente :riga", [undefined, null], [voce.description, voce.line]);
  eq("…e una riga che lo spiega", "@sepoina/vitetranslate 4.6.3 does not report lines", vecchia.at(-1).label);
}

console.log("\n== righe: glifi e filtro ==");
{
  eq("glifi di default", { malformed: "‼️", notSynced: "🔄", untranslated: "🔸", notFullyTranslated: "🔹" }, glyphsOf(undefined));
  eq("glifi del progetto; uno spento torna al default", { malformed: "!!", notSynced: "🔄", untranslated: "🔸", notFullyTranslated: "~" },
    glyphsOf({ mark: { malformed: "!!", untranslated: "", notFullyTranslated: "~" } }));

  const dir = join("/", "p");
  const input = { baseDir: ".", srcDir: "src" };
  const marked = { ok: true, version: "4.6.4", scanned: 2, files: [
    { rel: "src/A.jsx", path: join(dir, "src/A.jsx"), entries: [
      { id: "A_1", text: "Pulita", line: 1, column: 1, form: "translate", problems: [] },
      { id: "A_2", text: "Due guai", line: 2, column: 1, problems: [{ kind: "notFullyTranslated", detail: ["fr-FR"] }, { kind: "malformed", detail: "nested markers: …" }] },
    ] },
    { rel: "src/C.jsx", path: join(dir, "src/C.jsx"), entries: [{ id: "C_1", text: "Da tradurre", line: 1, column: 1, problems: [{ kind: "untranslated", detail: ["fr-FR"] }] }] },
    { rel: "src/B.jsx", path: join(dir, "src/B.jsx"), entries: [{ id: "B_1", text: "Tutto bene", line: 1, column: 1, problems: [] }] },
  ] };
  eq("voci del filtro, coi conteggi: solo quelle che trovano qualcosa (niente Not synced)",
    [["all", "All", "4"], ["malformed", "Malformed", "1 of 4"], ["untranslated", "Untranslated", "2 of 4"]],
    filterItems(marked).map((r) => [r.value, r.label, r.description]));
  const pulite = { ok: true, files: [{ rel: "src/B.jsx", entries: [{ id: "B_1", problems: [] }] }] };
  eq("nessun filtro se c'è solo All: tutto a posto, niente voci, scansione fallita", [[], [], []],
    [filterItems(pulite), filterItems({ ok: true, files: [] }), filterItems({ ok: false })]);
  const soloIlleggibile = { ok: true, files: [{ rel: "src/D.jsx", error: "EACCES", entries: [] }] };
  eq("un file illeggibile basta a far comparire Malformed", ["all", "malformed"], filterItems(soloIlleggibile).map((r) => r.value));
  const daSincronizzare = { ok: true, files: [{ rel: "src/E.jsx", entries: [{ id: "E_1", problems: [{ kind: "notSynced", detail: ["fr-FR"] }] }] }] };
  eq("Not synced, col suo tooltip", [["notSynced", "Not synced", "1 of 1"], "not in the language files yet: run the sync"],
    [[filterItems(daSincronizzare)[1].value, filterItems(daSincronizzare)[1].label, filterItems(daSincronizzare)[1].description], filterItems(daSincronizzare)[1].tooltip]);
  eq("riassunto con i problemi", "4 marked · 3 files · 2 to check", markedSummary(marked));

  const tutte = markedChildren({ dir, input, marked, filter: "all", glyphs: glyphsOf({ mark: { untranslated: "U" } }) });
  eq("l'albero, senza il filtro: lo aggiunge MarkedTree", ["src"], tutte.map((r) => r.label));
  const [src] = tutte;
  eq("tutte: tre file", ["A.jsx", "B.jsx", "C.jsx"], src.children.map((r) => r.label));
  const [pulita, guai] = src.children[0].children;
  eq("senza problemi: il verde della sua forma", `${PASSED.translate} Pulita`, pulita.label);
  eq("…e il tooltip dice quale", `Pulita\n\n${PASSED.translate} passed: <Translate>…</Translate>\n\nA_1`, pulita.tooltip);
  eq("glifi in ordine: prima ciò che non funziona", "‼️🔹 Due guai", guai.label);
  eq("tooltip: testo, spiegazioni, chiave", "Due guai\n\n‼️ nested markers: …\n🔹 still missing in fr-FR\n\nA_2", guai.tooltip);

  const [srcM] = markedChildren({ dir, input, marked, filter: "malformed" });
  eq("malformate: solo A.jsx, una voce", [["A.jsx", "1"]], srcM.children.map((r) => [r.label, r.description]));
  const [srcU] = markedChildren({ dir, input, marked, filter: "untranslated" });
  eq("non tradotte: A.jsx e C.jsx, una voce ciascuno", [["A.jsx", "1"], ["C.jsx", "1"]], srcU.children.map((r) => [r.label, r.description]));
  const illeggibile = { ...marked, files: [...marked.files, { rel: "src/D.jsx", path: join(dir, "src/D.jsx"), error: "EACCES", entries: [] }] };
  const nomi = (filtro) => markedChildren({ dir, input, marked: illeggibile, filter: filtro })[0].children.map((r) => r.label);
  eq("un file illeggibile: fra le malformate, non fra le non tradotte", [true, false], [nomi("malformed").includes("D.jsx"), nomi("untranslated").includes("D.jsx")]);

  const pulito = { ...marked, files: marked.files.filter((f) => f.rel === "src/B.jsx") };
  eq("nessun problema: lo dice", ["nothing malformed", "nothing to sync", "nothing untranslated"],
    ["malformed", "notSynced", "untranslated"].map((filtro) => markedChildren({ dir, input, marked: pulito, filter: filtro })[0].label));

  // Search: quante voci si vedono prima della ricerca, e la ricerca stessa.
  eq("shownCount: col filtro, prima della ricerca", [4, 1, 2, 0, 0], [shownCount(marked), shownCount(marked, "malformed"), shownCount(marked, "untranslated"), shownCount(marked, "notSynced"), shownCount({ ok: false })]);
  const conAccenti = [...marked.files, { rel: "src/città/Z.jsx", entries: [{ id: "Z_1", text: "Città", problems: [] }] }];
  eq("searchFiles: nel testo, senza maiuscole né accenti", [["src/A.jsx", ["Due guai"]], ["src/città/Z.jsx", ["Città"]]],
    searchFiles(conAccenti, "GUAI").concat(searchFiles(conAccenti, "citta").filter((f) => f.rel.includes("città"))).map((f) => [f.rel, f.entries.map((e) => e.text)]));
  eq("…nel percorso: il file resta intero", [["src/C.jsx", 1]], searchFiles(marked.files, "c.jsx").map((f) => [f.rel, f.entries.length]));
  eq("…vuoto o di soli spazi: niente tolto", [marked.files, marked.files], [searchFiles(marked.files, ""), searchFiles(marked.files, "  ")]);
  eq("un illeggibile resta solo se il percorso corrisponde", [["src/D.jsx"], []],
    [searchFiles(illeggibile.files, "d.jsx").map((f) => f.rel), searchFiles(illeggibile.files, "boh").map((f) => f.rel)]);
  const [srcS] = markedChildren({ dir, input, marked, search: "tutto" });
  eq("markedChildren con la ricerca: solo B.jsx", ["B.jsx"], srcS.children.map((r) => r.label));
  eq("…filtro e ricerca insieme", ["C.jsx"], markedChildren({ dir, input, marked, filter: "untranslated", search: "tradurre" })[0].children.map((r) => r.label));
  eq("…niente trovato: lo dice, col filtro", [["nothing matches \"zzz\"", "in Untranslated", "search"]],
    markedChildren({ dir, input, marked, filter: "untranslated", search: " zzz " }).map((r) => [r.label, r.description, r.icon]));
}

console.log("\n== righe: caricamento e disegno bloccato ==");
{
  eq("la riga che tiene il posto", { label: "Loading app…", icon: "loading~spin" }, loadingRow("Loading app…"));
  const dir = join("/", "p");
  const righe = [
    { label: "Filter", children: [{ label: "All" }] },
    { label: "src", kind: "folder", resource: join(dir, "src"), children: [
      { label: "A.jsx", kind: "file", resource: join(dir, "src/A.jsx"), description: "1", tooltip: "src/A.jsx", children: [{ label: "x", open: join(dir, "src/A.jsx"), tooltip: "t" }] },
      { label: "B.jsx", kind: "file", resource: join(dir, "src/B.jsx"), description: "1", children: [{ label: "y", open: join(dir, "src/B.jsx") }] },
    ] },
  ];
  eq("niente da bloccare: le stesse righe", true, frozenRows(righe, new Map()) === righe);
  // Chiavi per pathKey, come le fa markedTree (forgetFile, setDirty): su Windows sono in minuscolo.
  const bloccate = frozenRows(righe, new Map([[pathKey(join(dir, "src/A.jsx")), "saved"], [pathKey(join(dir, "src/B.jsx")), "unsaved"]]));
  const [a, b] = bloccate[1].children;
  eq("salvato: il segno davanti al conteggio", "⏳ updating · 1", a.description);
  eq("…le voci senza clic, col perché nel tooltip", [undefined, true], [a.children[0].open, /^Saved: /.test(a.children[0].tooltip)]);
  eq("non salvato: ✎", "✎ unsaved · 1", b.description);
  eq("le righe di partenza non cambiano", ["1", join(dir, "src/A.jsx")], [righe[1].children[0].description, righe[1].children[0].children[0].open]);
  eq("il filtro non si tocca", righe[0], bloccate[0]);
}

rmSync(radice, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
