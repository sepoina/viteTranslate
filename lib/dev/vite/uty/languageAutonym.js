/**
 * Nome della lingua nella lingua stessa (es. "it-IT" -> "italiano (Italia)"), via
 * Intl.DisplayNames. Se il tag non è risolvibile o l'ICU del runtime è ridotto (build
 * Node "small-icu" senza dati per quella lingua), ricade sul tag stesso.
 *
 * @param {string} tag - tag BCP 47 (es. "it-IT")
 * @returns {string}
 */
export default function languageAutonym(tag) {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag);
  } catch {
    return tag;
  }
}
