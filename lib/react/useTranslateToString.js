// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { useCallback, useContext } from 'react';
import { TranslateContext } from './TranslateContext.js';
import { markerKey, stripSourceMarker } from './parseCompiledMarker.js';
import { interpolate } from './interpolate.js';
import { resolveEntryText } from './resolveEntry.js';
// Fallback universale sempre disponibile (vedi Translate.jsx).
import { fallbackTable } from 'virtual:vitetranslate/languages';

/**
 * Hook che restituisce una funzione `ts(t, args?)` per ottenere una stringa
 * tradotta come valore primitivo — utile per prop DOM che non accettano JSX,
 * come `placeholder`, `aria-label`, `title` su elementi nativi, ecc.
 *
 * Accetta gli stessi formati di <Translate>:
 *   ts('_%_testo_%_')
 *   ts('_%_ciao %s_%_', 'Mario')
 *   ts('_%_hai %s messaggi_%_', [3])
 *
 * Nota: la stringa viene marcata con _%_..._%_ in sorgente così vitetranslate
 * la rileva e la compila nella tabella di traduzione (stesso meccanismo di <Translate>).
 *
 * Un `%s` rimasto senza valore diventa `[?]`, come in <Translate>.
 *
 * @returns {(t: string, a?: any|any[]) => string}
 */
export function useTranslateToString() {
  const lang = useContext(TranslateContext);

  // Identità stabile finché la lingua non cambia, come per l'oggetto di useTranslateLanguage:
  // `ts` finisce nelle liste di dipendenze del codice utente (un useEffect che calcola un
  // titolo, un useMemo che costruisce delle option), e una funzione nuova a ogni render li
  // farebbe ripartire tutti a ciclo. `lang` è già memoizzato da TranslateProvider.
  return useCallback(function ts(t, a) {
    if (!t) return '';

    // Formato post-vitetranslate: "_<_chiave_/_fallback_>_" (dev) o "_<_chiave_>_" (build).
    // resolveEntryText applica già l'interpolazione (la voce compilata è una funzione che
    // riceve gli argomenti), quindi qui si esce subito.
    if (typeof t === 'string' && t.startsWith('_<_') && t.endsWith('_>_')) {
      return resolveEntryText(lang?.table, fallbackTable, markerKey(t), a, t);
    }

    // Formato pre-build "_%_testo_%_" (non ancora compilato da babel, es. stringa costruita a
    // runtime): nessun id è mai stato generato per questo testo, quindi non esiste una chiave
    // da cercare in lang.table e si mostra il testo dentro i delimitatori. Una stringa
    // qualunque passa invece così com'è — stripSourceMarker le distingue.
    const text = stripSourceMarker(typeof t === 'string' ? t : String(t));

    // Interpolazione %s, condivisa con <Translate>: stesse regole sugli argomenti
    // mancanti, che diventano `[?]` invece di lasciare visibile il segnaposto.
    return interpolate(text, a);
  }, [lang]);
}
