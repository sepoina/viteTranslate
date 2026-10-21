// La sonda: legge UN vite.config e risponde con un oggetto JSON, poi esce.
//
// Gira in un processo figlio (vedi runProbe.mjs), mai dentro l'extension host: caricare un
// vite.config vuol dire eseguire codice del progetto, con i suoi import e i suoi effetti
// collaterali. In un processo a parte un config che si blocca si uccide con un timeout, uno
// che sporca lo stato globale di Node sporca un processo che muore subito dopo, e ogni lettura
// parte da una cache dei moduli vuota — un config modificato si rilegge davvero.
//
// Stesso percorso di lib/dev/vite/uty/loadConfig.js (il CLI): import del file, config e plugin
// risolti come fa Vite (un config-funzione o Promise, plugin annidati o in una Promise: lo stesso
// di resolveViteConfig.js), ricerca del plugin per nome e lettura di `vitetranslateConfig`. Il
// codice è una copia, non un import: le sonde non importano niente da lib/ del repo (lo controlla
// ideScanEntry.test.mjs). Che le due letture dicano lo stesso lo provano i test sulle stesse forme
// (loadConfigShapes.test.mjs, idePluginProbe.test.mjs). Non si passa da Vite: nessun hook del
// plugin viene eseguito, quindi nessuna sincronizzazione parte (VITETRANSLATE_NO_SYNC, messo da
// runProbe, è una cintura in più).
//
//   argv[2] = nome del file di config, relativo alla cwd (la cartella del progetto)
import path from "node:path";
import { pathToFileURL } from "node:url";

// Risponde e poi esce. Con `process.send` (processo figlio con canale IPC) si esce solo nella
// callback, cioè a messaggio consegnato; senza canale (sonda lanciata a mano, per provarla)
// la risposta va su stdout.
function rispondi(messaggio) {
  if (process.send) process.send(messaggio, () => process.exit(0));
  else {
    process.stdout.write(JSON.stringify(messaggio) + "\n");
    process.exit(0);
  }
}

// Il canale IPC porta JSON: una RegExp diventerebbe `{}`, una funzione sparirebbe. Le si
// descrive invece di perderle (autoWrap può essere una RegExp).
function serializza(valore, visti = new WeakSet()) {
  if (valore instanceof RegExp) return { $regexp: String(valore) };
  if (typeof valore === "function") return { $function: valore.name || "anonymous" };
  if (typeof valore === "bigint" || typeof valore === "symbol") return String(valore);
  if (valore === null || typeof valore !== "object") return valore;
  if (visti.has(valore)) return "[circular]";
  visti.add(valore);
  if (Array.isArray(valore)) return valore.map((x) => serializza(x, visti));
  const fuori = {};
  for (const [chiave, x] of Object.entries(valore)) if (x !== undefined) fuori[chiave] = serializza(x, visti);
  return fuori;
}

// `plugins` di Vite accetta array annidati, `false`/`null` e anche Promise: si appiattisce
// tutto, aspettando le Promise, come fa Vite stesso (flattenPlugins in resolveViteConfig.js).
async function appiattisci(lista) {
  const fuori = [];
  for (const voce of await Promise.all(lista ?? [])) {
    if (Array.isArray(voce)) fuori.push(...(await appiattisci(voce)));
    else if (voce) fuori.push(voce);
  }
  return fuori;
}

// Un vite.config TypeScript lo carica il Node dell'editor togliendo i tipi, se lo sa fare (da sé
// dalla 22.18 e dalla 23.6). Su un editor col Node più vecchio l'errore grezzo ("Unknown file
// extension") non dice cosa fare: lo si aggiunge, come fa il CLI (loadConfig.js).
function aiutoTs(file) {
  if (!/\.[cm]?ts$/.test(file) || process.features?.typescript) return "";
  return ` This editor runs vite.config with its own Node (${process.version}), which can't read TypeScript: update the editor, or use a vite.config.js.`;
}

const file = process.argv[2];
try {
  const { default: esportato } = await import(pathToFileURL(path.resolve(file)).href);
  // Stessi argomenti del CLI (CONFIG_ENV in resolveViteConfig.js): il pannello mostra ciò che vede
  // `vtranslate-cli`. Una funzione si chiama, una Promise si aspetta.
  const config = await (typeof esportato === "function"
    ? esportato({ command: "build", mode: "production", isSsrBuild: false, isPreview: false })
    : esportato);
  const plugins = await appiattisci(config?.plugins);
  const plugin = plugins.find((p) => p?.name === "vitetranslate");
  rispondi({
    ok: true,
    plugins: plugins.map((p) => p?.name ?? "(unnamed)"),
    vite: serializza({
      base: config?.base,
      root: config?.root,
      outDir: config?.build?.outDir,
      port: config?.server?.port,
      host: config?.server?.host,
    }),
    vitetranslate: plugin?.vitetranslateConfig ? serializza(plugin.vitetranslateConfig) : null,
  });
} catch (error) {
  // L'aiuto sulla prima riga: è quella che il pannello mostra (errorLine in summarize.mjs).
  const [prima, ...resto] = String(error?.message ?? error).split("\n");
  rispondi({ ok: false, code: error?.code ?? null, error: [prima + aiutoTs(file), ...resto].join("\n") });
}
