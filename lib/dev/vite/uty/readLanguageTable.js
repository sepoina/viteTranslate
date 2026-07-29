// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 6.

import vm from "vm";

/**
 * Legge la tabella da un modulo di lingua **senza** passare da `import()`.
 *
 * Il motivo è una perdita di memoria misurabile, non un'ottimizzazione teorica: la cache dei
 * moduli ESM di Node non viene mai rilasciata per la vita del processo e non ha API di
 * sfratto, quindi ogni URL distinto resta in memoria per sempre. `importLanguageModule` usa
 * l'mtime come query di cache-busting — necessario, altrimenti il dev server servirebbe
 * contenuto stantio — e questo evita la crescita a *riletture di file non modificati*, ma non
 * a quelle vere: ogni salvataggio del traduttore lascia dietro di sé un modulo in più.
 * Misurato su un file da 8,6 kB: 24 kB trattenuti per salvataggio, 7 MB dopo 300 salvataggi.
 *
 * I file che generiamo sono una tabella piatta — commenti di intestazione e
 * `export default { "chiave": <valore JSON>, ... };` — quindi non serve un module loader per
 * leggerli. Non è nemmeno JSON: il serializzatore lascia una virgola finale e un separatore a
 * commento dentro l'oggetto, che `JSON.parse` rifiuta ma che come literal JS sono legali.
 *
 * La valutazione avviene in un contesto senza alcun globale: un file che provi a toccare
 * qualcosa fallisce e ricade sul caricamento vero (vedi importLanguageModule.js), che resta
 * la strada per i moduli di lingua non generati da noi.
 *
 * @param {string} code - sorgente del modulo
 * @param {string} filePath - solo per i messaggi di errore dello stack
 * @returns {object | undefined} la tabella, o undefined se il file non ha la forma piatta
 */
export default function readLanguageTable(code, filePath) {
  const marker = /(?:^|[\n\r;])[ \t]*export[ \t]+default[ \t]+/;
  const at = code.search(marker);
  if (at === -1) return undefined;

  // Import, export nominali o require prima della tabella: non è la forma piatta che
  // generiamo, e valutarla fuori da un module loader darebbe un risultato sbagliato invece
  // di un errore. Meglio lasciarla a chi sa caricarla davvero.
  const head = code.slice(0, at);
  if (/(?:^|[\n\r;])[ \t]*(?:import|export)\b/.test(head) || head.includes("require(")) return undefined;

  const body = code.slice(at).replace(marker, "return ");

  try {
    const table = vm.runInNewContext(`(function(){${body}\n})()`, Object.create(null), {
      filename: filePath,
      timeout: 2000,
    });
    return table !== null && typeof table === "object" && !Array.isArray(table) ? table : undefined;
  } catch {
    return undefined;
  }
}

/**
 * "incomplete: false" viene omesso dal file su disco (vedi serializeLanguageModule.js): qui
 * si ripristina il valore di default, così ogni chiamante vede sempre il campo valorizzato a
 * booleano, sia che il file lo dichiari esplicitamente sia che lo ometta.
 */
export function normalizeBuilder(table) {
  if (table?.__builder__ && table.__builder__.incomplete === undefined) {
    table.__builder__.incomplete = false;
  }
  return table;
}
