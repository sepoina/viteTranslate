// Architettura d'insieme: doc/structure.md § "Distribuzione del pacchetto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/// <reference path="./virtual.d.ts" />

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
