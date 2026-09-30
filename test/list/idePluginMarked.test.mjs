// Estensione per l'editor (idePlugin): la sezione Marked. La sonda delle voci (markedProbe.mjs,
// lanciata da runProbe.mjs) su progetti veri in una cartella temporanea, con la libreria di questo
// repo linkata in node_modules; poi le righe (markedRows.mjs) sui casi che un progetto vero
// produce di rado: errori, libreria senza righe, testi lunghi o ripetuti.
//
//   node test/list/idePluginMarked.test.mjs
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import runProbe from "../../idePlugin/src/runProbe.mjs";
import { markedInput, markedChildren, markedSummary, glyphsOf, filterItems, hasEntries, PASSED } from "../../idePlugin/src/markedRows.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const PROBE = fileURLToPath(new URL("../../idePlugin/src/markedProbe.mjs", import.meta.url));
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
  eq("lingue lette", { source: "it-IT", targets: ["en-US", "fr-FR"] }, r.languages);
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
    { rel: "src/B.jsx", path: join(dir, "src/B.jsx"), entries: [{ id: "B_1", text: "Tutto bene", line: 1, column: 1, problems: [] }] },
  ] };
  eq("voci del filtro, coi conteggi", [["problems", "Problematic only", "1 of 3"], ["all", "All", "3"]], filterItems(marked).map((r) => [r.value, r.label, r.description]));
  eq("filtro solo sopra una scansione con voci", [true, false, false], [hasEntries(marked), hasEntries({ ok: true, files: [] }), hasEntries({ ok: false })]);
  eq("riassunto con i problemi", "3 marked · 2 files · 1 to check", markedSummary(marked));

  const tutte = markedChildren({ dir, input, marked, filter: "all", glyphs: glyphsOf({ mark: { untranslated: "U" } }) });
  eq("l'albero, senza il filtro: lo aggiunge MarkedTree", ["src"], tutte.map((r) => r.label));
  const [src] = tutte;
  eq("tutte: due file", ["A.jsx", "B.jsx"], src.children.map((r) => r.label));
  const [pulita, guai] = src.children[0].children;
  eq("senza problemi: il verde della sua forma", `${PASSED.translate} Pulita`, pulita.label);
  eq("…e il tooltip dice quale", `Pulita\n\n${PASSED.translate} passed: <Translate>…</Translate>\n\nA_1`, pulita.tooltip);
  eq("glifi in ordine: prima ciò che non funziona", "‼️🔹 Due guai", guai.label);
  eq("tooltip: testo, spiegazioni, chiave", "Due guai\n\n‼️ nested markers: …\n🔹 still missing in fr-FR\n\nA_2", guai.tooltip);

  const problemi = markedChildren({ dir, input, marked, filter: "problems" });
  const [srcP] = problemi;
  eq("problematiche: solo A.jsx, una voce", [["A.jsx", "1"]], srcP.children.map((r) => [r.label, r.description]));

  const pulito = { ...marked, files: [marked.files[1]] };
  eq("nessun problema: lo dice", "nothing to check", markedChildren({ dir, input, marked: pulito, filter: "problems" })[0].label);
}

rmSync(radice, { recursive: true, force: true });
console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
