// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import path from "path";

/**
 * Il percorso come va scritto in un messaggio: relativo alla radice del progetto e con "/".
 *
 * Due ragioni, e la seconda è quella che conta. La prima è la lunghezza: un percorso assoluto
 * mangia mezza riga di log e la parte che serve — quale file — sta in fondo. La seconda è che
 * un percorso relativo alla cartella da cui il comando è stato lanciato è **cliccabile**: il
 * terminale di VS Code lo risolve contro la propria cwd e ci mette sotto il link, mentre di
 * una riga lunga il più delle volte si limita a spezzarla.
 *
 * La radice è `process.cwd()` e non la cartella del `package.json` trovata risalendo: sono la
 * stessa cosa in ogni invocazione supportata — il comando pretende `vite.config.*` nella cwd —
 * e in caso di dubbio conta la cwd, perché è quella contro cui il terminale risolve il link.
 * Relativizzare contro un'altra cartella darebbe un percorso più corto e un link rotto.
 *
 * @param {string} target - percorso assoluto (o già relativo: viene risolto lo stesso)
 * @param {string} [root]
 * @returns {string}
 */
export default function shortPath(target, root = process.cwd()) {
  const rel = path.relative(root, path.resolve(root, target)).replace(/\\/g, "/");
  // Fuori dal progetto (un localeDir dietro un "../", un file linkato): accorciarlo non lo
  // renderebbe più corto, solo ambiguo su dove sia. Meglio l'assoluto, che è comunque un link.
  if (!rel || rel.startsWith("..")) return target;
  return rel;
}
