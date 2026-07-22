declare module '@sepoina/vitetranslate';
declare module '@sepoina/vitetranslate/react';

// Modulo virtuale generato da vitetranslate: elenco delle lingue trovate in
// localeDir, ciascuna caricabile pigramente via import() dinamico.
declare module 'virtual:vitetranslate/languages' {
  export const languages: Record<string, () => Promise<{ default: Record<string, string> }>>;
  export const defaultLanguage: string;
}
