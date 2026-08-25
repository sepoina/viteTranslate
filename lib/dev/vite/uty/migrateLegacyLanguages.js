// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import vm from "vm";
import pathCmd from "path";
import splitAndSortEntries from "./splitAndSortEntries.js";
import serializeLanguageFile from "./serializeLanguageFile.js";
import { LANG_EXT, LEGACY_LANG_EXT, languageFileName } from "./languageFileFormat.js";
import { logEchoColored, logWarning } from "../../../utility.js";

/**
 * Converte i file di lingua della 3.x (moduli JS) nel formato 4.0.
 *
 * Gira solo su richiesta esplicita (`--migrate`) e una volta sola: riscrive ogni `<tag>.js` di
 * localeDir come `<tag>.yml`, e rinomina l'originale in `.bak-migrated-*` invece di
 * cancellarlo. Non tocca un `.yml` già presente — un progetto migrato a metà non deve perdere
 * la parte già convertita per un secondo lancio del comando.
 *
 * La lettura è la stessa che faceva la 3.x, ridotta all'osso e confinata qui: valutare il
 * modulo in un contesto senza globali. È l'unico punto della libreria in cui si esegue ancora
 * del codice per leggere dei dati, e vive in un comando che si lancia a mano, una volta.
 *
 * @param {string} localeDir
 * @param {string} [sourceLanguage] - solo per marcarla come tale nell'intestazione: senza,
 *   l'etichetta comparirebbe soltanto alla prima sync che tocca davvero quel file, e una
 *   migrazione pulita non ne tocca nessuno.
 * @returns {{ migrated: string[], skipped: [string, string][] }}
 */
export default function migrateLegacyLanguages(localeDir, sourceLanguage) {
  const migrated = [];
  const skipped = [];

  let files;
  try {
    files = fs.readdirSync(localeDir).filter((f) => f.endsWith(LEGACY_LANG_EXT));
  } catch (e) {
    throw new Error(`cannot read the locale dir "${localeDir}": ${e.message}`);
  }

  if (files.length === 0) {
    logEchoColored("migrate", `No "${LEGACY_LANG_EXT}" language file found in "${localeDir}": nothing to migrate.`);
    return { migrated, skipped };
  }

  logEchoColored("migrate", `Converting ${files.length} language file(s) from "${LEGACY_LANG_EXT}" to "${LANG_EXT}"`);

  for (const file of files) {
    const tag = file.slice(0, -LEGACY_LANG_EXT.length);
    const legacyPath = pathCmd.join(localeDir, file);
    const targetPath = pathCmd.join(localeDir, languageFileName(tag));

    if (fs.existsSync(targetPath)) {
      skipped.push([file, `"${languageFileName(tag)}" already exists`]);
      continue;
    }

    let table;
    try {
      table = readLegacyModule(fs.readFileSync(legacyPath, "utf8"), legacyPath);
    } catch (e) {
      skipped.push([file, e.message]);
      continue;
    }
    if (table === undefined) {
      // File vuoto: era il modo documentato per aggiungere una lingua, e lo è ancora. Basta
      // creare il file nuovo vuoto — la sync qui sotto lo popola.
      fs.writeFileSync(targetPath, "", "utf8");
      fs.renameSync(legacyPath, `${legacyPath}.bak-migrated-${Date.now()}`);
      migrated.push(file);
      continue;
    }

    // Il conteggio di "to be translated" nell'intestazione lo rifà la sync subito dopo: qui
    // si usa il criterio locale (valore null), che è quello giusto per una sub-lingua e
    // innocuo per la sorgente, dove la sync riscriverà comunque il file.
    const { translated, untranslated } = splitAndSortEntries(table);
    fs.writeFileSync(
      targetPath,
      serializeLanguageFile({ tag, isSource: tag === sourceLanguage, translated, untranslated, now: new Date() }),
      "utf8"
    );
    fs.renameSync(legacyPath, `${legacyPath}.bak-migrated-${Date.now()}`);
    migrated.push(file);
  }

  for (const [file, reason] of skipped) {
    logWarning(`"${file}" not converted (${reason}): left where it is.`);
  }
  logEchoColored("", `${migrated.length} file(s) converted; the originals are kept as ".bak-migrated-*".`);
  if (migrated.length) {
    logEchoColored("", `Now run the command again without "--migrate" to re-sync the tables, then delete the backups.`);
  }
  return { migrated, skipped };
}

/**
 * Legge la tabella da un modulo di lingua 3.x: intestazione a commento e
 * `export default { chiave: <valore JSON>, ... };`, con una virgola finale e un commento
 * separatore dentro l'oggetto — legali come literal JS, rifiutati da JSON.parse.
 *
 * La valutazione avviene in un contesto senza alcun globale: un file che provi a toccarne uno
 * fallisce, e viene segnalato invece di essere convertito a metà.
 */
function readLegacyModule(code, filePath) {
  if (code.trim() === "") return undefined;

  const marker = /(?:^|[\n\r;])[ \t]*export[ \t]+default[ \t]+/;
  const at = code.search(marker);
  if (at === -1) throw new Error("no default export");

  const head = code.slice(0, at);
  if (/(?:^|[\n\r;])[ \t]*(?:import|export)\b/.test(head) || head.includes("require(")) {
    throw new Error("the module imports something: convert it by hand");
  }

  const body = code.slice(at).replace(marker, "return ");
  let table;
  try {
    table = vm.runInNewContext(`(function(){${body}\n})()`, Object.create(null), { filename: filePath, timeout: 2000 });
  } catch (e) {
    throw new Error(`cannot be evaluated (${e.message})`);
  }
  if (table === null || typeof table !== "object" || Array.isArray(table)) throw new Error("the default export is not a table");

  for (const [key, value] of Object.entries(table)) {
    if (key === "__builder__") continue;
    if (value !== null && typeof value !== "string") {
      throw new Error(`the value of "${key}" is not a text (${typeof value}): convert it by hand`);
    }
  }
  return table;
}
