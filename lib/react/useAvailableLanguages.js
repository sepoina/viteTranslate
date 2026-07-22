import { languages, defaultLanguage } from "virtual:vitetranslate/languages";

const tags = [defaultLanguage, ...Object.keys(languages).filter((tag) => tag !== defaultLanguage)];

/**
 * Elenco delle lingue trovate in localeDir (tag BCP 47), disponibile in sincrono
 * senza dover caricare i singoli file: utile per popolare selettori di lingua.
 *
 * @returns {{ tags: string[], defaultLanguage: string }}
 */
export function useAvailableLanguages() {
  return { tags, defaultLanguage };
}
