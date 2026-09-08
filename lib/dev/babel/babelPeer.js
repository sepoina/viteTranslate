// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "2a. Estrazione: parse e splice".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Tutto ciò che l'utente legge quando `@babel/core` non si carica, in un posto solo. Prima
// era in quattro copie in quattro file (extractMarkers.js, loadConfig.js, autoSync.js,
// vitetranslate.js), e la copia che diverge è esattamente quella che qualcuno legge.
//
// Non importa niente di suo, e non è un caso: loadConfig.js carica extractMarkers.js solo al
// momento dell'uso, e prendere una stringa da qui non deve diventare il motivo per cui quel
// modulo — e con lui @babel/core — viene tirato dentro prima del dovuto.

export const BABEL_PACKAGE = "@babel/core";
export const BABEL_INSTALL_COMMAND = `npm i -D ${BABEL_PACKAGE}`;
export const BABEL_7_INSTALL_COMMAND = `npm i -D ${BABEL_PACKAGE}@^7`;

// I due guasti possibili, ciascuno con la sua cura. Il testo è diviso in tre pezzi perché ha
// due forme d'uso: una riga sola (il throw di buildStart, l'avviso di auto-sync, il report del
// transform) e il blocco del dev server, che stampa il comando nella colonna dei comandi. Il
// comando compare una volta sola in entrambe.
export const BABEL_MISSING = {
  message: `scanning the source needs "${BABEL_PACKAGE}", which is not installed.`,
  cura: "It is a peer dependency of this plugin",
  comando: BABEL_INSTALL_COMMAND,
};

// Babel 8 è ESM, e `require()` di un modulo ESM è sincrono solo da Node 22.12 (e 20.19) in
// poi: sotto quelle versioni lancia. Babel 8 dichiara `engines` più stretto ancora
// (^22.18 || >=24.11), ma npm su `engines` avvisa e installa lo stesso, quindi la coppia
// "Node vecchio + Babel 8" si forma davvero. La via d'uscita è doppia, e nessuna delle due è
// ovvia leggendo un ERR_REQUIRE_ESM.
export const BABEL_NODE_TOO_OLD = {
  message: `scanning the source needs "${BABEL_PACKAGE}", and the installed one is Babel 8, which this Node (${process.version}) cannot load.`,
  cura: "Use Node ^22.18 || >=24.11, or stay on Babel 7",
  comando: BABEL_7_INSTALL_COMMAND,
};

/**
 * Il guasto in una riga sola, cura e comando compresi.
 *
 * @param {{ message: string, cura: string, comando: string }} guasto
 * @returns {string}
 */
export const babelUnaRiga = (guasto) => `${guasto.message} ${guasto.cura}: \`${guasto.comando}\`.`;

/**
 * La cura come consiglio su un pacchetto qualunque, con il perché attaccato.
 *
 * Serve nel ramo generico "pacchetto mancante" di loadConfig.js, che nomina il pacchetto che
 * ha trovato nel messaggio di Node: lì il lettore non sa a cosa serva Babel, e "peer
 * dependency" da solo non glielo dice. Dopo `BABEL_MISSING.message`, invece, ripeterlo
 * sarebbe la stessa informazione due volte nella stessa riga.
 */
export const babelConsiglio = () =>
  `${BABEL_MISSING.cura}, needed to scan your source for markers: \`${BABEL_INSTALL_COMMAND}\``;
