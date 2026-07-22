import pathCmd from "path";

// FNV-1a 32-bit hash (from the 'fnv1a' npm package, inlined to drop the dependency).
// The `(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)` sum is the FNV prime (0x01000193) multiplication
// decomposed into shifts, avoiding a 32-bit overflow-prone `h * prime`.
const FNV_OFFSET_BASIS = 0x811c9dc5;
function hash(s, h = FNV_OFFSET_BASIS) {
  const l = s.length;
  for (let i = 0; i < l; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

/**
 * Funzione principale del Plugin Babel.
 * @param {object} api - L'oggetto API di Babel.
 * @returns {object} - La configurazione del visitor.
 */
export default (api, options = {}) => {
  const { types: t } = api;
  // In dev il fallback resta embeddato nel marcatore compilato (_<_id_/_fallback_>_):
  // serve a vedere subito il testo anche prima che una build abbia sincronizzato i JSON.
  // In produzione si può omettere (_<_id_>_): il comando di prepare-translation-table
  // gira sempre prima della build, quindi la lingua base è già garantita completa.
  const includeFallback = options.includeFallback !== false;
  // Tabella id -> testo originale, popolata come side effect del transform.
  // Passata esplicitamente dal chiamante (cli.js la riusa tra i file di una stessa
  // scansione per accumulare tutte le stringhe trovate) invece di un globalThis
  // condiviso implicitamente: se non fornita, resta locale a questa singola chiamata.
  const table = options.table ?? {};

  return {
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
  // Verifica preliminare: deve esistere il valore
  if (!p?.node?.value) return;

  const nodeValue = p.node.value;

  // Deve essere una stringa di almeno 6 caratteri
  // (minimo "_%__%_" = 6 chars)
  if (typeof nodeValue !== "string" || nodeValue.length < 6) return;

  // Deve iniziare e finire con il marcatore speciale
  // Nota: startsWith/endsWith funzionano anche con \n nel mezzo
  if (!(nodeValue.startsWith("_%_") && nodeValue.endsWith("_%_"))) return;

  // Estrae il contenuto rimuovendo i marcatori (i primi 3 e gli ultimi 3 caratteri)
  const strToAdd = nodeValue.slice(3, -3);

  // Aggiunge alla tabella e ottiene l'ID univoco
  const data_translate = addToTable(strToAdd, state, table);

  // Calcola il nuovo valore
  const newValue = getReplacedForTranslate(nodeValue, data_translate, strToAdd, includeFallback);

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
    p.replaceWith(t.jsxText(newValue));
  } else if (nodeType === "TemplateElement") {
    p.replaceWith(t.templateElement({ raw: newValue, cooked: newValue }));
  }

  // Evita che Babel rivisiti il nodo appena creato
  p.skip();
}

/**
 * Esegue il replace della stringa usando una Regex corretta per multiline.
 * 
 * @param {string} value - La stringa completa originale (es. "_%_ciao\nmondo_%_")
 * @param {string} data_translate - L'ID calcolato (es. "file_hash")
 * @param {string} text - Il testo pulito (es. "ciao\nmondo")
 */
function getReplacedForTranslate(value, data_translate, text, includeFallback) {
  const newString = includeFallback
    ? `_<_${data_translate}_/_${text}_>_`
    : `_<_${data_translate}_>_`;

  // -------------------------------------------------------------
  // FIX BUG RITORNO A CAPO (\n):
  // La vecchia regex /_%_(.*?)_%_/ usava il punto (.), che NON cattura \n.
  // La nuova regex /_%_([\s\S]*?)_%_/ usa [\s\S] che cattura TUTTO.
  // -------------------------------------------------------------
  return value.replace(/_%_([\s\S]*?)_%_/, newString);
}

/**
 * ---------------------------------------------------------------------
 * HELPER: Gestione Tabella Traduzioni
 * ---------------------------------------------------------------------
 */
function addToTable(strToAdd, state, table) {
  // Recupera il nome del file corrente dal contesto di Babel (state)
  // Usa pathCmd come richiesto
  const filename = state.filename || "unknown";
  const nameFile = pathCmd.parse(filename).name;

  // Calcola l'hash FNV-1a (inline in cima al file)
  // Nota: converte in base 36 per accorciare la stringa
  const hex = hash(strToAdd).toString(36);

  // Crea l'ID univoco: nomefile_hash
  const data_translate = `${nameFile}_${hex}`;

  // Salva nella tabella: ID -> Testo Originale
  table[data_translate] = strToAdd;

  return data_translate; // Ritorna l'ID da inserire nel codice
}