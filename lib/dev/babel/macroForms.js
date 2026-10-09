// Architettura d'insieme: doc/structure.md § "2d. The macro: JSX and templates into messages".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Le quattro forme della macro, riconosciute durante la visita di extractMarkers:
//   1. <Translate>…</Translate> con testo, variabili e tag dentro (con o senza "_%_");
//   2. "_%_…_%_" che attraversa più figli JSX di un tag host o di un frammento (serve autoWrap);
//   3. un template marcato con `${…}`, dove c'è chi lo riceve: ts(…), <Translate t/o>, autoWrap;
//   4. ts`…`, dove `ts` viene da useTranslateToString() nello stesso file.
//
// La CHIAVE non dipende mai da autoWrap né dal componente riconosciuto (invariante 25): la
// scansione del CLI, che quelle cose non le calcola, deve trovare le stesse chiavi del transform.
// Da autoWrap dipende solo COME si riscrive.

import { registerMarker, relPathOf, cleanJsxText, markedTextOf } from "./markerCore.js";
import {
  compiledMarker, RUNTIME_IMPORT, MACRO_COMPONENTS, MACRO_HOOKS, TRANSLATE_TEXT_PROPS,
} from "../../markerSyntax.js";
import { colorize } from "../../utility.js";
import { jsxTokens, templateTokens, buildMessage, argsPieces, hintsOf, isBlank, MacroError } from "./jsxMessage.js";

// Perché una macro è stata rifiutata, per l'avviso. Le chiavi sono i `reason` di MacroError.
const MOTIVI = {
  unsupported: "a spread child, or a void tag with children, cannot be part of a sentence",
  marker: "a stray marker inside the sentence",
  "old-marker": 'an old "_%_" marker: this project uses other delimiters — run vtranslate-cli --rewriteMarker',
  "percent-s": '"%s" in the text: write the value in JSX, as {value}',
  empty: "there is no text to translate, only values",
};

// Le prop di <Translate> che dicono "il testo lo passo io": con una di queste la macro non c'entra.
const PROP_DEL_TESTO = new Set(TRANSLATE_TEXT_PROPS);

/**
 * @param {object} ctx - lo stato di extractMarkers per questo file:
 *   { code, ast, filename, baseDir, table, edits, warn, rewrite, includeFallback, wrapOn, wrapTags,
 *     green, visitorKeys, nearestComponent, tagClassOf, jsString, registraUso,
 *     alias: { T, N, S, Arg }, hints, onMarker, flags: { wrapped, usedArg } }
 * @returns {{ consumato: (pos: number) => boolean, visita: Function }}
 */
export function creaMacro(ctx) {
  const { code } = ctx;
  // La sintassi del marcatore del progetto (4.7.0): i delimitatori non sono più una costante.
  const m = ctx.syntax;

  // I nomi locali di Translate e useTranslateToString importati dal runtime, alias compresi
  // (e i loro nomi brevi, Trans e useTrans).
  const nomiTranslate = new Set();
  const nomiUseTs = new Set();
  for (const s of ctx.ast.program.body) {
    if (s.type !== "ImportDeclaration" || s.source.value !== RUNTIME_IMPORT || s.importKind === "type") continue;
    for (const sp of s.specifiers) {
      if (sp.type !== "ImportSpecifier") continue;
      const importato = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (MACRO_COMPONENTS.includes(importato)) nomiTranslate.add(sp.local.name);
      if (MACRO_HOOKS.includes(importato)) nomiUseTs.add(sp.local.name);
    }
  }

  // Le variabili che contengono `ts`: `const X = useTranslateToString()`. Una visita a parte, e
  // solo se il file importa l'hook: il tag può comparire PRIMA della dichiarazione (una closure).
  const nomiTs = new Set();
  if (nomiUseTs.size > 0) {
    (function trova(n) {
      if (n === null || typeof n !== "object") return;
      if (Array.isArray(n)) { for (const c of n) trova(c); return; }
      if (typeof n.type !== "string") return;
      if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.init?.type === "CallExpression" &&
          n.init.callee.type === "Identifier" && nomiUseTs.has(n.init.callee.name)) nomiTs.add(n.id.name);
      const keys = ctx.visitorKeys?.[n.type];
      if (keys) for (const k of keys) trova(n[k]);
      else for (const k in n) if (k !== "loc" && k !== "extra" && !k.endsWith("Comments")) trova(n[k]);
    })(ctx.ast.program);
  }

  // Le parti di sorgente che una macro ha consumato (il suo testo): lì dentro i nodi non si
  // visitano più come marcatori. I buchi (espressioni, tag di apertura degli slot) sì.
  const regioni = [];
  const consumato = (pos) => {
    for (const r of regioni) {
      if (pos < r.start || pos >= r.end) continue;
      if (!r.buchi.some(([s, e]) => pos >= s && pos < e)) return true;
    }
    return false;
  };
  const buchiDi = (tokens) => tokens
    .filter((t) => t.k === "name" || t.k === "pos" || t.k === "open")
    .map((t) => (t.k === "open" ? [t.node.openingElement.start, t.node.openingElement.end] : [t.node.start, t.node.end]));

  const dove = (node) => `:${node.loc.start.line}:${node.loc.start.column + 1}`;
  // I nomi per gli avvisi: quelli scritti nel file se ci sono (alias compresi), altrimenti i brevi.
  const nomeT = () => [...nomiTranslate][0] ?? "Trans";
  const nomeTs = () => [...nomiTs][0] ?? "trans";
  const avvisa = (kind, node, cosa, dettaglio) =>
    ctx.warn(`${cosa} in ${colorize("nome", `"${relPathOf(ctx.filename, ctx.baseDir)}${dove(node)}"`)}: ${dettaglio}`, kind);

  // Registra il messaggio (chiave, indicazioni per l'LLM, regione consumata) e restituisce il
  // marcatore compilato. Succede SEMPRE, anche col CLI e anche quando la riscrittura non si potrà
  // fare: la chiave non dipende dall'emissione.
  function registra(built, node, regione, form) {
    const id = registerMarker(built.message, ctx.filename, ctx.table, ctx.baseDir, ctx.warn, dove(node), m);
    ctx.onMarker?.({ id, text: built.message, line: node.loc.start.line, column: node.loc.start.column + 1, form });
    const h = hintsOf(built, code);
    if (h !== null && ctx.hints) ctx.hints[id] = h;
    regioni.push(regione);
    return compiledMarker(id, built.message, ctx.includeFallback);
  }

  const isTranslate = (el) => el?.type === "JSXElement" &&
    el.openingElement.name.type === "JSXIdentifier" && nomiTranslate.has(el.openingElement.name.name);

  const iniettabileIn = (frames) => {
    const frame = ctx.nearestComponent(frames, ctx.green);
    return frame !== null && ctx.green.get(frame) !== null ? frame : null;
  };

  // --- 1. <Translate>…</Translate> ---
  function macroTranslate(el, parent, frames) {
    const op = el.openingElement;
    if (op.selfClosing) return;
    if (op.attributes.some((a) => a.type === "JSXSpreadAttribute" || PROP_DEL_TESTO.has(a.name?.name))) return;
    const significativi = el.children.filter((k) => !isBlank(k, code));
    if (significativi.length === 0) return;
    // Le due forme di oggi restano quelle di oggi, byte per byte: un solo testo marcato per
    // intero, o una sola espressione (`{"_%_…_%_"}`, `{etichetta}`).
    if (significativi.length === 1) {
      const s = significativi[0];
      if (s.type === "JSXExpressionContainer") return;
      if (s.type === "JSXText" && markedTextOf(s, code, el, m) !== null) return;
    }
    let tokens, built;
    try {
      tokens = jsxTokens(el.children, code);
      built = buildMessage(tokens, "optional", m);
    } catch (e) {
      if (!(e instanceof MacroError)) throw e;
      // Un solo valore senza testo è il pass-through di sempre (<Translate><b>{x}</b></Translate>).
      if (e.reason === "empty" && significativi.length < 2) return;
      // Il nome scritto nel file (Trans o Translate, alias compresi), non quello della libreria.
      avvisa("macro-unsupported", e.node ?? el, `<${op.name.name}> left as it was`, MOTIVI[e.reason]);
      return;
    }
    const valore = registra(built, el, { start: op.end, end: el.end, buchi: buchiDi(tokens) }, "translate");
    if (!ctx.rewrite) return;
    const args = argsPieces(built, { wrap: ctx.alias.Arg });
    if (args !== null) ctx.flags.usedArg = true;
    const t = ctx.jsString(valore);
    // Forma a hook (4.4.0): autoWrap acceso, componente riconosciuto, nessun attributo — una
    // `key` deve restare su un elemento, altrimenti la lista perde la sua identità.
    const frame = ctx.wrapOn && op.attributes.length === 0 ? iniettabileIn(frames) : null;
    if (frame !== null) {
      // In posizione di figlio JSX, o di valore di attributo senza graffe (`label=<Translate>…`),
      // una chiamata va avvolta in `{…}`; in un'espressione (return, ternario, …) no.
      const graffe = parent?.type === "JSXElement" || parent?.type === "JSXFragment" || parent?.type === "JSXAttribute";
      ctx.edits.push({
        start: el.start, end: el.end,
        pieces: [graffe ? "{" : "", `${ctx.alias.N}(${t}`, ...(args ? [", ", ...args] : []), ")", graffe ? "}" : ""],
      });
      ctx.registraUso(frame, "node");
      return;
    }
    ctx.edits.push({
      start: op.end - 1, end: el.end,
      pieces: [` t={${t}}`, ...(args ? [" a={", ...args, "}"] : []), " />"],
    });
  }

  // --- 2. "_%_…_%_" spezzato da tag o espressioni, dentro un tag host o un frammento ---
  function macroSpezzata(node, frames) {
    if (node.type === "JSXElement") {
      const n = node.openingElement.name;
      if (n.type !== "JSXIdentifier" || !/^[a-z]/.test(n.name)) return;
    }
    const figli = node.children;
    for (let i = 0; i < figli.length; i++) {
      const a = figli[i];
      if (a.type !== "JSXText") continue;
      const testoA = cleanJsxText(code.slice(a.start, a.end)).trim();
      // Deve aprire senza chiudersi da solo: un testo marcato per intero è la via di sempre.
      if (!testoA.startsWith(m.start)) continue;
      if (testoA.length >= m.min && testoA.endsWith(m.end)) continue;
      let j = -1;
      for (let k = i + 1; k < figli.length; k++) {
        const b = figli[k];
        if (b.type !== "JSXText") continue;
        const testoB = cleanJsxText(code.slice(b.start, b.end)).trim();
        if (testoB.endsWith(m.end)) { j = k; break; }
        if (m.stray(testoB)) break; // un altro delimitatore in mezzo: non è una frase sola
      }
      if (j === -1) continue;
      const pezzo = figli.slice(i, j + 1);
      const ultimo = figli[j];
      let tokens, built;
      try {
        tokens = jsxTokens(pezzo, code);
        built = buildMessage(tokens, "required", m);
      } catch (e) {
        if (!(e instanceof MacroError)) throw e;
        avvisa("macro-unsupported", e.node ?? a, "marked sentence left as it was", MOTIVI[e.reason]);
        i = j;
        continue;
      }
      const valore = registra(built, a, { start: a.start, end: ultimo.end, buchi: buchiDi(tokens) }, "sentence");
      i = j;
      if (!ctx.wrapOn) {
        avvisa("macro-needs-autowrap", a, "marked sentence with tags or values", `put it inside <${nomeT()}>…</${nomeT()}>, or turn on autoWrap`);
        continue;
      }
      if (!ctx.rewrite) continue;
      const classe = node.type === "JSXFragment" ? "wrappable" : ctx.tagClassOf(node, ctx.wrapTags);
      if (classe === "textOnly") {
        avvisa("macro-unsupported", a, "marked sentence left as it was", "a text-only tag cannot hold tags or values");
        continue;
      }
      if (classe !== "wrappable") continue; // "opaque": escluso dalla RegExp dell'utente, di proposito
      // Spazi fuori dai delimitatori: come per il JSXText di sempre, uno spazio senza a-capo è
      // testo e resta ({" "}); con un a-capo JSX lo scarta comunque.
      const lead = /^\s*/.exec(code.slice(a.start, a.end))[0];
      const tail = /\s*$/.exec(code.slice(ultimo.start, ultimo.end))[0];
      const pre = lead !== "" && !lead.includes("\n") ? '{" "}' : "";
      const post = tail !== "" && !tail.includes("\n") ? '{" "}' : "";
      const args = argsPieces(built, { wrap: ctx.alias.Arg });
      if (args !== null) ctx.flags.usedArg = true;
      const t = ctx.jsString(valore);
      const frame = iniettabileIn(frames);
      const pieces = [pre];
      if (frame !== null) {
        pieces.push(`{${ctx.alias.N}(${t}`, ...(args ? [", ", ...args] : []), ")}");
        ctx.registraUso(frame, "node");
      } else {
        pieces.push(`<${ctx.alias.T} t={${t}}`, ...(args ? [" a={", ...args, "}"] : []), " />");
        ctx.flags.wrapped = true;
      }
      pieces.push(post);
      ctx.edits.push({ start: a.start, end: ultimo.end, pieces });
    }
  }

  // --- 3. template marcato con `${…}` ---
  function macroTemplate(tpl, parent, grand, frames, hostFrames) {
    if (parent?.type === "TaggedTemplateExpression" || tpl.expressions.length === 0) return;
    const primo = tpl.quasis[0].value.cooked;
    const ultimo = tpl.quasis[tpl.quasis.length - 1].value.cooked;
    if (typeof primo !== "string" || typeof ultimo !== "string") return;
    if (!primo.startsWith(m.start) || !ultimo.endsWith(m.end)) return;
    let tokens, built;
    try {
      tokens = templateTokens(tpl.quasis, tpl.expressions);
      built = buildMessage(tokens, "required", m);
    } catch (e) {
      if (!(e instanceof MacroError)) throw e;
      avvisa("macro-unsupported", tpl, "marked template left as it was", MOTIVI[e.reason]);
      return;
    }
    const valore = registra(built, tpl, { start: tpl.start, end: tpl.end, buchi: buchiDi(tokens) }, "template");
    if (!ctx.rewrite) return;
    const t = ctx.jsString(valore);
    // I valori di un template NON si normalizzano come quelli JSX: `null` resta un argomento
    // mancante (⁇), come per i marcatori di sempre (vedi il piano, "Semantica dei valori").
    const args = argsPieces(built, { wrap: null });
    const host = hostFrames[hostFrames.length - 1];
    const inAttributo = parent?.type === "JSXExpressionContainer" && grand?.type === "JSXAttribute";
    const inFiglio = parent?.type === "JSXExpressionContainer" && (grand?.type === "JSXElement" || grand?.type === "JSXFragment");
    const nomeAttr = inAttributo ? grand.name?.name : null;

    // a) primo e unico argomento di ts(…): `ts("…", a)`
    if (parent?.type === "CallExpression" && parent.arguments.length === 1 && parent.arguments[0] === tpl &&
        parent.callee.type === "Identifier" && nomiTs.has(parent.callee.name)) {
      ctx.edits.push({ start: tpl.start, end: tpl.end, pieces: [t, ", ", ...args] });
      return;
    }
    // b) chi accetta la forma { t, a }: le prop t/o di <Translate>, o il suo unico figlio
    if ((inAttributo && (nomeAttr === "t" || nomeAttr === "o") && isTranslate(host)) || (inFiglio && isTranslate(grand))) {
      ctx.edits.push({ start: tpl.start, end: tpl.end, pieces: [`({ t: ${t}, a: `, ...args, " })"] });
      return;
    }
    // c) attributo o figlio di un tag host: serve autoWrap, e un componente in cui iniettare l'hook
    const suHost = host?.openingElement?.name?.type === "JSXIdentifier" && /^[a-z]/.test(host.openingElement.name.name);
    const classe = inFiglio ? (grand.type === "JSXFragment" ? "wrappable" : ctx.tagClassOf(grand, ctx.wrapTags)) : null;
    if ((inAttributo && suHost && nomeAttr !== "key" && nomeAttr !== "ref") || (inFiglio && (classe === "wrappable" || classe === "textOnly"))) {
      if (!ctx.wrapOn) {
        avvisa("macro-needs-autowrap", tpl, "marked template in JSX", `use ${nomeTs()}\`…\` or <${nomeT()}>…</${nomeT()}>, or turn on autoWrap`);
        return;
      }
      const frame = iniettabileIn(frames);
      if (frame === null) {
        avvisa("autowrap-noscope", tpl, "marked template left as it was", `no enclosing component was recognised — use ${nomeTs()}\`…\` here, or export the component`);
        return;
      }
      const stringa = inAttributo || classe === "textOnly";
      ctx.edits.push({ start: tpl.start, end: tpl.end, pieces: [`${stringa ? ctx.alias.S : ctx.alias.N}(${t}, `, ...args, ")"] });
      ctx.registraUso(frame, stringa ? "str" : "node");
      return;
    }
    // d) nessuno che lo riceva: un oggetto { t, a } finito in un componente qualunque farebbe
    // lanciare React ("Objects are not valid as a React child"). Meglio dirlo e non toccare.
    avvisa("macro-unsupported", tpl, "marked template left as it was", `nothing here receives it — use ${nomeTs()}\`…\`, or <${nomeT()} t={…} />`);
  }

  // --- 4. ts`…` ---
  function macroTaggata(tagged) {
    if (tagged.tag.type !== "Identifier" || !nomiTs.has(tagged.tag.name)) return;
    const q = tagged.quasi;
    let tokens, built;
    try {
      tokens = templateTokens(q.quasis, q.expressions);
      built = buildMessage(tokens, "optional", m);
    } catch (e) {
      if (!(e instanceof MacroError)) throw e;
      avvisa("macro-unsupported", tagged, `${tagged.tag.name}\`…\` left as it was`, MOTIVI[e.reason]);
      return;
    }
    const valore = registra(built, tagged, { start: tagged.start, end: tagged.end, buchi: buchiDi(tokens) }, "ts");
    if (!ctx.rewrite) return;
    const args = argsPieces(built, { wrap: null });
    ctx.edits.push({
      start: tagged.start, end: tagged.end,
      pieces: [`${tagged.tag.name}(${ctx.jsString(valore)}`, ...(args ? [", ", ...args] : []), ")"],
    });
  }

  /**
   * Chiamata dal visitor di extractMarkers PRIMA della via di sempre.
   * @returns {boolean} true se il nodo è stato gestito qui (o è consumato), e la via di sempre
   *   non deve guardarlo
   */
  function visita(node, parent, grand, frames, hostFrames) {
    switch (node.type) {
      case "JSXElement":
        if (consumato(node.openingElement.end)) return true;
        if (isTranslate(node)) macroTranslate(node, parent, frames);
        else macroSpezzata(node, frames);
        return true;
      case "JSXFragment":
        if (consumato(node.openingFragment.end)) return true;
        macroSpezzata(node, frames);
        return true;
      case "TemplateLiteral":
        if (!consumato(node.start)) macroTemplate(node, parent, grand, frames, hostFrames);
        return true;
      case "TaggedTemplateExpression":
        if (!consumato(node.start)) macroTaggata(node);
        return true;
      case "StringLiteral":
      case "JSXText":
      case "TemplateElement":
        return consumato(node.start);
      default:
        return false;
    }
  }

  return { consumato, visita };
}
