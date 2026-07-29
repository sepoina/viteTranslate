import { compileLanguageModule } from "../../lib/dev/compile/compileTable.js";

// Stub del jsx-runtime: rappresenta gli elementi come oggetti ispezionabili, così il test
// verifica la struttura prodotta senza dipendere da React.
const STUB = `
const Fragment = "#frag";
const jsx = (type, props) => ({ type, children: props.children });
const jsxs = jsx;
`;

async function load(table, sourceTable = null) {
  const code = compileLanguageModule(table, "", sourceTable).replace(
    /import \{[^}]*\} from "react\/jsx-runtime";/,
    STUB
  );
  const mod = await import("data:text/javascript," + encodeURIComponent(code));
  return { table: mod.default, code };
}

// Rende l'albero come stringa leggibile, per confronti compatti.
function show(v) {
  if (v === null || v === undefined) return String(v);
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(show).join("");
  if (v.type === "#frag") return show(v.children);
  return `<${v.type}>${v.children === undefined ? "" : show(v.children)}</${v.type}>`;
}

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(42), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

// ---------------------------------------------------------------- i quattro casi
console.log("\n== i quattro casi ==");
const sorgenti = {
  testo: "Playground",
  testoArgs: "Ciao %s, come stai?",
  markup: "componente <code>&#60;Translate&#62;</code> attivo",
  markupArgs: "Ciao <b>%s</b> come stai?",
};
const { table: T, code } = await load(sorgenti);

eq("testo -> stringa", "string", typeof T.testo);
eq("testo+args -> funzione", "function", typeof T.testoArgs);
eq("markup -> oggetto (elemento, non funzione)", "object", typeof T.markup);
eq("markup+args -> funzione", "function", typeof T.markupArgs);

eq("testo", "Playground", show(T.testo));
eq("testo+args", "Ciao aldo, come stai?", show(T.testoArgs(["aldo"])));
eq("markup (entita decodificate)", "componente <code><Translate></code> attivo", show(T.markup));
eq("markup+args", "Ciao <b>aldo</b> come stai?", show(T.markupArgs(["aldo"])));

// ------------------------------------------------------- fail-safe senza parametri
console.log("\n== fail-safe: nessun parametro, o parametri sbagliati ==");
for (const [nome, chiamata] of [
  ["nessun argomento", () => T.testoArgs()],
  ["undefined", () => T.testoArgs(undefined)],
  ["null", () => T.testoArgs(null)],
  ["false (sentinella di Translate)", () => T.testoArgs(false)],
  ["lista vuota", () => T.testoArgs([])],
  ["lista con null", () => T.testoArgs([null])],
  ["scalare invece di lista", () => T.testoArgs("aldo")],
  ["numero zero", () => T.testoArgs([0])],
  ["stringa vuota", () => T.testoArgs([""])],
]) {
  let out;
  try { out = show(chiamata()); } catch (e) { out = `THROW ${e.constructor.name}`; fail++; }
  console.log("  ", nome.padEnd(34), "->", JSON.stringify(out));
}
console.log("   [markup+args] nessun argomento   ->", JSON.stringify((() => {
  try { return show(T.markupArgs()); } catch (e) { fail++; return `THROW ${e.constructor.name}`; }
})()));

eq("scalare accettato come lista di uno", "Ciao aldo, come stai?", show(T.testoArgs("aldo")));
eq("zero e' un valore, non un'assenza", "Ciao 0, come stai?", show(T.testoArgs([0])));
eq("mancante -> [?]", "Ciao [?], come stai?", show(T.testoArgs()));

// -------------------------------------------------------------------- casi limite
console.log("\n== casi limite del parser ==");
const { table: L } = await load({
  vuoto: "",
  soloArg: "%s",
  argIniziale: "%s messaggi",
  multiArg: "da %s a %s",
  argMancante: "da %s a %s",
  tagIgnoto: "<div>ciao <b>mondo</b></div>",
  tagVoid: "riga<br>altra riga",
  annidato: "<b>grassetto <i>e corsivo</i></b>",
  chiusuraSpaiata: "testo</b> ancora",
  nonChiuso: "<b>mai chiuso",
  entitaSoloTesto: "5 &lt; 7 &amp; 8 &gt; 6",
  entitaNumerica: "&#8364; &#x20AC;",
  commento: "prima<!-- nascosto -->dopo",
  minoreLetterale: "se a < b allora",
  argDentroTagIgnoto: "<span>ciao %s</span>",
  nullo: null,
  __builder__: { v: 260727, languageName: "italiano (Italia)" },
});

eq("stringa vuota", "", show(L.vuoto));
eq("solo segnaposto", "aldo", show(L.soloArg(["aldo"])));
eq("segnaposto iniziale", "3 messaggi", show(L.argIniziale([3])));
eq("due segnaposto", "da roma a milano", show(L.multiArg(["roma", "milano"])));
eq("secondo segnaposto mancante", "da roma a [?]", show(L.argMancante(["roma"])));
eq("tag ignoto sciolto", "ciao <b>mondo</b>", show(L.tagIgnoto));
eq("tag void", "riga<br></br>altra riga", show(L.tagVoid));
eq("tag annidati", "<b>grassetto <i>e corsivo</i></b>", show(L.annidato));
eq("chiusura spaiata ignorata", "testo ancora", show(L.chiusuraSpaiata));
eq("tag non chiuso", "<b>mai chiuso</b>", show(L.nonChiuso));
eq("entita in testo puro", "5 < 7 & 8 > 6", show(L.entitaSoloTesto));
eq("entita numeriche dec+hex", "€ €", show(L.entitaNumerica));
eq("commento rimosso", "primadopo", show(L.commento));
eq("< letterale non e' un tag", "se a < b allora", show(L.minoreLetterale));
eq("arg dentro tag sciolto", "ciao aldo", show(L.argDentroTagIgnoto(["aldo"])));
eq("null passa come null", null, L.nullo);
// I metadati di sincronizzazione non hanno lettori nel bundle (il nome lingua arriva da
// `languageNames`): restano sul file su disco e non vengono spediti al browser.
eq("__builder__ escluso dal compilato", undefined, L.__builder__);

eq("entita in testo puro resta stringa", "string", typeof L.entitaSoloTesto);
eq("< letterale resta stringa", "string", typeof L.minoreLetterale);

// ------------------------------------------------------ argomento come elemento React
console.log("\n== argomento non-stringa ==");
const linkFinto = { type: "a", children: "profilo" };
eq("elemento React nel markup", "Ciao <b><a>profilo</a></b> come stai?", show(T.markupArgs([linkFinto])));
// Regressione: in una voce SENZA markup i pezzi venivano concatenati con `+`, quindi un
// nodo React diventava "[object Object]" — e in silenzio, e solo in alcune lingue.
eq("elemento React nel testo semplice", "Ciao <a>profilo</a>, come stai?", show(T.testoArgs([linkFinto])));
eq("testo semplice + primitivo resta stringa", "string", typeof T.testoArgs(["aldo"]));
eq("testo semplice + numero resta stringa", "string", typeof T.testoArgs([7]));

// --------------------------------------------------------------- forma del generato
console.log("\n== forma del modulo generato ==");
console.log(code.split("\n").slice(0, 9).join("\n"));
const soloTesto = compileLanguageModule({ a: "uno", b: "due" });
eq("nessun import se non serve jsx", false, soloTesto.includes("jsx-runtime"));
eq("nessun helper se non ci sono args", false, soloTesto.includes("_arg"));

// ------------------------------------------------- tabella autonoma (fallback incorporato)
// Ogni lingua porta con sé il testo della sorgente per ciò che non è ancora tradotto: chi la
// consuma non ha bisogno di sapere in che lingua è stato scritto il progetto, né di averla
// caricata. Senza questo, una chiave non tradotta arrivava al browser come `null` e la
// risoluzione dipendeva dall'avere la tabella sorgente sempre in bundle.
console.log("\n== tabella autonoma ==");
const SORGENTE = {
  __builder__: { v: 1, languageName: "italiano" },
  tradotta: "originale",
  daTradurre: "testo non ancora tradotto",
  conMarkup: "resta <b>in grassetto</b>",
  conArgs: "ciao %s",
  soloNellaSorgente: "chiave che la sub-lingua non ha ancora",
};
const SUB = {
  __builder__: { v: 1, languageName: "english" },
  tradotta: "translated",
  daTradurre: null,
  conMarkup: null,
  conArgs: null,
};

{
  const { table: A } = await load(SUB, SORGENTE);
  eq("la traduzione fatta vince sulla sorgente", "translated", show(A.tradotta));
  eq("null riempito col testo sorgente", "testo non ancora tradotto", show(A.daTradurre));
  eq("nessun null residuo nella tabella", false, Object.values(A).includes(null));
  // Il fallback non è testo grezzo incollato: passa dalla stessa compilazione delle altre
  // voci, quindi markup e segnaposto funzionano come se fosse tradotto.
  eq("fallback con markup -> elemento", "resta <b>in grassetto</b>", show(A.conMarkup));
  eq("fallback con markup non è stringa", "object", typeof A.conMarkup);
  eq("fallback con segnaposto -> funzione", "function", typeof A.conArgs);
  eq("fallback con segnaposto interpola", "ciao aldo", show(A.conArgs(["aldo"])));
  // Il caso che conta di più: una lingua rimasta indietro, che la chiave non ce l'ha proprio.
  eq("chiave assente presa dalla sorgente", "chiave che la sub-lingua non ha ancora", show(A.soloNellaSorgente));
}
{
  // Senza sorgente il comportamento di prima resta intatto: i null sopravvivono e la catena
  // di runtime continua a coprirli.
  const { table: B } = await load(SUB);
  eq("senza sorgente il null resta null", null, B.daTradurre);
  eq("senza sorgente nessuna chiave aggiunta", undefined, B.soloNellaSorgente);
}
{
  // Una sorgente a sua volta non tradotta non ha nulla da offrire: meglio il null, che lascia
  // in piedi l'ultima risorsa a runtime, di un fallback inventato.
  const { table: C } = await load({ k: null }, { k: null });
  eq("sorgente anch'essa null -> resta null", null, C.k);
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
