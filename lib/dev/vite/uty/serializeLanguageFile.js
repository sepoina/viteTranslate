// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import buildLanguageHeader from "./buildLanguageHeader.js";

const SEPARATOR = "#  ----to be translated------------------------------------------";
const RULE = `#  ${"-".repeat(49)}`;
const BUILDER_KEY = "__builder__";

// Le chiavi generate (`Basename_checksum`) e `__builder__` rientrano sempre qui: è la stessa
// forma che parseLanguageFile accetta, e la garanzia che tagliare la riga al primo ":" non
// possa mai tagliare dentro una chiave. Se una chiave non rientrasse, il file sarebbe
// illeggibile alla prossima sync: meglio accorgersene scrivendo che leggendo.
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * Serializza le entry di una lingua nel testo del file su disco: intestazione a commento,
 * una voce per riga a colonna 0, e un separatore a commento prima delle chiavi non tradotte.
 *
 * Ogni valore passa da `JSON.stringify` e da nient'altro. È la regola che tiene insieme il
 * formato: JSON è un sottoinsieme di YAML 1.2, quindi ciò che scriviamo è leggibile sia dal
 * nostro parser stretto sia da un parser YAML vero, con lo stesso identico risultato. Basta
 * "abbellire" una riga a mano — togliere le virgolette a una chiave dentro `__builder__`, per
 * dire — perché i due comincino a leggere cose diverse senza che nessuno se ne accorga.
 *
 * @param {object} p
 * @param {string} p.tag
 * @param {boolean} p.isSource
 * @param {[string, any][]} p.translated
 * @param {[string, any][]} p.untranslated
 * @param {Date} p.now
 * @returns {string}
 */
export default function serializeLanguageFile({ tag, isSource, translated, untranslated, now }) {
  const header = buildLanguageHeader({ tag, isSource, missingCount: untranslated.length, now });

  // "incomplete: false" è il valore implicito (vedi parseLanguageFile.js, che lo ripristina in
  // lettura se assente): ometterlo quando è false tiene il file pulito, riservando la riga a
  // quando c'è davvero qualcosa da segnalare (incomplete: true).
  const entryLine = ([key, value]) => {
    if (!KEY_RE.test(key)) {
      throw new Error(`[vitetranslate] key "${key}" cannot be written to a language file: it must match ${KEY_RE}`);
    }
    if (key === BUILDER_KEY && value?.incomplete === false) {
      const { incomplete, ...rest } = value;
      return `${key}: ${JSON.stringify(rest)}`;
    }
    return `${key}: ${JSON.stringify(value)}`;
  };

  const lines = translated.map(entryLine);
  // `__builder__` è dati generati, non testo da tradurre: la riga di separazione lo tiene
  // visibilmente fuori dall'elenco su cui il traduttore lavora.
  if (translated[0]?.[0] === BUILDER_KEY) lines.splice(1, 0, RULE);
  if (untranslated.length) {
    lines.push("", SEPARATOR, ...untranslated.map(entryLine));
  }

  return `${header}\n${lines.join("\n")}\n`;
}
