// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { ownPackageJson } from "./ownPackage.js";

let cache;

/**
 * La versione del pacchetto, nella forma già pronta per l'intestazione ("v4.0.2").
 *
 * Letta dal package.json invece che scritta in una costante: una costante è una seconda
 * copia del numero di versione, e `npm version patch` ne aggiorna una sola — quella
 * sbagliata resterebbe a schermo per sempre, dicendo il falso proprio a chi guarda la
 * versione perché qualcosa non torna. Il file lo trova `ownPackage.js` risalendo per nome, non
 * contando le cartelle: `package.json` è sempre spedito da npm, anche con "files": ["lib"].
 *
 * Se il file non si legge (installazione atipica, permessi) il risultato è la stringa vuota:
 * l'intestazione la omette e basta. Non sapere la versione non è un motivo per non partire.
 *
 * @returns {string}
 */
export default function packageVersion() {
  if (cache !== undefined) return cache;
  const versione = ownPackageJson()?.version;
  cache = versione ? `v${versione}` : "";
  return cache;
}
