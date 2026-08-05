// Architettura d'insieme: doc/structure.md § "Distribuzione del pacchetto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/// <reference path="./virtual.d.ts" />

/**
 * Cosa si vede a schermo quando una stringa non arriva dove doveva.
 *
 * I primi quattro sono diagnostiche. Tre di essi sono prefissi davanti al testo, e vale il più
 * grave e uno solo: malformato, poi non tradotto qui, poi non tradotto altrove. `badData` non
 * ha un testo davanti a cui stare — è il caso in cui testo non ce n'è — e non compete con gli
 * altri. Ognuno si spegne da solo passando `""` o `false`.
 *
 * Questi nomi sono anche quelli che il runtime legge dal modulo virtuale: la risoluzione a
 * build time copia e spegne, non rinomina.
 */
export interface ErrorSolveMarks {
  /**
   * Nella posizione del testo è arrivato un valore che testo non è e non lo diventerà: una
   * funzione, un simbolo, un elemento React nel primo posto della tupla. Niente da salvare,
   * quindi il glifo non precede un testo — è tutto ciò che si rende, seguito dal nome di ciò
   * che si è trovato: `🚫[func]`, `🚫[symbol]`, `🚫[badDom]`. Spento, non si rende niente.
   * Default: `"🚫"`.
   */
  badData?: string | false;
  /**
   * Testo che la traduzione non ha mai visto (un `_%_..._%_` sfuggito al transform, o un
   * valore che marcato non è mai stato) e prop incompatibili fra loro. Default: `"‼️"`.
   */
  malformed?: string | false;
  /**
   * La lingua corrente non ha una traduzione per questa voce: a schermo c'è il testo della
   * lingua sorgente. Default: `"🔸"`.
   */
  untranslated?: string | false;
  /**
   * Tradotta qui, ma assente in almeno un'altra lingua del progetto. Default: `"🔹"`.
   */
  notFullyTranslated?: string | false;
  /**
   * Segnaposto `%s` rimasto senza valore. **Non** è una diagnostica ma una resa normale:
   * vale in sviluppo e in build, e `markOnlyDev` non lo tocca. Default: `"⁇"`.
   */
  absentDataInArray?: string;
}

/**
 * Cosa succede quando una stringa non arriva dove doveva: un testo che nessuno ha marcato,
 * prop incompatibili fra loro, una voce senza traduzione.
 *
 * Due domande separate: `mark` è **cosa** si vede, il resto è **quando** — a schermo con
 * `markOnlyDev`, in console con `warningDev` / `warningBuild`.
 */
export interface ErrorSolveOptions {
  /** I glifi mostrati a schermo. Ogni campo omesso resta al proprio default. */
  mark?: ErrorSolveMarks;
  /**
   * In build nessun mark diagnostico a schermo: si mostra il fallback e basta. Non tocca
   * `mark.absentDataInArray`, che diagnostica non è. Default: `true`.
   */
  markOnlyDev?: boolean;
  /** Output console del runtime in sviluppo. Default: `true`. */
  warningDev?: boolean;
  /**
   * Output console del runtime in produzione. Default: `false`.
   *
   * Governa **tutto** ciò che la libreria stampa nel browser, comprese le segnalazioni su
   * lingua iniziale non precaricata, tag inesistente e chunk non caricato: con il default
   * un'app pubblicata tace del tutto. I messaggi del plugin (a build time, prefissati
   * `[vitetranslate]`) non passano di qui.
   */
  warningBuild?: boolean;
}

/** Opzioni di `vitetranslate(...)`, da registrare fra i `plugins` di vite.config. */
export interface VitetranslateOptions {
  /** Cartella con i file di lingua JS, relativa a `baseDir` (es. `"src/locale"`). */
  localeDir: string;
  /** Tag BCP 47 della lingua in cui sono scritte le stringhe sorgente (es. `"it-IT"`). */
  sourceLanguage: string;
  /**
   * Lingue incluse staticamente nel bundle iniziale, per un primo paint senza sospensione.
   * In sviluppo `sourceLanguage` è precaricata comunque; in build solo se questo elenco è
   * vuoto (ogni tabella compilata è autonoma, quindi spedirla sarebbe una copia in più).
   * La prima della lista è la lingua iniziale di default di `TranslateContainer`.
   */
  preloadedLanguages?: string[];
  /** Radice del progetto usata per risolvere `localeDir` e `srcDir`. Default: `process.cwd()`. */
  baseDir?: string;
  /** Cartella dei sorgenti scansionata dalla CLI. Default: `"src"`. */
  srcDir?: string;
  /**
   * Incorpora il testo originale come fallback nel marcatore compilato.
   * Default: `true` in sviluppo, `false` in produzione (risolto da `configResolved`).
   */
  includeFallback?: boolean;
  /**
   * Diagnostica a schermo e in console per le stringhe che non arrivano dove dovevano.
   * Ogni campo è facoltativo; omettere l'opzione lascia tutti i default.
   */
  errorSolve?: ErrorSolveOptions;
}

/**
 * Plugin Vite: estrae i marcatori `_%_..._%_`, compila i file di lingua e serve il modulo
 * virtuale `virtual:vitetranslate/languages`. Restituisce **due** plugin, da inserire così
 * com'è nell'array `plugins` (Vite appiattisce gli array annidati).
 *
 * Il tipo di ritorno è volutamente largo: `Plugin` di Vite non è importabile qui, perché
 * `vite` è una peer dependency opzionale e il tipo non esisterebbe per chi usa solo il
 * runtime React. Le opzioni, che sono la parte che vale la pena controllare, sono tipate.
 */
export function vitetranslate(options: VitetranslateOptions): any[];

// `babelTranslate` era esportato fino alla 2.1.4: un plugin Babel che faceva la stessa
// estrazione fuori dal plugin Vite. Nessun percorso della libreria lo usava più (l'estrazione
// è passata a un parse + splice, molto più rapido) e non è mai stato documentato. Ora vive
// solo come implementazione di riferimento nei test, dove serve a dimostrare che quella
// veloce è corretta.
