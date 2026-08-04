/* eslint-disable react-hooks/exhaustive-deps */
// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime", "Suspense e cambio lingua".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import React from "react";
import { TranslateContext } from "./TranslateContext.js";
import {
  readLanguage, ensureLanguage, isKnownLanguage, isPreloadedLanguage,
  preloadedLanguages, firstPreloadedLanguage,
} from "./languageResource.js";
// Namespace per gli export recenti: vedi la nota in Translate.js.
import * as manifest from "virtual:vitetranslate/languages";
import { resolveDiagnostics, report } from "../errorSolve.js";

const diag = resolveDiagnostics(manifest);

// Una lingua iniziale non precaricata funziona — il container sospende, il chunk arriva, la
// pagina si completa — ma paga un giro di rete prima di poter mostrare qualsiasi testo, che è
// esattamente ciò che `preloadedLanguages` esiste per evitare. Vale la pena dirlo.
//
// L'avviso non è limitato allo sviluppo, ed è il motivo per cui `preloaded` viaggia nel
// bundle invece di essere dedotto: in dev la lingua sorgente è precaricata comunque, quindi
// un controllo fatto lì direbbe che va tutto bene proprio nella configurazione che poi, in
// produzione, sospende. Il caso tipico è `sourceLanguage: "it-IT"` con
// `preloadedLanguages: ["en-US"]` e `initialLanguage="it-IT"`.
//
// Da quando esiste `errorSolve` l'ultima parola ce l'ha `warningBuild`, che di default è
// false: in una build di produzione questo avviso tace, ed è una scelta di chi configura, non
// più della libreria. Chi vuole vederlo dove serve davvero mette `warningBuild: true`.
//
// Una volta sola per tag: è un errore di configurazione, si ripresenta identico a ogni mount.
const warnedNotPreloaded = new Set();

function warnInitialNotPreloaded(tag) {
  if (warnedNotPreloaded.has(tag)) return;
  warnedNotPreloaded.add(tag);
  report(
    diag, "warn",
    `TranslateContainer: initialLanguage "${tag}" is not preloaded, so the first render suspends ` +
    `until its chunk is fetched. Preloaded: ${preloadedLanguages.map((t) => `"${t}"`).join(", ") || "(none)"}. ` +
    `Add "${tag}" to the "preloadedLanguages" option of the vitetranslate plugin, or start from a preloaded language.`
  );
}

/**
 * Componente interno che vive DENTRO il boundary Suspense: legge la tabella della lingua
 * corrente e, se non è ancora pronta, sospende (readLanguage lancia la Promise). È qui —
 * non in TranslateContainer — che deve avvenire la sospensione, così a catturarla è il
 * <Suspense> reso dal container.
 */
function TranslateProvider({ lang, debug, proposeNewLanguage, children }) {
  const table = readLanguage(lang); // sospende finché la lingua non è caricata
  const value = React.useMemo(
    () => ({ id: lang, debug, table, proposeNewLanguage }),
    [lang, debug, table, proposeNewLanguage]
  );
  return <TranslateContext.Provider value={value}>{children}</TranslateContext.Provider>;
}

/**
 * @param {string} [initialLanguage] - tag BCP 47 iniziale (es. 'it-IT'). Di default la prima
 *   lingua precaricata — `preloadedLanguages[0]`, o la sourceLanguage se non ne è stata
 *   dichiarata nessuna — che è la stessa in sviluppo e in build: essendo precaricata viene
 *   mostrata sincrona al primo render. Passandone una non precaricata il container sospende
 *   finché il chunk non è caricato, senza mai renderizzare la lingua sbagliata, e lo segnala
 *   in console.
 * @param {React.ReactNode} [fallback=null] - mostrato durante il caricamento di una lingua
 *   non precaricata. Di default null: i chunk sono locali, il "loading" è un frame vuoto.
 * @param {boolean} [debug]
 */
export default function TranslateContainer({ initialLanguage = firstPreloadedLanguage, children, debug, fallback = null }) {
  // initialLanguage inesistente -> ricade sulla prima precaricata (quindi sempre disponibile)
  // senza far esplodere l'app. Inizializzatore: eseguito una sola volta.
  const [lang, setLang] = React.useState(() => {
    if (!isKnownLanguage(initialLanguage)) {
      report(diag, "error", `TranslateContainer: unknown initial language "${initialLanguage}", falling back to "${firstPreloadedLanguage}"`);
      return firstPreloadedLanguage;
    }
    // Lingua valida ma non in bundle: funziona, ma sospende. Vedi warnInitialNotPreloaded.
    if (!isPreloadedLanguage(initialLanguage)) warnInitialNotPreloaded(initialLanguage);
    return initialLanguage;
  });

  // struttura funzione proposeNewLanguage({
  //   lang:'it-IT',
  //   onStart: () => {},      // a inizio caricamento (chiamata solo se `lang` è valida)
  //   onDone: (isOk) => {},   // a fine caricamento isOk - true o false
  //   onError: (error) => {}, // in caso di errore, struttura error
  //  })
  // useCallback: identità stabile così il proposeNewLanguage esposto nel context — usato
  // dai language switcher — non cambia a ogni render.
  const proposeNewLanguage = React.useCallback(({ lang: next, onStart, onDone, onError } = {}) => {
    if (!isKnownLanguage(next)) {
      const error = new Error(`Unknown language "${next}"`);
      if (onError) onError({ error, inexistID: next });
      else report(diag, "error", `Inexistant language "${next}"`);
      if (onDone) onDone(false);
      return;
    }
    if (onStart) onStart();
    // Avvia (o riusa) il caricamento e aggancia i callback all'esito reale della Promise.
    ensureLanguage(next).then(
      () => { if (onDone) onDone(true); },
      error => {
        if (onError) onError({ error, inexistID: next });
        else report(diag, "error", `Error loading language "${next}"`, error);
        if (onDone) onDone(false);
      }
    );
    // Transition: React tiene visibile la lingua corrente finché la nuova è pronta, invece
    // di mostrare il fallback di Suspense (nessun lampo vuoto durante lo switch). Il render
    // legge sempre lo stato `lang` corrente, quindi risposte lente di richieste superate
    // vengono ignorate da sole (niente più guardia "last request wins").
    React.startTransition(() => setLang(next));
  }, []);

  return (
    <React.Suspense fallback={fallback}>
      <TranslateProvider lang={lang} debug={debug} proposeNewLanguage={proposeNewLanguage}>
        {children}
      </TranslateProvider>
    </React.Suspense>
  );
}
