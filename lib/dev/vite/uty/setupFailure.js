// Architettura d'insieme: doc/structure.md § "Fase 3 — The virtual module and code splitting",
// "Startup check: stopping before the first request".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { LEGACY_LANG_EXT, languageFileName } from "./languageFileFormat.js";
import { CLI_NAME } from "./cliName.js";
import { readSession } from "./sessionStore.js";
import { logError, logEchoColored, logCommand, colorize } from "../../../utility.js";

/**
 * Cosa manca e come rimediare, per ognuna delle `reason` di `checkSetup`. Restituisce pezzi
 * separati — non una frase già incollata — perché due chiamanti la rendono in due forme
 * diverse: `buildStart` la lancia com'è (un `Error`, mai colorato: potrebbe finire in un log
 * che non interpreta gli ANSI), `configureServer` la stampa nella colonna del log con i dati
 * variabili in evidenza. `ev` è il punto in cui le due forme divergono: l'identità per la
 * prima, `colorize("nome", …)` per la seconda — la frase intorno resta la stessa.
 *
 * @param {{ reason: string, detail?: any }} result
 * @param {{ localeDirLabel: string, sourceLanguage: string }} p
 * @param {(s: string) => string} [ev] - come evidenziare un valore dentro la frase
 * @returns {{ problem: string, fixIntro: string | null, fixCommand: string | null, fixText: string | null }}
 *   `fixCommand`, quando c'è, è la riga da lanciare in console, con `fixIntro` a introdurla;
 *   `fixText` è la cura quando non è un comando (il maiuscolo sbagliato si corregge in
 *   vite.config, non in un terminale) e allora `fixIntro`/`fixCommand` restano `null`.
 */
export function setupErrorText({ reason, detail }, { localeDirLabel, sourceLanguage }, ev = (s) => s) {
  switch (reason) {
    case "no-locale-dir":
    case "no-language-file":
    case "source-missing":
      return {
        problem: reason === "no-locale-dir"
          ? `localeDir ${ev(`"${localeDirLabel}"`)} does not exist.`
          : reason === "no-language-file"
          ? `${ev(`"${localeDirLabel}"`)} is empty: no language file in there yet.`
          : `sourceLanguage ${ev(`"${sourceLanguage}"`)} not found (missing or invalid file) in ${ev(`"${localeDirLabel}"`)}.`,
        fixIntro: "add it with this command:",
        fixCommand: `npx ${CLI_NAME} --add ${sourceLanguage}`,
        fixText: null,
      };
    case "legacy-format":
      return {
        problem: `the language files in ${ev(`"${localeDirLabel}"`)} are still in the 3.x ${ev(`"${LEGACY_LANG_EXT}"`)} format (${detail.join(", ")}). ` +
          `From 4.0 they are data files, not JS modules — the originals are kept as .bak-migrated-*.`,
        fixIntro: "migrate with this command:",
        fixCommand: `npx ${CLI_NAME} --migrate`,
        fixText: null,
      };
    case "source-case-mismatch":
      return {
        problem: `sourceLanguage ${ev(`"${sourceLanguage}"`)} not found in ${ev(`"${localeDirLabel}"`)}. ` +
          `${ev(`"${languageFileName(detail)}"`)} is there, but language tags are case-sensitive.`,
        fixIntro: null,
        fixCommand: null,
        fixText: `write sourceLanguage as ${ev(`"${detail}"`)} in vite.config, or rename the file to ${ev(`"${languageFileName(sourceLanguage)}"`)}.`,
      };
    case "source-invalid":
    default:
      return {
        problem: `${ev(`"${languageFileName(sourceLanguage)}"`)} in ${ev(`"${localeDirLabel}"`)} is not a valid language file (${detail}).`,
        fixIntro: "check it with this command:",
        fixCommand: `npx ${CLI_NAME} --status`,
        fixText: null,
      };
  }
}

/**
 * Stampa il blocco di un setup che non parte: cosa manca, dove stavano le tabelle l'ultima
 * volta, cosa dice vite.config, e la cura. Sta qui e non in vitetranslate.js perché è output,
 * e l'output della libreria vive accanto al resto dell'output (vedi languageStatus.js).
 */
export function logSetupFailure({ result, localeDirLabel, sourceLanguage, viteConfigFile, baseDir }) {
  // I valori variabili dentro la frase si evidenziano con lo stesso stile del codice di
  // lingua in --status: non è un'etichetta (non dice quale parte del comando parla), è
  // un dato dentro il testo.
  const ev = (s) => colorize("nome", s);
  const { problem, fixIntro, fixCommand, fixText } = setupErrorText(
    result, { localeDirLabel, sourceLanguage }, ev
  );
  logError(problem);
  // Dove si trovavano le tabelle l'ultima volta che una sessione le ha viste: utile
  // anche quando non è la stessa localeDir di adesso — è la prima cosa a controllare se
  // la cartella "giusta" è un'altra e vite.config sta puntando altrove per sbaglio.
  const sessione = readSession(baseDir);
  if (sessione?.localeDir) {
    logEchoColored("", `previous yml tables position is: ${ev(`"${sessione.localeDir}"`)}`);
  }
  logEchoColored("", viteConfigFile
    ? `your sourceLanguage in ${ev(`"${viteConfigFile}"`)} is ${ev(`"${sourceLanguage}"`)}`
    : `your sourceLanguage is ${ev(`"${sourceLanguage}"`)}`);
  if (fixCommand) {
    logEchoColored("", fixIntro);
    logCommand(fixCommand);
  } else {
    logEchoColored("", fixText);
  }
  logEchoColored("", "");
}

/**
 * Aspetta che quanto già scritto su stdout sia davvero uscito. Serve solo prima di un
 * `process.exit`: su un terminale la scrittura è sincrona e questa funzione ritorna subito, su
 * una pipe non lo è e senza aspettare l'ultimo messaggio si perde. Il timeout copre il caso in
 * cui la pipe sia piena e nessuno legga: meglio troncare che restare appesi.
 */
export function scaricaStdout(timeoutMs = 200) {
  return new Promise((risolvi) => {
    const chiudi = setTimeout(risolvi, timeoutMs);
    chiudi.unref?.();
    process.stdout.write("", () => { clearTimeout(chiudi); risolvi(); });
  });
}
