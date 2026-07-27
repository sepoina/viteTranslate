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

  export const languages: Record<string, () => Promise<{ default: TranslationTable }>>;
  export const sourceLanguage: string;
  /**
   * Tabella della lingua sorgente, importata staticamente come fallback universale; null
   * solo se il file della sourceLanguage non è presente in localeDir.
   */
  export const sourceTable: TranslationTable | null;
  /**
   * Tabelle precaricate staticamente (config preloadedLanguages, più la sourceLanguage
   * sempre inclusa), per il primo render sincrono senza flash; chiave = tag BCP 47.
   */
  export const preloadedTables: Record<string, TranslationTable>;
  /** Nome nativo di ogni lingua (autonimo), calcolato a sync-time; chiave = tag BCP 47. */
  export const languageNames: Record<string, string>;
}
