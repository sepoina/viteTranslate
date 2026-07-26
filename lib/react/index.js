import TranslateContainer from "./TranslateContainer.jsx";
import Translate from "./Translate.jsx";
import { useTranslateToString } from "./useTranslateToString.js";
import { useTranslateLanguage } from "./useTranslateLanguage.js";
import { basicHtmlToNodes } from "./basicHtmlToNodes.jsx";

// TranslateContext non è esportato di proposito: il valore del context contiene la tabella
// interna delle traduzioni, che deve restare libera di cambiare forma. Lingua corrente,
// elenco delle lingue e cambio lingua passano tutti da useTranslateLanguage().
export {
  TranslateContainer, Translate, useTranslateToString, useTranslateLanguage, basicHtmlToNodes
};
