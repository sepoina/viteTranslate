// I due parser di markup devono concordare.
//
// Il dialetto ne ha due: `lib/dev/compile/parseMarkup.js` compila le tabelle a build time,
// `lib/react/basicHtmlToNodes.js` interpreta a runtime (fallback di sviluppo e API pubblica).
// Condividono le liste di tag via htmlDialect.js, ma NON l'algoritmo: regex e stack da una
// parte, il parser HTML del browser dall'altra. Una divergenza non fa fallire niente — fa
// solo rendere lo stesso testo in un modo in sviluppo e in un altro nel bundle, in silenzio.
//
// Qui `parseMarkup` viene confrontato con il comportamento del browser registrato in
// markupExpected.mjs (vedi lì come rigenerarlo). Il test gira ovunque, senza browser.
//
// La registrazione serve solo per la STRUTTURA dei tag, che è l'unica cosa per cui un browser
// vero non ha sostituti. Per le entità l'oracolo è `entities` (fb55), la stessa tabella HTML5
// che usano i parser veri — dipendenza di sviluppo, mai spedita — e viene interrogato mentre il
// test gira: quei casi non hanno nessuna attesa scritta da nessuna parte, quindi aggiungerne
// uno non costa un giro di Chrome e nessuna tabella può restare indietro rispetto al corpus.
//
//   node test/list/markupParity.test.mjs
import { decodeHTML, decodeHTMLStrict } from "entities";
import parseMarkup from "../../lib/dev/compile/parseMarkup.js";
import { NAMED_ENTITIES } from "../../lib/dev/compile/decodeEntities.js";
import { VOID_TAGS, HAS_HTML_RE } from "../../lib/htmlDialect.js";
import { CORPUS, CORPUS_ENTITA, ENTITA_DIVERGENTI } from "./markupCorpus.mjs";
import { ATTESO_BROWSER } from "./markupExpected.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(38), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

/** Serializza l'albero di parseMarkup nella stessa forma registrata dal browser. */
function serializza(nodi) {
  return nodi.map(function uno(n) {
    if (n.type === "text") return n.value;
    return VOID_TAGS.has(n.tag) ? `<${n.tag}/>` : `<${n.tag}>${n.children.map(uno).join("")}</${n.tag}>`;
  }).join("");
}

// Divergenze note e volute. Vuoto sarebbe l'ideale; ogni voce va motivata, perché è un caso
// in cui build e runtime rendono diversamente lo stesso testo.
const DIVERGENZE_NOTE = {
  // Il browser applica la "adoption agency" di HTML e riapre <i> sul testo che segue; noi
  // chiudiamo e basta. Replicare quell'algoritmo non vale la pena per del markup che è
  // comunque un errore, quindi parseMarkup lo SEGNALA (vedi il test dell'avviso sotto).
  "tag incrociati": "<b>ciao <i>mondo</i></b> ancora",

  // Il punto e virgola, per noi, è obbligatorio. Il browser scioglie anche una manciata di
  // nomi storici senza — ed è la stessa regola che gli fa leggere `&nothing` come `¬hing`:
  // allinearsi vorrebbe dire portarsi dietro quel guaio dentro le traduzioni, dove `&` è un
  // carattere come un altro. Chi scrive un'entità scriva anche il `;`.
  //
  // Senza il tag accanto questa divergenza non si vedeva: il pre-filtro del runtime pretende
  // il punto e virgola, quindi scartava la stringa e il parser del browser non la vedeva mai.
  // Con un tag la vede, e i due lati rispondono davvero in modo diverso.
  "entita senza punto e virgola in un tag": "<b>a &amp b</b>",

  // La nostra tabella copre un sottoinsieme dell'HTML5 (vedi decodeEntities.js): un nome che
  // non c'è resta letterale, mentre il browser lo scioglie. È il costo dichiarato di non
  // spedire duemila nomi in ogni build; decodeEntities.test.mjs misura quanto è largo il buco.
  "entita fuori dalla tabella": "<b>♥ e &alpha;</b>",
};

console.log("\n== parseMarkup concorda con il parser del browser ==");
let concordi = 0;
for (const [nome, sorgente] of CORPUS) {
  const atteso = DIVERGENZE_NOTE[nome] ?? ATTESO_BROWSER[nome];
  if (atteso === undefined) {
    fail++;
    console.log("  KO  ", nome.padEnd(38), "-> nessun valore registrato: rigenera markupExpected.mjs");
    continue;
  }
  const ottenuto = serializza(parseMarkup(sorgente));
  if (ottenuto === atteso) { concordi++; continue; }
  fail++;
  console.log(`  KO   ${nome}`);
  console.log(`       input    ${JSON.stringify(sorgente)}`);
  console.log(`       atteso   ${JSON.stringify(atteso)}`);
  console.log(`       ottenuto ${JSON.stringify(ottenuto)}`);
}
const quante = Object.keys(DIVERGENZE_NOTE).length;
console.log(`  ${concordi}/${CORPUS.length} casi concordi (${quante} divergenz${quante === 1 ? "a nota" : "e note"})`);

// ----------------------------------------------------------- entità, senza registrazione
console.log("\n== entità: l'attesa la calcola l'oracolo, non una tabella ==");
{
  // Nessun valore congelato: per ognuno di questi casi l'attesa è `decodeHTMLStrict(sorgente)`,
  // cioè la tabella HTML5 vera applicata con la nostra regola sul punto e virgola. È il motivo
  // per cui questa lista può crescere quanto si vuole senza riaprire un browser.
  const discordi = CORPUS_ENTITA.filter((s) => serializza(parseMarkup(s)) !== decodeHTMLStrict(s));
  eq(`${CORPUS_ENTITA.length} casi, tutti d'accordo con entities`, "", discordi.map((s) => JSON.stringify(s)).join(" "));

  // Lo stesso, ma su OGNI nome che la tabella dichiara di conoscere, dentro una frase: la
  // parte che si moltiplica da sola, e che nessuno deve ricordarsi di aggiornare quando la
  // tabella cresce.
  const nomi = Object.keys(NAMED_ENTITIES);
  const frasi = nomi.map((n) => `prima &${n}; dopo`);
  const sbagliate = frasi.filter((s) => serializza(parseMarkup(s)) !== decodeHTMLStrict(s));
  eq(`i ${nomi.length} nomi della tabella, uno per frase`, "", sbagliate.join(" "));
}

console.log("\n== e le differenze volute sono ancora quelle, e solo quelle ==");
for (const { sorgente, nostro, perche } of ENTITA_DIVERGENTI) {
  eq(`${JSON.stringify(sorgente)}: ${perche.split(":")[0]}`, nostro, serializza(parseMarkup(sorgente)));
  // Se l'oracolo smettesse di dissentire, la nota sarebbe diventata falsa: meglio accorgersene
  // qui che continuare a documentare una divergenza che non c'è più.
  eq("  ...e il browser dissente davvero", true, decodeHTML(sorgente) !== nostro);
}

console.log("\n== il corpus copre le famiglie che contano ==");
const nomi = CORPUS.map(([n]) => n);
for (const [famiglia, sonda] of [
  ["tag void senza chiusura", "br senza chiusura"],
  ["markup malformato", "tag non chiuso"],
  ["tag fuori dal dialetto", "tag non ammesso"],
  ["attributi con > dentro", "maggiore in attributo"],
  ["entita mescolate ai tag", "entita dentro tag"],
  ["commenti", "commento non chiuso"],
  ["caratteri speciali nudi", "minore isolato"],
]) eq(famiglia, true, nomi.includes(sonda));

// Il secondo gruppo non ha nomi — le voci sono le stringhe stesse — quindi le famiglie si
// riconoscono per forma.
for (const [famiglia, sonda] of [
  ["entita nominate", (s) => /&[a-zA-Z]+;/.test(s)],
  ["entita numeriche decimali", (s) => /&#\d+;/.test(s)],
  ["entita esadecimali", (s) => /&#x[0-9a-f]+;/i.test(s)],
  ["fuori dal BMP", (s) => /&#(128005|x1F405);/i.test(s)],
  ["lettere accentate", (s) => /&(eacute|szlig|ntilde|ccedil);/.test(s)],
  ["e commerciali che entita non sono", (s) => /&(\s|$|[^a-zA-Z#])/.test(s)],
  ["invisibili", (s) => /&(shy|zwnj|zwj|lrm|rlm|ensp|emsp|thinsp);/.test(s)],
]) eq(famiglia, true, CORPUS_ENTITA.some(sonda));

console.log("\n== il pre-filtro non lascia fuori ciò che va parsato ==");
// Era il difetto più insidioso: HAS_HTML_RE riconosceva solo i tag AMMESSI, quindi una
// stringa con soli tag non ammessi non entrava mai nel parser a runtime e li mostrava alla
// lettera — mentre il build li scioglieva. Divergenza silenziosa su un caso comunissimo.
for (const [nome, s] of [
  ["tag non ammesso", "<div>ciao</div>"],
  ["tag sconosciuto", "<foo/>ciao"],
  ["commento", "prima<!-- x -->dopo"],
  ["entita esadecimale", "&#x3C;b&#x3E;"],
  ["entita numerica", "&#60;"],
  ["entita nominata", "&amp;"],
  ["tag ammesso", "<b>x</b>"],
]) eq(`riconosce ${nome}`, true, HAS_HTML_RE.test(s));
for (const [nome, s] of [
  ["testo senza markup", "ciao mondo"],
  ["minore isolato", "a < b"],
  ["minore finale", "finisce con <"],
  ["e commerciale nuda", "Tizio & Caio"],
]) eq(`scarta ${nome}`, false, HAS_HTML_RE.test(s));

console.log("\n== la divergenza sui tag incrociati viene segnalata ==");
{
  const avvisi = [];
  const originale = console.warn;
  console.warn = (m) => avvisi.push(m);
  try {
    parseMarkup("<b>ciao <i>mondo</b> ancora</i>");   // incrociati: deve avvisare
    parseMarkup("<b>ciao</b> <i>mondo</i>");          // ben formato: niente avviso
    parseMarkup("ciao <b>mondo");                     // non chiuso: niente avviso
    parseMarkup("ciao </b> mondo");                   // spaiato: niente avviso
  } finally {
    console.warn = originale;
  }
  eq("un solo avviso", 1, avvisi.length);
  eq("dice quale tag", true, avvisi[0]?.includes("</b>") && avvisi[0]?.includes("<i>"));
  eq("riporta il testo", true, avvisi[0]?.includes("ciao <i>mondo"));
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
