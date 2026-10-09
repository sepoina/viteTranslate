// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import pathCmd from "path";
import { planSubLanguage, countIcuMismatch } from './updateAllSubLanguages.js';
import updateKeys from "./uty/updateKeys.js";
import readLanguageForSync from "./uty/readLanguageForSync.js";
import { prepareLanguageFile } from "./uty/writeLanguageFile.js";
import replaceFileAtomic from "./uty/replaceFileAtomic.js";
import { SyncError } from "./uty/syncError.js";
import listLanguageFiles from "./uty/listLanguageFiles.js";
import { detectMassErase } from "./uty/guardMassErase.js";
import { languageFileName } from "./uty/languageFileFormat.js";
import backupLanguageFile from "./uty/backupLanguageFile.js";
import { logEchoColored } from "../../utility.js";
import { placeholderShape } from "./uty/placeholderShape.js";
/**
 * Updates the source-language file and those of every sub-language. A source file that is
 * missing, empty or corrupted is generated from the scan. A table is rewritten only when its
 * bytes really change.
 *
 * @function
 * @param {object} service - Stato condiviso della sessione di sincronizzazione (vedi cli.js):
 *   { localeDir, sourceLanguage, sourceTable, notTranslated, renamedKeys, renamedConversions }
 * @returns {Promise<{ file: string, action: string, written: boolean, languages: object[] }>}
 *   the account of what happened — see below on why it does not print it.
 * @throws {SyncError} VT_LANGUAGE_UNREADABLE, VT_BACKUP_FAILED, VT_FILE_CHANGED, VT_WRITE_FAILED
 *
 * @description
 * Four phases (4.7.1), in this order; only the last one changes tables:
 *  - P1 reads every language file. One that cannot be opened stops everything: nothing was touched.
 *  - P2 plans in memory (pure): the text of every table and the backups needed.
 *  - P3 makes ALL the backups, from the snapshot bytes. A failed backup stops everything.
 *  - P4 writes the tables one by one, with atomic replacement and a conflict check. At the first
 *    error it stops and reports what was already written (`written`): a blind rollback could
 *    overwrite newer edits, and a new sync completes the job.
 *
 * It does not narrate its steps: it RETURNS what it did, and the caller decides how to say it.
 * That used to be a dozen log lines — one per language — that mostly said the same thing and hid
 * the only one that matters: which languages still have keys to translate. Errors are NOT
 * printed here either: they are thrown, and printed once by whoever sits at the boundary
 * (cli.js, autoSync, the LLM command).
 */
export default async function updateLanguage(service) {
  const { localeDir, sourceLanguage } = service;
  const fileName = languageFileName(sourceLanguage);
  const filePath = pathCmd.join(localeDir, fileName);

  // ── P1. Read everything, write nothing ───────────────────────────────────────────────
  const letto = readLanguageForSync(filePath);

  let subFiles;
  try {
    subFiles = listLanguageFiles(localeDir, { includeUnreadableLinks: true }).filter((f) => f !== fileName);
  } catch (e) {
    throw new SyncError("VT_LANGUAGE_UNREADABLE",
      `Cannot list the locale folder '${localeDir}' (${e.code ?? e.message}). No language table was touched.`,
      { paths: [localeDir], cause: e });
  }
  const subPaths = subFiles.map((f) => pathCmd.join(localeDir, f));
  const subReads = subPaths.map((p) => readLanguageForSync(p));

  const illeggibili = [
    ...(letto.status === "unreadable" ? [[filePath, letto.error.message]] : []),
    ...subReads.flatMap((r, i) => r.status === "unreadable" ? [[subPaths[i], r.error.message]] : []),
  ];
  if (illeggibili.length > 0) {
    throw new SyncError("VT_LANGUAGE_UNREADABLE",
      `${illeggibili.length === 1 ? "A language file" : `${illeggibili.length} language files`} cannot be read: ` +
      `${illeggibili.map(([p, why]) => `${p} ${why}`).join("; ")}. ` +
      `No language table was touched; fix ${illeggibili.length === 1 ? "it" : "them"} and run again.`,
      { paths: illeggibili.map(([p]) => p) });
  }

  // ── P2. Plan in memory ───────────────────────────────────────────────────────────────
  // First the mass-erase check: it looks at the source table as it is on disk, before the plan
  // touches it.
  const massErase = detectMassErase({
    previousTable: letto.status === "ok" ? letto.table : null,
    sourceTable: service.sourceTable,
  });

  let state = { newest: true, changed: true }, baseData = null;
  // dropped key -> emerging key with the same value: lets the sub-languages inherit the
  // translation already made instead of losing it and restarting from null
  // (see updateAllSubLanguages.js)
  service.renamedKeys = {};
  let nota = null; // what to say about the source language, if it is not the usual comparison
  let sourceBackup = null;
  let oldText = letto.oldText;

  if (letto.status === "missing") {
    nota = "created";
    baseData = service.sourceTable;
  } else if (letto.status === "corrupted") {
    sourceBackup = { kind: "corrupted", reason: letto.error.message };
    nota = "was corrupted, rebuilt from the source code";
    baseData = service.sourceTable;
  } else if (letto.status === "empty") {
    // File created empty by hand (initial bootstrap): not corrupted, nothing to lose — a
    // backup would be noise.
    nota = "was empty, generated from scratch";
    baseData = service.sourceTable;
  } else if (letto.meta.tableVersion === null) {
    // A file that reads but carries no TableVersion header is not one of our tables: it counts as
    // corrupted. The check lives HERE and not in the shared reader because it concerns only the
    // source language — see updateAllSubLanguages.js, which does not do it.
    sourceBackup = { kind: "corrupted", reason: "no TableVersion header: not a language table" };
    nota = "was corrupted, rebuilt from the source code";
    baseData = service.sourceTable;
    oldText = null; // force the rewrite
  } else {
    const newData = service.sourceTable;
    [state, baseData] = updateKeys(letto.table, newData);
    service.renamedConversions = {};
    service.renamedKeys = matchRenamedKeys(state, newData, service.renamedConversions);
  }

  // What to say about the source language, in one line: whatever happened out of the ordinary
  // (created, empty, corrupted) beats the key count, which in the normal case is the news.
  const action = nota ?? (state.changed
    ? `${state.added.length} key(s) added, ${state.deleted.length} removed`
    : "no changes detected");

  // The sub-languages: plan, then text (no `isUntranslated`: the default criterion is theirs).
  const subPlans = subReads.map((read, i) => {
    const plan = planSubLanguage(read, subPaths[i], subFiles[i], service.sourceTable, service);
    const prepared = prepareLanguageFile({ tag: plan.tag, isSource: false, table: plan.table, oldText: plan.oldText });
    return {
      ...plan, text: prepared.text, changed: prepared.changed,
      missing: prepared.untranslated.length,
      icuMismatch: countIcuMismatch(service.sourceTable, plan.table, plan.tag),
    };
  });

  // The source last: it needs `service.notTranslated`, which the sub-languages fill.
  const notTranslated = service.notTranslated;
  // Presence of the key, not truth of the value: an empty source text "" is still a key to
  // report as missing elsewhere, if it is.
  const isUntranslated = (key) => notTranslated != null && key in notTranslated;
  const sourcePrepared = prepareLanguageFile({
    tag: sourceLanguage, isSource: true, table: baseData, oldText, isUntranslated,
  });

  // ── P3. Backups: the only writes before the tables ───────────────────────────────────
  const sourceEntry = { filePath, file: fileName, snapshot: letto.snapshot, backup: sourceBackup };
  const entries = [sourceEntry, ...subPlans.map((p) => ({ filePath: p.filePath, file: p.file, snapshot: p.expected, backup: p.backup }))];

  if (massErase !== null) {
    // Of EVERY language file, not just the source: the sub-languages lose the same keys, and
    // there the lost value is the real translation, the one that cost work.
    for (const e of entries) {
      if (e.snapshot?.kind !== "file") continue;
      backupLanguageFile(e.filePath, e.file, e.snapshot.bytes, { kind: "erased", reason: massErase.cause, detail: true });
    }
    // No "skipped files" to point at: an incomplete scan never gets this far (VT_SCAN_INCOMPLETE).
    logEchoColored("", `If this was not intended, restore the '.bak-erased-*' files and check srcDir.`);
  }
  for (const e of entries) {
    if (e.backup === null) continue;
    backupLanguageFile(e.filePath, e.file, e.snapshot.bytes, e.backup);
  }

  // ── P4. Write the tables: sub-languages in listing order, then the source ────────────
  const written = [];
  const commit = (plan, text, expected) => {
    try {
      replaceFileAtomic(plan.filePath, text, expected);
    } catch (e) {
      if (!(e instanceof SyncError) || (e.code !== "VT_FILE_CHANGED" && e.code !== "VT_WRITE_FAILED")) throw e;
      const partial = written.length > 0
        ? ` Partial update: ${written.join(", ")} ${written.length === 1 ? "was" : "were"} already replaced; run the sync again.`
        : "";
      throw new SyncError(e.code, `${e.message}${partial}`, { filePath: e.filePath, cause: e, written: [...written] });
    }
    written.push(plan.file);
  };
  for (const plan of subPlans) {
    if (plan.changed) commit(plan, plan.text, plan.expected);
  }
  if (sourcePrepared.changed) commit(sourceEntry, sourcePrepared.text, letto.snapshot);

  const languages = subPlans.map(({ tag, missing, icuMismatch, note }) => ({ tag, missing, icuMismatch, note }));
  return { file: fileName, action, written: sourcePrepared.changed, languages };
}

/**
 * Abbina le chiavi decadute a quelle emergenti con lo stesso valore in lingua
 * principale: stesso testo, id diverso (es. spostamento del marcatore in un
 * altro file/componente) -> è un rename, non un testo nuovo da tradurre.
 *
 * @param {{ deleted: string[], added: string[], deletedValues: Record<string,string> }} state
 * @param {Record<string,string>} newData - tabella base aggiornata (chiave emergente -> valore)
 * @param {Record<string, {from: string[], to: string[]}>} [conversions] - mutato: per ogni
 *   chiave decaduta abbinata "per forma" (4.6.4), i segnaposto dei due sorgenti, in ordine
 * @returns {Record<string,string>} chiave decaduta -> chiave emergente
 */
function matchRenamedKeys(state, newData, conversions = {}) {
  const addedByValue = new Map();
  for (const newKey of state.added) {
    const value = newData[newKey];
    if (!addedByValue.has(value)) addedByValue.set(value, []);
    addedByValue.get(value).push(newKey);
  }
  const renamedKeys = {};
  for (const oldKey of state.deleted) {
    const candidates = addedByValue.get(state.deletedValues[oldKey]);
    if (candidates?.length) renamedKeys[oldKey] = candidates.shift(); // un solo abbinamento per chiave emergente
  }

  // 4.6.4: stesso testo a meno della FORMA dei segnaposto — "%s" diventato "{nome}", "{0}"
  // diventato "{nome}". Succede convertendo una stringa alla macro: senza, ogni traduzione
  // della vecchia chiave andava persa. Uno a uno, nell'ordine, come l'abbinamento sopra.
  const assegnate = new Set(Object.values(renamedKeys));
  const perForma = new Map();
  for (const newKey of state.added) {
    if (assegnate.has(newKey) || typeof newData[newKey] !== "string") continue;
    const { shape, tokens } = placeholderShape(newData[newKey]);
    if (tokens.length === 0) continue;
    if (!perForma.has(shape)) perForma.set(shape, []);
    perForma.get(shape).push({ key: newKey, tokens });
  }
  for (const oldKey of state.deleted) {
    if (Object.hasOwn(renamedKeys, oldKey)) continue;
    const vecchio = state.deletedValues[oldKey];
    if (typeof vecchio !== "string") continue;
    const { shape, tokens } = placeholderShape(vecchio);
    const candidati = tokens.length > 0 ? perForma.get(shape) : undefined;
    if (!candidati?.length) continue;
    const scelto = candidati.shift();
    renamedKeys[oldKey] = scelto.key;
    conversions[oldKey] = { from: tokens, to: scelto.tokens };
  }

  return renamedKeys;
}
