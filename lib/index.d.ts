declare module '@sepoina/vitetranslate';
declare module '@sepoina/vitetranslate/react';

// Modulo virtuale generato da vitetranslate: elenco delle lingue trovate in
// localeDir, ciascuna caricabile pigramente via import() dinamico.
declare module 'virtual:vitetranslate/languages' {
  export const languages: Record<string, () => Promise<{ default: Record<string, string> }>>;
  export const sourceLanguage: string;
  // Tabella della lingua sorgente, importata staticamente come fallback universale; null
  // solo se il file della sourceLanguage non è presente in localeDir.
  export const sourceTable: Record<string, string> | null;
  // Tabelle precaricate staticamente (config preloadedLanguages, più la sourceLanguage
  // sempre inclusa), per il primo render sincrono senza flash; chiave = tag BCP 47.
  export const preloadedTables: Record<string, Record<string, string>>;
}
