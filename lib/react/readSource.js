// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { isValidElement } from "react";
import { fromObjectForm } from "./normalizeSource.js";

// La catena di normalizzazione che <Translate> e ts() attraversano prima di poter risolvere
// qualsiasi cosa. Era scritta due volte, e le due copie sono divergute: dove il componente
// manda a `salvage`, l'hook faceva `String(valore)` e scriveva "[object Object]" dentro un
// aria-label. È lo stesso motivo per cui esiste `interpolate.js`, che era già divergente sugli
// argomenti mancanti — qui la cura si estende al resto della catena.
//
// Questo modulo NON decide cosa fare di un esito: <Translate> rende un nodo e ha una via di
// salvataggio che nomina il valore trovato, ts() deve restituire una stringa primitiva e per
// lei un elemento React è un errore. Quelle due cose restano nei rispettivi file.

export const TEXT = "text";
export const EMPTY = "empty";
export const ELEMENT = "element";
export const NOT_TEXT = "notText";

/**
 * Riduce un valore nella posizione del testo a uno dei quattro esiti.
 *
 * @param {any} value - il valore già scelto fra le prop; la scelta la fa il chiamante
 * @returns {{kind: string, text?: string, tuple?: boolean, embedded?: any[], domain?: boolean,
 *            node?: any, why?: string, source?: any}}
 */
export function readSource(value) {
  const source = fromObjectForm(value);

  // Confronto esplicito e non sulla falsità: `0` e `false` sono entrambi falsy, ma solo il
  // secondo è la sentinella delle prop non passate. Con `!source` un conteggio che valga zero
  // sparirebbe senza che niente lo segnali.
  if (source === false || source === null || source === undefined || source === "") {
    return { kind: EMPTY };
  }

  // Un elemento sa già renderizzarsi. Che sia lecito o no lo decide il chiamante.
  if (isValidElement(source)) return { kind: ELEMENT, node: source };

  // Un oggetto senza campo `t` non è la forma `{ t, a }` e non contiene testo: è "niente",
  // come null. `hasOwn` e non la verità del campo, così `{ t: "" }` resta di questa forma.
  if (
    typeof source === "object" &&
    !Array.isArray(source) &&
    !(source instanceof String) &&
    !Object.hasOwn(source, "t")
  ) {
    return { kind: NOT_TEXT, why: "noField", source };
  }

  const tuple = Array.isArray(source);
  const raw = tuple ? source[0] : source;
  // `undefined` e non `[]` quando la tupla non porta argomenti: è la differenza su cui ts()
  // decide se usare l'argomento posizionale.
  const embedded = tuple && source.length > 1 ? source.slice(1) : undefined;

  // Un numero nella posizione del testo è dato di dominio: un conteggio, un interno, un codice.
  // Marcato non può essere — dal sorgente non ci passa — e in "42" segnaposto non ce ne sono.
  if (typeof raw === "number" || typeof raw === "bigint") {
    return { kind: TEXT, text: String(raw), tuple, embedded, domain: true };
  }
  if (typeof raw === "string" || raw instanceof String) {
    return { kind: TEXT, text: String(raw), tuple, embedded, domain: false };
  }

  // Una funzione, un simbolo, un elemento dentro la tupla: testo non ce n'è e non ce ne sarà.
  return { kind: NOT_TEXT, why: "badValue", source };
}
