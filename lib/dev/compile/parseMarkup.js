import decodeEntities from "./decodeEntities.js";

// Stesso dialetto di lib/react/basicHtmlToNodes.jsx, che questo parser sostituisce spostandolo
// a build time. Le due liste vanno tenute allineate: se cambiano lì, cambiano qui.
const ALLOWED_TAGS = new Set(["br", "b", "hr", "strong", "i", "em", "u", "small", "code", "wbr"]);
const VOID_TAGS = new Set(["br", "wbr", "hr"]);

// Un tag: nome, eventuali attributi (ignorati, come a runtime), eventuale "/" di chiusura.
// Non gestisce ">" dentro un valore di attributo, ma nemmeno il codice che sostituisce lo
// faceva, e in una tabella di traduzione gli attributi non hanno comunque alcun effetto.
const TAG_RE = /<(\/)?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/)?>/g;
const COMMENT_RE = /<!--[\s\S]*?-->/g;

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
 * @returns {Array<{type:"text",value:string}|{type:"el",tag:string,children:Array}>}
 */
export default function parseMarkup(source) {
  const input = source.replace(COMMENT_RE, "");
  const root = { type: "el", tag: null, children: [] };
  // Ogni frame ha il nodo in cui accumulare e il tag che lo chiuderà. I tag non permessi
  // entrano nello stack come frame "trasparenti": puntano al nodo del genitore, così i loro
  // figli diventano fratelli, ed esistono solo per consumare il rispettivo tag di chiusura.
  const stack = [{ node: root, tag: null }];
  const top = () => stack[stack.length - 1].node;

  let last = 0;
  let match;
  TAG_RE.lastIndex = 0;

  while ((match = TAG_RE.exec(input)) !== null) {
    if (match.index > last) pushText(top(), input.slice(last, match.index));
    last = TAG_RE.lastIndex;

    const [, closing, rawTag, selfClosing] = match;
    const tag = rawTag.toLowerCase();

    if (closing) {
      // Chiude il frame corrispondente più interno, scartando quelli rimasti aperti dentro.
      // Se non ce n'è nessuno il tag è spaiato e si ignora.
      const depth = stack.findLastIndex((frame) => frame.tag === tag);
      if (depth > 0) stack.length = depth;
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // Sciolto: nessun nodo creato, ma il frame serve a sapere dove finisce.
      if (!selfClosing) stack.push({ node: top(), tag });
      continue;
    }

    if (VOID_TAGS.has(tag)) {
      top().children.push(element(tag));
      continue;
    }

    const node = element(tag);
    top().children.push(node);
    if (!selfClosing) stack.push({ node, tag });
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
