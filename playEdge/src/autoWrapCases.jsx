import { useTranslateToString } from '@sepoina/vitetranslate/react';

//
// Dieci casi limite di autoWrap (piano 4.4.0), dal vivo: marcatori scritti SENZA <Translate>
// né ts() intorno, che il plugin riscrive da solo prima che il componente sia anche solo
// eseguito. Stesso schema a quaterna di testCases.jsx — [titolo, elemento reso, atteso,
// sorgente] — e stesso motivo per il quarto elemento scritto a mano: quando arriva qui il
// transform ha già riscritto ogni marcatore, ricostruire il sorgente dall'elemento vorrebbe
// dire decodificarlo.
//
// La configurazione di questa pagina (vedi vite.config.js) accende autoWrap con una RegExp
// che esclude deliberatamente <blockquote>, apposta per il caso 10 qui sotto.
//

// ---------------------------------------------------------------- 1. figlio nudo, componente riconosciuto
// Esportata: il classificatore la vede verde a colpo sicuro (punto 5 del semaforo, § 4.2),
// quindi il marcatore diventa una chiamata all'hook — nessun elemento, nessun <Translate>.
export function AutoWrapHost() {
  return <p>_%_Questo testo non ha nessun &lt;Translate&gt; intorno: lo ha aggiunto il plugin da solo._%_</p>;
}

// ---------------------------------------------------------------- 2. fragment nudo
// Un fragment è sempre "wrappable": non ha un nome di tag da controllare, quindi nessuna
// RegExp può escluderlo.
export function AutoWrapFragment() {
  return <>_%_Anche un fragment nudo va bene, senza bisogno di un tag intorno._%_</>;
}

// ---------------------------------------------------------------- 3. figlio nudo, componente NON riconosciuto
// Stessa forma del caso 1, ma questa funzione viene anche chiamata a mano più sotto — punto 4
// del semaforo: il classificatore la lascia rossa. Il marcatore rende comunque, ricadendo sul
// <Translate> della 4.3.0: un ROSSO di troppo non rompe mai nulla, costa solo un elemento in
// più (vedi doc/structure.md, invariante 16).
function AutoWrapUnrecognized() {
  return <p>_%_Questa funzione è anche chiamata come una funzione normale: il plugin non la riconosce come componente e ricade sul &lt;Translate&gt; classico — funziona lo stesso, solo un po' meno leggero._%_</p>;
}
// La chiamata che tiene rossa la funzione qui sopra. Il risultato non serve a nulla: serve
// solo a comparire come callee di una CallExpression, che è ciò che il classificatore guarda.
AutoWrapUnrecognized();

// ---------------------------------------------------------------- 4. attributo, forma diretta
export function AutoWrapAttrQuoted() {
  return <input readOnly placeholder="_%_Nome utente_%_" />;
}

// ---------------------------------------------------------------- 5. attributo, forma espressione
// Stesso esito del caso 4, sintassi diversa: è la forma che aveva la doppia graffa prima
// della correzione del 2026-09-15 (vedi il [!CAUTION] in doc/ImplementationPlans/4_4_0.md) —
// resta qui apposta, come guardia dal vivo contro quella classe di bug.
export function AutoWrapAttrExpr() {
  return <input readOnly placeholder={'_%_Cognome_%_'} />;
}

// ---------------------------------------------------------------- 6. attributo su un componente
// Badge non è un elemento host (il nome comincia per maiuscola): autoWrap non lo tocca per
// niente, il marcatore compilato arriva intatto come prop, e a tradurlo ci pensa Badge da sé
// con ts() — lo stesso schema che un progetto vero userebbe per un design system proprio.
function Badge({ label }) {
  const ts = useTranslateToString();
  return <span className="av-badge">{ts(label)}</span>;
}
export function AutoWrapAttrOnComponent() {
  return <Badge label="_%_Novità_%_" />;
}

// ---------------------------------------------------------------- 7. key marcata, mai riscritta
// La chiave sopravvive come marcatore compilato — un React key non deve essere leggibile, quindi
// è innocuo finché la lingua non cambia — mentre il testo visibile, un figlio come tutti gli
// altri, prende l'hook normalmente. Tradurre la key sarebbe stato l'errore: cambia identità a
// ogni cambio lingua e rimonta l'intera lista.
export function AutoWrapKeyLeftAlone() {
  return (
    <ul className="av-flat-list">
      <li key="_%_Salva_%_">_%_Salva_%_</li>
    </ul>
  );
}

// ---------------------------------------------------------------- 8. %s in un testo auto-avvolto
// Il tag/la chiamata che autoWrap emette qui non porta un array di argomenti: non c'è dove
// mettere un valore per %s. Il segnaposto assente rende con errorSolve.mark.absentDataInArray
// (⁇ di default) invece di sparire o rompere la build — ed è un avviso in console
// (autowrap-placeholder), non un errore silenzioso.
export function AutoWrapPlaceholderWarning() {
  return <p>_%_Hai %s messaggi_%_</p>;
}

// ---------------------------------------------------------------- 9. marcatore spezzato da un tag
// <b> spacca il testo in due pezzi JSX prima che l'estrazione ne veda uno intero: nessuno dei
// due apre E chiude, quindi NIENTE viene estratto — autoWrap non ha materia su cui lavorare, e
// i due frammenti restano testo letterale. Un avviso marker-split in console nomina <b> come
// causa (vedi doc/diagnostics.md); la via che funziona è un literal solo, con il tag dentro
// interpretato dal dialetto HTML a tempo di build: `t="_%_ciao <b>mondo</b>_%_"`.
export function AutoWrapMarkerSplit() {
  return <p>_%_Ciao <b>mondo</b>_%_</p>;
}

// ---------------------------------------------------------------- 10. tag escluso dalla RegExp
// <blockquote> non soddisfa la RegExp di autoWrap di questa pagina (vedi vite.config.js): la
// sua classe è "opaque", l'opzione lo esclude deliberatamente — comportamento identico a
// prima di questo piano, e senza avviso: è stato chiesto così.
export function AutoWrapOpaqueTag() {
  return <blockquote>_%_Questo tag non è nella RegExp del progetto: resta come prima, nessuna riscrittura._%_</blockquote>;
}

// Titoli marcati come il resto, nella stessa lingua sorgente del file che estendono.
const autoWrapCases = [
  '_%_autoWrap: marcatori senza <Translate>_%_',
  [
    '_%_1. Figlio nudo, componente riconosciuto_%_',
    <AutoWrapHost />,
    'Il testo tradotto, come se ci fosse un <Translate>: qui c’è solo un <p> con un marcatore dentro.',
    `export function AutoWrapHost() {
  return <p>_%_Questo testo non ha nessun <Translate> intorno: lo ha aggiunto il plugin da solo._%_</p>;
}`,
  ],
  [
    '_%_2. Fragment nudo_%_',
    <AutoWrapFragment />,
    'Il testo tradotto, senza nessun tag intorno nel sorgente originale.',
    `export function AutoWrapFragment() {
  return <>_%_Anche un fragment nudo va bene, senza bisogno di un tag intorno._%_</>;
}`,
  ],
  [
    '_%_3. Figlio nudo, componente NON riconosciuto_%_',
    <AutoWrapUnrecognized />,
    'Il testo tradotto lo stesso: il ripiego su <Translate> non è un fallimento, è la rete di sicurezza.',
    `function AutoWrapUnrecognized() {
  return <p>_%_..._%_</p>;
}
AutoWrapUnrecognized(); // la chiamata che tiene "rossa" la funzione`,
  ],
  [
    '_%_4. Attributo, forma diretta_%_',
    <AutoWrapAttrQuoted />,
    'Il placeholder tradotto, visibile nel campo vuoto.',
    `export function AutoWrapAttrQuoted() {
  return <input readOnly placeholder="_%_Nome utente_%_" />;
}`,
  ],
  [
    '_%_5. Attributo, forma espressione_%_',
    <AutoWrapAttrExpr />,
    'Stesso esito del caso 4: t="..." e t={"..."} sono equivalenti per autoWrap.',
    `export function AutoWrapAttrExpr() {
  return <input readOnly placeholder={'_%_Cognome_%_'} />;
}`,
  ],
  [
    '_%_6. Attributo su un componente_%_',
    <AutoWrapAttrOnComponent />,
    'Tradotto lo stesso, ma non da autoWrap: Badge chiama ts() al suo interno.',
    `function Badge({ label }) {
  const ts = useTranslateToString();
  return <span>{ts(label)}</span>;
}
export function AutoWrapAttrOnComponent() {
  return <Badge label="_%_Novità_%_" />;
}`,
  ],
  [
    '_%_7. La key non si traduce mai_%_',
    <AutoWrapKeyLeftAlone />,
    'Il testo visibile tradotto; la key resta il marcatore compilato, invisibile e innocuo finché la lingua non cambia.',
    `export function AutoWrapKeyLeftAlone() {
  return (
    <ul>
      <li key="_%_Salva_%_">_%_Salva_%_</li>
    </ul>
  );
}`,
  ],
  [
    '_%_8. Un %s che non può arrivare_%_',
    <AutoWrapPlaceholderWarning />,
    'Il segnaposto assente (⁇ di default): niente dove passare un argomento a una chiamata senza parametri.',
    `export function AutoWrapPlaceholderWarning() {
  return <p>_%_Hai %s messaggi_%_</p>;
}`,
  ],
  [
    '_%_9. Un tag DENTRO il marcatore lo spezza_%_',
    <AutoWrapMarkerSplit />,
    'I delimitatori restano a schermo, letterali: <b> ha spezzato il marcatore prima che l’estrazione ne vedesse uno intero. Il fix è un literal solo, non due pezzi di JSX.',
    `export function AutoWrapMarkerSplit() {
  return <p>_%_Ciao <b>mondo</b>_%_</p>;
}
// non funziona ne' con ne' senza autoWrap — usa invece:
//   <Translate t="_%_Ciao <b>mondo</b>_%_" />`,
  ],
  [
    '_%_10. Tag escluso dalla RegExp del progetto_%_',
    <AutoWrapOpaqueTag />,
    'Il marcatore compilato, a schermo: <blockquote> non è nella RegExp di autoWrap di questa pagina, quindi resta esattamente com’era prima di questo piano.',
    `// vite.config.js: autoWrap: /^(p|div|span|li|ul|ol|h[1-6]|b|strong|em|code|a|button|label)$/
export function AutoWrapOpaqueTag() {
  return <blockquote>_%_Questo tag non è nella RegExp del progetto: resta come prima, nessuna riscrittura._%_</blockquote>;
}`,
  ],
];

export default autoWrapCases;
