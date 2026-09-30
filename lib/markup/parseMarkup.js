// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "Il dialetto HTML, in un posto solo".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 2.

import decodeEntities from "./decodeEntities.js";
// Stesso dialetto di lib/react/basicHtmlToNodes.js, che questo parser sostituisce spostandolo
// a build time: definito una volta sola in lib/htmlDialect.js e letto da entrambi.
import { ALLOWED_TAGS, VOID_TAGS } from "../htmlDialect.js";
// Stesso testo di defaultWarn in lib/dev/babel/markerCore.js, riscritto e non importato:
// markerCore importa "path" (Node), e questo file gira anche nel browser di sviluppo
// (lib/markup/devRender.js).
const defaultWarn = (message) => console.warn(`[vitetranslate] ${message}`);

// Un tag: nome, eventuali attributi (ignorati, come a runtime), eventuale "/" finale.
//
// I valori di attributo fra virgolette sono riconosciuti come tali, così un ">" al loro
// interno non chiude il tag in anticipo: `<b title="a>b">ciao</b>` prima veniva troncato lì
// e il resto (`b">ciao`) colava nel testo. Il browser non sbaglia quel caso, quindi era una
// divergenza in cui il torto stava dalla parte del build.
// Esportato per validateTranslation.js (lib/dev/llm/): la sintassi dei tag ha un posto solo,
// vedi doc/structure.md § "Invarianti da non rompere", punto 14.
export const TAG_RE = /<(\/)?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
// Il tag numerato di uno slot (4.6.4): `<0>`, `</0>` — vedi SLOT_TAG_RE in lib/markerSyntax.js.
// Un solo scorrimento per tag e slot: i gruppi 1-3 sono quelli di TAG_RE, 4-5 quelli dello slot.
const TOKEN_RE = new RegExp(`${TAG_RE.source}|<(\\/)?(\\d{1,3})>`, "g");
const COMMENT_RE = /<!--[\s\S]*?-->/g;
// Un commento lasciato aperto arriva fino alla fine: è ciò che fa il browser, che non ha un
// "dopo" in cui tornare a leggere testo. Senza questa seconda passata il build lo mostrava
// alla lettera mentre il runtime lo inghiottiva.
const COMMENT_APERTO_RE = /<!--[\s\S]*$/;

const text = (value) => ({ type: "text", value });
const element = (tag) => ({ type: "el", tag, children: [] });

/**
 * Converte una stringa con markup elementare in un albero di nodi, senza DOM.
 *
 * Riproduce le regole di `basicHtmlToNodes`: solo i tag di formattazione sono conservati,
 * qualunque altro tag viene sciolto mantenendone il contenuto (`<div>ciao</div>` -> `ciao`),
 * nessun attributo sopravvive, i commenti spariscono. Le entità sono decodificate **dopo**
 * il riconoscimento dei tag, così `&lt;b&gt;` resta il testo letterale `<b>` invece di
 * diventare un elemento — che è quello che fa anche il browser.
 *
 * È tollerante sul markup malformato, come lo era il parser del browser: un tag di chiusura
 * spaiato viene ignorato, un tag lasciato aperto viene chiuso implicitamente a fine stringa.
 *
 * @param {string} source
 * @param {(message: string, kind?: string) => void} [warn] - dove segnalare i tag incrociati
 *   (default: la console, vedi `defaultWarn`)
 * @returns {Array<{type:"text",value:string}|{type:"el",tag:string,children:Array}|{type:"slot",index:number,children:Array}>}
 */
export default function parseMarkup(source, warn = defaultWarn) {
  const input = source.replace(COMMENT_RE, "").replace(COMMENT_APERTO_RE, "");
  const root = { type: "el", tag: null, children: [] };
  // Ogni frame ha il nodo in cui accumulare e il tag che lo chiuderà. I tag non permessi
  // entrano nello stack come frame "trasparenti": puntano al nodo del genitore, così i loro
  // figli diventano fratelli, ed esistono solo per consumare il rispettivo tag di chiusura.
  const stack = [{ node: root, tag: null }];
  const top = () => stack[stack.length - 1].node;

  let last = 0;
  let match;
  TOKEN_RE.lastIndex = 0;

  // Il nome con cui un frame compare in un avviso: uno slot è "#0" nella pila, "0" a schermo.
  const mostra = (tag) => (tag.startsWith("#") ? tag.slice(1) : tag);
  // Chiude il frame `tag` più interno; se ne attraversa altri, lo dice (vedi i tag incrociati).
  const chiudi = (tag) => {
    const depth = stack.findLastIndex((frame) => frame.tag === tag);
    if (depth > 0 && depth !== stack.length - 1) {
      warn(
        `mis-nested markup: </${mostra(tag)}> closes across ` +
        `<${stack.slice(depth + 1).map((f) => mostra(f.tag)).join(">, <")}> in "${source.slice(0, 60)}${source.length > 60 ? "…" : ""}". ` +
        `Close the inner tags first: browsers reopen them, the build does not.`,
        "mis-nested-markup"
      );
    }
    if (depth > 0) stack.length = depth;
  };

  while ((match = TOKEN_RE.exec(input)) !== null) {
    if (match.index > last) pushText(top(), input.slice(last, match.index));
    last = TOKEN_RE.lastIndex;

    // Slot: `<n>` apre un nodo "slot" (l'elemento arriva dall'argomento n), `</n>` lo chiude.
    if (match[5] !== undefined) {
      if (match[4]) { chiudi(`#${match[5]}`); continue; }
      const node = { type: "slot", index: Number(match[5]), children: [] };
      top().children.push(node);
      stack.push({ node, tag: `#${match[5]}` });
      continue;
    }

    const [, closing, rawTag] = match;
    const tag = rawTag.toLowerCase();

    if (closing) {
      // `</br>` vale `<br>`: è una regola di recupero di HTML, e il browser la applica.
      // Emularla è di due righe e toglie una divergenza; ignorarla lascerebbe il build a
      // produrre un a-capo in meno del runtime, in silenzio.
      if (VOID_TAGS.has(tag)) {
        top().children.push(element(tag));
        continue;
      }
      // Chiude il frame corrispondente più interno, scartando quelli rimasti aperti dentro.
      // Se non ce n'è nessuno il tag è spaiato e si ignora.
      chiudi(tag);
      continue;
    }

    // La "/" finale di un tag NON void non ha alcun effetto in HTML: `<b/>` apre e basta,
    // e il testo che segue ci finisce dentro. Prima veniva presa per una autochiusura, e
    // `<b/>ciao` dava `<b></b>ciao` invece di `<b>ciao</b>`.
    if (!ALLOWED_TAGS.has(tag)) {
      // Sciolto: nessun nodo creato, ma il frame serve a sapere dove finisce.
      stack.push({ node: top(), tag });
      continue;
    }

    if (VOID_TAGS.has(tag)) {
      top().children.push(element(tag));
      continue;
    }

    const node = element(tag);
    top().children.push(node);
    stack.push({ node, tag });
  }

  if (last < input.length) pushText(top(), input.slice(last));

  return root.children;
}

// Accorpa il testo al nodo precedente quando è già testo: uno `<span>` sciolto in mezzo a una
// frase spezzerebbe altrimenti la stringa in due, e il codegen emetterebbe due letterali
// adiacenti al posto di uno.
function pushText(parent, value) {
  if (value === "") return;
  const decoded = decodeEntities(value);
  const prev = parent.children[parent.children.length - 1];
  if (prev !== undefined && prev.type === "text") prev.value += decoded;
  else parent.children.push(text(decoded));
}
