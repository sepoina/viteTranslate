// Architettura d'insieme: doc/structure.md § "Fase 3 — The virtual module and code splitting",
// "The plugin's own package: finding it without counting directories".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import pathCmd from "path";
import { fileURLToPath } from "url";

const NOME = "@sepoina/vitetranslate";

let cache;

/**
 * La cartella in cui questo pacchetto vive DAVVERO, trovata risalendo da `import.meta.url` fino
 * al primo `package.json` che si chiama `@sepoina/vitetranslate`.
 *
 * Non si contano i livelli a mano. La profondità cambia fra sorgente e bundle pubblicato
 * (`lib/dev/vite/uty/…` sale di quattro, `lib/dist/vitetranslate.es.js` di due), quindi un
 * conteggio fisso è giusto per una delle due forme e sbagliato per l'altra — e sbagliato in
 * silenzio: sale oltre la radice del pacchetto e legge il `package.json` di qualcun altro,
 * quello di `node_modules/` che non esiste o, in un'installazione piatta, quello dell'app che
 * sta usando la libreria. Risalire per nome è corretto in entrambe le forme e non dipende da
 * dove punti un eventuale symlink (`file:..`, `npm link`): il primo `package.json` con QUESTO
 * nome che si incontra salendo è la radice del pacchetto, ovunque stia girando il codice.
 *
 * @returns {string | null} percorso assoluto, o `null` se non si trova (installazione atipica)
 */
export default function ownPackageDir() {
  if (cache !== undefined) return cache;
  let dir = pathCmd.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pathCmd.join(dir, "package.json"), "utf8"));
      if (pkg.name === NOME) { cache = dir; return cache; }
    } catch {
      // Nessun package.json qui, o illeggibile: si continua a risalire.
    }
    const parent = pathCmd.dirname(dir);
    if (parent === dir) { cache = null; return cache; } // radice del filesystem
    dir = parent;
  }
}

/**
 * Il `package.json` del pacchetto, già letto. `null` se non si trova o non si legge: non sapere
 * la propria versione non è un motivo per non partire.
 *
 * @returns {object | null}
 */
export function ownPackageJson() {
  const dir = ownPackageDir();
  if (!dir) return null;
  try {
    return JSON.parse(fs.readFileSync(pathCmd.join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}
