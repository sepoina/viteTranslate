// jsxMessage.js: dai figli JSX (o da un template) al messaggio + argomenti. Verificato nel piano
// 4.6.4 (§ "Verifiche fatte durante il piano", prima riga: 27/27 casi identici al render React).
//
// @babel/core è una peerDependency opzionale: se manca, test/run.mjs salta il file.
//
//   node test/list/jsxMessage.test.mjs
import { parseSync } from "@babel/core";
import parserOptionsFor from "../../lib/dev/babel/parserOptionsFor.js";
import { jsxTokens, buildMessage, argsPieces, hintsOf, MacroError } from "../../lib/dev/babel/jsxMessage.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const FILENAME = "/p/src/App.jsx";

/** I figli del frammento `<>…</>` che racchiude `inner`, e il sorgente completo del file. */
function parseChildren(inner) {
  const code = `const x = (<>${inner}</>);`;
  const ast = parseSync(code, {
    filename: FILENAME, babelrc: false, configFile: false, parserOpts: parserOptionsFor(FILENAME),
  });
  let fragment = null;
  (function walk(node) {
    if (fragment || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const n of node) walk(n); return; }
    if (node.type === "JSXFragment") { fragment = node; return; }
    for (const k in node) {
      if (k === "loc" || k === "extra" || k.endsWith("Comments")) continue;
      const v = node[k];
      if (v !== null && typeof v === "object") walk(v);
    }
  })(ast.program);
  return { code, children: fragment.children };
}

/** Messaggio costruito a partire da un frammento di figli JSX. `markers`: "optional" di default,
 *  come <Translate>. */
function messageOf(inner, markers = "optional") {
  const { code, children } = parseChildren(inner);
  const tokens = jsxTokens(children, code);
  return { code, tokens, built: buildMessage(tokens, markers) };
}

/** Il motivo del rifiuto di un frammento, o null se non rifiuta. */
function motivoDi(inner, markers = "optional") {
  try {
    messageOf(inner, markers);
    return null;
  } catch (e) {
    if (!(e instanceof MacroError)) throw e;
    return e.reason;
  }
}

/** I pezzi di argsPieces, in forma leggibile: le stringhe restano stringhe, i buchi diventano
 *  "HOLE(sorgente)" (con "/self-close" se lo slot va autochiuso). */
function renderPieces(code, pieces) {
  if (pieces === null) return null;
  return pieces.map((p) => (typeof p === "string" ? p : `HOLE(${code.slice(p.hole[0], p.hole[1])})${p.selfClose ? "/self-close" : ""}`));
}

console.log("\n== Messaggi attesi (verificati nel piano) ==");

eq("tag del dialetto senza attributi restano testo",
  "testo <b>{data}</b> e <em>altro</em>", messageOf("testo <b>{data}</b> e <em>altro</em>").built.message);

eq("multiriga: a-capo e indentazione collassati come in JSX",
  "Ciao <b>{name}</b>, hai {count} messaggi nuovi.",
  messageOf("Ciao <b>{name}</b>, hai {count} messaggi\n            nuovi.").built.message);

eq('{" "} letterale resta spazio',
  "Ciao <b>{name}</b> !", messageOf('Ciao{" "}<b>{name}</b>{" "}!').built.message);

eq("un a-capo fra due tag non e' uno spazio",
  "<b>a</b><i>b</i>", messageOf("<b>a</b>\n<i>b</i>").built.message);

eq("le entita' HTML restano letterali",
  "Tom &amp; Jerry &copy; {year}", messageOf("Tom &amp; Jerry &copy; {year}").built.message);

eq("un void tag autochiuso perde la '/'",
  "riga uno<br>riga due {x}", messageOf("riga uno<br/>riga due {x}").built.message);

eq("un'espressione non identificatore e' posizionale",
  "Ciao {0}", messageOf("Ciao {user.name}").built.message);

eq('un letterale con graffe diventa entita\'',
  "Usa &#123;graffe&#125; qui {x}", messageOf('Usa {"{graffe}"} qui {x}').built.message);

eq("un letterale con '<' diventa entita', non '>'",
  "a &lt;b> c {x}", messageOf('a {"<b>"} c {x}').built.message);

eq("un commento JSX (espressione vuota) sparisce",
  "Ciao  mondo {x}", messageOf("Ciao {/* nota */} mondo {x}").built.message);

{
  const { built } = messageOf("{n} e ancora {n}");
  eq("lo stesso nome due volte -> un nome solo nell'elenco", ["n"], built.names);
  eq("il messaggio ripete comunque il segnaposto", "{n} e ancora {n}", built.message);
}

eq("un link con attributo e' uno slot",
  "Leggi la <0>documentazione</0>.", messageOf('Leggi la <a href="/docs">documentazione</a>.').built.message);

{
  const { code, built } = messageOf('Ciao <b>{name}</b>, leggi <a href={url}>guida</a>');
  eq("nomi prima, slot numerato in base 1", "Ciao <b>{name}</b>, leggi <1>guida</1>", built.message);
  eq("argsPieces: nomi + slot", ["[", "{ name: name }", ", ", "HOLE(<a href={url}>)/self-close", "]"],
    renderPieces(code, argsPieces(built, { wrap: null })));
  eq("hintsOf: <1> e' un link con href", { "<1>": "<a href>" }, hintsOf(built, code));
}

eq("un componente senza contenuto e' un valore posizionale",
  "Ciao {1} {name}", messageOf("Ciao <Avatar /> {name}").built.message);

console.log("\n== argsPieces e hintsOf su un argomento posizionale ==");
{
  const { code, built } = messageOf("Ciao {user.name}");
  eq("argsPieces: un solo posizionale, array senza nomi", ["[", "HOLE(user.name)", "]"],
    renderPieces(code, argsPieces(built, { wrap: null })));
  eq("hintsOf: {0} mostra il sorgente dell'espressione", { "{0}": "user.name" }, hintsOf(built, code));
}

console.log("\n== argsPieces: nessun argomento -> null ==");
eq("un messaggio senza argomenti non ha argsPieces", null, argsPieces(messageOf("solo testo").built, { wrap: null }));

console.log("\n== Rifiuti ==");
eq("figlio spread", "unsupported", motivoDi("{...items}"));
eq("void tag con contenuto", "unsupported", motivoDi("<br>x</br>"));
eq('"%s" nel testo', "percent-s", motivoDi("10%s"));
eq("un _%_ in mezzo alla frase", "marker", motivoDi("a_%_b_%_c{x}"));
eq("solo un'espressione, nessun testo", "empty", motivoDi("{x}"));
eq('"required" senza delimitatori', "marker", motivoDi("solo testo", "required"));

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
