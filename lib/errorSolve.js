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
// tree-shaka campo per campo, quindi il bundle di produzione finirebbe per portarsi i quattro
// glifi diagnostici solo per leggere questa riga — proprio dove la diagnostica è spenta.
const DEFAULT_ABSENT_IN_ARRAY = "⁇";

/**
 * I default dell'opzione `errorSolve`, nella forma in cui li scrive chi usa la libreria.
 *
 * I cinque `mark` sono ciò che compare a schermo, e stanno insieme perché è una domanda sola:
 * "con che cosa lo faccio vedere?". I primi quattro sono diagnostiche e passano da
 * `markOnlyDev`; `absentDataInArray` non lo è — è la resa normale di un `%s` rimasto senza
 * valore — e per questo resta acceso anche in produzione. Fuori da `mark` ci sono solo
 * interruttori, cioè l'altra domanda: "quando".
 *
 * I nomi dentro `mark` sono gli stessi che il runtime legge dal modulo virtuale (§ Fase 3):
 * `resolveErrorSolve` copia e spegne, non traduce. Un vocabolario solo per una cosa sola.
 *
 * L'annotazione `@__PURE__` non è decorativa: senza, il bundler tiene la chiamata a
 * `Object.freeze` anche dopo aver scartato l'export inutilizzato, e i glifi finiscono nel
 * bundle di produzione — dove nessuno li legge, essendo la diagnostica spenta. Ce ne vuole una
 * per chiamata, annidata compresa: `Object.freeze` non annotata è una chiamata con effetti, e
 * basterebbe quella interna a tenere in vita tutto il resto.
 */
export const ERROR_SOLVE_DEFAULTS = /* @__PURE__ */ Object.freeze({
  /** Cosa si vede a schermo. I quattro glifi diagnostici, più la resa del `%s` senza valore. */
  mark: /* @__PURE__ */ Object.freeze({
    /**
     * Nella posizione del testo è arrivato un valore che testo non è e non lo diventerà: una
     * funzione, un simbolo, un elemento React dentro la tupla. Qui non c'è niente da salvare,
     * quindi il glifo non è un prefisso ma tutto ciò che si rende, seguito dal nome di ciò che
     * si è trovato — `🚫[func]`. Spento (ogni build di produzione con i default) non si rende
     * niente: chi legge lo schermo con quell'errore non c'entra.
     */
    badData: "🚫",
    /** Testo non marcato, o prop incompatibili fra loro. */
    malformed: "‼️",
    /** Non tradotto nella lingua corrente: a schermo c'è il testo della lingua sorgente. */
    untranslated: "🔸",
    /** Tradotto qui, ma assente in almeno un'altra lingua del progetto. */
    notFullyTranslated: "🔹",
    /** Segnaposto `%s` rimasto senza valore. Non è una diagnostica: vale anche in build. */
    absentDataInArray: DEFAULT_ABSENT_IN_ARRAY,
  }),
  /** In build nessun mark diagnostico: si mostra il fallback e basta. */
  markOnlyDev: true,
  /** Output console del runtime in sviluppo. */
  warningDev: true,
  /** Output console del runtime in produzione. */
  warningBuild: false,
});

// I mark che `markOnlyDev` può spegnere: le diagnostiche, cioè tutte tranne una. Elencati e non
// derivati per differenza, perché è l'elenco che dice quali sono — e aggiungerne uno nuovo deve
// essere una decisione, non un effetto collaterale di dove lo si scrive.
const DIAGNOSTIC_MARKS = ["badData", "malformed", "untranslated", "notFullyTranslated"];
const MARK_KEYS = [...DIAGNOSTIC_MARKS, "absentDataInArray"];
const FLAG_KEYS = ["markOnlyDev", "warningDev", "warningBuild"];

// I nomi di prima, con il posto in cui sono finiti. Un'opzione rinominata è indistinguibile da
// un refuso — entrambe finiscono nel ramo "unknown option" — ma la differenza per chi aggiorna
// è tutta: il refuso lo si corregge guardando l'elenco, il rinominato no, perché il nome giusto
// non c'è più. Sola diagnostica, non compatibilità: la forma vecchia resta ignorata.
const RENAMED = {
  beginCharMalformed: "mark.malformed",
  beginCharUntranslated: "mark.untranslated",
  beginCharNotFullyTranslated: "mark.notFullyTranslated",
  beginCharBadData: "mark.badData",
  noArrayChar: "mark.absentDataInArray",
  onlyInDev: "markOnlyDev",
};

/** Una copia scrivibile dei default: `mark` è congelato, e uno spread solo lo condividerebbe. */
const freshDefaults = () => ({ ...ERROR_SOLVE_DEFAULTS, mark: { ...ERROR_SOLVE_DEFAULTS.mark } });

/**
 * Completa l'opzione dell'utente con i default e ne verifica i tipi. Lato Node, a tempo di
 * definizione del plugin.
 *
 * Un mark può essere disattivato passando `""`, `false` o `null`: la stringa vuota è la forma
 * interna dello "spento", così il runtime non ha condizioni da valutare oltre alla verità del
 * valore. Un tipo sbagliato non fa fallire la build — sarebbe sproporzionato per un'opzione di
 * diagnostica — ma viene segnalato e il campo torna al default.
 *
 * @param {object} [given] - `defs.errorSolve` così com'è stato scritto
 * @param {(message: string) => void} [warn] - dove segnalare i problemi. Il messaggio non
 *   porta già il prefisso `[vitetranslate]`: lo aggiunge il default (console.warn), sulla
 *   falsariga di `defaultWarn` in markerCore.js; chi passa un canale suo (`logWarning`, la
 *   stessa colonna colorata di tutto il resto) decide da sé come incorniciarlo.
 * @returns {typeof ERROR_SOLVE_DEFAULTS}
 */
export function normalizeErrorSolve(given, warn = (m) => console.warn(`[vitetranslate] ${m}`)) {
  if (given === undefined || given === null) return freshDefaults();
  if (typeof given !== "object" || Array.isArray(given)) {
    warn(`option "errorSolve" must be an object, got ${Array.isArray(given) ? "array" : typeof given}: ignored, defaults used.`);
    return freshDefaults();
  }

  const out = freshDefaults();

  for (const key of Object.keys(given)) {
    // Un refuso in un nome di campo non produrrebbe nessun sintomo: l'opzione verrebbe
    // semplicemente ignorata e il default resterebbe attivo, cioè esattamente il contrario
    // di ciò che si stava cercando di ottenere.
    if (!Object.hasOwn(ERROR_SOLVE_DEFAULTS, key)) unknownKey("errorSolve", key, Object.keys(ERROR_SOLVE_DEFAULTS), warn);
  }

  const givenMark = given.mark;
  if (givenMark !== undefined && givenMark !== null) {
    if (typeof givenMark !== "object" || Array.isArray(givenMark)) {
      warn(`errorSolve.mark must be an object, got ${Array.isArray(givenMark) ? "array" : typeof givenMark}: ignored, defaults used.`);
    } else {
      for (const key of Object.keys(givenMark)) {
        if (!Object.hasOwn(ERROR_SOLVE_DEFAULTS.mark, key)) unknownKey("errorSolve.mark", key, MARK_KEYS, warn);
      }
      for (const key of MARK_KEYS) {
        const value = givenMark[key];
        if (value === undefined) continue;
        if (value === false || value === null || value === "") { out.mark[key] = ""; continue; }
        if (typeof value !== "string") {
          warn(`errorSolve.mark.${key} must be a string (or false to disable), got ${typeof value}: default "${ERROR_SOLVE_DEFAULTS.mark[key]}" kept.`);
          continue;
        }
        out.mark[key] = value;
      }
    }
  }

  for (const key of FLAG_KEYS) {
    const value = given[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      warn(`errorSolve.${key} must be a boolean, got ${typeof value}: default ${ERROR_SOLVE_DEFAULTS[key]} kept.`);
      continue;
    }
    out[key] = value;
  }

  // Un `absentDataInArray` vuoto è legittimo (chi lo vuole, ottiene un buco al posto del
  // segnaposto) ma non è la stessa cosa di "non specificato": resta com'è stato chiesto.
  return out;
}

/** Il messaggio del nome sconosciuto, con la nota in più se quel nome esisteva e si è spostato. */
function unknownKey(where, key, known, warn) {
  const moved = RENAMED[key];
  warn(
    `${where}: unknown option "${key}", ignored.` +
      (moved ? ` It was renamed: use "errorSolve.${moved}".` : ` Known options: ${known.join(", ")}.`),
  );
}

/**
 * Risolve l'opzione contro l'ambiente della build. Lato Node, in `configResolved` — quando
 * `isProduction` è finalmente noto.
 *
 * Il risultato è la forma che finisce nel modulo virtuale: valori già decisi, così il runtime
 * nel browser non deve ragionare su `import.meta.env` né conoscere `markOnlyDev`. In produzione
 * con i default i quattro glifi diagnostici sono `""` e la macchina è inerte.
 *
 * È `mark` con le diagnostiche spente e `warn` in fondo — niente di più. Da quando i nomi sono
 * gli stessi da una parte e dall'altra, questa funzione non traduce un vocabolario nell'altro,
 * e non c'è una coppia di nomi da tenere allineata a mano ogni volta che se ne aggiunge uno.
 * `absentDataInArray` non si spegne mai: un `%s` senza valore è una resa normale, e mostrare il
 * segnaposto grezzo esporrebbe all'utente finale la sintassi interna della tabella.
 *
 * @param {typeof ERROR_SOLVE_DEFAULTS} options - l'esito di normalizeErrorSolve
 * @param {boolean} isProduction
 * @returns {typeof ERROR_SOLVE_DEFAULTS.mark & {warn: boolean}}
 */
export function resolveErrorSolve(options, isProduction) {
  const out = { ...options.mark };
  if (options.markOnlyDev && isProduction) for (const key of DIAGNOSTIC_MARKS) out[key] = "";
  out.warn = isProduction ? options.warningBuild : options.warningDev;
  return out;
}

/** Nessuna chiave: oggetto senza prototipo, così `partiallyTranslated["toString"]` è undefined. */
const NO_KEYS = Object.freeze(Object.create(null));

/**
 * Ciò che il runtime usa quando il modulo virtuale non dice nulla — un manifest scritto a mano
 * (i test) o generato da una versione del plugin che `errorSolve` non lo conosceva.
 *
 * I mark diagnostici sono spenti, `absentDataInArray` no. L'asimmetria è voluta: senza la
 * risoluzione del plugin non si sa se si è in sviluppo o in produzione, e far comparire dei
 * glifi diagnostici in un'app pubblicata che non li ha mai chiesti è peggio che non mostrarne
 * nessuno. `absentDataInArray` è invece una resa normale, e resta quella anche qui.
 */
export const DEFAULT_DIAGNOSTICS = makeDiagnostics({
  badData: "",
  malformed: "",
  untranslated: "",
  notFullyTranslated: "",
  absentDataInArray: DEFAULT_ABSENT_IN_ARRAY,
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
    badData: given.badData ?? "",
    malformed: given.malformed ?? "",
    untranslated: given.untranslated ?? "",
    notFullyTranslated: given.notFullyTranslated ?? "",
    absentDataInArray: given.absentDataInArray ?? DEFAULT_ABSENT_IN_ARRAY,
    warn: given.warn !== false,
    partiallyTranslated: manifest.partiallyTranslated ?? NO_KEYS,
  });
}

function makeDiagnostics(fields) {
  // Un solo prefisso per stringa. Quando `‼️` ha già vinto, il testo recuperato attraversa
  // comunque la catena di risoluzione, che senza questa variante gli attaccherebbe davanti un
  // secondo prefisso. Precalcolata qui: il percorso di salvataggio non alloca nulla.
  //
  // Una copia e non un rimando a `diag` anche quando i due prefissi sono già spenti: costa un
  // oggetto una volta per modulo, e in cambio la struttura resta aciclica — ispezionabile in
  // un debugger, serializzabile, senza sorprese per chi ci finisce dentro a leggerla.
  return { ...fields, malformedOnly: { ...fields, untranslated: "", notFullyTranslated: "" } };
}

/**
 * Un valore qualunque ridotto a testo per un messaggio diagnostico, senza MAI lanciare.
 *
 * `JSON.stringify` non è innocuo: un valore ciclico — un elemento React che tiene un context,
 * un oggetto che si riferisce a sé — fa lanciare "Converting circular structure to JSON"
 * mentre il messaggio viene costruito, e il warning che doveva spiegare l'errore diventerebbe
 * il crash. Per i valori che non si serializzano (una funzione, un simbolo) resta il nome del
 * tipo, che è comunque più utile del nulla. L'uso va limitato ai messaggi: nel codice vero un
 * valore da mostrare ci arriva già come stringa.
 *
 * @param {any} value
 * @returns {string}
 */
export function describeValue(value) {
  try {
    return JSON.stringify(value) ?? typeof value;
  } catch {
    return `[not serializable: ${typeof value}]`;
  }
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
 * Come `report`, ma una volta sola per chiave distinta.
 *
 * Due parametri o tre, e la differenza conta. Con due, `key` è anche il messaggio: è la forma
 * per i testi che si compongono con una concatenazione e basta. Con tre, `key` serve solo a
 * deduplicare e il messaggio lo costruisce `build`, che **viene chiamata solo se il messaggio
 * verrà davvero stampato**.
 *
 * È il punto in cui si rispetta l'invariante "la diagnostica non deve costare niente dove è
 * spenta" (doc/structure.md § Invarianti, punto 9). Prima il messaggio arrivava qui già
 * composto — il template literal si valuta prima della chiamata — quindi un `describeValue()`,
 * cioè un `JSON.stringify`, girava a ogni render anche con la console spenta, che in produzione
 * è il default. E non su un percorso di laboratorio: un oggetto senza campo `t` rende vuoto ed
 * è un esito documentato, non un errore che qualcuno correggerà.
 *
 * Scegliendo la chiave: statica dove il valore che varia è solo un dettaglio della diagnosi (la
 * forma sbagliata di una prop si corregge una volta), dinamica dove il valore È l'informazione
 * — il testo non marcato, la chiave assente dalla tabella — altrimenti si vedrebbe il primo
 * caso e mai gli altri. Il tetto qui sotto esiste proprio perché le chiavi dinamiche non
 * facciano crescere il registro senza limite.
 *
 * @param {{warn: boolean}} diag
 * @param {string} key - messaggio completo (2 parametri) o sola chiave di deduplica (3)
 * @param {() => string} [build] - costruisce il messaggio, chiamata solo se serve stamparlo
 */
export function reportOnce(diag, key, build) {
  if (!diag.warn) return;
  if (reported.has(key)) return;
  if (reported.size >= REPORTED_MAX) reported.clear();
  reported.add(key);
  console.error(build === undefined ? key : build());
}
