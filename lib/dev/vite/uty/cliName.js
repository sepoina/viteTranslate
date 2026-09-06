// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Il nome con cui il comando si presenta. Dalla 4.1 il bin è `vtranslate-cli`: si scrive dopo
 * un `npx` decine di volte al giorno, e il nome vecchio —
 * `vitetranslate-prepare-translation-table` — descriveva bene quello che fa e malissimo quanto
 * costa digitarlo. Resta registrato come alias in package.json, così un `prebuild` già scritto
 * non si rompe; nei messaggi però ne compare uno solo, perché un comando che si autonomina in
 * due modi diversi è peggio di uno che ne sceglie uno.
 *
 * File suo, invece di stare dentro cli.js, per la stessa ragione di builderVersion.js e
 * configFiles.js: lo devono leggere anche languageStatus.js e vitetranslate.js, e importarlo
 * da cli.js — che a sua volta importa languageStatus.js — chiuderebbe un ciclo.
 */
export const CLI_NAME = "vtranslate-cli";
