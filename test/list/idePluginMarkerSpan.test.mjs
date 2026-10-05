// Estensione per l'editor (idePlugin): la voce sotto il cursore (markerSpan.mjs), per la sonda
// inversa. Le posizioni sono quelle vere: le dà extractMarkers di questo repo su un sorgente con
// voci su una riga e su più righe (<Translate> che va a capo, un template ts`…`, un testo JSX
// marcato lungo, autoWrap). Un cursore dentro una voce su più righe risale fino a lei; uno fuori no.
//
//   node test/list/idePluginMarkerSpan.test.mjs
import { join } from "node:path";
import { tmpdir } from "node:os";
import extractMarkers from "../../lib/dev/babel/extractMarkers.js";
import { entryAtCursor, markerEnd } from "../../idePlugin/src/views/results/markerSpan.mjs";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(56), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const SORGENTE = `import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";
export default function Hero() {
  const ts = useTranslateToString();
  const nota = ts\`Una nota
    su due righe\`;
  return (
    <section>
      <h1><Translate>Il mare arriva in tavola<br /><i>prima del tramonto</i></Translate></h1>
      <p className="lead">
        <Translate>
          Ogni mattina alle sei le barche rientrano in porto.
          Alle sette lo chef è già sul molo.
        </Translate>
      </p>
      <p>_%_Un testo marcato
        che va a capo_%_</p>
      <p title="_%_Titolo_%_">testo fuori</p>
      <footer>
        piè di pagina, niente voci
      </footer>
      <p>_%_Frase <b>{nome}</b> avvolta da autoWrap
        su due righe_%_</p>
    </section>
  );
}
`;
const voci = [];
extractMarkers(SORGENTE, {
  filename: join(tmpdir(), "src", "Hero.jsx"), table: {}, rewrite: false, baseDir: tmpdir(), hints: {},
  autoWrap: /^p$/, warn: () => {}, onMarker: (v) => voci.push(v),
});
voci.sort((a, b) => a.line - b.line || a.column - b.column);
const testo = (v) => v?.text.replace(/\s+/g, " ").slice(0, 20) ?? null;
// Il cursore: riga e colonna da 1, come nelle voci.
const su = (line, column) => testo(entryAtCursor(voci, SORGENTE, line, column));

console.log("\n== le voci, come le dà la libreria ==");
eq("le posizioni d'inizio", [[4, 16], [8, 11], [10, 9], [15, 10], [17, 16], [21, 10]], voci.map((v) => [v.line, v.column]));

console.log("\n== sulla riga ==");
eq("sulla riga d'inizio di un <Translate>", "Il mare arriva in ta", su(8, 40));
eq("un attributo marcato", "Titolo", su(17, 2));

console.log("\n== risalendo, dentro una voce su più righe ==");
eq("<Translate> che va a capo: le righe di mezzo", ["Ogni mattina alle se", "Ogni mattina alle se"], [su(11, 15), su(12, 5)]);
eq("…anche sulla riga del tag che chiude", "Ogni mattina alle se", su(13, 9));
eq("template ts`…` su due righe", "Una nota su due righ", su(5, 8));
eq("testo JSX marcato che va a capo", "Un testo marcato che", su(16, 5));
eq("autoWrap: la seconda riga, oltre i tag in mezzo", true, /^Frase/.test(su(22, 5) ?? ""));

console.log("\n== fuori: niente ==");
eq("subito dopo il </Translate>", null, su(14, 7));
eq("una riga senza voci, sotto una voce che non la contiene", null, su(19, 9));
eq("la riga dopo il template", null, su(6, 3));
eq("dopo il _%_ che chiude, sulla stessa riga", null, su(22, 26));
eq("senza il testo del documento: solo la riga", [null, "Titolo"], [testo(entryAtCursor(voci, null, 11, 15)), testo(entryAtCursor(voci, null, 17, 2))]);

console.log("\n== markerEnd ==");
eq("elemento con lo stesso nome annidato", 25, markerEnd("<b>uno <b>due</b> tre</b> resto", 0));
eq("stringa: fino alla virgoletta, gli escape saltati", 8, markerEnd('"a\\"b c" dopo', 0));
eq("template con ${…} che contiene un backtick", 14, markerEnd("`a ${ `x` } b` z", 0));
eq("un elemento mai chiuso: null, nel dubbio non sceglie", null, markerEnd("<Translate>senza fine", 0));
eq("testo marcato: fino al _%_ che chiude, tag compresi", 21, markerEnd("_%_a <b>{x}</b>\n b_%_</p>", 0));

console.log(fail ? `\n${fail} KO` : "\ntutto ok");
process.exit(fail ? 1 : 0);
