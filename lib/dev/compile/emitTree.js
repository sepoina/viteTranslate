// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Spostato da compileTable.js alla lettera (piano 4.6.3, 1.5): ARG, pushTextParts, nodesExpr,
// collectParts ed elementExpr. Li usa sia il percorso di sempre (compileTable.js) sia il
// compilatore ICU (lib/dev/compile/icu/compileIcu.js), che ricompone ogni messaggio come
// stringa modello con gli slot al posto degli argomenti ICU e riusa lo stesso parseMarkup.

import { PLACEHOLDER } from "../../markerSyntax.js";
import { SLOT_OPEN, SLOT_CLOSE } from "../../icu/parse.js";

// Nome dell'helper nel modulo generato. È emesso inline in ogni chunk lingua invece di essere
// importato dal runtime: il chunk resta autosufficiente (l'unica dipendenza è il jsx-runtime,
// e solo quando serve davvero), non dipende dalla risolvibilità di un path del pacchetto da
// dentro la cartella locale dell'utente, e il minifier lo accorcia comunque a un carattere.
export const ARG = "_arg";

// Delimita uno slot ICU dentro il testo modello (vedi lib/icu/parse.js): a differenza del
// segnaposto "%s", qui serve un separatore che consumi anche i marcatori invisibili, altrimenti
// restano appiccicati ai pezzi letterali adiacenti (e una cifra letterale del testo verrebbe
// scambiata per un indice di slot).
const SLOT_RE = new RegExp(`${SLOT_OPEN}(\\d+)${SLOT_CLOSE}`);

// Spezza un testo nei suoi pezzi letterali e nelle letture dei segnaposto. Vale sia in
// posizione "figlio JSX" (dove i pezzi diventano figli e un argomento può essere un elemento)
// sia in posizione stringa (dove `_cat` li ricompone), che è ciò che rende le due forme
// coerenti fra loro: lo stesso argomento si comporta allo stesso modo in entrambe.
//
// `slots`, se presente, dice che `value` è un modello ICU (vedi lib/icu/parse.js): i
// segnaposto non sono "%s" ma i token privati `<indice>`, e ogni indice si legge
// dall'array `slots` invece che con `_arg(a, n)`.
export function pushTextParts(value, counter, parts, slots) {
  if (slots === undefined) {
    const segments = value.split(PLACEHOLDER);
    if (segments[0] !== "") parts.push(JSON.stringify(segments[0]));
    for (let i = 1; i < segments.length; i++) {
      parts.push(`${ARG}(a, ${counter.n++})`);
      if (segments[i] !== "") parts.push(JSON.stringify(segments[i]));
    }
    return;
  }
  // Messaggio ICU: i pezzi sono letterali e slot, alternati (vedi lib/dev/compile/icu/compileIcu.js).
  const pieces = value.split(SLOT_RE);
  for (let i = 0; i < pieces.length; i++) {
    if (i % 2 === 0) { if (pieces[i] !== "") parts.push(JSON.stringify(pieces[i])); }
    else { parts.push(slots[Number(pieces[i])]); counter.n++; }
  }
}

export function nodesExpr(nodes, counter, used, slots) {
  const parts = collectParts(nodes, counter, used, slots);
  if (parts.length === 0) return '""';
  if (parts.length === 1) return parts[0];
  used.fragment = true;
  used.jsxs = true;
  return `jsxs(Fragment, { children: [${parts.join(", ")}] })`;
}

export function collectParts(nodes, counter, used, slots) {
  const parts = [];
  for (const node of nodes) {
    if (node.type === "text") pushTextParts(node.value, counter, parts, slots);
    else parts.push(elementExpr(node, counter, used, slots));
  }
  return parts;
}

export function elementExpr(node, counter, used, slots) {
  const tag = JSON.stringify(node.tag);
  const children = collectParts(node.children, counter, used, slots);

  if (children.length === 0) {
    used.jsx = true;
    return `jsx(${tag}, {})`;
  }
  if (children.length === 1) {
    used.jsx = true;
    return `jsx(${tag}, { children: ${children[0]} })`;
  }
  // `jsxs` e non `jsx`: segnala a React che la lista di figli è statica, evitando l'avviso
  // sulle key che scatterebbe passando un array a `jsx`.
  used.jsxs = true;
  return `jsxs(${tag}, { children: [${children.join(", ")}] })`;
}
