// I metatag di un testo, con le loro parti: dove colorare, dove attenuare, cosa lasciare stare.
// Le regex vengono da metatagPatterns.mjs; qui si mettono insieme e si risolvono i casi che una
// regex da sola non chiude (tag con attributi, graffe annidate, elementi omonimi annidati).
// Nessun import di `vscode`: offset nel testo, non posizioni dell'editor.
//
// Un metatag:
//   form           "string" | "template" | "jsxText" | "sentence" | "translate" | "ts"
//   start, end     il metatag: delimitatori + contenuto, o il solo contenuto nella forma
//                  componente (<Translate>…</Translate>, ts`…`), senza spazi ai capi
//   inner          [s, e] il contenuto dentro i delimitatori (= [start, end] se non ce ne sono)
//   delimiters     [[s, e], …] i `_%_`, zero o due
//   componentTags  [[s, e], …] `<Translate …>` e `</Translate>`, o `ts\`` e il backtick che chiude
//   holes          [[s, e], …] dentro `inner`, quello che non è testo: tag, `{…}`, `${…}`
//   text           [[s, e], …] il testo da colorare: `inner` meno i buchi, riga per riga
//   span           [s, e] tutto quello che occupa, tag compresi: per le sovrapposizioni
import {
  SOURCE_OPEN, SOURCE_CLOSE, MIN_SOURCE_MARKED, PLACEHOLDER, TRANSLATE_TEXT_PROPS, mayHaveMarkers,
} from "../../../lib/markerSyntax.js";
import {
  STRING_RE, TEMPLATE_RE, JSX_TEXT_RE, macroNames, tsNames, tagOpenRe, taggedTemplateRe, scanLiterals, escapeRe,
} from "./metatagPatterns.mjs";

const PROP_DEL_TESTO = new Set(TRANSLATE_TEXT_PROPS);
// Oltre questa lunghezza un tag d'apertura non si legge: nel dubbio non si colora.
const TAG_MAX = 4000;
const SPAZIO = /\s/;

/**
 * Dove finisce il tag che comincia a `i` (su `<`): dopo il suo `>`, saltando stringhe e `{…}`.
 * @returns {{ end: number, selfClosing: boolean } | null}
 */
export function fineTag(text, i) {
  let graffe = 0;
  let q = null;
  const limite = Math.min(text.length, i + TAG_MAX);
  for (let j = i + 1; j < limite; j++) {
    const c = text[j];
    if (q) {
      if (c === "\\" && graffe > 0) j++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "{") graffe++;
    else if (c === "}") graffe--;
    else if (graffe === 0 && c === ">") return { end: j + 1, selfClosing: text[j - 1] === "/" };
    else if (graffe === 0 && c === "<") return null;
  }
  return null;
}

/** Dove finisce (dopo la `}`) la graffa che si apre a `i`, saltando le stringhe; null se non si chiude. */
export function fineGraffa(text, i) {
  let graffe = 0;
  let q = null;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (q) {
      if (c === "\\") j++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "{") graffe++;
    else if (c === "}" && --graffe === 0) return j + 1;
  }
  return null;
}

/** Un intervallo spezzato riga per riga, ogni pezzo senza spazi ai capi; i pezzi vuoti spariscono. */
export function lineRanges(text, [s, e]) {
  const fuori = [];
  for (let i = s; i < e; ) {
    let a = text.indexOf("\n", i);
    if (a === -1 || a > e) a = e;
    let ps = i;
    let pe = a;
    while (ps < pe && SPAZIO.test(text[ps])) ps++;
    while (pe > ps && SPAZIO.test(text[pe - 1])) pe--;
    if (pe > ps) fuori.push([ps, pe]);
    i = a + 1;
  }
  return fuori;
}

function senzaSpazi(text, [s, e]) {
  while (s < e && SPAZIO.test(text[s])) s++;
  while (e > s && SPAZIO.test(text[e - 1])) e--;
  return [s, e];
}

// I buchi di un contenuto JSX: i tag (aperti, chiusi, autochiusi) e i `{…}`.
function buchiJsx(text, s, e) {
  const buchi = [];
  for (let i = s; i < e; i++) {
    const c = text[i];
    if (c !== "<" && c !== "{") continue;
    const fine = Math.min((c === "<" ? fineTag(text, i)?.end : fineGraffa(text, i)) ?? e, e);
    buchi.push([i, fine]);
    i = fine - 1;
  }
  return buchi;
}

// I buchi di un contenuto template: i `${…}`.
function buchiTemplate(text, s, e) {
  const buchi = [];
  for (let i = s; i < e; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] !== "$" || text[i + 1] !== "{") continue;
    const fine = Math.min(fineGraffa(text, i + 1) ?? e, e);
    buchi.push([i, fine]);
    i = fine - 1;
  }
  return buchi;
}

// Il testo da colorare: `inner` meno i buchi, riga per riga.
function testoDi(text, [s, e], buchi) {
  const pezzi = [];
  let i = s;
  for (const [bs, be] of buchi) {
    if (bs > i) pezzi.push([i, bs]);
    i = Math.max(i, be);
  }
  if (i < e) pezzi.push([i, e]);
  return pezzi.flatMap((p) => lineRanges(text, p));
}

// I delimitatori dentro un contenuto già senza spazi ai capi: la forma componente li accetta
// facoltativi (`<Translate>_%_Ciao_%_</Translate>`, ts`_%_Ciao_%_`).
function delimitatoriDentro(text, s, e) {
  if (e - s < MIN_SOURCE_MARKED || !text.startsWith(SOURCE_OPEN, s) || !text.startsWith(SOURCE_CLOSE, e - SOURCE_CLOSE.length)) return [];
  return [[s, s + SOURCE_OPEN.length], [e - SOURCE_CLOSE.length, e]];
}

// Il contenuto dentro i delimitatori (o tutto, se non ce ne sono), coi suoi buchi e il suo testo.
function parti(text, s, e, delimiters, buchiDi) {
  const inner = delimiters.length ? [delimiters[0][1], delimiters[1][0]] : [s, e];
  const holes = buchiDi ? buchiDi(text, inner[0], inner[1]) : [];
  return { inner, holes, text: testoDi(text, inner, holes) };
}

// I nomi degli attributi fra `da` e `a` (dentro un tag d'apertura), con "..." per uno spread; null
// se il tag non si legge.
function nomiAttributi(text, da, a) {
  const nomi = [];
  for (let i = da; i < a; ) {
    const c = text[i];
    if (c === "{") {
      const fine = fineGraffa(text, i);
      if (fine === null) return null;
      if (/^\{\s*\.\.\./.test(text.slice(i, fine))) nomi.push("...");
      i = fine;
    } else if (c === '"' || c === "'") {
      const fine = text.indexOf(c, i + 1);
      if (fine === -1) return null;
      i = fine + 1;
    } else {
      const m = /^[A-Za-z_$][\w$:.-]*/.exec(text.slice(i, Math.min(a, i + 200)));
      if (m) nomi.push(m[0]);
      i += m ? m[0].length : 1;
    }
  }
  return nomi;
}

// Il tag che chiude l'elemento `nome` aperto prima di `da`, contando gli omonimi annidati.
function chiusura(text, nome, da) {
  const re = new RegExp(String.raw`<(\/?)${escapeRe(nome)}(?=[\s/>])`, "g");
  re.lastIndex = da;
  let profondità = 1;
  for (let m; (m = re.exec(text)); ) {
    const tag = fineTag(text, m.index);
    if (!tag) return null;
    if (m[1]) {
      if (--profondità === 0) return { start: m.index, end: tag.end };
    } else if (!tag.selfClosing) profondità++;
    re.lastIndex = tag.end;
  }
  return null;
}

// <Translate>…</Translate>: le stesse esclusioni di macroTranslate in macroForms.js (autochiuso,
// spread, una prop del testo, contenuto vuoto o un'espressione sola, nessun testo).
function translate(text, i, nome) {
  const apre = fineTag(text, i);
  if (!apre || apre.selfClosing) return null;
  const attributi = nomiAttributi(text, i + 1 + nome.length, apre.end - 1);
  if (!attributi || attributi.some((n) => n === "..." || PROP_DEL_TESTO.has(n))) return null;
  const chiude = chiusura(text, nome, apre.end);
  if (!chiude) return null;
  const [s, e] = senzaSpazi(text, [apre.end, chiude.start]);
  if (s >= e || (text[s] === "{" && fineGraffa(text, s) === e)) return null;
  const delimiters = delimitatoriDentro(text, s, e);
  const p = parti(text, s, e, delimiters, buchiJsx);
  if (!p.text.length) return null;
  return {
    form: "translate", start: s, end: e, ...p, delimiters,
    componentTags: [[i, apre.end], [chiude.start, chiude.end]], span: [i, chiude.end],
  };
}

// ts`…`: il tag e i backtick sono la parte "componente", il contenuto è il messaggio.
function tagged(text, m) {
  const [ns] = m.indices[1];
  const [cs, ce] = m.indices[2];
  const [s, e] = senzaSpazi(text, [cs, ce]);
  if (s >= e) return null;
  const delimiters = delimitatoriDentro(text, s, e);
  const p = parti(text, s, e, delimiters, buchiTemplate);
  if (!p.text.length && !delimiters.length) return null;
  return {
    form: "ts", start: s, end: e, ...p, delimiters,
    componentTags: [[ns, cs], [ce, ce + 1]], span: [ns, ce + 1],
  };
}

// Le forme in linea: i delimitatori sono i gruppi `a` e `z` della regex.
function inLinea(form, text, m, a, z, buchiDi) {
  const apre = m.indices[a];
  const chiude = m.indices[z];
  const p = parti(text, apre[0], chiude[1], [apre, chiude], buchiDi);
  return {
    form: form === "jsxText" && p.holes.length ? "sentence" : form,
    start: apre[0], end: chiude[1], ...p, delimiters: [apre, chiude], componentTags: [],
    span: m.indices[0],
  };
}

const sovrapposti = (a, b) => a.span[0] < b.span[1] && b.span[0] < a.span[1];
const inUnBuco = (dentro, fuori) => fuori.holes.some(([s, e]) => dentro.span[0] >= s && dentro.span[1] <= e);

// I tag fra i buchi si chiudono tutti dentro il contenuto, e nessuno chiude un tag aperto fuori:
// macroForms.js vuole il delimitatore che apre e quello che chiude fra fratelli dello stesso
// genitore. Due `_%_` spaiati in due <p> vicini non sono una frase.
function bilanciati(text, holes) {
  let profondità = 0;
  for (const [s, e] of holes) {
    if (text[s] !== "<") continue;
    if (text[s + 1] === "/") {
      if (--profondità < 0) return false;
    } else if (text[e - 2] !== "/") profondità++;
  }
  return profondità === 0;
}

// Le forme della macro rifiutano due cose che una frase non può contenere (MOTIVI in macroForms.js):
// un "%s" e un "_%_" in mezzo. Rifiutata, la macro non estrae niente: non la si colora.
const MACRO = new Set(["translate", "sentence", "ts"]);
const èMacro = (c) => MACRO.has(c.form) || (c.form === "template" && c.holes.length > 0);
const rifiutata = (text, c) =>
  ((c.form === "translate" || c.form === "sentence") && !bilanciati(text, c.holes)) ||
  (èMacro(c) && c.text.some(([s, e]) => {
    const pezzo = text.slice(s, e);
    return pezzo.includes(PLACEHOLDER) || pezzo.includes(SOURCE_OPEN);
  }));

/**
 * I metatag di un file sorgente, nell'ordine del testo.
 *
 * Dove può stare un candidato: una stringa o un template marcati devono essere un letterale del
 * codice, non un pezzo di un letterale più grande; un testo JSX o un <Translate> non devono
 * cominciare dentro un letterale. Così un esempio di codice scritto in una stringa
 * ('<Translate>_%_…_%_</Translate>') resta una stringa. I commenti non contano.
 *
 * Chi vince: le forme componente su quelle in linea, i template sulle stringhe, le stringhe sul
 * testo JSX. Un candidato che si sovrappone a uno già preso si scarta, a meno che non stia tutto
 * dentro un suo buco (`{"_%_…_%_"}` in un <Translate>).
 *
 * @param {string} text
 * @returns {Array<object>}
 */
export function findMetatags(text) {
  if (!mayHaveMarkers(text)) return [];
  const { masked: t, literals } = scanLiterals(text);
  const inizi = new Map(literals.map(([s, e]) => [s, e]));
  const èLetterale = (s, e) => inizi.get(s) === e;
  // Ricerca binaria: `pos` sta dentro un letterale (non sul suo primo carattere)?
  const inLetterale = (pos) => {
    let lo = 0;
    let hi = literals.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [s, e] = literals[mid];
      if (pos <= s) hi = mid - 1;
      else if (pos >= e) lo = mid + 1;
      else return true;
    }
    return false;
  };
  const { component, hook } = macroNames(t);
  const ts = tsNames(t, hook);
  const candidati = [];
  if (component.size) {
    for (const m of t.matchAll(tagOpenRe(component))) if (!inLetterale(m.index)) candidati.push(translate(t, m.index, m[1]));
  }
  if (ts.size) {
    for (const m of t.matchAll(taggedTemplateRe(ts))) {
      const backtick = m.indices[2][0] - 1;
      if (èLetterale(backtick, m.indices[0][1])) candidati.push(tagged(t, m));
    }
  }
  for (const m of t.matchAll(TEMPLATE_RE)) if (èLetterale(...m.indices[0])) candidati.push(inLinea("template", t, m, 1, 3, buchiTemplate));
  for (const m of t.matchAll(STRING_RE)) if (èLetterale(...m.indices[0])) candidati.push(inLinea("string", t, m, 2, 4, null));
  for (const m of t.matchAll(JSX_TEXT_RE)) if (!inLetterale(m.index)) candidati.push(inLinea("jsxText", t, m, 1, 3, buchiJsx));
  // I presi, in ordine di inizio. Un candidato si confronta solo con quelli che possono toccarlo:
  // da dove si inserirebbe, all'indietro finché un preso comincia prima di (suo inizio − il preso
  // più lungo), e in avanti finché cominciano prima della sua fine.
  const presi = [];
  let lunghezzaMax = 0;
  for (const c of candidati) {
    if (!c || rifiutata(t, c)) continue;
    let lo = 0;
    let hi = presi.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (presi[mid].span[0] < c.span[0]) lo = mid + 1;
      else hi = mid;
    }
    let libero = true;
    for (let j = lo - 1; libero && j >= 0 && presi[j].span[0] > c.span[0] - lunghezzaMax; j--) {
      if (sovrapposti(presi[j], c) && !inUnBuco(c, presi[j])) libero = false;
    }
    for (let j = lo; libero && j < presi.length && presi[j].span[0] < c.span[1]; j++) {
      if (sovrapposti(presi[j], c) && !inUnBuco(c, presi[j])) libero = false;
    }
    if (!libero) continue;
    presi.splice(lo, 0, c);
    lunghezzaMax = Math.max(lunghezzaMax, c.span[1] - c.span[0]);
  }
  return presi;
}
