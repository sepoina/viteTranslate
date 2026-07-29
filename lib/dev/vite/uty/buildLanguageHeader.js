// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import languageAutonym from "./languageAutonym.js";

const RULE = "-".repeat(49);

/**
 * Intestazione a commento in testa al file lingua generato: nome (autonimo), tag,
 * numero di chiavi ancora da tradurre, timestamp dell'ultima sincronizzazione.
 * Rigenerata da zero ad ogni sync, non deve "sopravvivere" in lettura.
 *
 * @param {object} p
 * @param {string} p.tag - tag BCP 47 (es. "it-IT")
 * @param {boolean} p.isSource - true se tag === sourceLanguage del progetto
 * @param {number} p.missingCount - chiavi non ancora tradotte
 * @param {Date} p.now
 * @returns {string}
 */
export default function buildLanguageHeader({ tag, isSource, missingCount, now }) {
  const title = isSource ? `${languageAutonym(tag)} (sourceLanguage)` : languageAutonym(tag);
  const pad = (n) => String(n).padStart(2, "0");
  const processed = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return [
    `//  ${RULE}`,
    `//      ${title}`,
    `//       |    code: ${tag}`,
    `//       |    missing key: ${missingCount}`,
    `//       |    processed: ${processed}`,
    `//  ${RULE}`,
  ].join("\n");
}
