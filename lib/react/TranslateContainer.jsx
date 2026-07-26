/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { TranslateContext } from "./TranslateContext";
import { sourceLanguage } from "virtual:vitetranslate/languages";
import { readLanguage, ensureLanguage, isKnownLanguage } from "./languageResource";

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
 * @param {string} [initialLanguage=sourceLanguage] - tag BCP 47 iniziale (es. 'it-IT'), di
 *   default la sourceLanguage del plugin. Se è precaricata (sourceLanguage o una di
 *   preloadedLanguages) viene mostrata sincrona al primo render; altrimenti il container
 *   sospende finché il chunk non è caricato, senza mai renderizzare la lingua sbagliata.
 * @param {React.ReactNode} [fallback=null] - mostrato durante il caricamento di una lingua
 *   non precaricata. Di default null: i chunk sono locali, il "loading" è un frame vuoto.
 * @param {boolean} [debug]
 */
export default function TranslateContainer({ initialLanguage = sourceLanguage, children, debug, fallback = null }) {
  // initialLanguage inesistente -> ricade su sourceLanguage (sempre disponibile) senza
  // far esplodere l'app. Inizializzatore: eseguito una sola volta.
  const [lang, setLang] = React.useState(() => {
    if (isKnownLanguage(initialLanguage)) return initialLanguage;
    console.error(`TranslateContainer: unknown initial language "${initialLanguage}", falling back to "${sourceLanguage}"`);
    return sourceLanguage;
  });

  // struttura funzione proposeNewLanguage({
  //   lang:'it-IT',
  //   onStart: () => {},      // a inizio caricamento
  //   onDone: (isOk) => {},   // a fine caricamento isOk - true o false
  //   onError: (error) => {}, // in caso di errore, struttura error
  //  })
  // useCallback: identità stabile così il proposeNewLanguage esposto nel context — usato
  // dai language switcher — non cambia a ogni render.
  const proposeNewLanguage = React.useCallback(({ lang: next, onStart, onDone, onError } = {}) => {
    if (!isKnownLanguage(next)) {
      const error = new Error(`Unknown language "${next}"`);
      if (onError) onError({ error, inexistID: next });
      else console.error(`Inexistant language "${next}"`);
      if (onDone) onDone(false);
      return;
    }
    if (onStart) onStart(true);
    // Avvia (o riusa) il caricamento e aggancia i callback all'esito reale della Promise.
    ensureLanguage(next).then(
      () => { if (onDone) onDone(true); },
      error => {
        if (onError) onError({ error, inexistID: next });
        else console.error(`Error loading language "${next}"`, error);
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
