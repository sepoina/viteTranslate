// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Riporta la forma a oggetto `{ t, a }` alle due forme che gli emitter già conoscono: la
 * stringa marcata da sola, o la tupla `[testo, ...argomenti]`.
 *
 * È la forma in cui certi core applicativi trasportano il testo insieme ai suoi argomenti
 * (stato di una linea, annunci, riepiloghi) — un oggetto solo che viaggia da un livello
 * all'altro senza doversi ricordare quale campo è il testo e quale l'argomento. Finché non
 * era riconosciuta, passarla a `<Translate>` dava "t cannot be an object" e ogni chiamante
 * doveva convertirla a mano prima di renderla.
 *
 * Qualunque altro valore torna indietro invariato: un array, una stringa, un numero, un
 * oggetto che un campo `t` non ce l'ha. La validazione vera resta a valle, dove i messaggi
 * di errore sanno già dire cosa manca.
 *
 * @param {any} value
 * @returns {any}
 *
 * @example
 * fromObjectForm({ t: "_%_ciao_%_" })                    // -> "_%_ciao_%_"
 * fromObjectForm({ t: "_%_oppure %s?_%_", a: ["19"] })   // -> ["_%_oppure %s?_%_", "19"]
 * fromObjectForm({ t: "_%_oppure %s?_%_", a: "19" })     // -> ["_%_oppure %s?_%_", "19"]
 * fromObjectForm("_%_ciao_%_")                           // -> "_%_ciao_%_" (invariato)
 */
export function fromObjectForm(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  // `hasOwn` e non la verità del campo: `{ t: "" }` è un oggetto di questa forma con il testo
  // vuoto, non un oggetto qualunque. Esclude da sé gli elementi React, che un campo `t`
  // proprio non ce l'hanno.
  if (!Object.hasOwn(value, "t")) return value;

  const { t, a } = value;
  // Nessun argomento: resta la sola forma a stringa, che è quella che costa meno a valle
  // (niente array da destrutturare a ogni render).
  if (a === undefined || a === null) return t;
  return Array.isArray(a) ? [t, ...a] : [t, a];
}
