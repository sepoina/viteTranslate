// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

// Versione dello schema dei file di lingua generati (non del pacchetto): va bumpata a mano
// quando cambia la forma delle tabelle (struttura di "__builder__" o formato delle chiavi),
// non ad ogni sync.
//
// File suo, invece di stare dentro cli.js come prima: fastVerify.js deve confrontare il
// "builder" salvato nel record con quello corrente, e importarlo da cli.js — che a sua volta
// importa fastVerify.js — chiuderebbe un ciclo.
export const BUILDER_VERSION = 260824;
