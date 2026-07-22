import { useContext } from 'react';
import { TranslateContext } from './TranslateContext';
import { parseCompiledMarker } from './parseCompiledMarker';

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
 * @returns {(t: string, a?: any|any[]) => string}
 */
export function useTranslateString() {
  const lang = useContext(TranslateContext);

  return function ts(t, a) {
    if (!t) return '';

    let text;

    // Formato post-vitetranslate: "_<_chiave_/_fallback_>_" (dev) o "_<_chiave_>_" (build)
    if (typeof t === 'string' && t.startsWith('_<_') && t.endsWith('_>_')) {
      const { key, fallback } = parseCompiledMarker(t);
      text = lang?.table?.[key] ?? fallback ?? key;
    }
    // Formato pre-build: "_%_testo_%_" (non ancora compilato da babel, es. stringa
    // costruita a runtime) — nessun id è mai stato generato per questo testo, quindi
    // non esiste una chiave valida da cercare in lang.table: si estrae solo il fallback.
    else if (typeof t === 'string' && t.startsWith('_%_') && t.endsWith('_%_')) {
      text = t.slice(3, -3);
    }
    // Stringa semplice passthrough
    else {
      text = String(t);
    }

    // Interpolazione %s
    if (a !== undefined) {
      const args = Array.isArray(a) ? a : [a];
      let i = 0;
      text = text.replace(/%s/g, () => String(args[i++] ?? ''));
    }

    return text;
  };
}
