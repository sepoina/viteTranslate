// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Il nome con cui il comando si presenta. Il bin registrato in `package.json` resta
 * `vtranslate-cli` (e l'alias storico `vitetranslate-prepare-translation-table`, per non
 * rompere un `prebuild` già scritto), ma nei messaggi compare `vitetranslate`: è il nome del
 * launcher separato (`npm i -g vitetranslate`, o `npx vitetranslate` senza installarlo per
 * forza), che funziona ovunque — globale o locale — mentre `npx vtranslate-cli` da solo
 * funziona solo se questo pacchetto è già una dipendenza del progetto. Un comando che si
 * autonomina in due modi diversi è peggio di uno che ne sceglie uno, quindi qui ne compare uno
 * solo ovunque un messaggio suggerisca cosa digitare.
 *
 * File suo, invece di stare dentro cli.js, per la stessa ragione di builderVersion.js e
 * configFiles.js: lo devono leggere anche languageStatus.js e vitetranslate.js, e importarlo
 * da cli.js — che a sua volta importa languageStatus.js — chiuderebbe un ciclo.
 */
export const CLI_NAME = "vitetranslate";
