/**
 * Divide le chiavi di un oggetto lingua in due gruppi ordinati alfabeticamente
 * (con "__lngVersion__" sempre in testa al primo gruppo): tradotte e non tradotte.
 * Il criterio di "non tradotta" è parametrico: per una sub-lingua è "valore null",
 * per la lingua sorgente è "manca in almeno un'altra lingua" (vedi updateLanguage.js).
 *
 * @param {object} obj
 * @param {(key: string, value: any) => boolean} [isUntranslated] - default: valore null
 * @returns {{ translated: [string, any][], untranslated: [string, any][] }}
 */
export default function splitAndSortEntries(obj, isUntranslated = (key, value) => value === null) {
  const translated = [];
  const untranslated = [];
  for (const key in obj) {
    (isUntranslated(key, obj[key]) ? untranslated : translated).push([key, obj[key]]);
  }
  const byKey = ([a], [b]) => {
    if (a === "__lngVersion__") return -1;
    if (b === "__lngVersion__") return 1;
    return a.localeCompare(b);
  };
  translated.sort(byKey);
  untranslated.sort(byKey);
  return { translated, untranslated };
}
