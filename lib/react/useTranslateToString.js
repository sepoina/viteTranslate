// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { useCallback, useContext } from 'react';
import { TranslateContext } from './TranslateContext.js';
import { markerKey, stripSourceMarker } from './parseCompiledMarker.js';
import { interpolate } from './interpolate.js';
import { resolveEntryText } from './resolveEntry.js';
import { fromObjectForm } from './normalizeSource.js';
import { withPrefixText } from './withPrefix.js';
import { resolveDiagnostics, reportOnce } from '../errorSolve.js';
// Fallback universale sempre disponibile (vedi Translate.js).
import { fallbackTable } from 'virtual:vitetranslate/languages';
// Namespace per gli export recenti: vedi la nota in Translate.js.
import * as manifest from 'virtual:vitetranslate/languages';

const diag = resolveDiagnostics(manifest);

/**
 * Hook che restituisce una funzione `ts(t, args?)` per ottenere una stringa
 * tradotta come valore primitivo — utile per prop DOM che non accettano JSX,
 * come `placeholder`, `aria-label`, `title` su elementi nativi, ecc.
 *
 * Accetta gli stessi formati di <Translate>:
 *   ts('_%_testo_%_')
 *   ts('_%_ciao %s_%_', 'Mario')
 *   ts('_%_hai %s messaggi_%_', [3])
 *   ts(['_%_ciao %s_%_', 'Mario'])                 // forma a tupla
 *   ts({ t: '_%_ciao %s_%_', a: ['Mario'] })       // forma a oggetto
 *
 * Nota: la stringa viene marcata con _%_..._%_ in sorgente così vitetranslate
 * la rileva e la compila nella tabella di traduzione (stesso meccanismo di <Translate>).
 *
 * Un `%s` rimasto senza valore diventa `errorSolve.noArrayChar` (`[?]` di default),
 * come in <Translate>.
 *
 * @returns {(t: string|any[]|{t: string, a?: any}, a?: any|any[]) => string}
 */
export function useTranslateToString() {
  const lang = useContext(TranslateContext);

  // Identità stabile finché la lingua non cambia, come per l'oggetto di useTranslateLanguage:
  // `ts` finisce nelle liste di dipendenze del codice utente (un useEffect che calcola un
  // titolo, un useMemo che costruisce delle option), e una funzione nuova a ogni render li
  // farebbe ripartire tutti a ciclo. `lang` è già memoizzato da TranslateProvider.
  return useCallback(function ts(t, a) {
    // La forma a oggetto `{ t, a }` diventa una stringa o una tupla, cioè qualcosa che le
    // due righe qui sotto sanno già leggere. Stessa normalizzazione di <Translate>.
    const source = fromObjectForm(t);
    if (!source) return '';

    // Tupla `[testo, ...argomenti]`: gli argomenti che porta dentro vincono su quelli passati
    // a parte, ma se non ne porta si usano comunque quelli — `{ t, a: null }` arriva qui come
    // stringa nuda, e chi ha scritto `ts(x, arg)` intendeva proprio quell'arg.
    let text = source;
    let args = a;
    if (Array.isArray(source)) {
      text = source[0];
      if (source.length > 1) args = source.slice(1);
    }

    // Formato post-vitetranslate: "_<_chiave_/_fallback_>_" (dev) o "_<_chiave_>_" (build).
    // resolveEntryText applica già l'interpolazione (la voce compilata è una funzione che
    // riceve gli argomenti), quindi qui si esce subito. Il prefisso di traduzione mancante
    // (`⁑`/`∴`) lo mette resolveEntryText, che è l'unico a sapere com'è andata la ricerca.
    if (typeof text === 'string' && text.startsWith('_<_') && text.endsWith('_>_')) {
      return resolveEntryText(lang?.table, fallbackTable, markerKey(text), args, text, diag);
    }

    // Formato pre-build "_%_testo_%_" (non ancora compilato da babel, es. stringa costruita a
    // runtime): nessun id è mai stato generato per questo testo, quindi non esiste una chiave
    // da cercare in lang.table e si mostra il testo dentro i delimitatori. Una stringa
    // qualunque passa invece così com'è — stripSourceMarker le distingue.
    //
    // In entrambi i casi è testo che la traduzione non ha mai visto, e in sviluppo se lo porta
    // dietro il prefisso `⁂`, esattamente come in <Translate>: è la stessa condizione, e
    // vederla solo da una parte significherebbe non vederla dove si usa ts() — cioè proprio
    // nelle prop del DOM, dove non c'è un albero da ispezionare.
    const plain = stripSourceMarker(typeof text === 'string' ? text : String(text));
    reportOnce(diag, `useTranslateToString: text is not marked with _%_..._%_ (forgotten?): "${plain}"`);

    // Interpolazione %s, condivisa con <Translate>: stesse regole sugli argomenti
    // mancanti, che diventano `noArg` invece di lasciare visibile il segnaposto.
    return withPrefixText(diag.malformed, interpolate(plain, args, diag));
  }, [lang]);
}
