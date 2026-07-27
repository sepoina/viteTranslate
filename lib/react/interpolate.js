// Interpolazione dei segnaposto `%s`, condivisa da <Translate> (via basicHtmlToNodes) e da
// useTranslateToString: erano due implementazioni separate, e divergevano proprio sui casi
// limite degli argomenti mancanti.

// Segnaposto rimasto senza valore. Mostrare il `%s` grezzo espone all'utente finale la
// sintassi interna della tabella di traduzione; `[?]` segue la stessa convenzione di `[...]`,
// che <Translate> usa quando un errore gli impedisce di produrre il testo.
export const MISSING_ARG = "[?]";

const NO_ARGS = [];

// Gli argomenti arrivano in tre forme: array (`t={[testo, arg]}`), scalare (`a={"aldo"}`) o
// la sentinella `false`, che è il default di prop di <Translate> quando non è stato passato
// nulla. La normalizzazione va fatta sul tipo e non sulla verità di `.length`: `0` e `""` sono
// argomenti legittimi ma non hanno un `.length` utile, e verrebbero scambiati per "assente".
function normalizeArgs(args) {
  if (args === false || args == null) return NO_ARGS;
  return Array.isArray(args) ? args : [args];
}

/**
 * Sostituisce i `%s` di `text` con i valori di `args`, in ordine.
 *
 * Un segnaposto senza valore corrispondente diventa `[?]`: succede quando non è stato passato
 * alcun argomento, quando ne sono stati passati meno dei segnaposto presenti, o quando il
 * valore in quella posizione è `null`/`undefined`. La stringa vuota e lo zero sono invece
 * valori a tutti gli effetti e vengono interpolati normalmente.
 *
 * @param {string} text - testo, eventualmente con segnaposto `%s`
 * @param {any|any[]} [args] - valore singolo o lista di valori, in ordine
 * @returns {string}
 */
export function interpolate(text, args) {
  // `includes` è un substring search, molto più economico di una regex con callback. La
  // grande maggioranza delle voci di una tabella non ha segnaposto, e con questa guardia
  // non paga altro che una scansione — trascurabile accanto alla regex che basicHtmlToNodes
  // esegue comunque subito dopo per cercare il markup.
  if (!text.includes("%s")) return text;

  const list = normalizeArgs(args);
  let i = 0;
  return text.replace(/%s/g, () => {
    const value = list[i++];
    return value === undefined || value === null ? MISSING_ARG : String(value);
  });
}
