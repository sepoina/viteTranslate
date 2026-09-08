// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import path from "path";
import { pathToFileURL } from "url";
import { CONFIG_FILES, findConfigFile } from "./configFiles.js";
import { BABEL_PACKAGE, babelConsiglio } from "../../babel/babelPeer.js";

/**
 * Cosa dire di un pacchetto che manca. `@babel/core` ha una riga sua perché è il caso che
 * capita davvero: npm e pnpm lo installano da soli, essendo una peer dependency obbligatoria,
 * ma yarn si limita a un avviso e nessuno impedisce di rimuoverlo a mano. Senza non si estrae
 * niente, e "cannot find package" da solo non dice che basta installarlo.
 */
const consiglioPacchetto = (pacchetto) => pacchetto === BABEL_PACKAGE
  ? babelConsiglio()
  : `Install it: \`npm i -D ${pacchetto}\``;

/**
 * `extractMarkers` caricato al momento dell'uso e non in cima al file: il modulo non tira più
 * dentro `@babel/core` da solo (vedi `ensureBabel` in extractMarkers.js), quindi qui si chiama
 * esplicitamente per sapere SUBITO se manca, invece di scoprirlo alla prima scansione con del
 * lavoro già in corso.
 */
export async function loadExtractMarkers() {
  const { default: extractMarkers, ensureBabel } = await import("../../babel/extractMarkers.js");
  try {
    ensureBabel();
  } catch (error) {
    if (error?.code !== "VT_NO_BABEL") throw error;
    // Il guasto porta con sé la propria cura (vedi babelPeer.js): qui non si riscrive né la
    // diagnosi né il rimedio, perché non sono sempre gli stessi — un Babel 8 su un Node
    // troppo vecchio vuole un'altra riga di comando.
    throw new Error(`${error.message}\n  ${error.guasto.cura}: \`${error.guasto.comando}\``);
  }
  return extractMarkers;
}

export default async function loadConfig() {
  // Nessun file di config separato: la stessa config passata a vitetranslate(...)
  // in vite.config.* viene letta da qui, tramite la proprietà che il plugin
  // espone sull'oggetto restituito — una sola fonte di verità, zero duplicazione.
  const nome = findConfigFile(process.cwd());
  if (nome === undefined) {
    throw new Error(
      `no Vite config found in "${process.cwd()}" (looked for: ${CONFIG_FILES.join(", ")}). ` +
      "Run this command from the root of the project, where vite.config.* lives."
    );
  }

  const viteConfigPath = path.join(process.cwd(), nome);
  let resolved;
  try {
    ({ default: resolved } = await import(pathToFileURL(viteConfigPath).href));
  } catch (error) {
    // Un config TypeScript lo carica Node stesso, togliendo i tipi: dalla 22.6 dietro flag,
    // dalla 23.6 di default. Su un Node più vecchio — o con sintassi che non si limita ad
    // annotazioni (enum, namespace, decoratori) — l'import fallisce, e il messaggio grezzo non
    // dice quale delle due cose sia successa.
    const tipizzato = /\.[cm]?ts$/.test(nome);
    const aiuto = tipizzato && !process.features.typescript
      ? ` This Node (${process.version}) does not strip TypeScript types: use Node 23.6+, run with --experimental-strip-types, or keep a vite.config.js.`
      : "";
    // Caricare la config tira dentro il plugin, e con lui tutto ciò che il plugin importa: se
    // a mancare è un pacchetto, il messaggio grezzo lo nomina in mezzo a un percorso lungo e
    // sembra un problema della config. Quasi sempre è invece una peer dependency non
    // installata, e la cura è una riga.
    const pacchetto = error?.code === "ERR_MODULE_NOT_FOUND"
      ? /Cannot find package '([^']+)'/.exec(error.message)?.[1]
      : undefined;
    if (pacchetto) {
      throw new Error(
        `loading "${nome}" needs "${pacchetto}", which is not installed.\n` +
        `  ${consiglioPacchetto(pacchetto)}`
      );
    }
    throw new Error(`could not load "${nome}": ${error.message}${aiuto}`);
  }

  // `defineConfig` accetta anche una funzione di `{ command, mode }`, forma comunissima appena
  // la config deve guardare l'ambiente. Prima cadeva nel ramo "plugin non trovato", che
  // mandava a cercare un errore di registrazione che non c'era.
  if (typeof resolved === "function") {
    resolved = await resolved({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });
  }

  const plugins = (resolved?.plugins ?? []).flat(Infinity);
  const plugin = plugins.find((p) => p?.name === "vitetranslate");
  if (!plugin?.vitetranslateConfig) {
    throw new Error(
      `vitetranslate was not found among the "plugins" of ${nome}: register it to use this command.`
    );
  }
  return plugin.vitetranslateConfig;
}
