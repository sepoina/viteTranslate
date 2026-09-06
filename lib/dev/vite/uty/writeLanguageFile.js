// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import splitAndSortEntries from "./splitAndSortEntries.js";
import serializeLanguageFile from "./serializeLanguageFile.js";
import { sameIgnoringProcessed } from "./buildLanguageHeader.js";

/**
 * Ordina, serializza e scrive un file di lingua — ma solo se i byte sono davvero cambiati.
 *
 * La terna ordina/serializza/confronta compariva in quattro punti (le due sync, il bootstrap
 * del plugin, la migrazione), e il confronto è la parte che è facile scrivere quasi giusta: si
 * confrontano i BYTE mascherando la sola riga `processed:`, che è l'unica a cambiare a ogni
 * sync anche quando il contenuto è identico. Mascherare l'intestazione intera renderebbe il
 * confronto cieco proprio sul caso per cui esiste (vedi buildLanguageHeader.js).
 *
 * NON cattura gli errori di scrittura: i chiamanti li raccontano in modi diversi
 * ("writing in ...", "while updating ..."), e inghiottirli qui vorrebbe dire che uno dei due
 * smette di dirlo.
 *
 * @param {object} p
 * @param {string} p.filePath
 * @param {string} p.tag
 * @param {boolean} p.isSource
 * @param {object} p.table - la tabella da scrivere
 * @param {string|null} [p.oldText=null] - il testo attualmente su disco. `null` (il default)
 *   significa "non c'è niente di affidabile da confrontare": si scrive sempre.
 * @param {(key: string, value: any) => boolean} [p.isUntranslated] - criterio di "non
 *   tradotta". Omesso vale il default di splitAndSortEntries (valore null), che è quello
 *   giusto per una sub-lingua. **Ometterlo, non passare `null`**: `null` non è `undefined` e
 *   il default non scatterebbe.
 * @param {Date} [p.now]
 * @returns {{ written: boolean, untranslated: [string, any][], text: string }}
 * @throws {Error} se la scrittura fallisce, o se una chiave non rientra nel formato
 */
export default function writeLanguageFileIfChanged({
  filePath, tag, isSource, table, oldText = null, isUntranslated, now = new Date(),
}) {
  const { translated, untranslated } = splitAndSortEntries(table, isUntranslated);
  const text = serializeLanguageFile({ tag, isSource, translated, untranslated, now });

  if (oldText !== null && sameIgnoringProcessed(oldText, text)) {
    return { written: false, untranslated, text };
  }
  fs.writeFileSync(filePath, text, "utf8");
  return { written: true, untranslated, text };
}
