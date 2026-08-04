// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

// Le regole di `errorSolve` in un posto solo, come per il dialetto HTML (lib/htmlDialect.js).
//
// L'opzione la scrive chi usa la libreria in vite.config.js, la normalizza il plugin (lato
// Node), la risolve contro l'ambiente sempre il plugin, e a leggerne l'esito è il runtime nel
// browser. Quattro lettori per la stessa regola: scritta una volta sola qui, non possono
// divergere.
//
// Il file non importa nulla e non dipende né da React né da Node, esattamente come
// htmlDialect.js: entrambi i lati lo prendono così com'è.

// Tenuto a sé e non letto da ERROR_SOLVE_DEFAULTS: è l'unico default che serve anche al
// runtime, e pescarlo dall'oggetto se lo trascinerebbe dentro tutto. Un `Object.freeze` non si
// tree-shaka campo per campo, quindi il bundle di produzione finirebbe per portarsi i tre
// glifi diagnostici solo per leggere questa riga — proprio dove la diagnostica è spenta.
const DEFAULT_NO_ARG = "[?]";

/**
 * I default dell'opzione `errorSolve`, nella forma in cui li scrive chi usa la libreria.
 *
 * I tre `beginChar*` sono prefissi diagnostici: compaiono a schermo davanti al testo per dire
 * a colpo d'occhio che quella stringa non è arrivata dove doveva. `noArrayChar` non è una
 * diagnostica ma una resa normale — è il segnaposto che sostituisce un `%s` rimasto senza
 * valore — e per questo non passa da `onlyInDev`.
 *
 * L'annotazione `@__PURE__` non è decorativa: senza, il bundler tiene la chiamata a
 * `Object.freeze` anche dopo aver scartato l'export inutilizzato, e i tre glifi finiscono nel
 * bundle di produzione — dove nessuno li legge, essendo la diagnostica spenta. Con
 * l'annotazione l'intera espressione sparisce dal lato React e resta solo nel plugin.
 */
export const ERROR_SOLVE_DEFAULTS = /* @__PURE__ */ Object.freeze({
  /** Testo non marcato, o prop incompatibili fra loro. */
  beginCharMalformed: "⁂",
  /** Non tradotto nella lingua corrente: a schermo c'è il testo della lingua sorgente. */
  beginCharUntranslated: "⁑",
  /** Tradotto qui, ma assente in almeno un'altra lingua del progetto. */
  beginCharNotFullyTranslated: "∴",
  /** Segnaposto `%s` rimasto senza valore. */
  noArrayChar: DEFAULT_NO_ARG,
  /** In build nessun prefisso: si mostra il fallback e basta. */
  onlyInDev: true,
  /** Output console del runtime in sviluppo. */
  warningDev: true,
  /** Output console del runtime in produzione. */
  warningBuild: false,
});

const CHAR_KEYS = ["beginCharMalformed", "beginCharUntranslated", "beginCharNotFullyTranslated", "noArrayChar"];
const FLAG_KEYS = ["onlyInDev", "warningDev", "warningBuild"];

/**
 * Completa l'opzione dell'utente con i default e ne verifica i tipi. Lato Node, a tempo di
 * definizione del plugin.
 *
 * Un carattere può essere disattivato passando `""`, `false` o `null`: la stringa vuota è la
 * forma interna dello "spento", così il runtime non ha condizioni da valutare oltre alla
 * verità del valore. Un tipo sbagliato non fa fallire la build — sarebbe sproporzionato per
 * un'opzione di diagnostica — ma viene segnalato e il campo torna al default.
 *
 * @param {object} [given] - `defs.errorSolve` così com'è stato scritto
 * @param {(message: string) => void} [warn] - dove segnalare i problemi (default: console.warn)
 * @returns {typeof ERROR_SOLVE_DEFAULTS}
 */
export function normalizeErrorSolve(given, warn = (m) => console.warn(m)) {
  if (given === undefined || given === null) return { ...ERROR_SOLVE_DEFAULTS };
  if (typeof given !== "object" || Array.isArray(given)) {
    warn(`[vitetranslate] option "errorSolve" must be an object, got ${Array.isArray(given) ? "array" : typeof given}: ignored, defaults used.`);
    return { ...ERROR_SOLVE_DEFAULTS };
  }

  const out = { ...ERROR_SOLVE_DEFAULTS };

  for (const key of Object.keys(given)) {
    if (!Object.hasOwn(ERROR_SOLVE_DEFAULTS, key)) {
      // Un refuso in un nome di campo non produrrebbe nessun sintomo: l'opzione verrebbe
      // semplicemente ignorata e il default resterebbe attivo, cioè esattamente il contrario
      // di ciò che si stava cercando di ottenere.
      warn(`[vitetranslate] errorSolve: unknown option "${key}", ignored. Known options: ${Object.keys(ERROR_SOLVE_DEFAULTS).join(", ")}.`);
    }
  }

  for (const key of CHAR_KEYS) {
    const value = given[key];
    if (value === undefined) continue;
    if (value === false || value === null || value === "") { out[key] = ""; continue; }
    if (typeof value !== "string") {
      warn(`[vitetranslate] errorSolve.${key} must be a string (or false to disable), got ${typeof value}: default "${ERROR_SOLVE_DEFAULTS[key]}" kept.`);
      continue;
    }
    out[key] = value;
  }

  for (const key of FLAG_KEYS) {
    const value = given[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      warn(`[vitetranslate] errorSolve.${key} must be a boolean, got ${typeof value}: default ${ERROR_SOLVE_DEFAULTS[key]} kept.`);
      continue;
    }
    out[key] = value;
  }

  // Un `noArrayChar` vuoto è legittimo (chi lo vuole, ottiene un buco al posto del segnaposto)
  // ma non è la stessa cosa di "non specificato": resta com'è stato chiesto.
  return out;
}

/**
 * Risolve l'opzione contro l'ambiente della build. Lato Node, in `configResolved` — quando
 * `isProduction` è finalmente noto.
 *
 * Il risultato è la forma che finisce nel modulo virtuale: valori già decisi, così il runtime
 * nel browser non deve ragionare su `import.meta.env` né conoscere `onlyInDev`. In produzione
 * con i default i tre prefissi sono `""` e l'intera macchina diagnostica è inerte.
 *
 * @param {typeof ERROR_SOLVE_DEFAULTS} options - l'esito di normalizeErrorSolve
 * @param {boolean} isProduction
 * @returns {{malformed: string, untranslated: string, notFullyTranslated: string, noArg: string, warn: boolean}}
 */
export function resolveErrorSolve(options, isProduction) {
  const marks = !(options.onlyInDev && isProduction);
  return {
    malformed: marks ? options.beginCharMalformed : "",
    untranslated: marks ? options.beginCharUntranslated : "",
    notFullyTranslated: marks ? options.beginCharNotFullyTranslated : "",
    // Mai spento da onlyInDev: un `%s` senza valore è una resa normale, e mostrare il
    // segnaposto grezzo esporrebbe all'utente finale la sintassi interna della tabella.
    noArg: options.noArrayChar,
    warn: isProduction ? options.warningBuild : options.warningDev,
  };
}

/** Nessuna chiave: oggetto senza prototipo, così `partiallyTranslated["toString"]` è undefined. */
const NO_KEYS = Object.freeze(Object.create(null));

/**
 * Ciò che il runtime usa quando il modulo virtuale non dice nulla — un manifest scritto a mano
 * (i test) o generato da una versione del plugin che `errorSolve` non lo conosceva.
 *
 * I prefissi sono spenti, `noArg` no. L'asimmetria è voluta: senza la risoluzione del plugin
 * non si sa se si è in sviluppo o in produzione, e far comparire dei glifi diagnostici in
 * un'app pubblicata che non li ha mai chiesti è peggio che non mostrarne nessuno. `noArg` è
 * invece la resa di sempre, e il suo default coincide con il vecchio `MISSING_ARG`.
 */
export const DEFAULT_DIAGNOSTICS = makeDiagnostics({
  malformed: "",
  untranslated: "",
  notFullyTranslated: "",
  noArg: DEFAULT_NO_ARG,
  warn: true,
  partiallyTranslated: NO_KEYS,
});

/**
 * Legge il modulo virtuale e ne ricava la configurazione diagnostica del runtime.
 *
 * Prende il namespace del modulo, non i singoli export: un manifest che non li ha ancora non
 * deve rompere il collegamento ESM (un import nominato di un export inesistente è un errore
 * di linking, non un `undefined`). Ogni campo mancante ricade su DEFAULT_DIAGNOSTICS.
 *
 * @param {Record<string, any>} manifest - `import * as manifest from "virtual:vitetranslate/languages"`
 */
export function resolveDiagnostics(manifest) {
  const given = manifest?.errorSolve;
  if (!given) return DEFAULT_DIAGNOSTICS;
  return makeDiagnostics({
    malformed: given.malformed ?? "",
    untranslated: given.untranslated ?? "",
    notFullyTranslated: given.notFullyTranslated ?? "",
    noArg: given.noArg ?? DEFAULT_NO_ARG,
    warn: given.warn !== false,
    partiallyTranslated: manifest.partiallyTranslated ?? NO_KEYS,
  });
}

function makeDiagnostics(fields) {
  // Un solo prefisso per stringa. Quando `⁂` ha già vinto, il testo recuperato attraversa
  // comunque la catena di risoluzione, che senza questa variante gli attaccherebbe davanti un
  // secondo prefisso. Precalcolata qui: il percorso di salvataggio non alloca nulla.
  //
  // Una copia e non un rimando a `diag` anche quando i due prefissi sono già spenti: costa un
  // oggetto una volta per modulo, e in cambio la struttura resta aciclica — ispezionabile in
  // un debugger, serializzabile, senza sorprese per chi ci finisce dentro a leggerla.
  return { ...fields, malformedOnly: { ...fields, untranslated: "", notFullyTranslated: "" } };
}

/**
 * Console del runtime, sotto l'interruttore `warningDev`/`warningBuild`.
 *
 * Ci passa TUTTO l'output che la libreria emette nel browser, non solo le diagnostiche nuove:
 * chi mette a tacere il pacchetto in produzione si aspetta che taccia. I messaggi del plugin
 * (lato Node, a build time, prefissati `[vitetranslate]`) restano fuori — non sono runtime.
 *
 * @param {{warn: boolean}} diag
 * @param {"error"|"warn"} level
 */
export function report(diag, level, ...args) {
  if (!diag.warn) return;
  console[level](...args);
}

// Un uso scorretto è un errore di codice: si ripresenta identico a ogni render finché non lo
// si corregge. Loggarlo ogni volta seppellirebbe la console senza aggiungere informazione,
// quindi si segnala una volta per messaggio distinto (stessa strategia dei warning di React).
// Il registro è unico per l'intero pacchetto: gli emitter sono più di uno e il tetto deve
// valere sul totale, non su ciascuno. Evita che il Set cresca senza limite quando il messaggio
// contiene testo dinamico — il testo non marcato, per esempio, finisce nel messaggio.
const reported = new Set();
const REPORTED_MAX = 100;

/**
 * Come `report`, ma una volta sola per messaggio distinto.
 *
 * @param {{warn: boolean}} diag
 * @param {string} message
 */
export function reportOnce(diag, message) {
  if (!diag.warn) return;
  if (reported.has(message)) return;
  if (reported.size >= REPORTED_MAX) reported.clear();
  reported.add(message);
  console.error(message);
}
