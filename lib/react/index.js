import TranslateContainer from "./TranslateContainer.jsx";
import Translate from "./Translate.jsx";
import { useTranslateToString } from "./useTranslateToString.js";
import { useTranslateLanguage } from "./useTranslateLanguage.js";
import { basicHtmlToNodes } from "./basicHtmlToNodes.jsx";
// Letto a build time (bundler risolve il JSON e lo inlinea come stringa): niente fs a
// runtime nel bundle browser. Permette a chi consuma la libreria di mostrare la versione
// installata senza doverla duplicare a mano (es. nel footer di un playground/demo).
import { version } from "../../package.json" with { type: "json" };

// TranslateContext non è esportato di proposito: il valore del context contiene la tabella
// interna delle traduzioni, che deve restare libera di cambiare forma. Lingua corrente,
// elenco delle lingue e cambio lingua passano tutti da useTranslateLanguage().
export {
  TranslateContainer, Translate, useTranslateToString, useTranslateLanguage, basicHtmlToNodes,
  version,
};
