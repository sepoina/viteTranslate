// Architettura d'insieme: doc/structure.md § "No separate config file".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Dal default export di un vite.config ai suoi plugin, come li legge Vite stesso
// (loadConfigFromFile e asyncFlatten): l'export può essere un oggetto, una Promise o una funzione
// di `{ command, mode }`, e `plugins` accetta array annidati, `false`/`null` e Promise. Prima il
// CLI faceva solo `flat(Infinity)`: un plugin dentro una Promise, o un config esportato come
// Promise, finiva nel ramo "plugin non trovato" anche se Vite lo usava benissimo.
//
// Lo usa il CLI (loadConfig.js). La sonda dell'estensione per l'editor
// (idePlugin/src/probes/probe.mjs) fa lo stesso con una sua copia, perché le sonde non importano
// da lib/: se cambi qui, cambia anche lì. Lo controllano loadConfigShapes.test.mjs e
// idePluginProbe.test.mjs, sulle stesse forme.

/** L'ambiente con cui si chiama un config-funzione: quello di `vite build`, come il CLI. */
export const CONFIG_ENV = { command: "build", mode: "production", isSsrBuild: false, isPreview: false };

/**
 * La config dal default export del file: chiamata se è una funzione (`defineConfig` ne accetta
 * una, forma comunissima appena la config guarda l'ambiente), attesa se è una Promise.
 */
export async function resolveUserConfig(esportato) {
  return await (typeof esportato === "function" ? esportato(CONFIG_ENV) : esportato);
}

/**
 * I plugin della config, in fila: array annidati aperti (il plugin di viteTranslate ne restituisce
 * due), Promise attese a ogni livello, `false`/`null`/`undefined` scartati.
 *
 * @param {unknown[] | undefined} lista - `plugins` della config
 * @returns {Promise<object[]>}
 */
export async function flattenPlugins(lista) {
  const fuori = [];
  for (const voce of await Promise.all(lista ?? [])) {
    if (Array.isArray(voce)) fuori.push(...(await flattenPlugins(voce)));
    else if (voce) fuori.push(voce);
  }
  return fuori;
}
