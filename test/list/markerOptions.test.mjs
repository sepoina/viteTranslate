// I delimitatori del marcatore come opzione del plugin (4.7.0): `marker`, `markerStart`, `markerEnd`.
// Controlla la precedenza, la lettura senza badare a maiuscole e i controlli di validità, che
// fermano la costruzione del plugin con un messaggio che nomina l'opzione.
//
//   node test/list/markerOptions.test.mjs
import { resolveMarkers, markerProblem, markerPairProblem } from "../../lib/dev/vite/uty/markerOptions.js";
import vitetranslate from "../../lib/dev/vite/vitetranslate.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};
const errore = (defs) => {
  try {
    resolveMarkers(defs);
    return null;
  } catch (e) {
    return e.message;
  }
};

console.log("\n== precedenza: markerStart ?? marker ?? di serie ==");
{
  eq("nessuna opzione: di serie", { start: "_%_", end: "_%_" }, resolveMarkers({}));
  eq("defs assente", { start: "_%_", end: "_%_" }, resolveMarkers(undefined));
  eq("marker solo: lo stesso ai due capi", { start: "§", end: "§" }, resolveMarkers({ marker: "§" }));
  eq("markerStart e markerEnd soli", { start: "≼", end: "≽" }, resolveMarkers({ markerStart: "≼", markerEnd: "≽" }));
  eq("markerStart solo: la fine resta di serie", { start: "≼", end: "_%_" }, resolveMarkers({ markerStart: "≼" }));
  eq("markerEnd solo: l'inizio resta di serie", { start: "_%_", end: "≽" }, resolveMarkers({ markerEnd: "≽" }));
  eq("marker + markerStart: vince lo specifico", { start: "≼", end: "§" }, resolveMarkers({ marker: "§", markerStart: "≼" }));
  eq("marker + markerEnd: vince lo specifico", { start: "§", end: "≽" }, resolveMarkers({ marker: "§", markerEnd: "≽" }));
  eq("tutti e tre", { start: "(1", end: "2)" }, resolveMarkers({ marker: "§", markerStart: "(1", markerEnd: "2)" }));
}

console.log("\n== le chiavi si leggono senza badare alle maiuscole ==");
{
  eq("markerstart", { start: "≼", end: "≽" }, resolveMarkers({ markerstart: "≼", MARKEREND: "≽" }));
  eq("MARKER", { start: "§", end: "§" }, resolveMarkers({ MARKER: "§" }));
}

console.log("\n== valori validi ==");
{
  for (const v of ["≼", "≽", "§", "[[", "$$", "@@", "_%_", "%%", "~", "|"]) {
    eq(`valido: ${JSON.stringify(v)}`, null, markerProblem(v, "marker"));
  }
}

console.log("\n== valori non validi: il messaggio nomina l'opzione ==");
{
  const casi = [
    ["stringa vuota", { marker: "" }, "marker"],
    ["numero", { markerStart: 5 }, "markerStart"],
    ["null", { markerEnd: null }, "markerEnd"],
    ["spazio", { marker: "a b" }, "marker"],
    ["tab", { markerStart: "\t" }, "markerStart"],
    ["a capo", { markerEnd: "a\nb" }, "markerEnd"],
    ["controllo \\u0000", { marker: "a\u0000" }, "marker"],
    ["controllo \\u007f", { marker: "a\u007f" }, "marker"],
    ["<", { marker: "<<" }, "marker"],
    [">", { marker: ">>" }, "marker"],
    ["{", { marker: "{{" }, "marker"],
    ["}", { marker: "}}" }, "marker"],
    ["doppie virgolette", { marker: '"' }, "marker"],
    ["apostrofo", { marker: "'" }, "marker"],
    ["backtick", { marker: "`" }, "marker"],
    ["backslash", { marker: "\\" }, "marker"],
    ["&", { marker: "&&" }, "marker"],
    ["%s", { marker: "a%sb" }, "marker"],
  ];
  for (const [nome, defs, opzione] of casi) {
    const m = errore(defs);
    eq(`errore: ${nome}`, true, !!m && m.includes(opzione) && m.startsWith("[vitetranslate] invalid marker option"));
  }
  eq("più problemi: uno per riga", 2, (errore({ markerStart: "<", markerEnd: ">" }).match(/\n {2}- /g) ?? []).length);
}

console.log("\n== sovrapposizione: inizio e fine diversi non si contengono ==");
{
  eq("§ / §§: errore", true, /overlap/.test(errore({ markerStart: "§", markerEnd: "§§" })));
  eq("§§ / §: errore", true, /overlap/.test(errore({ markerStart: "§§", markerEnd: "§" })));
  eq("uguali vanno bene", null, errore({ marker: "§" }));
  eq("≼ / ≽ vanno bene", null, errore({ markerStart: "≼", markerEnd: "≽" }));
  eq("markerPairProblem diretto", null, markerPairProblem("[[", "]]"));
  eq("marker di serie + inizio che lo contiene", true, /overlap/.test(errore({ markerStart: "_%_x" })));
}

console.log("\n== il plugin: config normalizzata, modulo virtuale, opzione non valida ==");
{
  const plugins = vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT", markerStart: "≼", markerEnd: "≽" });
  const principale = plugins.find((p) => p?.name === "vitetranslate");
  eq("vitetranslateConfig.markers", { start: "≼", end: "≽" }, principale.vitetranslateConfig.markers);
  const serie = vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" }).find((p) => p?.name === "vitetranslate");
  eq("di serie, sempre presente", { start: "_%_", end: "_%_" }, serie.vitetranslateConfig.markers);
  let msg = null;
  try {
    vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT", marker: "a b" });
  } catch (e) {
    msg = e.message;
  }
  eq("un'opzione non valida ferma la costruzione", true, !!msg && msg.startsWith("[vitetranslate] invalid marker option") && msg.includes("marker"));

  // Il filtro del transform: un delimitatore con caratteri speciali di una RegExp.
  for (const [start, end] of [["$$", "$$"], ["[[", "]]"], ["(", ")"], ["^", "^"], ["+", "+"]]) {
    const p = vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT", markerStart: start, markerEnd: end }).find((x) => x?.name === "vitetranslate");
    const re = p.transform.filter.code;
    eq(`filtro con ${start}…${end}: il file marcato passa`, true, re.test(`const a = "${start}ciao${end}";`));
    eq(`filtro con ${start}…${end}: _%_ passa (old-marker)`, true, re.test(`const a = "_%_ciao_%_";`));
    eq(`filtro con ${start}…${end}: un file qualunque no`, false, re.test(`const a = "ciao";`));
  }
  const filtroSerie = serie.transform.filter.code;
  eq("filtro di serie: _%_", true, filtroSerie.test(`"_%_x_%_"`));
  eq("filtro di serie: l'import del runtime", true, filtroSerie.test(`import { Trans } from "@sepoina/vitetranslate/react";`));
}

process.exit(fail ? 1 : 0);
