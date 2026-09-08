// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione" e § "Fase 3 — Il modulo virtuale e il code splitting".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 3, 4 e 5.

import pathCmd from "path";
import extractMarkers, { ensureBabel } from "../babel/extractMarkers.js";
import { babelUnaRiga } from "../babel/babelPeer.js";
import { isLanguageFileName, tagFromFileName } from "./uty/languageFileFormat.js";
import { normalizeErrorSolve, resolveErrorSolve } from "../../errorSolve.js";
import checkSetup from "./uty/checkSetup.js";
import ownPackageDir from "./uty/ownPackage.js";
import creaReporter from "./uty/devReporter.js";
import { writeSession } from "./uty/sessionStore.js";
import { SOURCE_OPEN } from "../../markerSyntax.js";
import { CLI_NAME } from "./uty/cliName.js";
import { logWarning, logError, logEchoColored, logCommand, colorize, setLogStyle } from "../../utility.js";
import { toPosix } from "./uty/posix.js";
import { setupErrorText, logSetupFailure, scaricaStdout } from "./uty/setupFailure.js";
import creaManifest from "./buildManifest.js";
import creaCompileLocale from "./compileLocale.js";
import autoSync from "./autoSync.js";

// Dove il pacchetto vive DAVVERO, per escludere il proprio runtime compilato dalla scansione
// dei marcatori (vedi il transform più sotto). Lo trova `ownPackage.js` risalendo per NOME e
// non contando le cartelle: con "file:.." (playground/, playEdge/) node_modules/@sepoina/
// vitetranslate è un SYMLINK che punta alla radice del repo, non a "lib/", e un calcolo
// relativo a quel link escluderebbe l'intero repo (playground/src e playEdge/src compresi)
// invece del solo pacchetto — ogni marcatore lì dentro smetterebbe di essere estratto, in
// silenzio, e ogni <Translate> lo vedrebbe "non marcato" a runtime.
const ownDir = ownPackageDir();
const OWN_LIB_DIR = ownDir ? toPosix(pathCmd.join(ownDir, "lib")) : null;

// `@babel/core` è una peer dependency OBBLIGATORIA: npm e pnpm la installano da soli, ma yarn
// si limita a un avviso e nessuno impedisce di rimuoverla a mano. Quando manca, l'estrazione
// non gira: i marcatori restano nella forma sorgente e il runtime li mostra spogliati dei
// delimitatori, cioè l'applicazione appare funzionante ed è non tradotta in ogni stringa.
// Prima era un avviso, ed è il modo peggiore di dirlo: una build che riesce non viene riletta.
// Ora ferma sia il server di sviluppo sia la build, come già fa `checkSetup` per la cartella
// delle lingue mancante.

/**
 * Il guasto di Babel che deve fermare questo avvio, o null se si può proseguire.
 *
 * Diagnosi e cura arrivano allegate all'errore di `ensureBabel` (vedi babelPeer.js) e non
 * sono riscritte qui: il testo che l'utente legge ha una sola origine, e non è sempre lo
 * stesso — un Babel 8 su un Node troppo vecchio vuole un rimedio diverso da un Babel assente.
 *
 * @param {() => void} [probe] - solo per i test: la sonda che carica Babel. Stessa cucitura
 *   che `autoSync` espone come parametro `probeBabel`, e per la stessa ragione: senza, questa
 *   decisione non è verificabile se non disinstallando Babel dalla macchina che la verifica.
 * @returns {Error | null} l'errore di `ensureBabel`, con `guasto` allegato.
 */
export function motivoBabel(probe = ensureBabel) {
  // Vitest carica vite.config.* ed esegue gli hook del plugin, `buildStart` e
  // `configureServer` compresi. È la stessa ragione per cui auto-sync ha la guardia G9, con
  // una conseguenza peggiore: lì si rinuncia a scrivere, qui si ucciderebbe il processo del
  // runner. La suite di test di chi ci usa non deve fallire per una dipendenza che i suoi
  // test non toccano, e in un runner un `process.exit(1)` non è nemmeno un fallimento
  // leggibile. Chi esegue davvero una build lo scopre da `vite build`, che è dove serve.
  if (process.env.VITEST) return null;
  try {
    probe();
    return null;
  } catch (error) {
    if (error?.code !== "VT_NO_BABEL") throw error;
    return error;
  }
}

export const VIRTUAL_LANGUAGES_ID = "virtual:vitetranslate/languages";
const RESOLVED_VIRTUAL_LANGUAGES_ID = "\0" + VIRTUAL_LANGUAGES_ID;

// La sincronizzazione dei moduli di lingua NON avviene più qui: la fa il comando
// standalone "vtranslate-cli" (vedi cli.js), da
// lanciare come "prebuild" prima di "vite build" — così quando questo plugin
// espone il virtual module, i file su disco sono già aggiornati, senza dover
// dipendere dall'ordine con cui Rollup processa i propri hook in una singola build.
export default function vitetranslate(defs) {
  // Fail fast su config incompleta: senza queste due opzioni il plugin finirebbe per
  // costruire percorsi come "undefined.yml" invece di segnalare l'errore subito.
  if (typeof defs?.localeDir !== "string" || !defs.localeDir) {
    throw new Error('[vitetranslate] option "localeDir" is missing or invalid: it must be a non-empty string (e.g. "locale").');
  }
  if (typeof defs?.sourceLanguage !== "string" || !defs.sourceLanguage) {
    throw new Error('[vitetranslate] option "sourceLanguage" is missing or invalid: it must be a non-empty string holding the BCP 47 tag of the source language (e.g. "it-IT").');
  }
  const baseDir = defs.baseDir ?? process.cwd();
  const localeDir = pathCmd.join(baseDir, defs.localeDir);
  // Normalizzato a "/" per confrontarlo con gli id (posix-style) che Vite passa al transform.
  const localeDirPosix = toPosix(localeDir);
  // Prima di qualunque messaggio: applicato alla costruzione del plugin, così tutto ciò che
  // stampa da qui in poi (compreso un eventuale errore di setup) è già nella forma giusta.
  //
  // "simpleLog" è l'unica opzione la cui maiuscola interna si sbaglia scrivendola a mano
  // ("simplelog", "Simplelog", ...) senza che nulla se ne accorga: un refuso su localeDir o
  // sourceLanguage produce subito un errore di validazione, uno su simpleLog non produce
  // niente — resta silenziosamente nella forma di default. Letta case-insensitive fra le
  // chiavi di defs per questo, e non per le altre opzioni.
  const simpleLogKey = Object.keys(defs).find((k) => k.toLowerCase() === "simplelog");
  const simpleLog = !!(simpleLogKey && defs[simpleLogKey]);
  setLogStyle({ simple: simpleLog });
  // Stesso trattamento di simpleLog, e per una ragione più seria: "autoSyncdev: false" o
  // "autosyncBuild: false" sono refusi che non producono nessun errore, e il valore che resta
  // è il default `true` — cioè si continua a SCRIVERE SU DISCO proprio a chi aveva chiesto di
  // non farlo. Un default che sbaglia verso l'inazione si perdona; questo sbaglia verso
  // l'azione. Guardia G7.
  const leggiFlag = (nome, predefinito) => {
    const chiave = Object.keys(defs).find((k) => k.toLowerCase() === nome.toLowerCase());
    return chiave === undefined ? predefinito : defs[chiave] !== false;
  };
  const autoSyncDev = leggiFlag("autoSyncDev", true);
  const autoSyncBuild = leggiFlag("autoSyncBuild", true);
  // La rete che impedisce il secondo e il terzo errore (vedi configureServer): se il setup
  // fallisce, load() del modulo virtuale deve uscire subito, per qualunque motivo venisse
  // richiamato prima che il processo muoia.
  let setupFallito = false;
  // Un raccoglitore per sessione di dev/build: un avviso per categoria, il resto a conteggio
  // (vedi devReporter.js). Condiviso dalla fabbrica del manifest (buildManifest.js), da quella
  // del compile-locale (compileLocale.js) e dal transform qui sotto.
  const reporter = creaReporter({ baseDir, cliName: CLI_NAME });
  // Valore provvisorio: se defs.includeFallback non è specificato, viene risolto in
  // modo affidabile in configResolved (resolvedConfig.isProduction), invece di dedurlo
  // da process.env.NODE_ENV a tempo di definizione del plugin — NODE_ENV non riflette
  // sempre l'ambiente reale (mode custom, "vite preview", ecc.).
  let includeFallback = defs.includeFallback ?? true;
  // Le sourcemap del nostro transform seguono quelle della build invece di essere sempre
  // prodotte: costano circa l'8% del passaggio e con `build.sourcemap: false` nessuno le
  // legge. Risolto in configResolved, come includeFallback; in dev restano attive, che è
  // dove servono davvero.
  let emitSourceMaps = true;
  // Decide quali lingue sono precaricate (vedi buildManifest.js, funzione generate). Risolto in
  // configResolved come le altre due: `load` del modulo virtuale gira sempre dopo.
  let isProduction = false;
  // Il nome del file di config in uso ("vite.config.js"), per nominarlo nel blocco di un
  // setup mancante ("la sourceLanguage scritta lì è..."). Assente se Vite gira senza un file
  // di config su disco (uso puramente programmatico): il messaggio lo omette in quel caso.
  let viteConfigFile = "";
  // Diagnostica a schermo e in console. Le opzioni dell'utente si completano e si controllano
  // subito (un refuso va detto adesso, non alla prima build); la risoluzione contro l'ambiente
  // aspetta configResolved, come includeFallback. `resolvedErrorSolve` è ciò che finisce nel
  // modulo virtuale: valori già decisi, così il runtime non deve interpretare nulla.
  // `logWarning` invece del default (console.warn col prefisso "[vitetranslate]"): qui c'è
  // già una colonna di log da usare (setLogStyle è già stato applicato sopra), quindi un
  // refuso in errorSolve appare nella stessa forma colorata di ogni altro avviso, non a parte.
  const errorSolveOptions = normalizeErrorSolve(defs?.errorSolve, logWarning);
  let resolvedErrorSolve = resolveErrorSolve(errorSolveOptions, false);
  // I prefissi accesi hanno un costo che si paga nel bundle — l'elenco delle chiavi non
  // tradotte in ogni chunk di lingua, l'insieme globale nel modulo virtuale — e con i default
  // in produzione non si paga mai.
  const marksUntranslated = () => resolvedErrorSolve.untranslated !== "";
  const marksNotFullyTranslated = () => resolvedErrorSolve.notFullyTranslated !== "";

  // Gli id dei moduli di lingua che il bundler ci ha davvero chiesto di compilare. È l'elenco
  // completo per costruzione — un modulo entra nel grafo solo passando dal transform qui sotto
  // — e sostituisce la scansione di tutto `idToModuleMap` che serviva a ritrovarli: quel grafo
  // ha migliaia di voci in un'app vera, e le lingue sono una decina.
  const localeModuleIds = new Set();

  const manifest = creaManifest({
    defs, localeDir, reporter,
    leggiStato: () => ({ isProduction, errorSolve: resolvedErrorSolve }),
  });

  const localeCompiler = creaCompileLocale({
    defs, localeDirPosix, reporter, localeModuleIds,
    leggiStato: () => ({ errorSolve: resolvedErrorSolve }),
  });

  // La config risolta, in un oggetto solo. Due lettori: la CLI, che la ripesca da qui invece
  // di pretendere un file di config separato da tenere in sync (vedi doc/structure.md, "No
  // separate config file"), e l'auto-sync dell'hook `config` qui sotto.
  const vitetranslateConfig = {
    ...defs,
    baseDir,
    srcDir: defs.srcDir ?? "src",
    simpleLog,
    autoSyncDev,
    autoSyncBuild,
  };

  const plugin = {
    name: "vitetranslate",
    // esposta così com'è (con baseDir/srcDir già risolti) per il comando standalone
    // "vtranslate-cli": legge la config direttamente
    // da qui invece di richiedere un file di config separato da mantenere in sync.
    // srcDir di default "src": la convenzione quasi universale nei progetti Vite.
    vitetranslateConfig,
    // Gira prima del plugin React del progetto, così è l'estrazione a vedere il JSX
    // originale. Il marcatore compilato contiene un "<" letterale, che in un nodo di testo
    // JSX non sarebbe sintassi valida: per questo l'estrazione lo emette sempre dentro
    // un'espressione ({"..."}), lasciando il JSX intatto per chi viene dopo.
    enforce: "pre",
    // Il runtime importa `virtual:vitetranslate/languages`, che esiste solo attraverso
    // questo plugin: esbuild, che pre-bundla le dipendenze in un processo tutto suo, non lo
    // può risolvere e su Vite <= 7 il dev server muore in partenza con
    // "Could not resolve virtual:vitetranslate/languages". Non si vede finché la libreria è
    // linkata (`file:`/`npm link`): i pacchetti linkati non vengono pre-bundlati. Si vede
    // eccome appena la si installa da npm — cioè su ogni progetto vero.
    // L'esclusione la dichiara il plugin, non il consumer: è una conseguenza di come è fatta
    // la libreria, non una scelta di chi la usa. Il prefisso copre anche il sottopercorso
    // "/react", che è poi l'unico che finisce nel grafo del browser.
    // L'UNICO hook di questo plugin che scrive su disco, e l'unico che può farlo. Gira prima di
    // configResolved, prima di configureServer (quindi prima che esista server.watcher), prima
    // di buildStart e prima che un solo modulo venga risolto: quando ritorna, le scritture sono
    // finite e nessuno le ha ancora viste. È la stessa posizione temporale di un "predev", presa
    // da dentro il processo. Vedi autoSync.js per le guardie, e doc/structure.md § "Invariants"
    // per il perché ogni altro hook è escluso.
    //
    // `await` e non fire-and-forget: Vite attende gli hook `config` in serie, ed è proprio
    // quell'attesa a garantire che il watcher non veda mai una scrittura a metà. Guardia G2.
    async config(_userConfig, env) {
      await autoSync({ config: vitetranslateConfig, env });
      return { optimizeDeps: { exclude: ["@sepoina/vitetranslate"] } };
    },
    configResolved(resolvedConfig) {
      isProduction = !!resolvedConfig.isProduction;
      resolvedErrorSolve = resolveErrorSolve(errorSolveOptions, isProduction);
      if (defs.includeFallback === undefined) includeFallback = !isProduction;
      // In dev la sourcemap serve sempre; in build solo se la build stessa le vuole.
      emitSourceMaps = !isProduction || !!resolvedConfig.build?.sourcemap;
      if (resolvedConfig.configFile) viteConfigFile = pathCmd.basename(resolvedConfig.configFile);
    },
    //
    // compila _%_..._%_ e <Translate> via Babel in un unico passaggio
    //
    // "filter" pre-scarta in Rust i file senza il marcatore su Rolldown/Rollup>=4.38/Vite>=6.3
    // (ignorato sui bundler più vecchi); il guard imperativo in handler resta la fonte di
    // verità e copre anche quei bundler più vecchi.
    transform: {
      filter: { code: SOURCE_OPEN },
      handler(code, id) {
        if (!/\.[jt]sx?$/.test(id)) return null;
        if (id.includes("node_modules")) return null;
        // Copre il caso symlink (vedi OWN_LIB_DIR sopra): il runtime compilato del pacchetto
        // stesso (lib/dist/*, lib/react/*) contiene "_%_" come stringa letterale — i
        // delimitatori, definiti come costanti in errorSolve.js/interpolate.js — e senza
        // questo guard veniva scansionato come sorgente utente, producendo falsi "malformed
        // marker" per un testo che non è mai passato da Babel/JSX.
        if (OWN_LIB_DIR && toPosix(id).startsWith(`${OWN_LIB_DIR}/`)) return null;
        // I file lingua sono dati, non sorgente da compilare: anche se una stringa tradotta
        // contenesse "_%_" per coincidenza non deve finire nella pipeline Babel. Dalla 4.0
        // non sono più .js e il guard sull'estensione qui sopra basterebbe: questo copre i
        // residui di un progetto non ancora migrato, che altrimenti verrebbero scansionati.
        if (toPosix(id).startsWith(`${localeDirPosix}/`)) return null;
        if (!code.includes(SOURCE_OPEN)) return null;
        // Un file che non si riesce a parsare non deve far fallire la build a causa
        // *nostra*: se è davvero rotto lo segnalerà il transform successivo, con un
        // messaggio pertinente al suo linguaggio. Qui si lascia passare invariato,
        // avvisando che le sue stringhe marcate non sono state estratte.
        try {
          // Parse + splice, non un transform completo: il codice non marcato esce
          // esattamente com'era entrato. Vedi extractMarkers.js per il perché.
          return extractMarkers(code, {
            filename: id,
            table: {},
            includeFallback,
            sourceMaps: emitSourceMaps,
            baseDir,
            // Annidati, collisioni e marcatori malformati entrano nel raccoglitore come tutto
            // il resto (vedi devReporter.js): senza questo canale stampano per conto loro, e
            // sono i più ripetitivi di tutti (uno per file, a ogni salvataggio).
            warn: (msg, kind) => reporter.report(kind, msg),
          });
        } catch (error) {
          // Ramo di riserva, non più la via normale: `motivoBabel()` ferma il server e la
          // build prima che un transform venga chiamato, quindi in pratica ci si arriva in due
          // casi soli — una rimozione avvenuta a server già avviato, e Vitest, dove quelle due
          // porte sono aperte apposta. Resta anche perché il caricamento di Babel è pigro
          // (vedi ensureBabel in extractMarkers.js). Categoria a sé, perché senza Babel OGNI
          // file marcato la solleverebbe: senza questo ramo uscirebbe una volta per file,
          // invece di una volta sola per l'intera sessione (vedi devReporter.js).
          if (error?.code === "VT_NO_BABEL") {
            reporter.report("no-babel", babelUnaRiga(error.guasto));
            return null;
          }
          reporter.report("parse-failed", `${colorize("nome", `"${id}"`)} could not be parsed, markers not extracted: ${error.message}`);
          return null;
        }
      },
    },
    //
    // modulo virtuale: elenco lingue trovate in localeDir, ciascuna caricabile
    // pigramente via import() -> Rollup/Vite ne fa un chunk separato per lingua
    //
    resolveId(id) {
      if (id === VIRTUAL_LANGUAGES_ID) return RESOLVED_VIRTUAL_LANGUAGES_ID;
    },
    async load(id) {
      if (id === RESOLVED_VIRTUAL_LANGUAGES_ID) {
        // La rete: il setup è già stato segnalato e il processo sta per morire (vedi
        // configureServer). Se load() viene comunque richiamato nel frattempo — più moduli in
        // coda nello stesso giro — non deve produrre un secondo o un terzo errore.
        if (setupFallito) return;
        // moduleType: 'js' forza l'interpretazione JS su Rolldown/Vite 8, dove il tipo
        // sarebbe altrimenti dedotto dall'estensione dell'id (qui assente, essendo virtuale).
        // Ignorato su Rollup/Vite 7 (proprietà extra non riconosciuta).
        return { code: await manifest.generate(), moduleType: "js" };
      }
    },
    // build: stesso controllo di configureServer (vedi sotto), ma un throw è già la cosa
    // giusta qui — la build fallisce con codice non zero, e uccidere il processo toglierebbe
    // a Vite la possibilità di stampare il proprio riepilogo.
    buildStart() {
      // In dev il problema è già stato detto — per esteso, nella colonna del log — e il
      // processo sta uscendo: rilanciarlo da qui sostituirebbe quel blocco con lo stack trace
      // di un hook di Vite, che è la forma peggiore della stessa notizia.
      if (setupFallito) return;
      // Babel prima della cartella delle lingue: senza di lui non c'è estrazione, quindi
      // nemmeno un setup perfetto produrrebbe una build tradotta. Vedi motivoBabel.
      const guastoBabel = motivoBabel();
      // Mai colorato, per lo stesso motivo del throw più sotto.
      if (guastoBabel) throw new Error(`[vitetranslate] ${babelUnaRiga(guastoBabel.guasto)}`);
      const result = checkSetup({ localeDir, localeDirLabel: defs.localeDir, sourceLanguage: defs.sourceLanguage });
      if (result.ok) return;
      // Mai colorato: un Error lanciato può finire in un log che non interpreta gli ANSI.
      const { problem, fixCommand, fixText } = setupErrorText(result, { localeDirLabel: defs.localeDir, sourceLanguage: defs.sourceLanguage });
      throw new Error(`[vitetranslate] ${problem} ${fixCommand ?? fixText}`);
    },
    // In build il giro ha una fine dichiarata, e conviene usarla: un flush qui è sincrono con
    // il resto dell'output di Vite, invece di arrivare dopo, a timer scaduto.
    buildEnd() {
      reporter.flush();
    },
    //
    // dev: rigenera il modulo virtuale non appena un file lingua viene aggiunto/rimosso
    //
    async configureServer(server) {
      // Stessa ragione del controllo qui sotto, applicata a Babel: senza estrazione il server
      // partirebbe e servirebbe l'applicazione con i marcatori sorgente al posto delle
      // traduzioni — funzionante a vedersi, e sbagliata in ogni stringa.
      const guastoBabel = motivoBabel();
      if (guastoBabel) {
        setupFallito = true;
        logError(`${guastoBabel.message} ${guastoBabel.guasto.cura}:`);
        logCommand(guastoBabel.guasto.comando);
        logEchoColored("", "");
        await server.close();
        await scaricaStdout();
        process.exitCode = 1;
        process.exit(1);
        return;
      }
      // Un controllo unico, eseguito PRIMA che il server cominci a servire — non alla prima
      // richiesta del browser (vedi uty/checkSetup.js): altrimenti il server parte, dice di
      // essere pronto, e il primo errore vero arriva come fallimento di un modulo, uno per
      // ogni richiesta successiva.
      const result = checkSetup({ localeDir, localeDirLabel: defs.localeDir, sourceLanguage: defs.sourceLanguage });
      if (!result.ok) {
        setupFallito = true;
        logSetupFailure({
          result, localeDirLabel: defs.localeDir, sourceLanguage: defs.sourceLanguage,
          viteConfigFile, baseDir,
        });
        // Un throw da configureServer non basta: su Vite viene riportato come errore di
        // plugin e in più di una versione il processo resta vivo. Nemmeno chiudere il server e
        // lasciar morire il loop basta: `buildStart` gira DOPO (Vite lo chiama da
        // `httpServer.listen`), e senza l'uscita di qui il suo throw coprirebbe il blocco
        // appena stampato con uno stack trace — il guard su `setupFallito` lì lo evita, ma
        // resterebbe comunque un server che ha cominciato ad ascoltare su un progetto che non
        // può funzionare. Quindi si esce, davvero.
        await server.close();
        // Prima di uscire, però, si aspetta che stdout si svuoti: su una pipe (un log di CI,
        // un `| tee`) la scrittura è asincrona, e `process.exit` taglierebbe esattamente il
        // messaggio per cui questo controllo esiste. Il timeout è la via d'uscita nel caso in
        // cui a valle non legga nessuno.
        await scaricaStdout();
        process.exitCode = 1;
        process.exit(1);
        return;
      }
      writeSession(baseDir, { localeDir: defs.localeDir, sourceLanguage: defs.sourceLanguage });

      server.watcher.add(localeDir);

      // Solo i file di lingua diretti dentro localeDir. Senza il filtro sull'estensione anche
      // i backup che il comando di sync lascia lì accanto (".bak-corrupted-*",
      // ".bak-erased-*", ".bak-migrated-*") facevano ricaricare la pagina.
      const isLanguageFile = (file) =>
        pathCmd.dirname(file) === localeDir && isLanguageFileName(file);

      // Il contenuto del modulo virtuale dipende dall'INSIEME dei file lingua e dal nome di
      // ciascuna lingua, non dalle traduzioni: rigenerarlo (cioè rileggere tutte le lingue)
      // a ogni modifica di testo era lavoro buttato.
      const invalidateManifestModule = () => {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_LANGUAGES_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      const invalidateManifest = (file) => {
        if (!isLanguageFile(file)) return;
        invalidateManifestModule();
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", invalidateManifest);
      server.watcher.on("unlink", invalidateManifest);

      // Modifica di contenuto: il manifest resta valido, ma ricaricare serve comunque. Le
      // tabelle vivono in una cache a livello di modulo lato client (react/languageResource.js),
      // che un semplice hot update del modulo di lingua non svuoterebbe: la pagina
      // continuerebbe a mostrare la traduzione vecchia. Copre anche il file corretto a mano
      // dopo essere stato segnalato come non valido.
      server.watcher.on("change", (file) => {
        if (!isLanguageFile(file)) return;

        // `🔹` dice quali chiavi restano non tradotte in QUALCHE lingua: è un insieme calcolato
        // leggendole tutte, e tradurne una lo cambia. Il manifest va quindi rigenerato anche
        // quando cambia solo il contenuto di un file — che è l'eccezione alla regola qui
        // sopra, e vale solo con quel prefisso acceso. Spento (ogni build di produzione con i
        // default) la rilettura non avviene e la regola resta quella di prima.
        if (marksNotFullyTranslated()) invalidateManifestModule();

        // Ogni lingua incorpora il testo della sorgente per le chiavi non ancora tradotte,
        // quindi una modifica alla sorgente rende stantii TUTTI gli altri moduli compilati,
        // non solo il proprio. Vite non può dedurlo dal grafo — quel testo entra nel modulo
        // durante il transform, non attraverso un import — e senza questa invalidazione la
        // pagina ricaricata continuerebbe a ricevere i moduli compilati prima della modifica.
        if (tagFromFileName(pathCmd.basename(file)) === defs.sourceLanguage) {
          for (const id of localeModuleIds) {
            const mod = server.moduleGraph.getModuleById(id);
            // Sparito dal grafo (file rimosso, grafo ricostruito): la voce non serve più.
            if (mod) server.moduleGraph.invalidateModule(mod);
            else localeModuleIds.delete(id);
          }
        }

        server.ws.send({ type: "full-reload" });
      });
    },
  };

  // cli.js cerca il plugin per nome dopo un flat(Infinity), quindi l'array non lo disturba.
  return [localeCompiler, plugin];
}
