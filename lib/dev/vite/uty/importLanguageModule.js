// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 6.

import fs from "fs";
import { pathToFileURL } from "url";
import readLanguageTable, { normalizeBuilder } from "./readLanguageTable.js";
import { hash } from "../../babel/markerCore.js";

/**
 * Legge il modulo JS di un file lingua e ne restituisce il default export.
 *
 * Strada preferita: valutare la tabella dal sorgente (readLanguageTable.js), che è quella
 * che i nostri file generati permettono sempre e che non lascia nulla dietro di sé.
 *
 * Ripiego per un modulo di lingua non generato da noi (import in testa, valori calcolati):
 * `import()` vero e proprio, con query di cache-busting. Senza la query la cache dei moduli
 * ESM di Node restituirebbe contenuto stantio se lo stesso path viene re-importato nello
 * stesso processo — il dev server di Vite che rivalida un file lingua modificato a mano,
 * senza mai riavviare Node. Resta il fatto che quella cache non viene mai rilasciata, ed è la
 * ragione per cui questa è la seconda scelta e non la prima.
 *
 * La query è un hash del CONTENUTO, non l'mtime. L'mtime aveva la proprietà giusta — non
 * creare una entry nuova a ogni lettura di un file immutato — ma la sbagliava proprio quando
 * conta: la granularità del timestamp del filesystem è grossolana (3 ms su ext4 con HZ=300,
 * 1-2 s su exFAT/FAT), e due contenuti diversi scritti dentro lo stesso tick condividono la
 * chiave di cache. Node restituisce allora la versione PRECEDENTE, in silenzio: il file
 * appena modificato a mano viene riscritto da com'era prima, e un file appena rotto risulta
 * leggibile — quindi nessun backup `.bak-corrupted-*`, che è la rete che dovrebbe scattare lì.
 * Il contenuto, a differenza dell'orologio, distingue sempre due versioni diverse e coincide
 * sempre con se stesso.
 *
 * @param {string} filePath
 * @returns {Promise<any>} il default export (l'oggetto lingua), o undefined se il file è vuoto
 */
export default async function importLanguageModule(filePath) {
  const code = fs.readFileSync(filePath, "utf8");

  // File creato vuoto a mano: è il modo documentato per aggiungere una lingua, e chi chiama lo
  // riconosce dal fatto che non c'è tabella. Va deciso qui, sul contenuto, perché `import()`
  // risponde in due modi diversi a seconda del progetto che ci ospita: in un progetto ESM
  // ("type": "module") un file vuoto dà `default: undefined`, in un progetto CommonJS dà
  // `module.exports`, cioè `{}` — un oggetto verissimo, che passava per una lingua valida e
  // vuota. Il file restava vuoto sul disco e il traduttore non vedeva mai le chiavi da tradurre.
  if (code.trim() === "") return undefined;

  const table = readLanguageTable(code, filePath);
  if (table !== undefined) return normalizeBuilder(table);

  const url = `${pathToFileURL(filePath).href}?t=${hash(code).toString(36)}`;
  const mod = await import(url);
  return normalizeBuilder(mod.default);
}
