// La sintassi del marcatore vive in lib/markerSyntax.js perché chi scrive e chi legge sono due
// programmi diversi: la prima divergenza non produce un errore, produce testo sbagliato a
// schermo. Questo test è la prova che lo scrittore (compiledMarker) e i lettori
// (markerKey/markerFallback/isCompiledMarker/markedTextOf/stripSourceMarker) sono d'accordo.
//
//   node test/list/markerSyntax.test.mjs
import {
  compiledMarker, isCompiledMarker, SOURCE_OPEN, SOURCE_CLOSE, UNTRANSLATED_KEY,
  mayHaveMarkers, SLOT_TAG_RE, RUNTIME_IMPORT,
  MACRO_COMPONENT, MACRO_HOOK, TRANSLATE_TEXT_PROPS, RUNTIME_IMPORT_RE,
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

console.log("\n== mayHaveMarkers (4.6.4): pre-filtro dei file, _%_ oppure import della macro ==");
{
  const casi = [
    ["un marcatore sorgente da solo", `const x = "${SOURCE_OPEN}ciao${SOURCE_CLOSE}";`, true],
    ["import di Translate, niente _%_", `import { Translate } from "${RUNTIME_IMPORT}";\nexport default () => <Translate>Ciao</Translate>;`, true],
    ["import di useTranslateToString, niente _%_", `import { useTranslateToString } from "${RUNTIME_IMPORT}";`, true],
    ["import con alias", `import { Translate as T } from "${RUNTIME_IMPORT}";`, true],
    ["nessun marcatore, nessun import del runtime", `export default () => <div>ciao</div>;`, false],
    ["il pacchetto importato ma non Translate/useTranslateToString", `import { useTranslateNode } from "${RUNTIME_IMPORT}";`, false],
    ["TranslateContainer non e' Translate (nessun confine di parola)", `import { TranslateContainer } from "${RUNTIME_IMPORT}";`, false],
  ];
  for (const [nome, code, atteso] of casi) eq(nome, atteso, mayHaveMarkers(code));
}

console.log("\n== la macro: i nomi in un posto solo (piano idePlugin_highlight) ==");
{
  // MACRO_IMPORT_RE è una regex letterale: deve dire gli stessi nomi delle costanti.
  eq("il pre-filtro riconosce MACRO_COMPONENT", true, mayHaveMarkers(`import { ${MACRO_COMPONENT} } from "${RUNTIME_IMPORT}";`));
  eq("…e MACRO_HOOK", true, mayHaveMarkers(`import { ${MACRO_HOOK} } from "${RUNTIME_IMPORT}";`));
  const elenco = [...`import { ${MACRO_COMPONENT} as T, altro } from "${RUNTIME_IMPORT}";`.matchAll(RUNTIME_IMPORT_RE)];
  eq("RUNTIME_IMPORT_RE: l'elenco fra graffe nel gruppo 1", `${MACRO_COMPONENT} as T, altro`, elenco[0]?.[1].trim());
  eq("…e dice RUNTIME_IMPORT", true, RUNTIME_IMPORT_RE.source.includes(RUNTIME_IMPORT.replace(/\//g, "\\/")));
  eq("TRANSLATE_TEXT_PROPS: le prop del testo", "t,o,a,children,skipMark", TRANSLATE_TEXT_PROPS.join(","));
}

console.log("\n== SLOT_TAG_RE: matchAll su piu' slot ==");
{
  const matches = [..."<0>a</0> <12>b</12>".matchAll(SLOT_TAG_RE)];
  eq("quattro token", 4, matches.length);
  eq("apertura 0", "0", matches[0][2]);
  eq("apertura 0 non e' chiusura", "", matches[0][1]);
  eq("chiusura 0", "0", matches[1][2]);
  eq("chiusura 0 e' chiusura", "/", matches[1][1]);
  eq("apertura 12", "12", matches[2][2]);
  eq("chiusura 12", "12", matches[3][2]);
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
