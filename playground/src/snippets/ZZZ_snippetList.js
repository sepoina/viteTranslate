import BasicExample from "./BasicExample.jsx";
import basicCode from "./BasicExample.jsx?raw";
import DynamicExample from "./DynamicExample.jsx";
import dynamicCode from "./DynamicExample.jsx?raw";
import PlaceholderExample from "./PlaceholderExample.jsx";
import placeholderCode from "./PlaceholderExample.jsx?raw";
import LanguageSwitchExample from "./LanguageSwitchExample.jsx";
import languageSwitchCode from "./LanguageSwitchExample.jsx?raw";

const snippetList = [
  {
    id: "cambio-lingua",
    title: "_%_Cambio lingua_%_",
    description:
      "_%_L'hook useAvailableLanguages() espone i tag BCP 47 trovati in localeDir (nessun caricamento, solo l'elenco); il contesto di TranslateContainer espone id (lingua corrente), debug (passato a TranslateContainer) e proposeNewLanguage per richiedere il caricamento pigro di un'altra lingua a runtime, con callback onStart/onDone/onError per seguirne l'esito._%_",
    code: languageSwitchCode,
    Example: LanguageSwitchExample,
  },
  {
    id: "traduzione-statica",
    title: "_%_Traduzione statica_%_",
    // { t, a } invece di stringa semplice: l'esempio letterale del marcatore
    // vive nell'argomento "a", una stringa opaca al babel plugin (non inizia
    // con _%_) che emitNodes interpola con %s solo a runtime — così l'intera
    // frase resta un unico blocco traducibile, senza rompere l'estrazione.
    description: {
      t: "_%_Il componente <code>&lt;Translate&gt;</code> avvolge il testo statico marcato con %s, sostituito in build-time con l'id di traduzione e il relativo fallback._%_",
      a: ["<code>_%_testo_%_</code>"],
    },
    code: basicCode,
    Example: BasicExample,
  },
  {
    id: "traduzione-dinamica",
    title: "_%_Traduzione dinamica_%_",
    description: "_%_Formato t={[testo, arg1, arg2, ...]} per interpolare variabili nel testo tradotto._%_",
    code: dynamicCode,
    Example: DynamicExample,
  },
  {
    id: "placeholder-e-attributi",
    title: "_%_Placeholder e attributi_%_",
    description:
      "_%_<code>&lt;Translate&gt;</code> restituisce nodi React: non può essere usato in attributi HTML che richiedono una stringa semplice, come <code>placeholder</code>, <code>aria-label</code> o <code>title</code>. In questi casi serve l'hook <code>useTranslateString()</code>, che risolve la stessa traduzione ma restituisce una stringa primitiva. Questi attributi non sono visibili come testo a schermo: per vederli tradotti ispeziona l'elemento con F12._%_",
    code: placeholderCode,
    Example: PlaceholderExample,
  },
];

export default snippetList;
