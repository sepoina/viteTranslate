import { useContext, useMemo } from "react";
import { TranslateContext } from "./TranslateContext";
import { languages, sourceLanguage } from "virtual:vitetranslate/languages";

// Elenco dei tag trovati in localeDir, lingua sorgente per prima: si ricava dal solo
// manifest delle lingue, senza caricare nessuna tabella. È una costante di modulo, quindi
// è disponibile anche fuori da <TranslateContainer> e non cambia mai identità.
const tags = [sourceLanguage, ...Object.keys(languages).filter((tag) => tag !== sourceLanguage)];

// Il context non è esportato dalla libreria: la sua forma (che include `table`, la mappa
// interna delle traduzioni) resta un dettaglio implementativo, libero di cambiare. Chi usa
// la libreria passa da qui, e riceve solo ciò che è supportato.
let warnedOutsideContainer = false;

// Sostituto inerte quando non c'è un container sopra: leggere `tags` fuori dall'albero
// tradotto è legittimo e resta silenzioso, mentre l'avviso scatta solo se si prova davvero
// a cambiare lingua — cioè l'unica cosa che lì non può funzionare. Una volta sola, come
// per gli errori di <Translate>.
function proposeNewLanguageOutsideContainer() {
  if (warnedOutsideContainer || !import.meta.env?.DEV) return;
  warnedOutsideContainer = true;
  console.error("useTranslateLanguage: proposeNewLanguage() chiamata fuori da <TranslateContainer>, il cambio lingua non ha effetto");
}

/**
 * Tutto ciò che serve a un selettore di lingua, in un hook solo: lingua corrente, elenco
 * delle lingue disponibili e funzione per cambiarla.
 *
 * Fuori da <TranslateContainer> `tags` e `sourceLanguage` restano validi (sono noti a
 * build time), `id` è undefined e `proposeNewLanguage` è inerte — l'interfaccia non cambia
 * forma, così i consumer non devono difendersi con `?.` ovunque.
 *
 * @returns {{
 *   id: string | undefined,
 *   debug: boolean,
 *   tags: string[],
 *   sourceLanguage: string,
 *   proposeNewLanguage: (options: {
 *     lang: string,
 *     onStart?: (started: boolean) => void,
 *     onDone?: (isOk: boolean) => void,
 *     onError?: (info: { error: Error, inexistID: string }) => void,
 *   }) => void,
 * }}
 */
export function useTranslateLanguage() {
  const lang = useContext(TranslateContext);

  // Qui il memo colpisce davvero: `lang` è già memoizzato da TranslateProvider e tutto il
  // resto è costante di modulo. Serve perché questo oggetto finisce nelle liste di
  // dipendenze del codice utente, dove un'identità nuova a ogni render farebbe ripartire
  // useEffect a ciclo.
  return useMemo(
    () => ({
      id: lang?.id,
      debug: !!lang?.debug,
      tags,
      sourceLanguage,
      proposeNewLanguage: lang?.proposeNewLanguage ?? proposeNewLanguageOutsideContainer,
    }),
    [lang]
  );
}
