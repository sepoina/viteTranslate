/**
 * Divide le chiavi di un oggetto lingua in due gruppi ordinati alfabeticamente
 * (con "__builder__" sempre in testa al primo gruppo): tradotte e non tradotte.
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
  // `localeCompare` con un locale ESPLICITO. Senza, l'ordine dipende dal locale di default
  // del processo: la stessa tabella poteva ordinarsi in un modo sulla macchina di chi
  // sviluppa e in un altro sulla CI, e siccome la riscrittura del file si decide
  // confrontando proprio queste liste, bastava a far risultare "cambiato" un contenuto
  // identico. Fissarlo a "en" tiene l'ordine che i file hanno già (maiuscole e minuscole
  // mescolate, come le leggerebbe una persona) senza dipendere dall'ambiente.
  const byKey = ([a], [b]) => {
    if (a === "__builder__") return -1;
    if (b === "__builder__") return 1;
    return a.localeCompare(b, "en");
  };
  translated.sort(byKey);
  untranslated.sort(byKey);
  return { translated, untranslated };
}
