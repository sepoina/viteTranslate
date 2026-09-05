// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import languageAutonym from "./languageAutonym.js";
import { BUILDER_VERSION } from "./builderVersion.js";

const RULE = "-".repeat(49);

/**
 * Intestazione a commento in testa al file lingua generato: nome (autonimo), tag,
 * numero di chiavi ancora da tradurre, timestamp dell'ultima sincronizzazione, e la riga
 * `TableVersion` — l'unica, di tutta l'intestazione, che parseLanguageFile rilegge (vedi
 * doc/structure.md § "Invariants not to break", punto 13). Rigenerata da zero ad ogni sync;
 * ogni altra riga non deve "sopravvivere" in lettura.
 *
 * L'ultima riga, un `#` da solo, non porta informazione: è solo respiro visivo prima della
 * prima chiave. Una riga vuota avrebbe lo stesso effetto per il parser (che la salta senza
 * guardarla), ma qui si preferisce un commento: l'intestazione resta un blocco di commenti
 * riconoscibile a colpo d'occhio, senza una riga anomala in mezzo.
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
    `#  ${RULE}`,
    `#      ${title}`,
    `#       |    code: ${tag}`,
    `#       |    missing key: ${missingCount}`,
    `#       |    processed: ${processed}`,
    `#       |    TableVersion: ${BUILDER_VERSION}`,
    `#  ${RULE}`,
    `#`,
  ].join("\n");
}

// La riga del timestamp è la sola parte del file che cambia a ogni sync anche quando il
// contenuto è identico: mascherarla su entrambi i lati rende "questi byte devono cambiare?" una
// domanda con una risposta sola.
//
// Si maschera SOLO quella riga. "missing key" sta nella stessa intestazione ed è proprio il
// segnale che deve far scattare la riscrittura quando cambia solo la classificazione
// tradotto/da tradurre — cioè il lavoro che faceva "incomplete". Mascherare l'intestazione
// intera per comodità rende il confronto cieco esattamente sul caso per cui esiste.
const PROCESSED_RE = /^#.*\bprocessed:.*$/gm;

export const sameIgnoringProcessed = (a, b) =>
  a.replace(PROCESSED_RE, "") === b.replace(PROCESSED_RE, "");
