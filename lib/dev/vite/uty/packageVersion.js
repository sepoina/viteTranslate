// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const QUI = path.dirname(fileURLToPath(import.meta.url));
// lib/dev/vite/uty -> la radice del pacchetto. `package.json` è sempre spedito da npm,
// anche con "files": ["lib"], quindi il percorso vale tanto in sviluppo quanto installato.
const PACKAGE_JSON = path.join(QUI, "..", "..", "..", "..", "package.json");

let cache;

/**
 * La versione del pacchetto, nella forma già pronta per l'intestazione ("v4.0.2").
 *
 * Letta dal package.json invece che scritta in una costante: una costante è una seconda
 * copia del numero di versione, e `npm version patch` ne aggiorna una sola — quella
 * sbagliata resterebbe a schermo per sempre, dicendo il falso proprio a chi guarda la
 * versione perché qualcosa non torna.
 *
 * Se il file non si legge (installazione atipica, permessi) il risultato è la stringa vuota:
 * l'intestazione la omette e basta. Non sapere la versione non è un motivo per non partire.
 *
 * @returns {string}
 */
export default function packageVersion() {
  if (cache !== undefined) return cache;
  try {
    cache = `v${JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")).version}`;
  } catch {
    cache = "";
  }
  return cache;
}
