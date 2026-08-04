// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import React from "react";

/**
 * Attacca un prefisso diagnostico davanti a ciò che si sta per rendere.
 *
 * Il caso normale è il prefisso spento (`""`): è quello di ogni build di produzione con le
 * opzioni di default, e deve costare quanto non chiamarla — stesso valore di ritorno, stessa
 * identità, nessuna allocazione. È ciò che permette a React di continuare a saltare la
 * riconciliazione dei sottoalberi costruiti una volta sola nella tabella compilata.
 *
 * Una voce di tabella può risolversi in una stringa o in un elemento: nel primo caso i due
 * pezzi si concatenano, nel secondo diventano due figli di un frammento. Non si passa sempre
 * dal frammento perché la stringa è la forma che `ts()` si aspetta e quella che React rende
 * senza costruire nulla.
 *
 * @param {string} char - il carattere, `""` per non fare niente
 * @param {React.ReactNode} node
 * @returns {React.ReactNode}
 */
export function withPrefix(char, node) {
  if (char === "") return node;
  if (typeof node === "string") return char + node;
  if (typeof node === "number") return char + String(node);
  return React.createElement(React.Fragment, null, char, node);
}

/**
 * Come `withPrefix`, ma su un valore che è già testo: serve a `ts()`, che deve restituire una
 * stringa primitiva perché finisce in prop del DOM come `placeholder` o `aria-label`.
 *
 * @param {string} char
 * @param {string} text
 * @returns {string}
 */
export function withPrefixText(char, text) {
  return char === "" ? text : char + text;
}
