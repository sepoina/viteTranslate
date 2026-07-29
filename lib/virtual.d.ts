// Architettura d'insieme: doc/structure.md § "Fase 3 — Il modulo virtuale e il code splitting".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

// Modulo virtuale generato da vitetranslate: elenco delle lingue trovate in
// localeDir, ciascuna caricabile pigramente via import() dinamico.
//
// Questo file non ha import/export di primo livello: è di proposito, così le dichiarazioni
// qui dentro sono ambientali (globali) invece di essere lette come augmentation di un
// modulo — che TypeScript rifiuterebbe, non riuscendo a risolvere lo specifier "virtual:".
// Viene tirato dentro dai `/// <reference>` di index.d.ts e react.d.ts.

declare module 'virtual:vitetranslate/languages' {
  /**
   * Valore di una voce di tabella, nella forma prodotta dalla compilazione a build time:
   *  - `string`   — testo senza markup né segnaposto
   *  - `ReactNode`— markup senza segnaposto, costruito una volta sola al caricamento
   *  - funzione   — c'è almeno un `%s`: riceve gli argomenti e restituisce testo o nodi
   *  - `null`     — chiave non ancora tradotta in questa lingua
   *
   * La funzione tollera qualunque forma di argomenti, compresa la loro assenza.
   */
  export type TranslationEntry =
    | string
    | import('react').ReactNode
    | ((args?: unknown) => string | import('react').ReactNode)
    | null;

  /** Tabella di una lingua: le chiavi generate dal plugin, più i metadati `__builder__`. */
  export type TranslationTable = Record<string, TranslationEntry>;

  /** Una lingua trovata in localeDir, con tutto ciò che al runtime serve saperne. */
  export interface LanguageEntry {
    /** Nome nativo (autonimo), calcolato a sync-time e salvato in `__builder__`. */
    name: string;
    /**
     * Importata staticamente: la tabella è già in bundle e il primo render non sospende.
     *
     * Quali lingue lo siano dipende dall'ambiente — in sviluppo la `sourceLanguage` è sempre
     * inclusa, in build cede il posto a `preloadedLanguages` se ne è stata dichiarata almeno
     * una. Il flag viaggia nel bundle proprio per questo: è l'unico modo di sapere in
     * produzione ciò che in sviluppo risulterebbe sempre vero.
     */
    preloaded: boolean;
    /** La tabella, presente solo se `preloaded`. */
    table?: TranslationTable;
    /** Firma unica: Promise già risolta se `preloaded`, `import()` dinamico altrimenti. */
    load: () => Promise<{ default: TranslationTable }>;
  }

  /**
   * Tutte le lingue trovate in localeDir; chiave = tag BCP 47. Le precaricate compaiono per
   * prime, e la prima di esse è la lingua iniziale di default di `<TranslateContainer>` —
   * la stessa in sviluppo e in build.
   */
  export const languages: Record<string, LanguageEntry>;
  /** Tag della lingua in cui sono scritti i sorgenti. */
  export const sourceLanguage: string;
  /**
   * Tabella importata staticamente su cui il runtime può sempre contare: la `sourceLanguage`
   * quando è fra le precaricate, altrimenti la prima delle precaricate. L'identità non conta —
   * ogni tabella compilata porta con sé il testo della sorgente per le chiavi non tradotte.
   */
  export const fallbackTable: TranslationTable;
}
