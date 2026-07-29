// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "Il dialetto HTML, in un posto solo".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

// A runtime le entità le decodificava il parser HTML del browser, dentro un <template>.
// A build time quel parser non c'è, quindi serve una tabella esplicita. Non è la tabella
// completa dell'HTML (sono più di duemila nomi, per lo più simboli matematici e alfabeto greco,
// che in un testo tradotto non compaiono): copre quello che un traduttore può davvero scrivere.
// Un nome sconosciuto viene lasciato letterale, che è anche il comportamento del browser di
// fronte a un'entità non riconosciuta.
//
// Ogni nome che manca qui ma che il browser conosce è una divergenza silenziosa: lo stesso
// testo si legge in un modo prima della sincronizzazione — dove a interpretarlo è il browser,
// via basicHtmlToNodes — e in un altro dentro la tabella compilata. Era il caso delle lettere
// accentate (`&Aacute;`, `&eacute;`), cioè esattamente i caratteri per cui un'entità si scrive.

// Blocco Latin-1 (U+00A0-U+00FF): i nomi sono elencati NELL'ORDINE dei code point, così la
// tabella si genera invece di essere battuta a mano coppia per coppia. Novantasei coppie
// scritte a mano sono novantasei occasioni di sbagliare un carattere senza che nulla lo
// segnali; qui l'unica cosa da tenere giusta è l'ordine, e il test lo verifica.
const LATIN1 = (
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr " +
  "deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest " +
  "Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml " +
  "ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig " +
  "agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml " +
  "eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml"
).split(" ");

const NAMED = {
  // sintassi: le uniche il cui significato è strutturale e non tipografico
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",

  // Le sole varianti maiuscole che l'HTML5 riconosce: un lascito storico, ma un browser le
  // scioglie e chi scrive in stampatello (o con il caps lock inserito) le produce senza
  // accorgersene. Sono sette nomi, e senza di essi il testo divergeva fra runtime e build.
  AMP: "&", LT: "<", GT: ">", QUOT: '"', COPY: "©", REG: "®", TRADE: "™",

  // punteggiatura e virgolette
  hellip: "…", mdash: "—", ndash: "–", minus: "−",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", bdquo: "„", sbquo: "‚",
  lsaquo: "‹", rsaquo: "›", bull: "•", dagger: "†", Dagger: "‡",
  prime: "′", Prime: "″", permil: "‰",

  // valuta e simboli che la Latin-1 non copre
  euro: "€", trade: "™",

  // lettere fuori dalla Latin-1: francese, tedesco, lingue slave
  OElig: "Œ", oelig: "œ", Scaron: "Š", scaron: "š", Yuml: "Ÿ", fnof: "ƒ",

  // spazi e caratteri di controllo tipografici. `zwnj`/`zwj` decidono se due lettere si legano
  // (arabo, persiano, lingue indiane), `lrm`/`rlm` la direzione di un pezzo di testo misto:
  // sono invisibili, quindi scriverli come entità è l'unico modo per vederli nel file.
  ensp: " ", emsp: " ", thinsp: " ",
  zwnj: "‌", zwj: "‍", lrm: "‎", rlm: "‏",

  // frecce e matematica elementare
  larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔",
  ne: "≠", le: "≤", ge: "≥", asymp: "≈", infin: "∞", radic: "√", sum: "∑", prod: "∏",

  // simboli d'uso comune
  hearts: "♥", diams: "♦", clubs: "♣", spades: "♠", loz: "◊",
};

for (let i = 0; i < LATIN1.length; i++) NAMED[LATIN1[i]] = String.fromCharCode(0xa0 + i);

// `[xX]`: la forma esadecimale con la X maiuscola (`&#X3C;`) è valida quanto l'altra, e il
// browser la scioglie. Qui la riconosceva solo il ramo che legge il code point qui sotto —
// che infatti guardava entrambe le lettere — ma la regex non gliela faceva mai arrivare.
const ENTITY_RE = /&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;

/**
 * Decodifica le entità HTML di una stringa: numeriche decimali (`&#60;`), numeriche
 * esadecimali (`&#x3c;`) e i nomi della tabella qui sopra. Tutto il resto resta invariato.
 *
 * Il punto e virgola è obbligatorio, come nel comportamento registrato dal browser nel corpus
 * dei test: `a &amp b` resta letterale. La sostituzione è a passata unica, quindi `&amp;lt;`
 * dà `&lt;` e non `<`: un testo già codificato due volte non si scodifica da solo.
 *
 * @param {string} text
 * @returns {string}
 */
export default function decodeEntities(text) {
  if (!text.includes("&")) return text;

  return text.replace(ENTITY_RE, (match, body) => {
    if (body[0] === "#") {
      const codePoint = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      // Fuori dal piano Unicode valido, o surrogato isolato: String.fromCodePoint
      // lancerebbe. Meglio lasciare l'entità letterale che far fallire la build.
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) return match;
      return String.fromCodePoint(codePoint);
    }
    return NAMED[body] ?? match;
  });
}

/** La tabella dei nomi, esposta perché il test possa verificarla senza ricopiarla. */
export const NAMED_ENTITIES = NAMED;
