import { languages, defaultLanguage, defaultTable, preloadedTables } from "virtual:vitetranslate/languages";

/**
 * Cache a livello di modulo del caricamento di ogni lingua, condivisa da tutte le
 * istanze di TranslateContainer. È ciò che rende usabile Suspense: `readLanguage` va
 * chiamata durante il render e, se la lingua non è pronta, lancia la Promise (stesso
 * meccanismo di React.lazy). Senza una cache stabile ogni render lancerebbe una Promise
 * nuova -> loop infinito di sospensione.
 *
 * entry: { status: 'pending'|'done'|'error', promise, table?, error? }
 */
const cache = new Map();

/** La lingua è tra quelle trovate in localeDir (incluse le precaricate)? */
export function isKnownLanguage(tag) {
  return !!tag && !!languages[tag];
}

/**
 * Avvia (o riusa) il caricamento della lingua e ne restituisce la Promise cached.
 * Le lingue precaricate sono già in memoria: Promise già risolta. Usata da
 * proposeNewLanguage per agganciare i callback onDone/onError all'esito reale.
 */
export function ensureLanguage(tag) {
  const cached = cache.get(tag);
  if (cached) return cached.promise;

  // Precaricata (import statico): nessun fetch, risultato immediato.
  const preloaded = preloadedTables[tag];
  if (preloaded) {
    const entry = { status: "done", table: preloaded };
    entry.promise = Promise.resolve(preloaded);
    cache.set(tag, entry);
    return entry.promise;
  }

  const loader = languages[tag];
  if (!loader) {
    const error = new Error(`Unknown language "${tag}"`);
    const entry = { status: "error", error, promise: Promise.reject(error) };
    entry.promise.catch(() => {}); // evita unhandledrejection se nessuno la aggancia
    cache.set(tag, entry);
    return entry.promise;
  }

  const entry = { status: "pending" };
  // import() dinamico -> Vite carica solo il chunk della lingua richiesta.
  entry.promise = loader().then(
    mod => { entry.status = "done"; entry.table = mod.default; return entry.table; },
    error => { entry.status = "error"; entry.error = error; throw error; }
  );
  cache.set(tag, entry);
  return entry.promise;
}

/**
 * Lettura sincrona per il render:
 *  - precaricata / già caricata -> ritorna la tabella (nessuna sospensione)
 *  - in caricamento             -> lancia la Promise (Suspense mostra il fallback)
 *  - errore di caricamento      -> NON fa crashare: ricade sulla lingua sorgente
 *    (defaultTable, sempre importata staticamente), coerente con la filosofia
 *    "mostra sempre qualcosa" della libreria. L'errore è già loggato da chi ha
 *    avviato il caricamento (proposeNewLanguage / qui sotto).
 */
export function readLanguage(tag) {
  const preloaded = preloadedTables[tag];
  if (preloaded) return preloaded;

  let entry = cache.get(tag);
  if (!entry) {
    ensureLanguage(tag);
    entry = cache.get(tag);
  }

  if (entry.status === "done") return entry.table;
  if (entry.status === "pending") throw entry.promise; // -> Suspense
  return defaultTable ?? {}; // status === "error"
}
