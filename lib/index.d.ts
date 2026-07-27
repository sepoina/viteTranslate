/// <reference path="./virtual.d.ts" />

/** Opzioni di `vitetranslate(...)`, da registrare fra i `plugins` di vite.config. */
export interface VitetranslateOptions {
  /** Cartella con i file di lingua JS, relativa a `baseDir` (es. `"src/locale"`). */
  localeDir: string;
  /** Tag BCP 47 della lingua in cui sono scritte le stringhe sorgente (es. `"it-IT"`). */
  sourceLanguage: string;
  /**
   * Lingue incluse staticamente nel bundle iniziale, per un primo paint senza sospensione.
   * `sourceLanguage` è sempre precaricata, indipendentemente da questo elenco.
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

/** Opzioni del plugin Babel di estrazione, quando lo si usa fuori dal plugin Vite. */
export interface BabelTranslateOptions {
  /** Incorpora il testo originale nel marcatore compilato. Default: `true`. */
  includeFallback?: boolean;
  /** Tabella `id -> testo` da popolare; se assente ne viene usata una locale alla chiamata. */
  table?: Record<string, string>;
}

/**
 * Plugin Babel che riscrive `"_%_testo_%_"` in `"_<_id_/_testo_>_"` e accumula le stringhe
 * trovate in `options.table`. Legge il JSX ma non lo trasforma: chi lo usa deve abilitare i
 * parser plugin adatti al file (`jsx`, `typescript`).
 */
export function babelTranslate(api: any, options?: BabelTranslateOptions): {
  name?: string;
  visitor: Record<string, (path: any, state: any) => void>;
};
