import buildLanguageHeader from "./buildLanguageHeader.js";

const SEPARATOR = "  //  ----to be translated------------------------------------------";

/**
 * Serializza le entry di una lingua nel testo di un modulo JS (`export default {...}`),
 * con intestazione a commento e un separatore a commento prima delle chiavi non tradotte.
 *
 * @param {object} p
 * @param {string} p.tag
 * @param {boolean} p.isSource
 * @param {[string, any][]} p.translated
 * @param {[string, any][]} p.untranslated
 * @param {Date} p.now
 * @returns {string}
 */
export default function serializeLanguageModule({ tag, isSource, translated, untranslated, now }) {
  const header = buildLanguageHeader({ tag, isSource, missingCount: untranslated.length, now });
  // "incomplete: false" è il valore implicito (vedi importLanguageModule.js, che lo
  // ripristina in lettura se assente): ometterlo quando è false tiene il file pulito,
  // riservando la riga a quando c'è davvero qualcosa da segnalare (incomplete: true).
  const entryLine = ([key, value]) => {
    if (key === "__builder__" && value.incomplete === false) {
      const { incomplete, ...rest } = value;
      return `  ${JSON.stringify(key)}: ${JSON.stringify(rest)},`;
    }
    return `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`;
  };
  const lines = translated.map(entryLine);
  if (untranslated.length) {
    lines.push("", SEPARATOR, ...untranslated.map(entryLine));
  }
  return `${header}\nexport default {\n${lines.join("\n")}\n};\n`;
}
