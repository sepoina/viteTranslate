// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Dall'AST validato da parseIcu (ok: true) all'espressione JS. Il markup (`<b>`) e l'ICU si
// annidano in entrambe le direzioni, quindi ogni messaggio (principale e ogni ramo) si
// ricompone come stringa modello con un token privato per ogni elemento ICU — lo stesso
// meccanismo con cui oggi si spezza "%s" — e su quella stringa gira il parseMarkup di sempre.

import parseMarkup from "../parseMarkup.js";
import { ARG, nodesExpr, pushTextParts } from "../emitTree.js";
import { TYPE, SLOT_OPEN, SLOT_CLOSE } from "../../../icu/parse.js";

// Stessa costante di compileTable.js (nome dell'helper "_cat" nel modulo generato): non è
// esportata da emitTree.js, quindi resta una seconda dichiarazione della stessa stringa.
const CAT = "_cat";

/**
 * @param {object[]} ast - un AST già validato da parseIcu (ok: true): qui non si fallisce più
 * @param {{ locale?: string, used: object, warn?: Function }} ctx
 * @returns {string} un'espressione JS
 */
export function compileIcuEntry(ast, { locale, used, warn }) {
  const st = { L: locale ? JSON.stringify(locale) : "void 0", used, warn };
  const { expr, dynamic } = messageExpr(ast, st, null, 0);
  return dynamic ? `(a, o) => ${expr}` : expr;
}

// `text` è esattamente lo slot k, senza nessun letterale intorno: l'espressione è quella
// dello slot, non un `_cat` con un solo elemento dentro.
function onlySlot(text, slots) {
  const m = new RegExp(`^${SLOT_OPEN}(\\d+)${SLOT_CLOSE}$`).exec(text);
  return m ? slots[Number(m[1])] : null;
}

function messageExpr(ast, st, pound, depth) {
  let template = "";
  const slots = [];
  const slot = (e) => {
    slots.push(e);
    return `${SLOT_OPEN}${slots.length - 1}${SLOT_CLOSE}`;
  };
  for (const node of ast) {
    if (node.type === TYPE.literal) template += node.value;
    else if (node.type === TYPE.pound) template += pound === null ? "#" : slot(pound);
    else template += slot(elementIcu(node, st, depth));
  }

  const nodes = parseMarkup(template, st.warn);
  let expr;
  if (nodes.length === 0 || (nodes.length === 1 && nodes[0].type === "text")) {
    const text = nodes.length === 0 ? "" : nodes[0].value;
    if (slots.length === 0) {
      expr = JSON.stringify(text);
    } else {
      const single = onlySlot(text, slots);
      if (single !== null) {
        expr = single;
      } else {
        const parts = [];
        pushTextParts(text, { n: 0 }, parts, slots);
        expr = `${CAT}([${parts.join(", ")}])`;
        st.used.cat = true;
        st.used.jsxs = true;
        st.used.fragment = true;
      }
    }
  } else {
    expr = nodesExpr(nodes, { n: 0 }, st.used, slots);
  }
  return { expr, dynamic: slots.length > 0 };
}

// Qui `v` è la lettura del valore, e accende sempre used.arg (_m e _named stanno nel blocco
// di _arg, e servono anche a _key).
function elementIcu(node, st, depth) {
  const key = node.value;
  st.used.arg = true;
  let v;
  if (/^\d+$/.test(key)) {
    v = `${ARG}(a, ${Number(key)})`;
  } else {
    st.used.key = true;
    v = `_key(a, ${JSON.stringify(key)})`;
  }

  switch (node.type) {
    case TYPE.argument:
      return v;
    case TYPE.number: {
      st.used.icu.add("icuNumber");
      return `_icuN(${v}, ${st.L}, ${optRef(node.vtOptions, st)})`;
    }
    case TYPE.date:
    case TYPE.time: {
      st.used.icu.add("icuDate");
      return `_icuD(${v}, ${st.L}, ${optRef(node.vtOptions, st)}, o)`;
    }
    case TYPE.select: {
      st.used.icu.add("icuSelect");
      const branches = Object.entries(node.options)
        .map(([k, b]) => `${JSON.stringify(k)}: () => ${messageExpr(b.value, st, null, depth).expr}`)
        .join(", ");
      return `_icuS(${v}, { ${branches} })`;
    }
    case TYPE.plural: {
      st.used.icu.add("icuPlural");
      const h = `h${depth}`;
      const exact = [];
      const cats = [];
      for (const [k, b] of Object.entries(node.options)) {
        const branchExpr = `(${h}) => ${messageExpr(b.value, st, h, depth + 1).expr}`;
        if (k.startsWith("=")) exact.push(`${JSON.stringify(k.slice(1))}: ${branchExpr}`);
        else cats.push(`${JSON.stringify(k)}: ${branchExpr}`);
      }
      const exactExpr = exact.length > 0 ? `{ ${exact.join(", ")} }` : "null";
      return `_icuP(${v}, ${st.L}, ${node.pluralType === "ordinal" ? 1 : 0}, ${node.offset ?? 0}, ${exactExpr}, { ${cats.join(", ")} })`;
    }
    default:
      return v;
  }
}

function optRef(opts, st) {
  if (opts === undefined) return "void 0";
  const json = JSON.stringify(opts);
  let name = st.used.icuOpts.get(json);
  if (name === undefined) {
    name = `_o${st.used.icuOpts.size}`;
    st.used.icuOpts.set(json, name);
  }
  return name;
}
