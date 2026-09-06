// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { useCallback, useContext } from 'react';
import { TranslateContext } from './TranslateContext.js';
import { markerKey, stripSourceMarker } from './parseCompiledMarker.js';
import { isCompiledMarker } from '../markerSyntax.js';
import { interpolate } from './interpolate.js';
import { resolveEntryText } from './resolveEntry.js';
import { readSource, EMPTY, ELEMENT, NOT_TEXT } from './readSource.js';
import { withPrefixText } from './withPrefix.js';
import { resolveDiagnostics, reportOnce, describeValue } from '../errorSolve.js';
// Fallback universale sempre disponibile (vedi Translate.js).
import { fallbackTable } from 'virtual:vitetranslate/languages';
// Namespace per gli export recenti: vedi la nota in Translate.js.
import * as manifest from 'virtual:vitetranslate/languages';

const diag = resolveDiagnostics(manifest);

// Frammento per la chiave di `reportOnce`, non per il messaggio mostrato (quello resta
// `describeValue`). Serve solo a distinguere funzione/elemento/tupla-vuota/tupla-con-solo-null
// fra loro: `reportOnce` deduplica su un registro globale al processo (vedi errorSolve.js), e
// senza questo dettaglio solo il primo di questi casi loggherebbe mai qualcosa nella sessione.
// Non condivide `badDataKind` di Translate.js apposta — vedi Decisione 2 del piano 4.1.0, le
// vie di salvataggio non si condividono — e qui basta distinguere le chiavi, non nominare il
// valore per l'utente come fa `badDataKind`.
function badValueKind(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'empty';
    const first = value[0];
    return first === null ? 'null' : typeof first;
  }
  return typeof value;
}

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
 * Un `%s` rimasto senza valore diventa `errorSolve.mark.absentDataInArray` (`⁇` di default),
 * come in <Translate>.
 *
 * Il terzo parametro è opzionale e porta le stesse dichiarazioni che in <Translate> sono prop:
 * `{ skipMark: true }` dice che qui una stringa non marcata è legittima.
 *
 * @returns {(t: string|any[]|{t: string, a?: any}, a?: any|any[], options?: {skipMark?: boolean}) => string}
 */
export function useTranslateToString() {
  const lang = useContext(TranslateContext);

  // Identità stabile finché la lingua non cambia, come per l'oggetto di useTranslateLanguage:
  // `ts` finisce nelle liste di dipendenze del codice utente (un useEffect che calcola un
  // titolo, un useMemo che costruisce delle option), e una funzione nuova a ogni render li
  // farebbe ripartire tutti a ciclo. `lang` è già memoizzato da TranslateProvider.
  return useCallback(function ts(t, a, options) {
    const v = readSource(t);

    if (v.kind === EMPTY) return '';

    // Un elemento React qui è un errore legittimo, al contrario che in <Translate>: ts() deve
    // restituire una stringa primitiva, e un nodo montato a stringa non si riduce.
    if (v.kind === ELEMENT) {
      reportOnce(diag, 'useTranslateToString: a React element cannot be reduced to a string, renders empty. Use <Translate> instead.');
      return '';
    }

    // Il ramo che mancava. Senza, `String(text)` scriveva "[object Object]" o il sorgente di
    // una funzione dentro un aria-label, e in produzione — dove `‼️` è spento — ci finiva nudo.
    // Rendere vuoto è la stessa scelta che <Translate> fa in produzione per gli stessi valori.
    if (v.kind === NOT_TEXT) {
      const noField = v.why === 'noField';
      reportOnce(
        diag,
        noField
          ? 'useTranslateToString: object without a "t" field'
          : `useTranslateToString: "t" is not a supported form (${badValueKind(v.source)})`,
        () => noField
          ? `useTranslateToString: object without a "t" field is not a { t, a } form and renders empty: ${describeValue(v.source)}`
          : `useTranslateToString: "t" must be a string, a number, a tuple or a { t, a } object, got ${describeValue(v.source)}`,
      );
      return '';
    }

    if (v.domain) return v.text;

    const text = v.text;
    // La tupla vince su ciò che è stato passato a parte, ma solo se porta qualcosa: `{t, a:null}`
    // arriva qui come stringa nuda, e chi ha scritto `ts(x, arg)` intendeva proprio quell'arg.
    const args = v.embedded ?? a;

    // Formato post-vitetranslate: "_<_chiave_/_fallback_>_" (dev) o "_<_chiave_>_" (build).
    // resolveEntryText applica già l'interpolazione (la voce compilata è una funzione che
    // riceve gli argomenti), quindi qui si esce subito. Il prefisso di traduzione mancante
    // (`🔸`/`🔹`) lo mette resolveEntryText, che è l'unico a sapere com'è andata la ricerca.
    if (isCompiledMarker(text)) {
      return resolveEntryText(lang?.table, fallbackTable, markerKey(text), args, text, diag);
    }

    // Formato pre-build "_%_testo_%_" (non ancora compilato da babel, es. stringa costruita a
    // runtime): nessun id è mai stato generato per questo testo, quindi non esiste una chiave
    // da cercare in lang.table e si mostra il testo dentro i delimitatori. Una stringa
    // qualunque passa invece così com'è — stripSourceMarker le distingue.
    //
    // In entrambi i casi è testo che la traduzione non ha mai visto, e in sviluppo se lo porta
    // dietro il prefisso `‼️`, esattamente come in <Translate>: è la stessa condizione, e
    // vederla solo da una parte significherebbe non vederla dove si usa ts() — cioè proprio
    // nelle prop del DOM, dove non c'è un albero da ispezionare.
    const plain = stripSourceMarker(text);

    // Interpolazione %s, condivisa con <Translate>: stesse regole sugli argomenti
    // mancanti, che diventano `absentDataInArray` invece di lasciare visibile il segnaposto.
    const reso = interpolate(plain, args, diag);

    // `skipMark` dichiara, nel punto di chiamata, che qui il non marcato è la normalità e non
    // un marcatore dimenticato: stessa via d'uscita della prop omonima di <Translate>, e per
    // gli stessi valori — un placeholder che porta il nome di un campo configurato altrove,
    // un title che porta una descrizione arrivata dal server.
    if (options?.skipMark) return reso;

    reportOnce(diag, `useTranslateToString: text is not marked with _%_..._%_ (forgotten?): "${plain}"`);
    return withPrefixText(diag.malformed, reso);
  }, [lang]);
}
