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
  const entryLine = ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`;
  const lines = translated.map(entryLine);
  if (untranslated.length) {
    lines.push("", SEPARATOR, ...untranslated.map(entryLine));
  }
  return `${header}\nexport default {\n${lines.join("\n")}\n};\n`;
}
