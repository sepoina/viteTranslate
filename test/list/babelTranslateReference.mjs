import {
  markedTextOf, innerTextOf, compiledMarker, escapeTemplateRaw, registerMarker,
} from "../../lib/dev/babel/markerCore.js";

// IMPLEMENTAZIONE DI RIFERIMENTO — non fa parte della libreria e non viene distribuita.
//
// L'estrazione vera è lib/dev/babel/extractMarkers.js, che si ferma al parse e fa uno splice
// sul sorgente invece di ricostruirlo (5x più veloce, vedi il commento in testa a quel file).
// Questo file è il modo *ovvio* di fare la stessa cosa — sostituire i nodi e lasciare che
// Babel rigeneri — e serve a dimostrare che quello veloce è corretto: extractMarkers.test.mjs
// confronta i due su un corpus di casi limite, fino al JSX compilato.
//
// È l'unica prova indipendente che abbiamo. Un test che confrontasse extractMarkers solo con
// se stesso non direbbe nulla.
//
// Le regole dei marcatori — riconoscimento, hash, forma del marcatore compilato — arrivano da
// markerCore.js e sono condivise: qui resta solo la meccanica della riscrittura, che è
// esattamente ciò che il confronto deve mettere alla prova.
//
// Fino alla 2.1.4 era esportato dal pacchetto come `babelTranslate`. Non lo usava nessun
// percorso della libreria e non è mai stato documentato nel README: continuare a spedirlo
// significava tenere in vita una seconda implementazione a beneficio di nessuno.

/**
 * Funzione principale del Plugin Babel.
 * @param {object} api - L'oggetto API di Babel.
 * @returns {object} - La configurazione del visitor.
 */
export default (api, options = {}) => {
  const { types: t } = api;
  // In dev il fallback resta embeddato nel marcatore compilato (_<_id_/_fallback_>_):
  // serve a vedere subito il testo anche prima che una build abbia sincronizzato i file lingua.
  // In produzione si può omettere (_<_id_>_): il comando di prepare-translation-table
  // gira sempre prima della build, quindi la lingua base è già garantita completa.
  const includeFallback = options.includeFallback !== false;
  // Tabella id -> testo originale, popolata come side effect del transform.
  // Passata esplicitamente dal chiamante invece di un globalThis condiviso implicitamente:
  // se non fornita, resta locale a questa singola chiamata.
  const table = options.table ?? {};

  return {
    // Il plugin non trasforma il JSX né i tipi TypeScript: si limita a leggerli, quindi
    // dichiara le sole sintassi che deve poter *parsare*. È il chiamante (vite/cli) a
    // scegliere i parser plugin in base all'estensione del file; questo manifest serve a
    // chi usasse il plugin da solo in una config Babel propria.
    name: "vitetranslate-extract",

    visitor: {
      // ---------------------------------------------------------------
      // GESTIONE STRINGHE STATICHE
      // Intercetta stringhe nel codice tipo: "_%_testo da tradurre_%_"
      // Funziona su: StringLiteral ("..."), JSXText (>...<), TemplateElement (`...`)
      // Copre anche <Translate t="_%_testo_%_" /> e <Translate>_%_testo_%_</Translate>:
      // il testo va sempre marcato esplicitamente, non c'è auto-detect del testo semplice.
      // ---------------------------------------------------------------
      StringLiteral: (p, state) => staticStringToTranslateTable(p, state, t, includeFallback, table),
      JSXText: (p, state) => staticStringToTranslateTable(p, state, t, includeFallback, table),
      TemplateElement: (p, state) => staticStringToTranslateTable(p, state, t, includeFallback, table),
    },
  };
};

/**
 * ---------------------------------------------------------------------
 * LOGICA PER STRINGHE STATICHE
 * Trasforma "_%_testo_%_" in "_<_id_/_testo_>_" e lo salva nella tabella.
 * ---------------------------------------------------------------------
 */
function staticStringToTranslateTable(p, state, t, includeFallback, table) {
  const marked = markedTextOf(p.node);
  if (marked === null) return;

  const strToAdd = innerTextOf(marked);
  const data_translate = registerMarker(strToAdd, state.filename || "unknown", table);

  // Il nodo è marcato da un capo all'altro, quindi il marcatore compilato è l'intero
  // valore nuovo: non serve una replace sul valore vecchio. Quella che c'era interpretava
  // anche i pattern `$&` / `$1` di String.replace, corrompendo un testo che li contenesse.
  const newValue = compiledMarker(data_translate, strToAdd, includeFallback);

  // -----------------------------------------------------------------
  // Sostituzione con nodo nuovo (p.replaceWith) invece di mutazione in-place.
  // Babel traccia correttamente le source map quando il nodo viene sostituito,
  // evitando l'accumulo di offset errati nei file con molte traduzioni.
  // -----------------------------------------------------------------
  const nodeType = p.node.type;

  if (nodeType === "StringLiteral") {
    // -----------------------------------------------------------------
    // FIX ACCENTI NEGLI ATTRIBUTI JSX (es. t="_%_è_%_"):
    // Rigenerando lo StringLiteral, il generatore babel fa l'escape dei
    // caratteri non-ASCII (è -> \xE8). In un valore-attributo JSX il
    // backslash NON è un escape, quindi \xE8 verrebbe mostrato letteralmente.
    // Racchiudendo la stringa in un'espressione ({"..."}) il valore torna a
    // essere una stringa JS: gli escape vengono decodificati a runtime.
    // A runtime t="..." e t={"..."} sono equivalenti per il componente.
    // -----------------------------------------------------------------
    if (p.parent?.type === "JSXAttribute") {
      p.replaceWith(t.jsxExpressionContainer(t.stringLiteral(newValue)));
    } else {
      p.replaceWith(t.stringLiteral(newValue));
    }
  } else if (nodeType === "JSXText") {
    // Espressione, non JSXText: il marcatore compilato contiene un "<" letterale, che in un
    // nodo di testo JSX non è sintassi valida. Racchiuderlo in `{"..."}` lo tiene una
    // stringa JS a tutti gli effetti, ed è ciò che permette di lasciare il JSX intatto per
    // il plugin React del progetto invece di compilarlo qui (vedi vitetranslate.js).
    p.replaceWith(t.jsxExpressionContainer(t.stringLiteral(newValue)));
  } else if (nodeType === "TemplateElement") {
    // `raw` è il testo come apparirà fra i backtick: va ri-escapato, altrimenti un "\" o un
    // "`" nel testo tradotto cambierebbe il significato del template. `tail` va conservato:
    // perderlo trasformerebbe l'ultimo quasi in uno intermedio, generando codice non valido.
    p.replaceWith(t.templateElement({ raw: escapeTemplateRaw(newValue), cooked: newValue }, p.node.tail));
  }

  // Evita che Babel rivisiti il nodo appena creato
  p.skip();
}
