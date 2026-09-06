// La sintassi del marcatore vive in lib/markerSyntax.js perché chi scrive e chi legge sono due
// programmi diversi: la prima divergenza non produce un errore, produce testo sbagliato a
// schermo. Questo test è la prova che lo scrittore (compiledMarker) e i lettori
// (markerKey/markerFallback/isCompiledMarker/markedTextOf/stripSourceMarker) sono d'accordo.
//
//   node test/list/markerSyntax.test.mjs
import {
  compiledMarker, isCompiledMarker, SOURCE_OPEN, SOURCE_CLOSE, UNTRANSLATED_KEY,
} from "../../lib/markerSyntax.js";
import { markerKey, markerFallback, stripSourceMarker } from "../../lib/react/parseCompiledMarker.js";
import { markedTextOf, registerMarker } from "../../lib/dev/babel/markerCore.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = Object.is(atteso, ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

console.log("\n== compiledMarker con fallback: scritto e riletto d'accordo ==");
{
  const conFallback = compiledMarker("App_k", "ciao", true);
  eq("markerKey", "App_k", markerKey(conFallback));
  eq("markerFallback", "ciao", markerFallback(conFallback));
}

console.log("\n== compiledMarker senza fallback ==");
{
  const senzaFallback = compiledMarker("App_k", "ciao", false);
  eq("markerKey", "App_k", markerKey(senzaFallback));
  eq("markerFallback", undefined, markerFallback(senzaFallback));
}

console.log("\n== isCompiledMarker riconosce entrambe le forme, e nient'altro ==");
{
  eq("con fallback", true, isCompiledMarker(compiledMarker("App_k", "ciao", true)));
  eq("senza fallback", true, isCompiledMarker(compiledMarker("App_k", "ciao", false)));
  eq("marcatore sorgente", false, isCompiledMarker("_%_ciao_%_"));
  eq("testo qualunque", false, isCompiledMarker("ciao"));
  eq("solo apertura", false, isCompiledMarker("_<_ciao"));
  eq("solo chiusura", false, isCompiledMarker("ciao_>_"));
}

console.log("\n== marcatore sorgente: markedTextOf e stripSourceMarker sono d'accordo ==");
{
  const marcato = `${SOURCE_OPEN}Benvenuto${SOURCE_CLOSE}`;
  eq("markedTextOf lo riconosce", marcato, markedTextOf({ type: "StringLiteral", value: marcato }));
  eq("stripSourceMarker lo riduce al contenuto", "Benvenuto", stripSourceMarker(marcato));
}

console.log("\n== UNTRANSLATED_KEY non può collidere con una chiave generata ==");
{
  // __untranslated__ rientra nel pattern delle chiavi di un file di lingua (comincia per "_"):
  // non è quello a impedire la collisione. La garanzia vera è che sanitizeName toglie ogni
  // carattere fuori da [A-Za-z0-9] e l'id finisce sempre con "_" più il checksum in base 36 —
  // un id generato non può quindi valere "__untranslated__" (due underscore, poi la parola,
  // poi due underscore: nessun checksum in base 36 la produce).
  const testi = ["ciao", "Benvenuto _%_", "", "中文", "a".repeat(50), "untranslated"];
  const silenzio = () => {};
  for (const testo of testi) {
    const table = {};
    const id = registerMarker(testo, "src/App.jsx", table, "/repo", silenzio);
    eq(`id per ${JSON.stringify(testo).slice(0, 20)} non è UNTRANSLATED_KEY`, false, id === UNTRANSLATED_KEY);
  }
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
