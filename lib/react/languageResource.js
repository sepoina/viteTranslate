// Architettura d'insieme: doc/structure.md § "Fase 3 — Il modulo virtuale" e § "Fase 4 — Runtime".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { languages, fallbackTable } from "virtual:vitetranslate/languages";

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

// `languages` è un oggetto letterale generato, quindi eredita da Object.prototype:
// `languages["constructor"]` o `["toString"]` sono valori veri, e un controllo per verità
// farebbe passare quei tag come lingue esistenti. Il lookup guarda solo le proprietà proprie.
const own = (obj, key) => typeof key === "string" && Object.hasOwn(obj, key);

/** La voce di `languages` per questo tag, o undefined se il tag non è una lingua. */
const entryOf = (tag) => (own(languages, tag) ? languages[tag] : undefined);

/** La lingua è tra quelle trovate in localeDir (incluse le precaricate)? */
export function isKnownLanguage(tag) {
  return entryOf(tag) !== undefined;
}

/**
 * La lingua è importata staticamente, cioè disponibile sincrona al primo render?
 *
 * Il flag arriva dal bundle, non da un ragionamento a runtime, ed è per questo che la
 * risposta è attendibile anche in produzione — dove l'insieme delle precaricate è diverso da
 * quello di sviluppo (in dev la lingua sorgente c'è sempre).
 */
export function isPreloadedLanguage(tag) {
  return entryOf(tag)?.preloaded === true;
}

/**
 * I tag delle lingue precaricate, nell'ordine in cui il bundle le importa. Congelato per la
 * stessa ragione di `languages` in useTranslateLanguage.js: è una costante di modulo che
 * descrive com'è fatto il bundle, e il bundle non cambia mentre la pagina è aperta.
 */
export const preloadedLanguages = Object.freeze(Object.keys(languages).filter((tag) => languages[tag].preloaded));

/**
 * Lingua iniziale di default: la prima precaricata. Non è una scelta arbitraria fra pari — il
 * plugin emette per prima `preloadedLanguages[0]`, o la sourceLanguage se non ce ne sono, ed
 * è lo stesso tag in sviluppo e in build.
 */
export const firstPreloadedLanguage = preloadedLanguages[0];

/**
 * Avvia (o riusa) il caricamento della lingua e ne restituisce la Promise cached.
 * Le lingue precaricate sono già in memoria: Promise già risolta. Usata da
 * proposeNewLanguage per agganciare i callback onDone/onError all'esito reale.
 *
 * Un caricamento fallito NON resta in cache come tale: un chunk può fallire per un buco di
 * rete, e tenerne memoria per sempre significherebbe che quella lingua non è più
 * selezionabile per tutta la vita della pagina, per quanti tentativi si facciano. La entry
 * in errore resta finché serve a `readLanguage` (che deve poter rispondere senza sospendere
 * di nuovo, altrimenti si sospenderebbe all'infinito), ma qualunque richiesta esplicita
 * successiva riparte da capo.
 */
export function ensureLanguage(tag) {
  const cached = cache.get(tag);
  if (cached && cached.status !== "error") return cached.promise;

  const language = entryOf(tag);

  // Precaricata (import statico): nessun fetch, risultato immediato.
  if (language?.preloaded) {
    const preloaded = language.table;
    const entry = { status: "done", table: preloaded };
    entry.promise = Promise.resolve(preloaded);
    cache.set(tag, entry);
    return entry.promise;
  }

  if (language === undefined) {
    const error = new Error(`Unknown language "${tag}"`);
    const entry = { status: "error", error, promise: Promise.reject(error) };
    entry.promise.catch(() => {}); // evita unhandledrejection se nessuno la aggancia
    cache.set(tag, entry);
    return entry.promise;
  }

  const entry = { status: "pending" };
  // import() dinamico -> Vite carica solo il chunk della lingua richiesta.
  entry.promise = language.load().then(
    mod => { entry.status = "done"; entry.table = mod.default; return entry.table; },
    error => { entry.status = "error"; entry.error = error; throw error; }
  );
  // Il render (readLanguage) avvia il caricamento senza agganciare la Promise: senza questo
  // handler un fallimento diventerebbe un unhandledrejection nella console del browser.
  // Aggancia il rifiuto senza consumarlo: chi chiama ensureLanguage lo riceve comunque.
  entry.promise.catch(() => {});
  cache.set(tag, entry);
  return entry.promise;
}

/**
 * Il caricamento di questa lingua è fallito e non è ancora stato ritentato?
 *
 * Serve a due cose che senza di essa restano invisibili, entrambe in TranslateContainer:
 * distinguere una proposta nuova da un **ritentativo** (vedi `nextLanguageState`), e sapere
 * che a schermo c'è la tabella eager e non la lingua richiesta (vedi `readLanguage`).
 *
 * Va letta PRIMA di `ensureLanguage`, che riarma il caricamento e con esso cancella la
 * traccia dell'errore.
 */
export function hasFailedLanguage(tag) {
  return cache.get(tag)?.status === "error";
}

/**
 * Lo stato successivo del container per una proposta di cambio lingua.
 *
 * Restituisce **lo stesso oggetto** — cioè "non c'è niente da ri-renderizzare" — solo quando
 * la proposta non cambia nulla di osservabile. In ogni altro caso l'identità è nuova, ed è
 * l'unica cosa che conta: `setState` con un valore identico incontra il bailout di React e non
 * pianifica nessun render.
 *
 * È il bug che questa funzione esiste per chiudere. Dopo un caricamento fallito il tag è già
 * quello richiesto: riproporlo — cioè il pulsante "riprova" di un language switcher — faceva
 * ripartire il caricamento davvero, ma `setLang(stessoTag)` usciva dal bailout senza render.
 * Il chunk arrivava, `onDone(true)` diceva che era andata bene, e a schermo restava la tabella
 * di fallback finché un render qualunque, per tutt'altra ragione, non ripassava di qui.
 *
 * `epoch` non viene letto da nessuno: serve solo a rendere l'oggetto diverso dal precedente.
 *
 * @param {{tag: string, epoch: number}} prev
 * @param {string} tag - la lingua proposta
 * @param {boolean} retrying - `hasFailedLanguage(tag)` campionato prima di `ensureLanguage`
 * @returns {{tag: string, epoch: number}} `prev` se non c'è nulla da fare
 */
export function nextLanguageState(prev, tag, retrying) {
  if (prev.tag === tag && !retrying) return prev;
  return { tag, epoch: prev.epoch + 1 };
}

/**
 * Lettura sincrona per il render:
 *  - precaricata / già caricata -> ritorna la tabella (nessuna sospensione)
 *  - in caricamento             -> lancia la Promise (Suspense mostra il fallback)
 *  - errore di caricamento      -> NON fa crashare: ricade sulla tabella eager
 *    (fallbackTable, sempre importata staticamente), coerente con la filosofia
 *    "mostra sempre qualcosa" della libreria. L'errore è già loggato da chi ha
 *    avviato il caricamento (proposeNewLanguage / qui sotto).
 */
export function readLanguage(tag) {
  const language = entryOf(tag);
  if (language?.preloaded) return language.table;

  let entry = cache.get(tag);
  if (!entry) {
    ensureLanguage(tag);
    entry = cache.get(tag);
  }

  if (entry.status === "done") return entry.table;
  if (entry.status === "pending") throw entry.promise; // -> Suspense
  return fallbackTable ?? {}; // status === "error"
}
