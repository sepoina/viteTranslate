// Architettura d'insieme: doc/structure.md § "2d. La macro: JSX e template in messaggio".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Un valore scritto come figlio JSX, reso come lo renderebbe React: `null`, `undefined`, `true` e
 * `false` non rendono niente. La macro (lib/dev/babel/macroForms.js) avvolge in questa funzione
 * ogni espressione JSX che sposta negli argomenti. Senza, `{vip && <b>VIP</b>}` con `false`
 * diventerebbe "false" (la ricomposizione `_cat` concatena) e `{nick}` a `null` diventerebbe `⁇`:
 * due differenze dal JSX di partenza, misurate durante il piano 4.6.4.
 *
 * @param {any} v
 * @returns {any} `""` per ciò che React non rende, altrimenti `v` così com'è
 */
export const jsxArg = (v) => (v == null || typeof v === "boolean" ? "" : v);
