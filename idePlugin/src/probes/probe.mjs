// La sonda: legge UN vite.config e risponde con un oggetto JSON, poi esce.
//
// Gira in un processo figlio (vedi runProbe.mjs), mai dentro l'extension host: caricare un
// vite.config vuol dire eseguire codice del progetto, con i suoi import e i suoi effetti
// collaterali. In un processo a parte un config che si blocca si uccide con un timeout, uno
// che sporca lo stato globale di Node sporca un processo che muore subito dopo, e ogni lettura
// parte da una cache dei moduli vuota — un config modificato si rilegge davvero.
//
// Stesso percorso di lib/dev/vite/uty/loadConfig.js (il CLI): import del file, chiamata della
// funzione se `defineConfig` ha ricevuto una funzione, ricerca del plugin per nome e lettura di
// `vitetranslateConfig`. Non si passa da Vite: nessun hook del plugin viene eseguito, quindi
// nessuna sincronizzazione parte (VITETRANSLATE_NO_SYNC, messo da runProbe, è una cintura in più).
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
// tutto, aspettando le Promise, come fa Vite stesso.
async function appiattisci(lista) {
  const fuori = [];
  for (const voce of await Promise.all(lista ?? [])) {
    if (Array.isArray(voce)) fuori.push(...(await appiattisci(voce)));
    else if (voce) fuori.push(voce);
  }
  return fuori;
}

try {
  const file = process.argv[2];
  let { default: config } = await import(pathToFileURL(path.resolve(file)).href);
  // Stessi argomenti del CLI (loadConfig.js): il pannello mostra ciò che vede `vtranslate-cli`.
  if (typeof config === "function") {
    config = await config({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });
  }
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
  rispondi({ ok: false, code: error?.code ?? null, error: String(error?.message ?? error) });
}
