// Architettura d'insieme: doc/structure.md § "2d. The macro: JSX and templates into messages".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Dai figli JSX (o da un template literal) a un messaggio della tabella più i suoi argomenti.
// Non scrive codice: produce "token", e chi emette (macroForms.js) decide la forma.
//
// Regole, in ordine di importanza:
//  1. nella lingua sorgente il messaggio rende ESATTAMENTE ciò che renderebbe il JSX di partenza
//     (invariante 22): spazi con la regola di React (cleanJsxText), letterali JS resi entità;
//  2. un tag del dialetto senza attributi resta testo (`<b>…</b>`): il traduttore lo vede e lo sposta;
//  3. ogni altro elemento con contenuto è uno SLOT `<n>…</n>`: gli attributi restano nel codice;
//  4. un identificatore è un argomento con nome `{nome}`; ogni altra espressione, o un elemento
//     senza contenuto, è posizionale `{n}`. Posizionali e slot condividono il contatore.

import { cleanJsxText } from "./markerCore.js";
import { ALLOWED_TAGS, VOID_TAGS } from "../../htmlDialect.js";
import { SOURCE_OPEN, SOURCE_CLOSE, PLACEHOLDER, ICU_NAME_RE } from "../../markerSyntax.js";

/** Un motivo per cui un pezzo di codice non diventa una macro. `node` dice dove. */
export class MacroError extends Error {
  constructor(reason, node) {
    super(reason);
    this.reason = reason;
    this.node = node;
  }
}

// Le graffe sono SEMPRE letterali nel testo di una macro: gli argomenti arrivano da `{…}` JSX o
// da `${…}`, mai dal testo. Senza, `{"{ t }"}` diventerebbe un argomento ICU.
const escBraces = (s) => s.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
// Un letterale JS (`{"<b>"}`) React lo mostra alla lettera: anche `&` e `<` diventano entità.
const escLiteral = (s) => escBraces(s.replace(/&/g, "&amp;").replace(/</g, "&lt;"));

/** Un figlio che JSX scarta: testo di soli spazi con a-capo, o un commento JSX (espressione vuota). */
export const isBlank = (k, code) =>
  (k.type === "JSXText" && cleanJsxText(code.slice(k.start, k.end)) === "") ||
  (k.type === "JSXExpressionContainer" && k.expression.type === "JSXEmptyExpression");

/**
 * I token dei figli JSX. Token:
 *   { k: "text", v }                 testo del messaggio, già nella forma della tabella
 *   { k: "name", name, node }        argomento con nome (un identificatore)
 *   { k: "pos", node, el }           argomento posizionale: un'espressione, o (el: true) un
 *                                    elemento senza contenuto
 *   { k: "open", node } / { k: "close", open }   uno slot: `node` è il JSXElement
 * @throws {MacroError}
 */
export function jsxTokens(children, code) {
  const out = [];
  walkJsx(children, code, out);
  return out;
}

function walkJsx(children, code, out) {
  for (const c of children) {
    if (c.type === "JSXText") {
      const t = cleanJsxText(code.slice(c.start, c.end));
      if (t !== "") out.push({ k: "text", v: t });
    } else if (c.type === "JSXExpressionContainer") {
      const e = c.expression;
      if (e.type === "JSXEmptyExpression" || e.type === "BooleanLiteral" || e.type === "NullLiteral") continue;
      if (e.type === "StringLiteral") out.push({ k: "text", v: escLiteral(e.value) });
      else if (e.type === "TemplateLiteral" && e.expressions.length === 0) {
        const v = e.quasis[0].value.cooked;
        if (typeof v !== "string") throw new MacroError("unsupported", c);
        out.push({ k: "text", v: escLiteral(v) });
      } else if (e.type === "NumericLiteral") out.push({ k: "text", v: String(e.value) });
      else if (e.type === "Identifier" && ICU_NAME_RE.test(e.name)) out.push({ k: "name", name: e.name, node: e });
      else out.push({ k: "pos", node: e, el: false });
    } else if (c.type === "JSXFragment") {
      walkJsx(c.children, code, out);
    } else if (c.type === "JSXElement") {
      const op = c.openingElement;
      const name = op.name.type === "JSXIdentifier" ? op.name.name : null;
      const dialect = name !== null && /^[a-z]/.test(name) && ALLOWED_TAGS.has(name) && op.attributes.length === 0;
      const content = c.children.some((k) => !isBlank(k, code));
      if (dialect && VOID_TAGS.has(name)) {
        if (content) throw new MacroError("unsupported", c);
        out.push({ k: "text", v: `<${name}>` });
      } else if (dialect) {
        out.push({ k: "text", v: `<${name}>` });
        walkJsx(c.children, code, out);
        out.push({ k: "text", v: `</${name}>` });
      } else if (!content) {
        out.push({ k: "pos", node: c, el: true });
      } else {
        const open = { k: "open", node: c };
        out.push(open);
        walkJsx(c.children, code, out);
        out.push({ k: "close", open });
      }
    } else {
      // JSXSpreadChild ({...items}) e qualunque forma futura
      throw new MacroError("unsupported", c);
    }
  }
}

/** I token di un template literal (`quasis`/`expressions` del nodo TemplateLiteral). */
export function templateTokens(quasis, expressions) {
  const out = [];
  for (let i = 0; i < quasis.length; i++) {
    const v = quasis[i].value.cooked;
    if (typeof v !== "string") throw new MacroError("unsupported", quasis[i]);
    if (v !== "") out.push({ k: "text", v: escBraces(v) });
    if (i < expressions.length) {
      const e = expressions[i];
      if (e.type === "Identifier" && ICU_NAME_RE.test(e.name)) out.push({ k: "name", name: e.name, node: e });
      else out.push({ k: "pos", node: e, el: false });
    }
  }
  return out;
}

/**
 * Il messaggio e la sua lista di argomenti.
 *
 * Numerazione (la regola documentata di doc/icu.md, "Arguments: positions or names"): se c'è
 * almeno un nome, gli argomenti viaggiano come `[{ nomi }, pos1, pos2…]` e i posizionali
 * partono da 1; altrimenti `[pos0, pos1…]`. Con soli nomi, l'oggetto `{ nomi }`. Così la stessa
 * `a` vale identica in `<Translate a>`, `ts(t, a)`, `__vtNode(t, a)` e nella forma `{ t, a }`.
 *
 * @param {object[]} tokens
 * @param {"optional"|"required"} markers - "required": il testo DEVE aprirsi e chiudersi con
 *   `_%_` (template marcato, frase spezzata); "optional": i due delimitatori ai capi si tolgono se ci sono
 * @returns {{ message: string, names: string[], positions: object[] }}
 * @throws {MacroError} "marker" (un `_%_` fuori posto), "percent-s" (un `%s` nel testo),
 *   "empty" (nessun testo statico: non è una frase da tradurre)
 */
export function buildMessage(tokens, markers) {
  const names = [];
  for (const t of tokens) if (t.k === "name" && !names.includes(t.name)) names.push(t.name);
  const base = names.length > 0 ? 1 : 0;
  const positions = [];
  let raw = "";
  let text = "";
  for (const t of tokens) {
    if (t.k === "text") { raw += t.v; text += t.v; }
    else if (t.k === "name") raw += `{${t.name}}`;
    else if (t.k === "pos") { t.index = base + positions.length; positions.push(t); raw += `{${t.index}}`; }
    else if (t.k === "open") { t.index = base + positions.length; positions.push(t); raw += `<${t.index}>`; }
    else raw += `</${t.open.index}>`;
  }
  let message = raw.trim();
  const marked = message.length >= SOURCE_OPEN.length + SOURCE_CLOSE.length &&
    message.startsWith(SOURCE_OPEN) && message.endsWith(SOURCE_CLOSE);
  if (marked) message = message.slice(SOURCE_OPEN.length, -SOURCE_CLOSE.length);
  else if (markers === "required") throw new MacroError("marker");
  if (message.includes(SOURCE_OPEN)) throw new MacroError("marker");
  if (message.includes(PLACEHOLDER)) throw new MacroError("percent-s");
  // Testo statico vero, tolti tag, delimitatori ed entità di spazio: senza, non c'è una frase.
  const statico = text.split(SOURCE_OPEN).join("").replace(/<\/?[a-z]+>/g, "").replace(/&nbsp;|&#160;/g, "").trim();
  if (statico === "") throw new MacroError("empty");
  return { message, names, positions };
}

/**
 * I pezzi di codice dell'argomento `a`: stringhe e "buchi" (pezzi di sorgente da copiare, con le
 * modifiche annidate applicate — vedi macroEdits.js). `null` se non ci sono argomenti.
 *
 * @param {{ names: string[], positions: object[] }} built
 * @param {{ wrap: string|null }} opts - `wrap`: il nome con cui avvolgere i valori JSX (l'alias di
 *   jsxArg); `null` per i template (nessuna normalizzazione)
 */
export function argsPieces(built, { wrap }) {
  const { names, positions } = built;
  if (names.length === 0 && positions.length === 0) return null;
  const valore = (src) => (wrap ? `${wrap}(${src})` : src);
  const nomi = names.length ? `{ ${names.map((n) => `${n}: ${valore(n)}`).join(", ")} }` : null;
  if (positions.length === 0) return [nomi];
  const pieces = ["["];
  if (nomi) pieces.push(nomi, ", ");
  positions.forEach((p, i) => {
    if (i > 0) pieces.push(", ");
    if (p.k === "open") {
      pieces.push({ hole: [p.node.openingElement.start, p.node.openingElement.end], selfClose: true });
    } else if (p.el) {
      pieces.push({ hole: [p.node.start, p.node.end] });
    } else {
      if (wrap) pieces.push(`${wrap}(`);
      pieces.push({ hole: [p.node.start, p.node.end] });
      if (wrap) pieces.push(")");
    }
  });
  pieces.push("]");
  return pieces;
}

// Il nome di un attributo JSX, anche con namespace (`xlink:href`); "…" per uno spread.
function nomeAttributo(a) {
  if (a.type !== "JSXAttribute") return "…";
  return a.name.type === "JSXNamespacedName" ? `${a.name.namespace.name}:${a.name.name.name}` : a.name.name;
}

/**
 * Le indicazioni per l'LLM (mai scritte nello YAML): cosa sta dietro a ogni `{n}` e `<n>`.
 * `{nome}` non ne ha bisogno: il nome è già l'indicazione.
 */
export function hintsOf(built, code) {
  const out = {};
  for (const p of built.positions) {
    if (p.k === "open") {
      const op = p.node.openingElement;
      const attrs = op.attributes.map(nomeAttributo).join(" ");
      out[`<${p.index}>`] = `<${code.slice(op.name.start, op.name.end)}${attrs ? ` ${attrs}` : ""}>`;
    } else {
      const src = code.slice(p.node.start, p.node.end).replace(/\s+/g, " ");
      out[`{${p.index}}`] = src.length > 60 ? `${src.slice(0, 59)}…` : src;
    }
  }
  return Object.keys(out).length ? out : null;
}
