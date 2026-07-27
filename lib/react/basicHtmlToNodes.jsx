import React from "react";
import { interpolate } from "./interpolate.js";
// --- HELPERS ---

const ALLOWED_TAGS = new Set(["br", "b", "hr", "strong", "i", "em", "u", "small", "code", "wbr"]);
const VOID_TAGS = new Set(["br", "wbr", "hr"]);
const HAS_HTML_RE = /<\/?(br|hr|b|strong|i|em|u|small|code|wbr)\b|&[a-z]+;|&#\d+;/i;

// Cache degli alberi già prodotti. basicHtmlToNodes è pura e gli elementi React sono
// immutabili, quindi lo stesso albero si riusa fra componenti diversi e fra cambi di
// lingua: il parsing di una stringa si paga una volta sola per app. La chiave è la stringa
// già interpolata — codifica in un solo valore testo e argomenti, e il suo hash è già
// calcolato da V8 quando la stringa arriva da una tabella (stessa istanza a ogni render).
// Limite FIFO perché gli argomenti possono generare stringhe illimitate (contatori, timer,
// input dell'utente): circa 1 kB a voce, quindi il tetto vale circa 256 kB.
const CACHE = new Map();
const CACHE_MAX = 256;
let template = null;

// Appiattisce i figli direttamente nell'array di destinazione: un tag non permesso sparisce
// e i suoi figli diventano fratelli, senza array annidati da ri-appiattire dopo.
// `out.length` come key basta e avanza: React richiede unicità solo fra fratelli, e i nodi
// finiscono tutti in questo stesso array.
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

// <template> riusato invece di DOMParser: il contenuto resta inerte (niente script eseguiti,
// niente risorse caricate) ma non si crea un Document nuovo a ogni chiamata, che era il
// costo dominante dell'intera funzione.
function parseHtml(html) {
  if (template === null) template = document.createElement("template");
  template.innerHTML = html;
  const nodes = appendChildren(template.content, []);
  template.innerHTML = ""; // non trattenere DOM fra una chiamata e l'altra
  if (nodes.length === 0) return "";
  if (nodes.length === 1) return nodes[0];
  return <>{nodes}</>;
}

/**
 * Converte una stringa con un HTML elementare in nodi React, senza `dangerouslySetInnerHTML`.
 *
 * Sono riconosciuti solo i tag di formattazione `<b> <strong> <i> <em> <u> <small> <code>
 * <br> <hr> <wbr>` e le entità HTML. Qualsiasi altro tag viene scartato conservandone il
 * contenuto (`<div>ciao</div>` -> `ciao`) e **nessun attributo viene mai propagato**: gli
 * elementi prodotti hanno solo la `key`. Se la stringa non contiene markup viene restituita
 * così com'è, senza allocare nulla.
 *
 * Pensata per stringhe che controlli tu — tipicamente le tue tabelle di traduzione — non
 * come sanificatore di input ostile.
 *
 * Nota: gli argomenti sono interpolati PRIMA del parsing, quindi un argomento che contiene
 * markup viene a sua volta interpretato come HTML.
 *
 * Richiede il DOM (usa un `<template>`): dove `document` non esiste, come nel rendering
 * lato server, restituisce la stringa di partenza senza convertirla.
 *
 * @param {string} text - testo, eventualmente con markup e segnaposto `%s`
 * @param {any|any[]} [args] - valori che sostituiscono i `%s`, in ordine. Uno scalare vale
 *   come lista di un elemento; un segnaposto rimasto senza valore diventa `[?]` (vedi
 *   `interpolate`).
 * @returns {React.ReactNode} stringa, singolo elemento o frammento
 *
 * @example
 * basicHtmlToNodes("Ciao <b>%s</b>", "Mario")   // -> ["Ciao ", <b>Mario</b>]
 * basicHtmlToNodes("hai %s messaggi", 0)        // -> "hai 0 messaggi"
 * basicHtmlToNodes("hai %s messaggi")           // -> "hai [?] messaggi"
 * basicHtmlToNodes("nessun markup")             // -> "nessun markup" (stessa stringa)
 */
export function basicHtmlToNodes(text, args) {
  const html = interpolate(text, args);

  if (!HAS_HTML_RE.test(html)) return html; // text node puro: mai in cache

  const cached = CACHE.get(html);
  if (cached !== undefined) return cached;

  let nodes;
  try {
    nodes = parseHtml(html);
  } catch (e) {
    console.error("basicHtmlToNodes: HTML parsing error", e);
    return html;
  }

  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(html, nodes);
  return nodes;
}

export default basicHtmlToNodes;
