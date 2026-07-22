/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";
import { TranslateContext } from "./TranslateContext";
import { languages, defaultLanguage } from "virtual:vitetranslate/languages";

/**
 * @param {string} [predefined=defaultLanguage] - tag BCP 47 iniziale da caricare (es. 'it-IT'),
 *   di default quello configurato come defaultLanguage nel plugin vitetranslate
 * @param {boolean} [debug]
 */
export default function TranslateContainer({ predefined = defaultLanguage, children, debug }) {
  const [propose, setPropose] = React.useState({ lang: predefined });
  const [langOBJ, setLangOBJ] = React.useState(null);
  // Per-istanza (non a livello di modulo): due TranslateContainer montati insieme
  // (nesting, root multipli, remount) non devono condividere questo stato di guardia,
  // altrimenti il secondo che propone la stessa lingua del primo troverebbe già
  // last.current === lang, farebbe return subito e langOBJ resterebbe null per sempre.
  const last = React.useRef(null);

  // struttura funzione proposeNewLanguage({
  //   lang:'it-IT',
  //   onStart: () => {},      // a inizio caricamento
  //   onDone: (isOk) => {},   // a fine caricamento isOk - true o false
  //   onError: (error) => {}, // in caso di errore, struttura error
  //  })
  const proposeNewLanguage = propObj => {
    setPropose(propObj);
  };

  React.useEffect(() => {
    if (!propose.lang) return;
    if (last.current === propose.lang) return; // già in caricamento
    const requestedLang = propose.lang;
    last.current = requestedLang; // evita doppie interazioni, e traccia la richiesta più recente
    if (propose.onStart) propose.onStart(true);
    // declare the async data loading function
    const loadData = async () => {
      // la lingua richiesta è tra quelle trovate in localeDir da vitetranslate?
      const loader = languages[requestedLang];
      if (!loader) {
        const error = new Error(`Unknown language "${requestedLang}"`);
        if (propose.onError) propose.onError({ error, inexistID: requestedLang });
        else console.error(`Inexistant language "${requestedLang}"`);
        if (propose.onDone) propose.onDone(false);
        return;
      }
      try {
        // import() dinamico -> Rollup/Vite carica solo il chunk della lingua richiesta
        const mod = await loader();
        // Se nel frattempo è stata proposta un'altra lingua, questa risoluzione è
        // superata (le import() concorrenti non risolvono in ordine): scartala per
        // evitare che una risposta lenta sovrascriva una lingua più recente già applicata.
        if (last.current !== requestedLang) return;
        // set state with the result
        if (propose.onDone) propose.onDone(true);
        setLangOBJ({
          id: requestedLang,
          debug: debug,
          table: mod.default,
          proposeNewLanguage: proposeNewLanguage,
        });
      } catch (error) {
        if (last.current !== requestedLang) return;
        if (propose.onError) propose.onError({ error: error, inexistID: requestedLang });
        else console.error(`Error loading language "${requestedLang}"`, error);
        if (propose.onDone) propose.onDone(false);
        return;
      }
    };

    // call the function
    loadData();
  }, [propose.lang]);

  return (
    <TranslateContext.Provider value={langOBJ}>
      {children}
    </TranslateContext.Provider>
  );
}
