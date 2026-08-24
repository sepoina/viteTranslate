// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 6.

/**
 * Legge un file di lingua. È un sottoinsieme STRETTO di YAML, non YAML.
 *
 * La differenza è il motivo per cui questo file esiste invece di una dipendenza. Il formato
 * che scriviamo è una mappa piatta di stringhe, e YAML pieno su quel contenuto sbaglia in
 * silenzio: uno scalare non quotato che comincia per `%` è un errore di sintassi (e `%s` è
 * proprio il nostro segnaposto), `prezzo 5 # sconto` si tronca a `prezzo 5`, `1.20` diventa
 * il numero 1.2, `null` come testo tradotto si confonde con il null "da tradurre". Sono
 * esattamente i valori che un traduttore scrive.
 *
 * Quindi: si accetta poco, e ciò che si accetta ha in YAML lo stesso identico significato che
 * ha qui. Un file scritto da noi è YAML valido — l'editor lo colora, `yaml.load` lo legge
 * uguale — ma non ogni YAML valido è un file di lingua, e le righe che non rientrano nel
 * sottoinsieme diventano un errore con il numero di riga invece di un valore plausibile.
 *
 * Le forme ammesse, una per riga, tutte a colonna 0:
 *
 *     # commento                    riga intera, l'intestazione generata è fatta così
 *     Chiave_abc: "testo"           JSON.parse del valore: gli escape di JSON sono gli
 *                                   stessi di uno scalare YAML double-quoted
 *     Chiave_abc: null              non ancora tradotta
 *     Chiave_abc:                   idem: è ciò che resta cancellando il null
 *     __builder__: {"v":1,...}      solo questa chiave può contenere un oggetto (JSON stretto)
 *
 * Niente scalari non quotati, niente commenti in coda a una riga con valore, niente
 * indentazione: tre cose che YAML accetterebbe e che qui cambierebbero il testo senza dirlo.
 *
 * @param {string} text - contenuto del file
 * @param {string} [filePath] - solo per i messaggi d'errore
 * @returns {object | undefined} la tabella, o `undefined` se il file è vuoto (che è il modo
 *   documentato per aggiungere una lingua nuova: file vuoto + comando di sync)
 * @throws {Error} `line N: ...` sulla prima riga che non rientra nel formato, e su un file
 *   che ha contenuto ma nessuna voce — quello NON è una lingua nuova, è una lingua svuotata,
 *   e il chiamante deve trattarlo come tale (backup, non ripopolamento silenzioso).
 */

// La chiave è generata da markerCore.sanitizeName (`Basename_checksum`, con `Basename`
// ridotto a [A-Za-z0-9] e una cifra iniziale preceduta da "n"), più `__builder__`. I due punti
// non possono farne parte: è questo che rende sicuro tagliare la riga al primo ":".
// Trattino e punto restano ammessi in lettura per i file scritti da versioni precedenti.
//
// La forma di una riga è questa regex, ed è la definizione leggibile del formato. Il ciclo
// sotto non la applica intera — su una tabella grande sono decine di migliaia di `exec` che
// allocano un array di gruppi ciascuno — ma ne usa la metà che conta (KEY_RE) e replica il
// resto con confronti sui codici dei caratteri. Le due cose devono restare d'accordo:
// languageFileIO.test.mjs confronta cosa accettano, riga per riga.
export const ENTRY_RE = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:[ \t]+(.*))?$/;
const BUILDER_KEY = "__builder__";

const SPACE = 32, TAB = 9, HASH = 35, QUOTE = 34, BRACE = 123;
// Un carattere di controllo dentro le virgolette: YAML lo accetterebbe, JSON.parse no, e la
// scorciatoia sotto deve rifiutarlo per restare identica alla strada lunga. Regex e non ciclo:
// su una tabella grande è una scansione di centinaia di migliaia di caratteri, e il motore la
// fa in nativo.
const CONTROL_RE = /[\u0000-\u001f]/;

// La sola chiave, estratta da ENTRY_RE: si prova sulla sottostringa già affettata, che serve
// comunque subito dopo.
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export default function parseLanguageFile(text, filePath) {
  // Il BOM è invisibile in editor ma farebbe fallire la prima chiave (o il primo commento)
  // con un messaggio incomprensibile.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  // File vuoto: è una lingua nuova, non un errore. Va distinto dal file che ha contenuto ma
  // nessuna voce (vedi in fondo), che è invece una lingua svuotata.
  if (clean.trim() === "") return undefined;

  const table = {};
  // CRLF: i file di lingua si editano su Windows quanto altrove, e un "\r" rimasto in coda
  // finirebbe dentro l'ultimo valore o farebbe fallire JSON.parse.
  const lines = clean.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const at = (msg) => new Error(`line ${i + 1}: ${msg}`);

    const len = line.length;
    if (len === 0) continue;
    const first = line.charCodeAt(0);

    // Riga che comincia con uno spazio: un commento indentato passa, una voce no. È l'unico
    // punto in cui vale la pena allocare, e capita una volta ogni file.
    if (first === SPACE || first === TAB) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.charCodeAt(0) === HASH) continue;
      throw at(`indented line — every entry starts at column 0 (found "${preview(line)}")`);
    }
    if (first === HASH) continue;

    const colon = line.indexOf(":");
    const key = colon < 1 ? "" : line.slice(0, colon);
    if (!KEY_RE.test(key)) {
      throw at(`not an entry — expected 'Key_abc: "text"', 'Key_abc: null' or a "#" comment (found "${preview(line)}")`);
    }

    let v = colon + 1;
    if (v < len) {
      const after = line.charCodeAt(v);
      if (after !== SPACE && after !== TAB) {
        throw at(`missing space after ":" — write 'Key_abc: "text"', not 'Key_abc:"text"'`);
      }
      while (v < len && (line.charCodeAt(v) === SPACE || line.charCodeAt(v) === TAB)) v++;
    }

    // `__proto__` non può uscire da sanitizeName, ma un file scritto a mano sì: assegnarlo su
    // un oggetto normale non crea una proprietà, e la voce sparirebbe in silenzio.
    if (key === "__proto__") throw at(`"__proto__" cannot be used as a key`);
    if (Object.hasOwn(table, key)) {
      const prima = lines.findIndex((l) => l.startsWith(`${key}:`)) + 1;
      throw at(`duplicate key "${key}", already set at line ${prima}`);
    }

    // Solo la coda: uno spazio finale non è parte del testo, e il testo vero è quotato.
    const raw = v >= len ? "" : line.slice(v).trimEnd();

    // "Chiave:" senza valore è ciò che resta quando il traduttore cancella il `null` invece
    // di sostituirlo. YAML la legge come null e noi facciamo lo stesso: accettarla non allarga
    // il formato e risparmia un errore per qualcosa che non è un errore.
    if (raw === "" || raw === "null") {
      table[key] = null;
      continue;
    }

    if (raw.charCodeAt(0) === QUOTE) {
      // Gli escape di JSON (\n \t \" \\ \uXXXX) sono un sottoinsieme di quelli di uno scalare
      // YAML double-quoted, con lo stesso significato: il round-trip fra i due parser non può
      // divergere finché il valore lo scrive JSON.stringify.
      //
      // Scorciatoia per il caso normale — nessun escape, nessuna virgoletta interna, nessun
      // carattere di controllo: lì `slice` restituisce esattamente ciò che restituirebbe
      // `JSON.parse`, e quelle tre condizioni sono precisamente ciò che rende le due cose la
      // stessa cosa. Tutto il resto resta a `JSON.parse`, che sa anche dire perché non va.
      if (raw.indexOf('"', 1) === raw.length - 1 && raw.indexOf("\\") === -1 && !CONTROL_RE.test(raw)) {
        table[key] = raw.slice(1, -1);
        continue;
      }
      try {
        const value = JSON.parse(raw);
        if (typeof value !== "string") throw new Error("not a string");
        table[key] = value;
      } catch (e) {
        throw at(`invalid quoted text for "${key}" (${e.message}) — a "\\" and a '"' inside the text must be escaped, and nothing may follow the closing quote`);
      }
      continue;
    }

    if (raw.charCodeAt(0) === BRACE) {
      if (key !== BUILDER_KEY) throw at(`only "${BUILDER_KEY}" can hold an object; "${key}" must be a quoted text`);
      try {
        table[key] = JSON.parse(raw);
      } catch (e) {
        throw at(`invalid "${BUILDER_KEY}" (${e.message}) — it is generated data in strict JSON, do not edit it by hand`);
      }
      continue;
    }

    throw at(`unquoted value for "${key}" — wrap the text in double quotes: '${key}: "${preview(raw)}"'`);
  }

  // Contenuto presente ma nessuna voce: NON è una lingua nuova. È un file svuotato (righe
  // cancellate lasciando l'intestazione), e trattarlo come nuovo vorrebbe dire ripopolarlo di
  // null senza mettere al sicuro quello che c'era. Chi chiama lo distingue dal file vuoto
  // guardando il testo, e ne fa un backup.
  if (Object.keys(table).length === 0) {
    throw new Error(`no entry found: the file has content but not a single key`);
  }

  return table;
}

/**
 * "incomplete: false" viene omesso dal file su disco (vedi serializeLanguageFile.js): qui si
 * ripristina il valore di default, così ogni chiamante vede sempre il campo valorizzato a
 * booleano, sia che il file lo dichiari esplicitamente sia che lo ometta.
 */
export function normalizeBuilder(table) {
  if (table?.[BUILDER_KEY] && table[BUILDER_KEY].incomplete === undefined) {
    table[BUILDER_KEY].incomplete = false;
  }
  return table;
}

/** Un pezzo di riga da mostrare nel messaggio d'errore, senza allagare il terminale. */
const preview = (line) => {
  const short = line.trim().slice(0, 40);
  return short.length < line.trim().length ? `${short}…` : short;
};
