// A runtime le entità le decodificava il parser HTML del browser, dentro un <template>.
// A build time quel parser non c'è, quindi serve una tabella esplicita. Non è una tabella
// completa dell'HTML (sono più di duemila nomi): copre le entità che hanno senso in un testo
// tradotto, cioè i caratteri che un traduttore non può digitare direttamente o che
// romperebbero il markup. Un nome sconosciuto viene lasciato letterale, che è anche il
// comportamento del browser di fronte a un'entità non riconosciuta.
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", minus: "−", shy: "­",
  laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  bull: "•", middot: "·", deg: "°", plusmn: "±", times: "×", divide: "÷",
  copy: "©", reg: "®", trade: "™", sect: "§", para: "¶", dagger: "†",
  euro: "€", pound: "£", yen: "¥", cent: "¢", curren: "¤",
  frac12: "½", frac14: "¼", frac34: "¾", sup2: "²", sup3: "³",
  larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔",
  ne: "≠", le: "≤", ge: "≥", asymp: "≈", infin: "∞",
};

const ENTITY_RE = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;

/**
 * Decodifica le entità HTML di una stringa: numeriche decimali (`&#60;`), numeriche
 * esadecimali (`&#x3c;`) e i nomi della tabella qui sopra. Tutto il resto resta invariato.
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
