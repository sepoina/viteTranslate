import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_NAME = "@sepoina/vitetranslate";

/**
 * Plugin solo per lo sviluppo di questo playground — non riguarda vite-translate.
 * Decide se "@sepoina/vitetranslate" / ".../react" si risolvono al
 * sorgente locale della libreria (../lib) o alla versione installata in
 * node_modules, come farebbe un consumer reale.
 *
 * @param {{ useLocalLibrary?: boolean }} [options]
 *   useLocalLibrary=true  -> alias verso ../lib (richiede solo che esista)
 *   useLocalLibrary=false -> nessun alias, risoluzione normale da node_modules
 *                            (serve che PKG_NAME sia una dependency reale in playground/package.json)
 */
export default function pluginOnlyForPlayground({ useLocalLibrary = true } = {}) {
  return {
    name: "playground-local-lib-alias",
    config() {
      if (!useLocalLibrary) return {};
      return {
        resolve: {
          alias: [
            { find: `${PKG_NAME}/react`, replacement: path.resolve(__dirname, "../lib/react/index.js") },
            { find: PKG_NAME, replacement: path.resolve(__dirname, "../lib/index.js") },
          ],
        },
      };
    },
  };
}
