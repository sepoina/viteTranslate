// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import path from "path";
import readLanguageFile from "./readLanguageFile.js";
import validateLanguageTag from "./validateLanguageTag.js";
import languageAutonym from "./languageAutonym.js";
import { listFiles } from "./listLanguageFiles.js";
import { LEGACY_LANG_EXT, isLanguageFileName, tagFromFileName } from "./languageFileFormat.js";
import { displayWidth as width, wrapLog, logEchoColored, logWarning, logError, colorize, TEXT_WIDTH } from "../../../utility.js";

const BUILDER_KEY = "__builder__";

/**
 * I livelli dal più lieve al più grave. L'ordine è il criterio: una lingua può avere più
 * problemi insieme (incompleta E disallineata), e quello che finisce nel riepilogo è il
 * peggiore — mentre le note le elencano tutti.
 *
 * "stale" sta sopra "incomplete" perché sono due lavori diversi rivolti a due persone diverse:
 * una tabella incompleta aspetta un traduttore ed è lo stato normale di un progetto vivo, una
 * disallineata aspetta solo che qualcuno rilanci il comando.
 */
const LEVELS = ["ok", "incomplete", "stale", "warning", "error"];
const worst = (a, b) => (LEVELS.indexOf(b) > LEVELS.indexOf(a) ? b : a);

// Allineamento e a-capo stanno in utility.js insieme al resto del log: qui la tabella e' una
// forma di output come le altre, e la larghezza di un nome di lingua non puo' essere due cose
// diverse a seconda di chi la misura.
const padEnd = (s, w) => `${s}${" ".repeat(Math.max(0, w - width(s)))}`;
const padStart = (s, w) => `${" ".repeat(Math.max(0, w - width(s)))}${s}`;

/**
 * Fotografa lo stato delle tabelle di lingua, senza scrivere niente.
 *
 * Il riferimento è `service.sourceTable`, cioè quello che la scansione ha appena trovato nel
 * CODICE — non il file della lingua sorgente. È la differenza che rende utile il comando:
 * confrontarsi col file di lingua direbbe solo se le tabelle sono coerenti fra loro, mentre
 * la domanda vera è se sono coerenti con il sorgente di adesso.
 *
 * @param {object} service - lo stato della sessione (vedi cli.js), con sourceTable già popolata
 * @param {number} builderVersion - la versione di schema attesa (BUILDER_VERSION in cli.js)
 * @returns {{ rows: object[], legacy: string[], sourceMissing: boolean, level: string }}
 */
export function collectStatus(service, builderVersion) {
  const { localeDir, sourceLanguage, sourceTable } = service;
  const sourceKeys = Object.keys(sourceTable).filter((k) => k !== BUILDER_KEY);

  let entries;
  try {
    // Solo i FILE: una cartella chiamata "fr-FR.yml" non è una lingua a cui manchino delle
    // chiavi, è una cartella, e in tabella comparirebbe come una riga in errore inspiegabile.
    entries = listFiles(localeDir);
  } catch (e) {
    // localeDir assente non è un errore da eccezione: è esattamente uno degli stati che
    // questo comando esiste per riferire, ed è quello di un progetto appena configurato.
    return { rows: [], legacy: [], sourceMissing: true, level: "error", localeDirError: e.message };
  }

  // I file della 3.x non sono file di lingua per il resto della libreria (il plugin si rifiuta
  // di partire se li trova), quindi non diventano righe: sono una nota a parte, con la cura.
  const legacy = entries.filter((f) => f.endsWith(LEGACY_LANG_EXT));

  const rows = [];
  for (const file of entries) {
    if (!isLanguageFileName(file)) continue;
    rows.push(statusOfFile(path.join(localeDir, file), file, { sourceLanguage, sourceKeys, builderVersion }));
  }

  const sourceMissing = !rows.some((r) => r.isSource);
  const level = rows.reduce((acc, r) => worst(acc, r.level), (legacy.length || sourceMissing) ? "error" : "ok");
  return { rows, legacy, sourceMissing, level };
}

/** Lo stato di un singolo file di lingua: una riga della tabella. */
function statusOfFile(filePath, file, { sourceLanguage, sourceKeys, builderVersion }) {
  const tag = tagFromFileName(file);
  const row = {
    file,
    tag,
    isSource: tag === sourceLanguage,
    language: languageAutonym(tag),
    keys: null,
    missing: null,
    toAdd: 0,
    toRemove: 0,
    level: "ok",
    notes: [],
  };
  const nota = (level, testo) => {
    row.level = worst(row.level, level);
    row.notes.push(testo);
  };

  // Il tag non è un errore bloccante: un file fuori convenzione la libreria lo sincronizza e
  // lo compila lo stesso. È però il modo in cui un refuso diventa una lingua, quindi va detto.
  const tagOk = validateLanguageTag(tag);
  if (!tagOk.ok) nota("warning", `off-convention tag (${tagOk.reason})`);

  let table;
  try {
    table = readLanguageFile(filePath);
  } catch (e) {
    // Non leggibile: il comando di sync ne farebbe un backup e la rigenererebbe da zero,
    // perdendo le traduzioni che il file contiene. Saperlo PRIMA è metà del motivo per cui
    // questo comando esiste.
    nota("error", e.message);
    return row;
  }

  if (table === undefined) {
    nota("stale", "new language, empty: run the sync to fill it");
    return row;
  }

  const builder = table[BUILDER_KEY];
  const chiavi = Object.keys(table).filter((k) => k !== BUILDER_KEY);
  row.keys = chiavi.length;
  row.missing = chiavi.filter((k) => table[k] === null).length;
  row.toAdd = sourceKeys.filter((k) => !(k in table)).length;
  row.toRemove = chiavi.filter((k) => !sourceKeys.includes(k)).length;

  if (builder?.v !== builderVersion) {
    nota("warning", `table format v${builder?.v ?? "?"}, expected v${builderVersion}: run the sync`);
  }
  if (row.toAdd || row.toRemove) {
    nota("stale", `out of sync with the source code: ${row.toAdd} key(s) to add, ${row.toRemove} to remove`);
  }
  if (row.missing) {
    // Nella lingua sorgente una chiave a null non è "da tradurre": è una voce che non ha
    // testo, cioè un file toccato a mano in un modo che il comando di sync non produce mai.
    if (row.isSource) nota("warning", `${row.missing} key(s) with no text in the source language`);
    else nota("incomplete", `${row.missing} key(s) to translate`);
  }
  if (!row.notes.length) row.notes.push(row.isSource ? "source language" : "fully translated");
  return row;
}

/**
 * Il rapporto, stampato nella colonna del comando: il codice di lingua sta nell'etichetta a
 * sinistra — è l'identificativo della riga, e in colonna si legge scorrendo — e tutto il resto
 * dopo il montante. Colorare l'etichetta col livello risparmia una colonna di simboli che
 * direbbe la stessa cosa.
 *
 * Separata da collectStatus perché sono due cose diverse: il formato cambia quando qualcuno
 * vuole leggerlo meglio, i controlli quando cambia la libreria.
 *
 * @param {object} status - il risultato di collectStatus
 * @param {object} info - { localeDir, sourceLanguage, sourceKeys, scanned, skipped, warnings }
 */
export function printStatus(status, info) {
  const { rows, legacy, sourceMissing, localeDirError } = status;
  const { localeDir, sourceLanguage, sourceKeys, scanned, skipped = [], warnings = [] } = info;
  // Il livello di una riga diventa il colore della sua etichetta: "stale" e "incomplete" sono
  // due cose da fare, non due gravità diverse, e all'occhio valgono entrambe come "attenzione".
  const stile = { error: "error", warning: "warning", stale: "warning", incomplete: "warning", ok: "ok" };

  logEchoColored("status", `translation tables in "${localeDir}"`);
  logEchoColored("", `source language "${sourceLanguage}" · ${sourceKeys} key(s) found in ${scanned} scanned source file(s)`);

  if (localeDirError) {
    // Il messaggio grezzo di Node porterebbe di nuovo il percorso assoluto: qui c'è già,
    // corto, nella riga sopra. Del resto dell'errore interessa solo il codice.
    logError(`the locale dir "${localeDir}" cannot be read (${String(localeDirError).split(":")[0]})`);
    logEchoColored("", "it is created by the first sync, or by --add <tag>");
    return;
  }
  if (!rows.length) {
    logError(`no language file in the locale dir: run --add ${sourceLanguage} to start`);
    return;
  }

  // Colonne dimensionate sul contenuto: i nomi delle lingue nella loro lingua vanno da "日本語"
  // a "português (Brasil)", e una larghezza fissa o taglia gli uni o spreca sugli altri.
  const num = (v) => (v === null ? "-" : String(v));
  const w = (sel, min) => Math.max(min, ...rows.map((r) => width(sel(r))));
  const wCode = w((r) => r.tag, 4);
  const wLang = w((r) => r.language, 8);
  const wKeys = w((r) => num(r.keys), 4);
  const wMiss = w((r) => num(r.missing), 7);

  // La colonna in cui comincia STATUS, contata dentro l'area di testo. Le note sono la parte
  // che si allunga senza limite — un errore di parse porta con sé la riga e il testo che
  // l'ha causata — e vanno a capo incolonnate lì sotto invece di sfondare la tabella.
  const colonna = wCode + 2 + wLang + 2 + wKeys + 2 + wMiss + 2;

  logEchoColored("", "");
  logEchoColored("", `${padEnd("CODE", wCode)}  ${padEnd("LANGUAGE", wLang)}  ${padStart("KEYS", wKeys)}  ${padStart("MISSING", wMiss)}  STATUS`);
  for (const r of rows) {
    // Il colore sta sul codice, dentro la tabella: è la cella che dice di chi si parla, e
    // accenderla evita una colonna di simboli che direbbe la stessa cosa. Nell'etichetta a
    // sinistra non ci va: quella dice quale parte del comando sta parlando, non un dato.
    const testa = `${colorize(stile[r.level], padEnd(r.tag, wCode))}  ` +
      `${padEnd(r.language, wLang)}  ${padStart(num(r.keys), wKeys)}  ${padStart(num(r.missing), wMiss)}  `;
    const [prima, ...dopo] = wrapLog(r.notes.join("; "), TEXT_WIDTH - colonna, TEXT_WIDTH - colonna);
    logEchoColored("", `${testa}${prima}`);
    for (const nota of dopo) logEchoColored("", `${" ".repeat(colonna)}${nota}`);
  }

  if (sourceMissing) {
    logError(`the source language "${sourceLanguage}" has no file here: the plugin will not start`);
  }
  if (legacy.length) {
    logError(`${legacy.length} file(s) still in the 3.x format (${legacy.join(", ")}): run --migrate`);
  }
  if (warnings.length) {
    // Marcatori annidati e collisioni di id: non riguardano una lingua in particolare — sono
    // chiavi nate storte nel sorgente, e stanno per finire in tutte le tabelle insieme.
    logWarning(`${warnings.length} marker warning(s) in the source code:`);
    for (const avviso of warnings) logEchoColored("", `  - ${avviso}`);
  }
  if (skipped.length) {
    // Un sorgente non scansionato falsa OGNI riga sopra: le sue chiavi risultano assenti dal
    // codice, quindi "da rimuovere" da tutte le lingue. Va detto vicino ai numeri che sporca.
    logWarning(`${skipped.length} source file(s) could not be scanned: the counts above are incomplete`);
    for (const riga of skipped) logEchoColored("", `  - ${riga}`);
  }

  const conta = (livello) => rows.filter((r) => r.level === livello).length;
  const riepilogo = LEVELS.map((l) => [l, conta(l)]).filter(([, n]) => n).map(([l, n]) => `${n} ${l}`);
  logEchoColored("", "");
  logEchoColored("status", `${rows.length} language(s): ${riepilogo.join(", ")}`);
}
