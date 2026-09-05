// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync",
// "Fast verify: the two-stage check".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import path from "path";

export const EXT_RE = /\.[jt]sx?$/;
export const EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

/**
 * Cammina `srcRoot` raccogliendo ogni file sorgente con il suo `stat`, per poterlo confrontare
 * più avanti con un record precedente senza aprirlo (vedi fastVerify.js).
 *
 * Gli mtime vanno presi PRIMA di leggere i contenuti: un file modificato durante la scansione
 * verrebbe altrimenti registrato col timestamp nuovo pur essendo stato letto vecchio, e la
 * verifica successiva lo benedirebbe per errore.
 *
 * @param {string} srcRoot - la cartella dei sorgenti, già risolta
 * @param {string} excludeDir - localeDir risolta: le tabelle generate non sono sorgente da
 *   scansionare per il marcatore "_%_"
 * @param {string} baseDir - radice da cui relativizzare `rel`, sempre con "/" — la stessa forma
 *   che finisce negli id delle chiavi (vedi relPathOf in markerCore.js)
 * @param {Array} [results] - accumulatore per la ricorsione
 * @returns {Array<{ path: string, rel: string, mtimeMs: number, size: number }>}
 */
export default function walkSource(srcRoot, excludeDir, baseDir, results = []) {
  for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(srcRoot, entry.name);
    if (entry.isDirectory()) {
      // localeDir contiene i file lingua generati: non sono codice sorgente da scansionare
      // per il marcatore "_%_". Dalla 4.0 non sono più .js e EXT_RE li scarterebbe comunque:
      // questo copre i residui di un progetto non ancora migrato, le cui stringhe tradotte
      // potrebbero contenere "_%_" per coincidenza.
      if (full === excludeDir) continue;
      walkSource(full, excludeDir, baseDir, results);
      continue;
    }
    if (!EXT_RE.test(entry.name)) continue;
    // Un file che sparisce fra il readdir e lo stat (build concorrente, editor) viene saltato,
    // non fa fallire il giro.
    const stat = fs.statSync(full, { throwIfNoEntry: false });
    if (!stat) continue;
    results.push({
      path: full,
      rel: path.relative(baseDir, full).replace(/\\/g, "/"),
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    });
  }
  return results;
}
