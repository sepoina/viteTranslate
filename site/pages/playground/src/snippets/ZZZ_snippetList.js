import { createElement } from "react";
import BasicExample from "./BasicExample.jsx";
import basicCode from "./BasicExample.jsx?raw";
import DynamicExample from "./DynamicExample.jsx";
import dynamicCode from "./DynamicExample.jsx?raw";
import MarkupExample from "./MarkupExample.jsx";
import markupCode from "./MarkupExample.jsx?raw";
import PlaceholderExample from "./PlaceholderExample.jsx";
import placeholderCode from "./PlaceholderExample.jsx?raw";
import LanguageSwitchExample from "./LanguageSwitchExample.jsx";
import languageSwitchCode from "./LanguageSwitchExample.jsx?raw";
import PluralExample from "./PluralExample.jsx";
import pluralCode from "./PluralExample.jsx?raw";
import SelectExample from "./SelectExample.jsx";
import selectCode from "./SelectExample.jsx?raw";
import FormatExample from "./FormatExample.jsx";
import formatCode from "./FormatExample.jsx?raw";
import AutoWrapExample from "./AutoWrapExample.jsx";
import autoWrapCode from "./AutoWrapExample.jsx?raw";
import HtmlToNodesExample from "./HtmlToNodesExample.jsx";
import htmlToNodesCode from "./HtmlToNodesExample.jsx?raw";

// Il marcatore mostrato come esempio: un elemento e non la stringa "<code>…</code>", perché un
// argomento non è mai letto come HTML (React lo rende com'è, tag compresi). Il delimitatore è
// composto a runtime: scritto per intero verrebbe preso per un marcatore malformato.
const M = ["_", "%", "_"].join("");
export const MARKER_EXAMPLE = createElement("code", null, `${M}testo${M}`);

// Un esempio per voce: `id` è l'ancora pubblica (…/playground/#icu-plural), in inglese e mai
// tradotta — la documentazione ci punta, e i vecchi id in italiano restano validi tramite
// LEGACY_IDS in App.jsx. `file` è il nome mostrato sulla finestra del codice.
//
// Nelle descrizioni una graffa letterale si scrive &#123;: con una graffa vera il testo
// diventerebbe un messaggio ICU, e "&#123;0, plural, …}" un argomento da riempire.
const snippetList = [
  {
    id: "static-text",
    title: "_%_Traduzione statica_%_",
    // { t, a } invece di stringa semplice: l'esempio letterale del marcatore vive
    // nell'argomento, così l'intera frase resta un unico blocco traducibile.
    description: {
      t: "_%_Il componente <code>&lt;Translate&gt;</code> avvolge il testo statico marcato con %s, sostituito in build-time con l'id di traduzione e il relativo fallback._%_",
      a: [MARKER_EXAMPLE],
    },
    file: "BasicExample.jsx",
    code: basicCode,
    Example: BasicExample,
  },
  {
    id: "dynamic-text",
    title: "_%_Traduzione dinamica_%_",
    description: "_%_Formato t={[testo, arg1, arg2, ...]} per interpolare variabili nel testo tradotto._%_",
    file: "DynamicExample.jsx",
    code: dynamicCode,
    Example: DynamicExample,
  },
  {
    id: "markup",
    title: "_%_Markup e nodi React_%_",
    description:
      "_%_Dentro il marcatore vale un piccolo dialetto HTML (<code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;code&gt;</code>, <code>&lt;br&gt;</code>…), compilato in build: nessun parser nel browser, nessun attributo che passi. Un argomento può essere un nodo React, per esempio un link: React lo rende come qualunque altro figlio, mai come HTML._%_",
    file: "MarkupExample.jsx",
    code: markupCode,
    Example: MarkupExample,
  },
  {
    id: "attributes",
    title: "_%_Placeholder e attributi_%_",
    description:
      "_%_<code>&lt;Translate&gt;</code> restituisce nodi React: non può essere usato in attributi HTML che richiedono una stringa semplice, come <code>placeholder</code>, <code>aria-label</code> o <code>title</code>. In questi casi serve l'hook <code>useTranslateToString()</code>, che risolve la stessa traduzione ma restituisce una stringa primitiva. Questi attributi non sono visibili come testo a schermo: per vederli tradotti ispeziona l'elemento con F12._%_",
    file: "PlaceholderExample.jsx",
    code: placeholderCode,
    Example: PlaceholderExample,
  },
  {
    id: "language-switch",
    title: "_%_Cambio lingua_%_",
    description:
      "_%_L'hook useTranslateLanguage() espone in un colpo solo la lingua corrente (id), i tag BCP 47 trovati in localeDir (nessun caricamento, solo l'elenco), il flag debug e proposeNewLanguage per richiedere il caricamento pigro di un'altra lingua a runtime, con callback onStart/onDone/onError per seguirne l'esito._%_",
    file: "LanguageSwitchExample.jsx",
    code: languageSwitchCode,
    Example: LanguageSwitchExample,
  },
  {
    id: "icu-plural",
    title: "_%_Plurali e ordinali (ICU)_%_",
    description:
      "_%_Con ICU il plurale lo decide la lingua: <code>&#123;0, plural, …}</code> sceglie il ramo giusto per ogni numero, e <code>#</code> è il numero stesso, già formattato. Ogni lingua ha le sue categorie: gli ordinali italiani distinguono “l’8º” da “il 7º”, l’inglese ne vuole quattro (1st, 2nd, 3rd, 4th)._%_",
    file: "PluralExample.jsx",
    code: pluralCode,
    Example: PluralExample,
  },
  {
    id: "icu-select",
    title: "_%_Select e argomenti con nome (ICU)_%_",
    description:
      "_%_<code>select</code> sceglie un ramo per chiave; gli argomenti con nome (<code>&#123;name}</code>) arrivano in un oggetto, <code>a=&#123;&#123; name, gender }}</code>. Chi traduce può spostarli dove vuole la sua grammatica, ma il nome resta lo stesso in ogni lingua._%_",
    file: "SelectExample.jsx",
    code: selectCode,
    Example: SelectExample,
  },
  {
    id: "icu-format",
    title: "_%_Numeri, valute e date (ICU)_%_",
    description:
      "_%_Numeri, valute, date e ore nel formato della lingua corrente, senza librerie: cambia lingua e guarda separatori e nomi dei giorni. Il fuso orario si fissa con la prop <code>timeZone</code> di <code>TranslateContainer</code>, o con l’opzione <code>icu.timeZone</code> del plugin._%_",
    file: "FormatExample.jsx",
    code: formatCode,
    Example: FormatExample,
  },
  {
    id: "autowrap",
    title: "_%_autoWrap: marcatori senza componente_%_",
    description:
      "_%_Con l’opzione <code>autoWrap</code> accesa basta marcare il testo JSX o l’attributo di un tag HTML: la chiamata di traduzione la aggiunge il plugin, niente <code>&lt;Translate&gt;</code> e niente <code>ts()</code>. I casi che non copre sono nella pagina dei casi limite._%_",
    file: "AutoWrapExample.jsx",
    code: autoWrapCode,
    Example: AutoWrapExample,
  },
  {
    id: "html-to-nodes",
    title: "_%_HTML da fuori: basicHtmlToNodes()_%_",
    description:
      "_%_Lo stesso dialetto HTML, per un testo che non passa da una tabella, come la risposta di un server: i tag ammessi diventano nodi React, il resto è sciolto o scartato. Niente <code>dangerouslySetInnerHTML</code>, e l’<code>onerror</code> dell’immagine non parte._%_",
    file: "HtmlToNodesExample.jsx",
    code: htmlToNodesCode,
    Example: HtmlToNodesExample,
  },
];

export default snippetList;
