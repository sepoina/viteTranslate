// Estensione per l'editor (idePlugin): l'elenco a scelta singola (choiceList.mjs) che fa Configs e
// il filtro di Marked. Righe col segno, scelta spostata sul posto, righe di altri elenchi ignorate.
//
//   node test/list/idePluginChoice.test.mjs
import { ChoiceList, selectionMark, MARKS } from "../../idePlugin/src/choiceList.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

console.log("\n== le righe ==");
const elenco = new ChoiceList({ name: "frutta", value: "pera" });
const righe = elenco.rows([
  { value: "mela", label: "Mela", description: "rossa" },
  { value: "pera", label: "Pera", id: "x/pera" },
]);
eq("segni: triangolo sulla scelta, puntino sulle altre", ["idle", "selected"], righe.map((r) => r.mark));
eq("…disegnati dalla codicon e dal colore di MARKS", [["circle-small-filled", "disabledForeground"], ["triangle-right", "charts.green"]], righe.map((r) => [r.icon, r.iconColor]));
eq("gli altri campi passano", ["rossa", "x/pera"], [righe[0].description, righe[1].id]);
eq("chiave di partenza dal valore", "frutta:mela", righe[0].key);
eq("…e ogni riga dice di chi è", { list: "frutta", value: "mela" }, righe[0].choice);
eq("owns: le sue sì", true, elenco.owns(righe[0]));
eq("owns: le altre no", [false, false, false], [elenco.owns({ label: "file" }), elenco.owns({ choice: { list: "altro", value: "mela" } }), elenco.owns(undefined)]);
eq("rowOf", righe[1], elenco.rowOf("pera"));
eq("selectionMark", ["selected", "idle"], [selectionMark(true), selectionMark(false)]);

console.log("\n== pick ==");
const cambiate = elenco.pick("mela");
eq("restituisce le due righe cambiate", [righe[1], righe[0]], cambiate);
eq("…cambiate sul posto", ["selected", "idle"], righe.map((r) => r.mark));
eq("…icona compresa", [MARKS.selected.icon, MARKS.idle.icon], righe.map((r) => r.icon));
eq("valore spostato", "mela", elenco.value);
eq("la stessa scelta: null", null, elenco.pick("mela"));
eq("un valore non mostrato: una riga sola cambia", [righe[0]], elenco.pick("banana"));
eq("…e il valore si sposta lo stesso", "banana", elenco.value);

console.log("\n== prima di mostrare niente ==");
const vuoto = new ChoiceList({ name: "v" });
eq("nessuna scelta di partenza", null, vuoto.value);
eq("pick senza righe: nessuna cambiata", [], vuoto.pick("a"));

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
