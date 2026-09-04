// Architettura d'insieme: doc/structure.md § "Fase 3 — The virtual module and code splitting",
// "Startup check: stopping before the first request".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import pathCmd from "path";
import { listFiles } from "./listLanguageFiles.js";
import { LEGACY_LANG_EXT, isLanguageFileName, languageFileName, tagFromFileName } from "./languageFileFormat.js";
import readLanguageFile from "./readLanguageFile.js";

/**
 * Il progetto ha una sourceLanguage leggibile in localeDir? Funzione pura sul filesystem:
 * nessuna stampa, nessuna scrittura. Chi la chiama decide come dirlo (vedi vitetranslate.js,
 * `configureServer`/`buildStart`) — qui c'è solo la domanda e la risposta.
 *
 * Eseguita una volta sola, PRIMA che il server cominci a servire (o, in build, prima che
 * Rollup/Rolldown chiami `load`): è il controllo che oggi vive dentro `generateLanguagesModule`,
 * spostato qui perché lì gira alla prima richiesta del browser, tre volte per lo stesso errore.
 *
 * @param {object} p
 * @param {string} p.localeDir - percorso assoluto, già risolto
 * @param {string} p.localeDirLabel - come nominarlo nei messaggi (l'opzione così com'è scritta
 *   in vite.config, relativa a baseDir)
 * @param {string} p.sourceLanguage
 * @returns {{ ok: true } | { ok: false, reason: string, detail?: any }}
 *
 * `reason` ∈ "no-locale-dir" | "no-language-file" | "source-missing" |
 *            "source-case-mismatch" | "legacy-format" | "source-invalid"
 */
export default function checkSetup({ localeDir, localeDirLabel, sourceLanguage }) {
  let entries;
  try {
    entries = listFiles(localeDir);
  } catch (e) {
    return { ok: false, reason: "no-locale-dir", detail: e.code ?? e.message };
  }

  const files = entries.filter(isLanguageFileName);
  const tags = files.map(tagFromFileName);

  if (!tags.includes(sourceLanguage)) {
    // I file 3.x non sono nemmeno letti dal filtro sopra (estensione diversa): restando nella
    // stessa cartella con lo stesso nome, altrimenti sembrerebbe che manchino del tutto.
    const legacy = entries.filter((f) => f.endsWith(LEGACY_LANG_EXT));
    if (legacy.length) return { ok: false, reason: "legacy-format", detail: legacy };

    // Un tag scritto con le maiuscole sbagliate trova il file su un filesystem case-insensitive
    // e non lo trova qui, dove il confronto è fra stringhe: è un refuso che si guarda dieci
    // volte senza vederlo, quindi va segnalato per quello che è.
    const perCaso = tags.find((t) => t.toLowerCase() === sourceLanguage.toLowerCase());
    if (perCaso) return { ok: false, reason: "source-case-mismatch", detail: perCaso };

    if (files.length === 0) return { ok: false, reason: "no-language-file" };
    return { ok: false, reason: "source-missing" };
  }

  try {
    const table = readLanguageFile(pathCmd.join(localeDir, languageFileName(sourceLanguage)));
    if (table === undefined) return { ok: false, reason: "source-invalid", detail: "empty file" };
  } catch (e) {
    return { ok: false, reason: "source-invalid", detail: e.message };
  }

  return { ok: true };
}
