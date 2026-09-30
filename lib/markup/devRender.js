// Architettura d'insieme: doc/structure.md § "Phase 4 — Runtime", "Dev fallback: devRender".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Il testo di riserva di una chiave scritta in questa sessione di `vite dev` e non ancora
// sincronizzata, reso con le STESSE regole della tabella compilata: stesso parseMarkup, stessa
// lettura degli argomenti (lib/namedArgs.js), stessi slot. Sostituisce basicHtmlToNodes in questo
// ruolo, che passava dal DOM e trasformava in stringa ogni argomento ("[object Object]" per un
// elemento React, misurato). Solo sviluppo: il manifest lo esporta in dev e vale `null` in
// produzione (buildManifest.js), quindi non entra mai nel bundle del runtime né in una build.

import { createElement, cloneElement, Fragment, isValidElement } from "react";
import parseMarkup from "./parseMarkup.js";
import { interpretIcu } from "../icu/devInterpret.js";
import { argAt } from "../namedArgs.js";
import { PLACEHOLDER } from "../markerSyntax.js";
import { DEFAULT_DIAGNOSTICS } from "../errorSolve.js";

// L'albero di un testo si calcola una volta: il testo di riserva è un letterale del sorgente
// compilato, e torna identico a ogni render. Tetto FIFO come per le altre cache del runtime.
const ALBERI = new Map();
const ALBERI_MAX = 500;
// Gli avvisi di parseMarkup (tag incrociati) li dà già il build sulla stessa stringa.
const silenzio = () => {};

function alberoDi(text) {
  let nodi = ALBERI.get(text);
  if (nodi === undefined) {
    nodi = parseMarkup(text, silenzio);
    if (ALBERI.size >= ALBERI_MAX) ALBERI.delete(ALBERI.keys().next().value);
    ALBERI.set(text, nodi);
  }
  return nodi;
}

/**
 * @param {string} text - il testo sorgente incorporato nel marcatore di sviluppo
 * @param {any} args - gli argomenti, nella forma che riceve una voce compilata
 * @param {string} [locale] - la lingua sorgente (i plurali del testo sono scritti per lei)
 * @param {{timeZone?: string}} [icu]
 * @param {{absentDataInArray: string}} [diag]
 * @returns {import("react").ReactNode}
 */
export function devRender(text, args, locale, icu, diag = DEFAULT_DIAGNOSTICS) {
  // ICU: l'interprete di sempre riduce il messaggio a testo con "%s" e valori già formattati.
  // Gli slot restano `<n>` letterali in quel testo, e leggono dagli argomenti ORIGINALI.
  const ridotto = interpretIcu(text, args, locale, icu);
  const nodi = alberoDi(ridotto ? ridotto.text : text);
  const st = { i: 0, valori: ridotto ? ridotto.values : args, args, manca: diag.absentDataInArray };
  if (nodi.length === 0) return "";
  // Stesse tre forme di compileEntry: testo semplice (ricomposto come `_cat`), un nodo solo, un
  // frammento. Vedi lib/dev/compile/compileTable.js ed emitTree.js.
  if (nodi.length === 1 && nodi[0].type === "text") return cat(parti(nodi[0].value, st));
  const out = figli(nodi, st);
  return out.length === 1 ? out[0] : createElement(Fragment, null, ...out);
}

// I pezzi di un testo: letterali e valori dei "%s", nell'ordine (come pushTextParts).
function parti(value, st) {
  const segmenti = value.split(PLACEHOLDER);
  const out = [];
  if (segmenti[0] !== "") out.push(segmenti[0]);
  for (let k = 1; k < segmenti.length; k++) {
    const v = argAt(st.valori, st.i++);
    out.push(v === undefined ? st.manca : v);
    if (segmenti[k] !== "") out.push(segmenti[k]);
  }
  return out;
}

function figli(nodi, st) {
  const out = [];
  for (const n of nodi) {
    if (n.type === "text") out.push(...parti(n.value, st));
    else if (n.type === "slot") {
      const c = figli(n.children, st);
      const e = argAt(st.args, n.index);
      // come `_slot` del chunk compilato: un elemento si clona, il resto vale assente
      out.push(isValidElement(e) ? cloneElement(e, undefined, ...c) : createElement(Fragment, null, st.manca, ...c));
    } else {
      out.push(createElement(n.tag, null, ...figli(n.children, st)));
    }
  }
  return out;
}

// Come `_cat` del chunk: tutti primitivi -> una stringa; un oggetto -> un frammento.
function cat(p) {
  for (const v of p) if (v !== null && typeof v === "object") return createElement(Fragment, null, ...p);
  return p.join("");
}
