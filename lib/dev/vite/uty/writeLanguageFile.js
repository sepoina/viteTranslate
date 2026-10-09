// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import splitAndSortEntries from "./splitAndSortEntries.js";
import serializeLanguageFile from "./serializeLanguageFile.js";
import { sameIgnoringProcessed } from "./buildLanguageHeader.js";
import replaceFileAtomic from "./replaceFileAtomic.js";

/**
 * Sorts and serializes a language file, and tells whether the bytes really changed. Pure, no I/O.
 *
 * The sort/serialize/compare triple used to appear in four places (the two syncs, the plugin
 * bootstrap, the migration), and the comparison is the part that is easy to write almost right:
 * it compares BYTES, masking only the `processed:` line, the one line that changes on every sync
 * even when the content is identical. Masking the whole header would blind the comparison on
 * exactly the case it exists for (see buildLanguageHeader.js).
 *
 * @param {object} p
 * @param {string} p.tag
 * @param {boolean} p.isSource
 * @param {object} p.table - the table to write
 * @param {string|null} [p.oldText=null] - the text currently on disk. `null` (the default) means
 *   "nothing reliable to compare": always write. It does NOT mean "the file does not exist":
 *   the snapshot says that.
 * @param {(key: string, value: any) => boolean} [p.isUntranslated] - the "not translated"
 *   criterion. When omitted, splitAndSortEntries' default (value null) applies, which is right
 *   for a sub-language. **Omit it, do not pass `null`**: `null` is not `undefined` and the
 *   default would not kick in.
 * @param {Date} [p.now]
 * @returns {{ text: string, untranslated: [string, any][], changed: boolean }}
 * @throws {Error} if a key does not fit the format
 */
export function prepareLanguageFile({ tag, isSource, table, oldText = null, isUntranslated, now = new Date() }) {
  const { translated, untranslated } = splitAndSortEntries(table, isUntranslated);
  const text = serializeLanguageFile({ tag, isSource, translated, untranslated, now });
  const changed = !(oldText !== null && sameIgnoringProcessed(oldText, text));
  return { text, untranslated, changed };
}

/**
 * Writes a language file — but only if the bytes really changed, and without overwriting a file
 * that changed in the meantime (`expected`, the snapshot of the read: see replaceFileAtomic.js).
 * When there is nothing to write there is nothing to overwrite, so the snapshot is not checked.
 *
 * It does NOT catch write errors: a `SyncError` (`VT_FILE_CHANGED`, `VT_WRITE_FAILED`) reaches
 * the caller, who decides how to tell it. Parameters as in `prepareLanguageFile`, plus:
 *
 * @param {object} p
 * @param {string} p.filePath
 * @param {{ kind: "absent" } | { kind: "file", bytes: Buffer, realPath: string, mode: number }} p.expected
 *   the snapshot from `readLanguageForSync`; required whenever there is something to write
 * @returns {{ written: boolean, untranslated: [string, any][], text: string }}
 * @throws {TypeError} if `expected` is missing and there is something to write
 * @throws {import("./syncError.js").SyncError}
 */
export default function writeLanguageFileIfChanged({
  filePath, tag, isSource, table, oldText = null, expected, isUntranslated, now = new Date(),
}) {
  const p = prepareLanguageFile({ tag, isSource, table, oldText, isUntranslated, now });
  if (!p.changed) return { written: false, untranslated: p.untranslated, text: p.text };
  if (expected === undefined) throw new TypeError("writeLanguageFileIfChanged: `expected` snapshot is required");
  replaceFileAtomic(filePath, p.text, expected);
  return { written: true, untranslated: p.untranslated, text: p.text };
}
