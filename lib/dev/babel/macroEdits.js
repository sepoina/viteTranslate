// Architettura d'insieme: doc/structure.md § "2d. The macro: JSX and templates into messages".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Le modifiche di extractMarkers sono sempre state piatte e disgiunte: uno splice per nodo.
// Una macro no: SPOSTA dei pezzi di sorgente (le espressioni negli argomenti, il tag di apertura
// di uno slot), e dentro quei pezzi possono esserci altre modifiche — un `title="_%_…_%_"` sul
// link di uno slot, una seconda macro dentro un ternario. Qui si risolve l'annidamento e si
// restituisce di nuovo una lista piatta, che lo splice di sempre sa applicare.
//
// Una modifica macro è `{ start, end, pieces }`: `pieces` alterna stringhe e buchi
// `{ hole: [s, e], selfClose? }`. Ogni altra modifica resta `{ start, end, text }`.

function countNewlines(text, from, to) {
  let n = 0;
  for (let i = from; i < to; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/**
 * @param {string} code - il sorgente del file
 * @param {object[]} edits - modifiche piatte e macro, in qualunque ordine
 * @returns {Array<{start: number, end: number, text: string}>} disgiunte (l'ordine lo rifà chi chiama)
 */
export function flattenEdits(code, edits) {
  if (!edits.some((e) => e.pieces)) return edits;
  // Contenitori prima dei contenuti: a parità di inizio, la modifica più lunga prima.
  const ordered = [...edits].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const parent = new Map();
  const aperte = [];
  for (const e of ordered) {
    while (aperte.length && e.start >= aperte[aperte.length - 1].end) aperte.pop();
    const top = aperte[aperte.length - 1];
    if (top && e.end <= top.end) parent.set(e, top);
    if (e.pieces) aperte.push(e);
  }
  const figli = new Map();
  for (const [figlio, padre] of parent) {
    if (!figli.has(padre)) figli.set(padre, []);
    figli.get(padre).push(figlio);
  }
  const render = (m) => renderMacro(code, m, figli.get(m) ?? [], render);
  return ordered
    .filter((e) => !parent.has(e))
    .map((e) => (e.pieces ? { start: e.start, end: e.end, text: render(e) } : e));
}

// Il testo di una macro. Ogni buco torna sulla SUA riga d'origine (a-capo inseriti prima del
// buco, fra due token, dove sono inerti): il plugin React incide il numero di riga di ogni
// elemento JSX come VALORE nel suo jsxDEV, e un elemento spostato di riga mentirebbe a DevTools
// e agli stack di errore. In coda, gli a-capo che mancano per pareggiare le righe del pezzo
// sostituito: il numero di righe del file non cambia (invariante 17).
function renderMacro(code, m, figli, render) {
  let out = "";
  for (const p of m.pieces) {
    if (typeof p === "string") {
      out += p;
      continue;
    }
    const [s, e] = p.hole;
    const riga = countNewlines(code, m.start, s);
    const fatte = countNewlines(out, 0, out.length);
    if (riga > fatte) out += "\n".repeat(riga - fatte);
    let pezzo = applyInside(code, s, e, figli.filter((k) => k.start >= s && k.end <= e), render);
    if (p.selfClose) pezzo = pezzo.replace(/\s*>$/, " />");
    out += pezzo;
  }
  const totali = countNewlines(code, m.start, m.end);
  const fatte = countNewlines(out, 0, out.length);
  if (totali > fatte) out += "\n".repeat(totali - fatte);
  return out;
}

function applyInside(code, s, e, figli, render) {
  figli.sort((a, b) => a.start - b.start);
  let out = "";
  let cur = s;
  for (const k of figli) {
    out += code.slice(cur, k.start) + (k.pieces ? render(k) : k.text);
    cur = k.end;
  }
  return out + code.slice(cur, e);
}
