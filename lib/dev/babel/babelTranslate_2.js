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

// Lunghezza minima di una stringa marcata: "_%__%_" (marcatore vuoto).
const MIN_MARKED_LENGTH = 6;
const OPEN = "_%_";
const CLOSE = "_%_";

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
  // Passata esplicitamente dal chiamante (cli.js la riusa tra i file di una stessa
  // scansione per accumulare tutte le stringhe trovate) invece di un globalThis
  // condiviso implicitamente: se non fornita, resta locale a questa singola chiamata.
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
 * Estrae il testo su cui lavorare da un nodo, nella forma specifica del suo tipo.
 *
 * - `StringLiteral`   -> `value` è già la stringa.
 * - `JSXText`         -> `value` è il testo **grezzo**, virgolette di JSX comprese: un
 *   marcatore scritto su una riga a sé (`<Translate>\n  _%_ciao_%_\n</Translate>`, cioè
 *   la formattazione normale) arriva qui con newline e indentazione attorno. Vanno tolti
 *   prima del confronto, altrimenti il nodo non viene mai riconosciuto. Sono gli stessi
 *   spazi che JSX scarterebbe comunque nel render.
 * - `TemplateElement` -> `value` è un oggetto `{ raw, cooked }`, non una stringa: leggere
 *   `value` direttamente faceva fallire il controllo di tipo e rendeva il visitor inerte.
 *   Un template con interpolazioni ha più quasi, e nessuno di essi apre *e* chiude il
 *   marcatore: restano correttamente esclusi.
 *
 * @returns {string | null} il testo marcato, o null se il nodo non è marcato
 */
function markedTextOf(node) {
  let value;
  if (node.type === "TemplateElement") value = node.value.cooked ?? node.value.raw;
  else if (node.type === "JSXText") value = typeof node.value === "string" ? node.value.trim() : null;
  else value = node.value;

  if (typeof value !== "string" || value.length < MIN_MARKED_LENGTH) return null;
  if (!(value.startsWith(OPEN) && value.endsWith(CLOSE))) return null;
  return value;
}

/**
 * ---------------------------------------------------------------------
 * LOGICA PER STRINGHE STATICHE
 * Trasforma "_%_testo_%_" in "_<_id_/_testo_>_" e lo salva nella tabella.
 * ---------------------------------------------------------------------
 */
function staticStringToTranslateTable(p, state, t, includeFallback, table) {
  const nodeValue = markedTextOf(p.node);
  if (nodeValue === null) return;

  // Estrae il contenuto rimuovendo i marcatori (i primi 3 e gli ultimi 3 caratteri)
  const strToAdd = nodeValue.slice(3, -3);

  // Aggiunge alla tabella e ottiene l'ID univoco
  const data_translate = addToTable(strToAdd, state, table);

  // Il nodo è marcato da un capo all'altro, quindi il marcatore compilato è l'intero
  // valore nuovo: non serve una replace sul valore vecchio. Quella che c'era interpretava
  // anche i pattern `$&` / `$1` di String.replace, corrompendo un testo che li contenesse.
  const newValue = includeFallback
    ? `_<_${data_translate}_/_${strToAdd}_>_`
    : `_<_${data_translate}_>_`;

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

// Escape dei soli caratteri che dentro un template literal non stanno per se stessi.
function escapeTemplateRaw(value) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
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

  // Due testi diversi che collidono sullo stesso id si sovrascriverebbero a vicenda, e uno
  // dei due sparirebbe dalla tabella senza che nulla lo segnali: la traduzione dell'altro
  // comparirebbe al suo posto. È raro (32 bit, nello spazio di un solo nome file) ma va
  // detto, perché a schermo si vedrebbe solo il testo sbagliato.
  const previous = table[data_translate];
  if (previous !== undefined && previous !== strToAdd) {
    console.warn(
      `[vitetranslate] collisione di id "${data_translate}" in "${filename}": ` +
      `"${previous}" e "${strToAdd}" producono la stessa chiave. ` +
      `Modifica leggermente uno dei due testi (o rinomina il file) per separarli.`
    );
  }

  // Salva nella tabella: ID -> Testo Originale
  table[data_translate] = strToAdd;

  return data_translate; // Ritorna l'ID da inserire nel codice
}
