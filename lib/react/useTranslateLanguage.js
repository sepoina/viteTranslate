// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { useContext, useMemo } from "react";
import { TranslateContext } from "./TranslateContext.js";
import { languages as manifest, sourceLanguage } from "virtual:vitetranslate/languages";

// Elenco { tag, languageName } trovato in localeDir, lingua sorgente per prima: si ricava
// dal solo manifest delle lingue (nomi già calcolati a sync-time in __builder__), senza
// caricare nessuna tabella. È una costante di modulo, quindi è disponibile anche fuori da
// <TranslateContainer> e non cambia mai identità.
//
// Congelato, array e voci: essendo un singleton condiviso da tutta l'app e consegnato a
// codice che non controlliamo, una singola scrittura di troppo lo corrompe per l'intera
// vita della pagina, per tutti i consumer, e il guasto si manifesta lontano da dove è
// stato causato. Il caso reale che ha portato a questa riga è un `filter(l => l.tag = id)`
// (`=` invece di `===`) in un language switcher: azzerava il tag di ogni lingua al primo
// render. I moduli ESM sono sempre in strict mode, quindi ora quella riga lancia un
// TypeError sul posto invece di avvelenare l'array in silenzio.
//
// Chi deve riordinare o filtrare l'elenco lavora su una copia (`[...languages]`): è quello
// che andrebbe fatto comunque su un valore condiviso.
const tags = [sourceLanguage, ...Object.keys(manifest).filter((tag) => tag !== sourceLanguage)];
const languages = Object.freeze(
  tags.map((tag) => Object.freeze({ tag, languageName: manifest[tag]?.name ?? tag }))
);

// Il context non è esportato dalla libreria: la sua forma (che include `table`, la mappa
// interna delle traduzioni) resta un dettaglio implementativo, libero di cambiare. Chi usa
// la libreria passa da qui, e riceve solo ciò che è supportato.
let warnedOutsideContainer = false;

// Sostituto inerte quando non c'è un container sopra: leggere `languages` fuori dall'albero
// tradotto è legittimo e resta silenzioso, mentre l'avviso scatta solo se si prova davvero
// a cambiare lingua — cioè l'unica cosa che lì non può funzionare. Una volta sola, come
// per gli errori di <Translate>.
function proposeNewLanguageOutsideContainer() {
  if (warnedOutsideContainer || !import.meta.env?.DEV) return;
  warnedOutsideContainer = true;
  console.error("useTranslateLanguage: proposeNewLanguage() called outside <TranslateContainer>, the language switch has no effect");
}

/**
 * Tutto ciò che serve a un selettore di lingua, in un hook solo: lingua corrente, elenco
 * delle lingue disponibili e funzione per cambiarla.
 *
 * Fuori da <TranslateContainer> `languages` e `sourceLanguage` restano validi (sono noti a
 * build time), `id` è undefined e `proposeNewLanguage` è inerte — l'interfaccia non cambia
 * forma, così i consumer non devono difendersi con `?.` ovunque.
 *
 * @returns {{
 *   id: string | undefined,
 *   debug: boolean,
 *   languages: { tag: string, languageName: string }[],
 *   sourceLanguage: string,
 *   proposeNewLanguage: (options: {
 *     lang: string,
 *     onStart?: () => void,
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
  // Congelato come `languages`, e per la stessa ragione: è memoizzato, quindi lo stesso
  // oggetto è condiviso da tutti i componenti che chiamano l'hook finché la lingua non
  // cambia. Scriverci dentro (`l.id = "en-US"`) non cambierebbe la lingua di nessuno, si
  // limiterebbe a mentire a tutti gli altri lettori.
  return useMemo(
    () => Object.freeze({
      id: lang?.id,
      debug: !!lang?.debug,
      languages,
      sourceLanguage,
      proposeNewLanguage: lang?.proposeNewLanguage ?? proposeNewLanguageOutsideContainer,
    }),
    [lang]
  );
}
