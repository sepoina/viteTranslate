// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync",
// "Auto-sync at config time".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Questo file esiste per una ragione sola: la sincronizzazione scrive su disco, e va fatta
// **prima** che Vite abbia un watcher, un grafo dei moduli o un server in ascolto. L'unico hook
// che gira lì è `config`. Se ti stai chiedendo se puoi chiamare `autoSync` da `buildStart`,
// `configureServer`, `transform` o `handleHotUpdate`: no. È il motivo per cui questa funzione
// era stata scartata fino alla 4.2, e `doc/structure.md` § "Invariants" lo dice per esteso.
//
// Le guardie, nell'ordine in cui compaiono qui sotto (vedi il piano 4_2_0.md, § "Le quattordici
// guardie", per il perché di ciascuna):
//   G8   VITETRANSLATE_NO_SYNC non vuota           -> non si sincronizza mai
//   G9   process.env.VITEST presente               -> non si sincronizza (i test non scrivono)
//   G4   vite preview                               -> non si sincronizza (serve una build già fatta)
//   G5   build SSR                                  -> non si sincronizza (la build client l'ha già fatta)
//   G6   autoSyncDev / autoSyncBuild spente          -> via di fuga documentata
//   G3   sync già in corso per questa config         -> si aspetta la stessa promise
//   G10  @babel/core assente                         -> si degrada con un avviso, non si esce
//   G11  file 3.x senza il .yml della sourceLanguage -> serve --migrate a mano
//   G12  in dev si passa da fastVerify, in build mai
//   G13  fastVerify riceve la config viva come `expect`
//   G14  un errore vero si stampa e si rilancia

import { ensureBabel } from "../babel/extractMarkers.js";
import { listFiles } from "./uty/listLanguageFiles.js";
import { LEGACY_LANG_EXT, languageFileName } from "./uty/languageFileFormat.js";
import { CLI_NAME } from "./uty/cliName.js";
import { logWarning, logError } from "../../utility.js";
import fastVerify from "./uty/fastVerify.js";
import runSync, { localeDirOf } from "./syncCore.js";

// Guardia G3. La chiave è la config, non il processo: al restart del dev server Vite
// reimporta solo vite.config.* (con cache busting), mentre QUESTO modulo resta nella cache
// di Node. Un booleano sopravviverebbe al restart e impedirebbe la risincronizzazione
// proprio nel caso in cui serve — hai appena cambiato sourceLanguage, ed è per questo che
// Vite ha fatto ripartire il server.
//
// Il valore è la PROMISE, non un booleano: due chiamanti concorrenti devono aspettare la
// stessa esecuzione, non farne due.
const inCorso = new Map();

const chiaveDi = (config, comando) => JSON.stringify([
  comando, config.baseDir, config.srcDir, config.localeDir, config.sourceLanguage,
]);

/**
 * @param {object} p
 * @param {object} p.config - vitetranslateConfig, già normalizzato dal plugin
 * @param {{ command?: string, isPreview?: boolean, isSsrBuild?: boolean }} [p.env] - il
 *   secondo argomento dell'hook `config` di Vite
 * @param {() => void} [p.probeBabel] - solo per i test: la sonda della guardia G10
 * @returns {Promise<{ ran: boolean, reason: string }>}
 */
export default function autoSync({ config, env, probeBabel = ensureBabel }) {
  // G8. La guardia che si applica SENZA toccare vite.config.*: una CI con checkout in sola
  // lettura, un container, un tool che carica la config solo per leggerla.
  if (process.env.VITETRANSLATE_NO_SYNC) return Promise.resolve({ ran: false, reason: "env-off" });
  // G9. Vitest carica vite.config.* e ne esegue gli hook `config`: senza questa guardia
  // lanciare i test di un progetto ne riscriverebbe le tabelle di traduzione.
  if (process.env.VITEST) return Promise.resolve({ ran: false, reason: "vitest" });
  // G4. `vite preview` carica la config e chiama gli hook `config`, ma serve una build già
  // fatta: una scrittura lì è una scrittura senza nessuna build dietro.
  if (env?.isPreview === true || process.argv.includes("preview")) {
    return Promise.resolve({ ran: false, reason: "preview" });
  }
  // G5. La build SSR della stessa app risolve la config una seconda volta: le tabelle le ha
  // già scritte la build client.
  if (env?.isSsrBuild === true) return Promise.resolve({ ran: false, reason: "ssr-build" });

  const inBuild = env?.command === "build";
  // G6. L'unica via di fuga documentata verso il comportamento precedente alla 4.2.
  const opzioneAccesa = inBuild ? config.autoSyncBuild : config.autoSyncDev;
  if (opzioneAccesa === false) return Promise.resolve({ ran: false, reason: "option-off" });

  // G3. Due chiamanti concorrenti (o un secondo tentativo con la stessa identità) aspettano
  // la stessa esecuzione invece di scriverne due.
  const chiave = chiaveDi(config, env?.command);
  const giaInCorso = inCorso.get(chiave);
  if (giaInCorso) return giaInCorso;

  const promessa = esegui({ config, env, probeBabel, inBuild })
    .catch((errore) => {
      // Un fallimento non deve congelare il risultato: se il processo sopravvive (uso
      // programmatico di Vite) un secondo tentativo dev'essere possibile.
      inCorso.delete(chiave);
      throw errore;
    });
  inCorso.set(chiave, promessa);
  return promessa;
}

async function esegui({ config, env, probeBabel, inBuild }) {
  try {
    // G10. @babel/core è una peer dependency OPZIONALE. Senza, la scansione non estrae
    // niente: sourceTable resta vuota, guardMassErase scatta con "nessun marcatore trovato" e
    // mette in salvo una copia di ogni lingua. Nella CLI questo caso muore con un exit 1; nel
    // plugin far morire il dev server per una dipendenza opzionale sarebbe sbagliato, quindi
    // si degrada.
    try {
      probeBabel();
    } catch (errore) {
      if (errore?.code !== "VT_NO_BABEL") throw errore;
      logWarning(
        `auto-sync skipped: scanning the source needs "@babel/core" (optional peer dependency: \`npm i -D @babel/core\`). ` +
        `Your tables were left untouched; run \`npx ${CLI_NAME}\` once it is installed.`
      );
      return { ran: false, reason: "no-babel" };
    }

    // G11. Senza questo controllo l'auto-sync creerebbe un <sourceLanguage>.yml nuovo di
    // zecca, checkSetup passerebbe, e il progetto partirebbe come se le traduzioni 3.x non
    // fossero mai esistite — restando in .js accanto, invisibili. La migrazione resta un
    // comando che si lancia a mano.
    const localeDir = localeDirOf(config);
    let filiLocale;
    try {
      filiLocale = listFiles(localeDir);
    } catch {
      // Cartella assente: è il caso normale del primo avvio, la sync la crea. Non è il caso
      // di questa guardia.
      filiLocale = [];
    }
    const haLegacy = filiLocale.some((f) => f.endsWith(LEGACY_LANG_EXT));
    const sourceYml = languageFileName(config.sourceLanguage);
    if (haLegacy && !filiLocale.includes(sourceYml)) {
      logWarning(
        `auto-sync skipped: "${config.localeDir}" still has 3.x language files ("${LEGACY_LANG_EXT}") and no ` +
        `"${sourceYml}" for the source language. Run \`npx ${CLI_NAME} --migrate\` once, then restart.`
      );
      return { ran: false, reason: "legacy-format" };
    }

    // G12 / G13. In dev si passa da fastVerify, con la config viva come `expect`: il record è
    // confrontato con l'mtime di vite.config.*, ma una config può cambiare senza che il file
    // cambi (una variabile d'ambiente, una config inline, un monorepo che condivide
    // node_modules). In build non si chiama affatto fastVerify: davanti a una build vale la
    // certezza di tabelle appena ricostruite, come già per `prebuild` oggi.
    let motivoFast = null;
    if (!inBuild) {
      const esito = fastVerify({
        baseDir: config.baseDir,
        expect: { srcDir: config.srcDir, localeDir: config.localeDir, sourceLanguage: config.sourceLanguage },
      });
      // Silenzio totale sul percorso fresco: quel testo esiste per la CLI, dove l'utente ha
      // lanciato un comando e si aspetta una risposta; qui l'utente ha lanciato `vite`.
      if (esito.fresh) return { ran: false, reason: "fresh" };
      motivoFast = esito;
    }

    await runSync({ config, motivoFast });
    return { ran: true, reason: "synced" };
  } catch (errore) {
    // G14. Stessa semantica di un `predev` che fallisce e blocca `npm run dev`: si stampa e
    // si rilancia, così `config` fallisce e Vite esce con codice diverso da zero.
    logError(`[${CLI_NAME}] auto-sync failed: ${errore.message}`);
    throw errore;
  }
}
