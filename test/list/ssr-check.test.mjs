// Verifica end-to-end: tabella compilata -> resolveEntry -> renderToString, in Node puro.
// Se il markup arriva a HTML senza che esista un `document`, la limitazione "No SSR support"
// del README non c'è più. Girato da playground/ per risolvere react e react-dom.
import { renderToString } from "react-dom/server";
import { writeFileSync, unlinkSync } from "node:fs";

const { compileLanguageModule } = await import("../../lib/dev/compile/compileTable.js");
const { resolveEntry, resolveEntryText } = await import("../../lib/react/resolveEntry.js");
const { jsx } = await import("react/jsx-runtime");

console.log("document esiste in questo processo?", typeof globalThis.document);

const sorgente = {
  testo: "Playground",
  testoArgs: "Ciao %s, come stai?",
  markup: "componente <code>&#60;Translate&#62;</code> attivo",
  markupArgs: "Ciao <b>%s</b>, hai %s messaggi",
};

// Il modulo generato importa react/jsx-runtime: lo scrivo accanto a node_modules così si
// risolve davvero, invece di stubbarlo. Sono elementi React veri.
const tmp = new URL("./__tabella-compilata.mjs", import.meta.url);
writeFileSync(tmp, compileLanguageModule(sorgente, "test"));
let table;
try {
  table = (await import(tmp.href)).default;
} finally {
  unlinkSync(tmp);
}

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(46), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// renderToString separa con `<!-- -->` due figli di testo adiacenti, così l'idratazione sa
// dove finisce l'uno e comincia l'altro. È il comportamento normale di React per qualunque
// `<>hai {n} messaggi</>`, non una particolarità del codice generato: qui si toglie dal
// confronto perché rende illeggibili le attese, ma nell'HTML servito c'è e va bene così.
const html = (key, args) =>
  renderToString(resolveEntry(table, undefined, key, args, undefined)).replaceAll("<!-- -->", "");

console.log("\n== render lato server, senza DOM ==");
eq("testo", "Playground", html("testo"));
eq("testo + argomento", "Ciao aldo, come stai?", html("testoArgs", ["aldo"]));
eq("markup (entita decodificate a build time)", "componente <code>&lt;Translate&gt;</code> attivo", html("markup"));
eq("markup + argomenti", "Ciao <b>aldo</b>, hai 3 messaggi", html("markupArgs", ["aldo", 3]));

console.log("\n== cio che prima era impossibile ==");
// Prima Translate lanciava "Non sono accettati subelementi html nel translate".
const link = jsx("a", { href: "/u/aldo", children: "aldo" });
eq("elemento React come argomento", 'Ciao <b><a href="/u/aldo">aldo</a></b>, hai 3 messaggi', html("markupArgs", [link, 3]));
// L'argomento non viene piu interpretato come HTML: React lo escapa.
eq("argomento ostile escapato, non interpretato", "Ciao <b>&lt;script&gt;x&lt;/script&gt;</b>, hai 0 messaggi", html("markupArgs", ["<script>x</script>", 0]));

console.log("\n== fail-safe attraverso resolveEntry ==");
eq("nessun argomento", "Ciao ⁇, come stai?", html("testoArgs"));
eq("false (sentinella di Translate)", "Ciao ⁇, come stai?", html("testoArgs", false));
eq("lista piu corta dei segnaposto", "Ciao <b>aldo</b>, hai ⁇ messaggi", html("markupArgs", ["aldo"]));
eq("zero resta un valore", "Ciao 0, come stai?", html("testoArgs", [0]));

console.log("\n== ts(): resolveEntryText ==");
eq("testo semplice", "Playground", resolveEntryText(table, undefined, "testo"));
eq("testo + argomento", "Ciao aldo, come stai?", resolveEntryText(table, undefined, "testoArgs", "aldo"));
eq("markup appiattito a testo", "componente <Translate> attivo", resolveEntryText(table, undefined, "markup"));
eq("markup + args appiattito", "Ciao aldo, hai 3 messaggi", resolveEntryText(table, undefined, "markupArgs", ["aldo", 3]));

console.log("\n== chiave assente ==");
// L'ultimo argomento è il MARCATORE compilato, non il testo di riserva già estratto: da lì
// `resolveEntry` lo ricava, ma solo in questo ramo (vedi resolveEntry.js).
eq("ricade sul fallback del marcatore", "testo di riserva", resolveEntryText(table, undefined, "inesistente", undefined, "_<_inesistente_/_testo di riserva_>_"));
eq("senza fallback nel marcatore resta la chiave", "inesistente", resolveEntryText(table, undefined, "inesistente", undefined, "_<_inesistente_>_"));
eq("senza marcatore resta la chiave", "inesistente", resolveEntryText(table, undefined, "inesistente"));

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
