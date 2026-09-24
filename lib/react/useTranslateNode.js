// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { useCallback, useContext } from "react";
import { TranslateContext } from "./TranslateContext.js";
import { resolveEntry } from "./resolveEntry.js";
import { markerKey, stripSourceMarker } from "./parseCompiledMarker.js";
import { isCompiledMarker } from "../markerSyntax.js";
import { resolveDiagnostics, reportOnce } from "../errorSolve.js";
import { fallbackTable } from "virtual:vitetranslate/languages";
import * as manifest from "virtual:vitetranslate/languages";

const diag = resolveDiagnostics(manifest);

/**
 * La forma a hook di <Translate>: risolve un marcatore compilato in un nodo React.
 *
 * Esiste per essere INIETTATA dal transform (`autoWrap`), e il guadagno è la sua ragione
 * d'essere: dieci stringhe marcate in un componente costavano dieci elementi, dieci fiber e
 * dieci chiamate a componente; qui costano dieci chiamate di funzione, e il nodo risolto
 * diventa figlio diretto del genitore.
 *
 * Lo scambio non è gratis in entrambe le direzioni, e va saputo: con <Translate> il
 * consumatore del context è la foglia, quindi al cambio lingua si rirenderizzano le sole
 * foglie; qui è il componente, quindi si rirenderizza il suo sottoalbero. Cambiare lingua è
 * raro e comporta già il caricamento di un chunk. In regime stazionario vince questa.
 *
 * Accetta un marcatore compilato. Una stringa qualunque non ha una chiave da cercare: esce col
 * testo (delimitatori `_%_` tolti, se ci sono), e in sviluppo lo segnala una volta.
 *
 * @returns {(t: string, a?: any) => import("react").ReactNode}
 */
export function useTranslateNode() {
  const lang = useContext(TranslateContext);
  // Identità stabile finché la lingua non cambia, come per `ts`: la funzione finisce nelle
  // liste di dipendenze del codice utente, e una nuova a ogni render le farebbe ripartire tutte.
  return useCallback((t, a) => {
    // Una stringa che marcatore non è NON può proseguire, e non basta segnalarla: `markerKey`
    // affetta per posizione (parseCompiledMarker.js) e su un testo qualunque restituisce un
    // troncone, che finirebbe a schermo come chiave grezza — in produzione, dove il ramo DEV
    // non esiste, in silenzio. Si esce col testo, che è la stessa via di degrado di <Translate>
    // e di ts(). Questo hook nasce per essere iniettato, ma è esportato dal pacchetto (il
    // codice iniettato lo importa da lì): il contratto vale anche per chi lo chiama a mano.
    if (!isCompiledMarker(t)) {
      if (import.meta.env?.DEV) {
        reportOnce(diag, `useTranslateNode: "${t}" is not a compiled marker — use <Translate> for anything else.`);
      }
      // `stripSourceMarker` è già nel bundle (la usano Translate.js e useTranslateToString.js):
      // qui costa zero byte in più e toglie i delimitatori a un "_%_..._%_" mai compilato.
      return stripSourceMarker(t);
    }
    return resolveEntry(lang?.table, fallbackTable, markerKey(t), a, t, diag, lang?.icu ?? manifest.icu);
  }, [lang]);
}
