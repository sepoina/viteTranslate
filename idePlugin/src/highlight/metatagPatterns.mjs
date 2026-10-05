// Le regex dei metatag per l'evidenziazione. Si costruiscono dalle costanti di lib/markerSyntax.js:
// la sintassi la decide la libreria, qui la si traduce in pattern e basta. Nessun "_%_" e nessun
// "Translate" scritti a mano: se la libreria cambia un delimitatore, l'evidenziazione lo segue alla
// build successiva. Nessun import di `vscode`.
//
// Le regex sono un'approssimazione dichiarata di quello che fa l'estrazione con Babel
// (lib/dev/babel/extractMarkers.js, macroForms.js): servono a colorare mentre si scrive, non a
// decidere le chiavi. Il test idePluginHighlight.test.mjs misura quanto si discostano, sul sito.
import {
  SOURCE_OPEN, SOURCE_CLOSE, MACRO_COMPONENT, MACRO_HOOK, RUNTIME_IMPORT_RE,
} from "../../../lib/markerSyntax.js";

/** Un testo qualunque, letterale dentro una regex. */
export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const O = escapeRe(SOURCE_OPEN);
const C = escapeRe(SOURCE_CLOSE);
const ID = String.raw`[A-Za-z_$][\w$]*`;

// Il corpo di un template literal: escape, `$` sciolti e `${…}` con graffe annidate fino a tre
// livelli, senza backtick dentro. \x60 è il backtick, che in String.raw non si può scrivere.
const INTERP = String.raw`\$\{(?:[^{}\x60]|\{(?:[^{}\x60]|\{[^{}\x60]*\})*\})*\}`;
const TEMPLATE_BODY = String.raw`(?:[^\x60\\$]|\\[\s\S]|\$(?!\{)|${INTERP})*?`;

/**
 * Una stringa fra virgolette avvolta per intero: `"_%_ciao_%_"`, anche un attributo JSX che va a
 * capo. Gruppi: 1 la virgoletta, 2 apre, 3 il contenuto, 4 chiude. Flag `d`: gli offset dei gruppi.
 */
export const STRING_RE = new RegExp(String.raw`(["'])(${O})((?:(?!\1)[^\\]|\\[\s\S])*?)(${C})\1`, "gd");

/** Un template literal avvolto per intero, con o senza `${…}`. Gruppi: 1 apre, 2 contenuto, 3 chiude. */
export const TEMPLATE_RE = new RegExp(String.raw`\x60(${O})(${TEMPLATE_BODY})(${C})\x60`, "gd");

/**
 * Un testo JSX avvolto: comincia dopo un tag o un `{…}`, finisce prima di un tag o di un `{`. Il
 * primo delimitatore dopo quello che apre è quello che chiude, con tag e valori in mezzo (la frase
 * della macro). Gruppi: 1 apre, 2 contenuto, 3 chiude.
 */
export const JSX_TEXT_RE = new RegExp(String.raw`(?<=[>}]\s*)(${O})((?:(?!${O})[\s\S])*?)(${C})(?=\s*[<{])`, "gd");

// Un nome dentro le graffe di un import: `Translate`, `Translate as T`, `type Translate`.
const SPECIFIER_RE = new RegExp(String.raw`^\s*(?:type\s+)?(${ID})(?:\s+as\s+(${ID}))?\s*$`);

/**
 * I nomi locali del componente e dell'hook della macro importati dal runtime, alias compresi: gli
 * stessi che raccoglie macroForms.js dagli ImportDeclaration.
 * @returns {{ component: Set<string>, hook: Set<string> }}
 */
export function macroNames(text) {
  const component = new Set();
  const hook = new Set();
  for (const m of text.matchAll(RUNTIME_IMPORT_RE)) {
    for (const parte of m[1].split(",")) {
      const s = SPECIFIER_RE.exec(parte);
      if (!s) continue;
      if (s[1] === MACRO_COMPONENT) component.add(s[2] ?? s[1]);
      if (s[1] === MACRO_HOOK) hook.add(s[2] ?? s[1]);
    }
  }
  return { component, hook };
}

/** Le variabili che tengono `ts`: `const ts = useTranslateToString()` (anche `let`, `var`, tipata). */
export function tsNames(text, hooks) {
  const nomi = new Set();
  if (!hooks.size) return nomi;
  // Il tipo, se c'è, può contenere `=>`: (s: TemplateStringsArray) => string.
  const re = new RegExp(String.raw`\b(?:const|let|var)\s+(${ID})\s*(?::(?:[^=;]|=>)+)?=\s*(?:${[...hooks].map(escapeRe).join("|")})\s*\(`, "g");
  for (const m of text.matchAll(re)) nomi.add(m[1]);
  return nomi;
}

/** Dove comincia un tag con uno di questi nomi; il resto del tag lo legge fineTag. Gruppo 1: il nome. */
export const tagOpenRe = (nomi) => new RegExp(String.raw`<(${[...nomi].map(escapeRe).join("|")})(?=[\s/>])`, "g");

/** Un template con uno di questi tag, `ts\`…\``. Gruppi: 1 il tag, 2 il contenuto. */
export const taggedTemplateRe = (nomi) =>
  new RegExp(String.raw`(?<![\w$.])(${[...nomi].map(escapeRe).join("|")})\s*\x60(${TEMPLATE_BODY})\x60`, "gd");

// I letterali e i commenti del file, in un giro solo da sinistra: una stringa consumata prima non
// apre un commento ("http://…"), un commento consumato prima non apre una stringa. Le accortezze
// per il testo JSX e per le espressioni regolari, che una regex non distingue dal codice:
//   - un apostrofo dopo una lettera non apre una stringa: L'utente, dell'app, don't;
//   - dopo un `=` una stringa può andare a capo: un attributo JSX lo può fare, una stringa JS no;
//   - un `//` è un commento solo a inizio riga o dopo spazio o punteggiatura di codice: in un testo
//     JSX un URL ha `:` davanti;
//   - una `/` dopo `(`, `=`, `,`, `return`… apre un'espressione regolare: le sue virgolette
//     (/["']/) non aprono stringhe. Dopo una `}` no: in JSX è `{…}/>`.
// Un template si chiude con fineTemplate, non con la regex: dentro i suoi `${…}` c'è codice, con le
// sue stringhe, che si rilegge.
const LITERAL_SRC = [
  String.raw`(?<=^|[\s;{}(),=])\/\/[^\n]*`,
  String.raw`\/\*[\s\S]*?\*\/`,
  String.raw`(?<=(?:^|[(,=:[!&|?;{]|\breturn|\btypeof|\bcase)\s*)\/(?![*/])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[a-z]*`,
  String.raw`(?<==\s*)"(?:[^"\\]|\\[\s\S])*"`,
  String.raw`(?<==\s*)'(?:[^'\\]|\\[\s\S])*'`,
  String.raw`"(?:[^"\\\n]|\\.)*"`,
  String.raw`(?<![\p{L}\p{N}_$])'(?:[^'\\\n]|\\.)*'`,
  String.raw`\x60`,
].join("|");

/** Dove finisce (dopo il backtick) il template che si apre a `i`, `${…}` compresi; null se non si chiude. */
export function fineTemplate(text, i) {
  let graffe = 0;
  for (let j = i + 1; j < text.length; j++) {
    const c = text[j];
    if (c === "\\") j++;
    else if (graffe === 0 && c === "`") return j + 1;
    else if (c === "$" && text[j + 1] === "{") {
      graffe++;
      j++;
    } else if (graffe > 0 && c === "{") graffe++;
    else if (graffe > 0 && c === "}") graffe--;
  }
  return null;
}

// Il codice dentro i `${…}` di un template fra `s` e `e`: [inizio, fine] dentro le graffe.
function interpolazioni(text, s, e) {
  const fuori = [];
  let graffe = 0;
  let da = -1;
  for (let j = s + 1; j < e - 1; j++) {
    const c = text[j];
    if (c === "\\") j++;
    else if (c === "$" && text[j + 1] === "{" && graffe === 0) {
      graffe = 1;
      da = j + 2;
      j++;
    } else if (graffe > 0 && c === "{") graffe++;
    else if (graffe > 0 && c === "}" && --graffe === 0) fuori.push([da, j]);
  }
  return fuori;
}

/**
 * Il testo coi commenti sostituiti da spazi (a capo compresi: stessa lunghezza, stessi offset), e
 * le stringhe e i template del codice, anche quelli dentro un `${…}`.
 * @returns {{ masked: string, literals: Array<[number, number]> }} literals in ordine di inizio
 */
export function scanLiterals(text) {
  const commenti = [];
  const literals = [];
  (function giro(da, a) {
    const re = new RegExp(LITERAL_SRC, "gmu");
    re.lastIndex = da;
    for (let m; (m = re.exec(text)) && m.index < a; ) {
      const c = m[0][0];
      if (c === "`") {
        const fine = fineTemplate(text, m.index) ?? a;
        literals.push([m.index, fine]);
        for (const [s, e] of interpolazioni(text, m.index, fine)) giro(s, e);
        re.lastIndex = fine;
      } else if (c === '"' || c === "'") literals.push([m.index, m.index + m[0].length]);
      else if (m[0][1] === "/" || m[0][1] === "*") commenti.push([m.index, m.index + m[0].length]);
    }
  })(0, text.length);
  literals.sort((x, y) => x[0] - y[0]);
  if (!commenti.length) return { masked: text, literals };
  let masked = "";
  let da = 0;
  for (const [s, e] of commenti) {
    masked += text.slice(da, s) + text.slice(s, e).replace(/[^\r\n]/g, " ");
    da = e;
  }
  return { masked: masked + text.slice(da), literals };
}
