// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

// Interpolazione dei segnaposto `%s` sulle stringhe che non passano dalla tabella compilata:
// il testo non marcato in <Translate>, il fallback incorporato nel marcatore, e i formati
// grezzi accettati da useTranslateToString. Le voci di tabella non passano di qui — hanno i
// segnaposto già compilati come buchi in una template literal o come figli JSX.
//
// Era duplicata fra <Translate> e useTranslateToString, e le due copie divergevano proprio
// sui casi limite degli argomenti mancanti.

// Segnaposto rimasto senza valore: `diag.absentDataInArray`, cioè l'opzione
// `errorSolve.mark.absentDataInArray` del plugin — stesso nome da una parte e dall'altra.
// Mostrare il `%s` grezzo espone all'utente finale la sintassi interna della tabella di
// traduzione; il default `⁇` è un glifo solo, si vede a colpo d'occhio in mezzo al testo e non
// somiglia a niente che qualcuno possa aver scritto sul serio.
//
// La configurazione arriva come parametro e non come import: questo modulo è sulla strada di
// `basicHtmlToNodes`, che è API pubblica e non deve tirarsi dietro il modulo virtuale, e di
// `resolveEntry`, che i test caricano direttamente da Node. Chi la conosce la passa; chi non
// la conosce ottiene i default, che sono il comportamento di sempre.
import { DEFAULT_DIAGNOSTICS } from "../errorSolve.js";
import { PLACEHOLDER, PLACEHOLDER_RE } from "../markerSyntax.js";
import { argAt } from "../namedArgs.js";

/**
 * Sostituisce i `%s` di `text` con i valori di `args`, in ordine.
 *
 * Un segnaposto senza valore corrispondente diventa `diag.absentDataInArray` (`⁇` di default): succede quando non è stato passato
 * alcun argomento, quando ne sono stati passati meno dei segnaposto presenti, quando il valore
 * in quella posizione è `null`/`undefined`, o quando è un oggetto semplice (il contenitore degli
 * argomenti con nome, mai un valore da mostrare — vedi lib/namedArgs.js). La stringa vuota e lo
 * zero sono invece valori a tutti gli effetti e vengono interpolati normalmente.
 *
 * @param {string} text - testo, eventualmente con segnaposto `%s`
 * @param {any|any[]} [args] - valore singolo, lista di valori in ordine, o oggetto degli argomenti con nome
 * @param {{absentDataInArray: string}} [diag] - configurazione diagnostica risolta (vedi lib/errorSolve.js)
 * @returns {string}
 */
export function interpolate(text, args, diag = DEFAULT_DIAGNOSTICS) {
  // `includes` è un substring search, molto più economico di una regex con callback: la
  // stragrande maggioranza dei testi che arrivano qui non ha segnaposto, e con questa
  // guardia non pagano altro che una scansione.
  if (!text.includes(PLACEHOLDER)) return text;

  const missing = diag.absentDataInArray;
  let i = 0;
  // Condividere una regex /g fra chiamate è sicuro solo con `replace`: azzera `lastIndex`
  // prima di cominciare e non lascia stato dietro di sé. `.test()`/`.exec()` invece porterebbero
  // stato da una chiamata all'altra.
  return text.replace(PLACEHOLDER_RE, () => {
    const value = argAt(args, i++);
    return value === undefined ? missing : String(value);
  });
}
