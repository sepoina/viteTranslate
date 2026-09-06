// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import pathCmd from "path";
import readLanguageFile from "./uty/readLanguageFile.js";
import { LANG_EXT, languageFileName, isLanguageFileName, tagFromFileName } from "./uty/languageFileFormat.js";
import { compileLanguageModule } from "../compile/compileTable.js";
import { colorize } from "../../utility.js";
import { toPosix } from "./uty/posix.js";

// I file lingua sono quelli diretti dentro localeDir (niente sottocartelle: è la stessa
// convenzione con cui il plugin li scopre). Serve come pre-filtro del transform; il controllo
// imperativo nell'handler resta la fonte di verità, come per l'altro transform.
function localeFileRe(dirPosix) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escape(dirPosix)}/[^/]+${escape(LANG_EXT)}(\\?|$)`);
}

/**
 * Compila i file lingua da tabella di stringhe a modulo di valori già pronti (stringhe,
 * elementi React costruiti una volta sola, funzioni per le voci con segnaposto). È un plugin a
 * sé e non un ramo del transform di vitetranslate.js: quello ha `filter: { code: "_%_" }`, un
 * pre-scarto eseguito in Rust che i file lingua non superano — contengono testo tradotto, non
 * marcatori.
 *
 * Il file su disco non viene mai toccato: resta la tabella di stringhe che il traduttore
 * edita e che il comando di sincronizzazione scrive. La compilazione vive solo nel grafo
 * dei moduli del bundler, quindi il lato Node (readLanguageFile -> logica di sync)
 * continua a leggere le stringhe di cui ha bisogno.
 *
 * @param {object} p
 * @param {object} p.defs - le opzioni del plugin così come le ha scritte l'utente
 * @param {string} p.localeDirPosix
 * @param {object} p.reporter - il raccoglitore di avvisi (vedi uty/devReporter.js)
 * @param {Set<string>} p.localeModuleIds
 * @param {() => { errorSolve: object }} p.leggiStato
 * @returns {object} il plugin Vite/Rollup "vitetranslate:compile-locale"
 */
export default function creaCompileLocale({ defs, localeDirPosix, reporter, localeModuleIds, leggiStato }) {
  return {
    name: "vitetranslate:compile-locale",
    enforce: "pre",
    transform: {
      filter: { id: localeFileRe(localeDirPosix) },
      handler(code, id) {
        const { errorSolve } = leggiStato();

        const filePath = toPosix(id).split("?")[0];
        if (!filePath.startsWith(`${localeDirPosix}/`) || !isLanguageFileName(filePath)) return null;

        // Registrato qui, che è il solo punto da cui un modulo di lingua può entrare nel grafo:
        // l'insieme è completo per costruzione, e serve al watcher per invalidarli senza
        // scandire tutto il grafo (vedi localeModuleIds).
        localeModuleIds.add(id);

        // Il contenuto arriva già letto da Vite: la tabella si ricava da lì, senza tornare sul
        // disco. Il parse è sincrono e non lascia niente dietro di sé — era il ripiego su
        // `import()` la voce che, a ogni salvataggio di un file lingua in una sessione di dev,
        // lasciava un modulo irrecuperabile nella cache ESM di Node.
        let table;
        try {
          ({ table } = readLanguageFile(filePath, code));
        } catch (error) {
          reporter.report("invalid-language-file", `${colorize("nome", `"${pathCmd.basename(filePath)}"`)} is not a valid language file, left as is: ${error.message}`);
          return null;
        }
        // File vuoto: è la lingua nuova che il manifest sta per popolare, non c'è ancora
        // niente da compilare.
        if (table === undefined) {
          reporter.report("empty-language-file", `${colorize("nome", `"${pathCmd.basename(filePath)}"`)} is empty, left as is`);
          return null;
        }

        const tag = tagFromFileName(pathCmd.basename(filePath));

        // Tabella sorgente, per riempire le chiavi non ancora tradotte: è ciò che rende il
        // modulo prodotto autonomo (vedi compileLanguageModule). Per la lingua sorgente stessa
        // non serve — sarebbe il fallback di se stessa.
        let sourceTable = null;
        if (tag !== defs.sourceLanguage) {
          const sourcePath = `${localeDirPosix}/${languageFileName(defs.sourceLanguage)}`;
          // Il modulo compilato dipende ora anche dal file della lingua sorgente: dichiararlo
          // fa sì che una sua modifica invalidi questo modulo, invece di lasciarlo servire da
          // una cache che non sa di essere scaduta.
          this.addWatchFile?.(sourcePath);
          try {
            sourceTable = readLanguageFile(sourcePath).table ?? null;
          } catch (error) {
            // Senza sorgente si compila comunque: i null restano, e la catena di runtime
            // continua a coprirli come prima.
            reporter.report("source-unreadable", `${colorize("nome", `"${languageFileName(defs.sourceLanguage)}"`)} not readable, ${colorize("nome", `"${tag}"`)} compiled without embedded fallback: ${error.message}`);
          }
        }

        // Nessuna sourcemap: il modulo emesso non ha più corrispondenza riga-a-riga con il
        // file su disco, ed è codice generato che nessuno debugga a quel livello.
        //
        // `emitUntranslated` solo per le lingue diverse dalla sorgente: lì una voce non
        // tradotta non esiste per definizione, ed è la lingua in cui il testo è scritto.
        return {
          code: compileLanguageModule(table, tag, sourceTable, {
            missingArg: errorSolve.absentDataInArray,
            emitUntranslated: errorSolve.untranslated !== "" && tag !== defs.sourceLanguage,
            // Stesso raccoglitore dei marcatori (vedi "warn" nel transform di vitetranslate.js):
            // senza questo canale i tag incrociati stampavano per conto loro, fuori dalla
            // colonna e senza il conteggio/dedup che ha tutto il resto — vedi devReporter.js.
            warn: (msg, kind) => reporter.report(kind ?? "mis-nested-markup", msg),
          }),
          map: null,
          // Il file su disco non è più un .js: su Rolldown/Vite 8 il tipo del modulo si
          // dedurrebbe dall'estensione dell'id, ed è quella del file di lingua, non quella di
          // ciò che stiamo restituendo. Dichiararlo toglie di mezzo la deduzione. Ignorato su
          // Rollup/Vite 7 (proprietà extra non riconosciuta).
          moduleType: "js",
        };
      },
    },
  };
}
