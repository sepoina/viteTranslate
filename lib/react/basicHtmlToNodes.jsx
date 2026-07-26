import React from "react";
// --- HELPERS ---

const ALLOWED_TAGS = new Set(["br", "b", "hr", "strong", "i", "em", "u", "small", "code", "wbr"]);
const VOID_TAGS = new Set(["br", "wbr", "hr"]);
const HAS_HTML_RE = /<\/?(br|hr|b|strong|i|em|u|small|code|wbr)\b|&[a-z]+;|&#\d+;/i;

// Cache degli alberi già prodotti. emitNodes è pura e gli elementi React sono
// immutabili, quindi lo stesso albero si riusa fra componenti diversi e fra
// cambi di lingua: il parsing di una stringa si paga una volta sola per app.
// La chiave è la stringa già risolta e interpolata — codifica in un solo valore
// lingua, id di traduzione, livello di fallback e argomenti, e il suo hash è
// già calcolato da V8 (le stringhe arrivano dalla tabella, sono le stesse
// istanze a ogni render). Limite FIFO perché gli argomenti interpolati possono
// generare stringhe illimitate (contatori, timer, input dell'utente).
const CACHE = new Map();
const CACHE_MAX = 256;
let template = null;

function interpolate(template, args) {
  if (!args?.length) return template;
  const list = [].concat(args);
  let i = 0;
  return template.replace(/%s/g, () => String(list[i++] ?? ""));
}

// Appiattisce i figli direttamente nell'array di destinazione: un tag non
// permesso sparisce e i suoi figli diventano fratelli, senza array annidati da
// ri-appiattire dopo. `out.length` come key basta e avanza: React richiede
// unicità solo fra fratelli, e i nodi finiscono tutti in questo stesso array.
function appendChildren(parent, out) {
  for (let node = parent.firstChild; node !== null; node = node.nextSibling) {
    const type = node.nodeType;

    if (type === 3 /* TEXT_NODE */) {
      if (node.data !== "") out.push(node.data);
      continue;
    }
    if (type !== 1 /* ELEMENT_NODE */) continue; // commenti e simili: scartati

    const tag = node.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      appendChildren(node, out); // unwrap: processa i figli, scarta il tag
      continue;
    }

    // Tag void: niente figli
    if (VOID_TAGS.has(tag)) {
      out.push(React.createElement(tag, { key: out.length }));
      continue;
    }

    out.push(React.createElement(tag, { key: out.length }, appendChildren(node, [])));
  }
  return out;
}

// <template> riusato invece di DOMParser: il contenuto resta inerte (niente
// script eseguiti, niente risorse caricate) ma non si crea un Document nuovo a
// ogni chiamata, che era il costo dominante dell'intera funzione.
function parseHtml(html) {
  if (template === null) template = document.createElement("template");
  template.innerHTML = html;
  const nodes = appendChildren(template.content, []);
  template.innerHTML = ""; // non trattenere DOM fra una chiamata e l'altra
  if (nodes.length === 0) return "";
  if (nodes.length === 1) return nodes[0];
  return <>{nodes}</>;
}

export default function emitNodes(args, inputString) {
  const html = args?.length ? interpolate(inputString, args) : inputString;

  if (!HAS_HTML_RE.test(html)) return html; // text node puro: mai in cache

  const cached = CACHE.get(html);
  if (cached !== undefined) return cached;

  let nodes;
  try {
    nodes = parseHtml(html);
  } catch (e) {
    console.error("emitNodes: HTML parsing error", e);
    return html;
  }

  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(html, nodes);
  return nodes;
}
