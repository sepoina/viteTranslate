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
 *     #  ⋮  TableVersion: 260905    l'UNICA riga di commento che il codice rilegge (vedi sotto)
 *     Chiave_abc: "testo"           JSON.parse del valore: gli escape di JSON sono gli
 *                                   stessi di uno scalare YAML double-quoted
 *     Chiave_abc: null              non ancora tradotta
 *     Chiave_abc:                   idem: è ciò che resta cancellando il null
 *
 * Niente oggetti su nessuna chiave, niente scalari non quotati, niente commenti in coda a una
 * riga con valore, niente indentazione: quattro cose che YAML accetterebbe e che qui
 * cambierebbero il testo (o il tipo) senza dirlo. Il tipo di un valore è sempre `string | null`,
 * senza eccezioni.
 *
 * @param {string} text - contenuto del file
 * @param {string} [filePath] - solo per i messaggi d'errore
 * @returns {{ table: object | undefined, meta: { tableVersion: number | null } }} `table` è
 *   `undefined` se il file è vuoto (che è il modo documentato per aggiungere una lingua nuova:
 *   file vuoto + comando di sync), altrimenti un oggetto — anche vuoto: zero voci non è più un
 *   errore di parse (vedi doc/structure.md § "Empty, emptied, unreadable"). `meta.tableVersion`
 *   è il numero letto dalla riga `TableVersion`, o dal portatore legacy `__builder__` se quella
 *   riga manca; `null` se nessuno dei due c'è.
 * @throws {Error} `line N: ...` sulla prima riga che non rientra nel formato.
 */

// La chiave è generata da markerCore.sanitizeName (`Basename_checksum`, con `Basename`
// ridotto a [A-Za-z0-9] e una cifra iniziale preceduta da "n"). I due punti non possono farne
// parte: è questo che rende sicuro tagliare la riga al primo ":". Trattino e punto restano
// ammessi in lettura per i file scritti da versioni precedenti, e così `__builder__`, il
// portatore legacy gestito più sotto.
//
// La forma di una riga è questa regex, ed è la definizione leggibile del formato. Il ciclo
// sotto non la applica intera — su una tabella grande sono decine di migliaia di `exec` che
// allocano un array di gruppi ciascuno — ma ne usa la metà che conta (KEY_RE) e replica il
// resto con confronti sui codici dei caratteri. Le due cose devono restare d'accordo:
// languageFileIO.test.mjs confronta cosa accettano, riga per riga.
export const ENTRY_RE = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:[ \t]+(.*))?$/;
const BUILDER_KEY = "__builder__";

// La riga di intestazione che porta la versione del formato. Ancorata al "#" di inizio riga, e
// fra il "#" e il token ammette SOLO caratteri di decorazione: un commento che nomini
// "TableVersion:" dentro una frase non deve diventare l'opcode.
const TABLE_VERSION_RE = /^#[ \t|.\-]*TableVersion:[ \t]*(\d+)[ \t]*$/;

const SPACE = 32, TAB = 9, HASH = 35, QUOTE = 34, BRACE = 123;

// Le chiavi che un oggetto normale ha GIÀ. Nessuna può uscire da sanitizeName — che produce
// `Basename_checksum` — ma un file scritto (o riordinato) a mano sì, e ciascuna rompe qualcosa
// di diverso e in silenzio:
//   `__proto__`  assegnarlo non crea una proprietà: la voce sparisce, e basta;
//   le altre     la creano, ma erano già "presenti" prima — e tutta la sincronizzazione decide
//                con `chiave in tabella`, che guarda anche il prototipo. Una chiave `toString`
//                in una sub-lingua non risulta mai in eccesso, quindi non viene mai tolta:
//                resta nel file per sempre, riscritta a ogni giro.
// Rifiutarle qui è l'unico punto in cui la cosa si vede ancora come una riga di un file.
const RESERVED_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));
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
  if (clean.trim() === "") return { table: undefined, meta: { tableVersion: null } };

  // Un file salvato in UTF-16 — il Blocco note di Windows alla voce "Unicode", un editor
  // configurato male — letto come UTF-8 diventa il testo giusto con un NUL fra un carattere e
  // l'altro. Senza questo controllo l'errore è "line 1: not an entry" seguito da mezzo file
  // illeggibile, e non c'è modo di indovinare che il problema è la codifica e non la sintassi.
  // Un NUL non può stare in un file scritto da noi: JSON.stringify lo scriverebbe "\u0000",
  // cioè sei caratteri stampabili.
  const nul = clean.indexOf("\u0000");
  if (nul !== -1) {
    const riga = clean.slice(0, nul).split("\n").length;
    throw new Error(
      `line ${riga}: not UTF-8 text (NUL byte found) — a language file is plain UTF-8; ` +
      `if you saved it as UTF-16 or UCS-2, save it again as UTF-8`
    );
  }

  const table = {};
  let tableVersion = null;
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
    if (first === HASH) {
      // Solo finché non si è trovata: le righe di commento di un file di lingua sono
      // l'intestazione più il separatore, quindi il costo è una manciata di exec per file.
      if (tableVersion === null) {
        const m = TABLE_VERSION_RE.exec(line);
        if (m) tableVersion = Number(m[1]);
      }
      continue;
    }

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

    if (RESERVED_KEYS.has(key)) throw at(`"${key}" cannot be used as a key: it is a name every object already has`);
    if (Object.hasOwn(table, key)) {
      const prima = lines.findIndex((l) => l.startsWith(`${key}:`)) + 1;
      throw at(`duplicate key "${key}", already set at line ${prima}`);
    }

    // Solo la coda: uno spazio finale non è parte del testo, e il testo vero è quotato.
    const raw = v >= len ? "" : line.slice(v).trimEnd();

    // Portatore legacy della 4.0.6 e precedenti: la versione stava in una voce della tabella. Si
    // legge per sapere con quale formato il file è stato scritto, poi si scarta — non è una chiave
    // di contenuto, e alla prossima riscrittura non esisterà più. Un valore illeggibile qui non è
    // un errore: vale "versione sconosciuta", che porta comunque alla riscrittura.
    if (key === BUILDER_KEY) {
      if (tableVersion === null && raw.charCodeAt(0) === BRACE) {
        try { tableVersion = Number(JSON.parse(raw)?.v) || null; } catch { /* versione sconosciuta */ }
      }
      continue;
    }

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

    throw at(`unquoted value for "${key}" — wrap the text in double quotes: '${key}: "${preview(raw)}"'`);
  }

  return { table, meta: { tableVersion } };
}

/**
 * Un pezzo di riga da mostrare nel messaggio d'errore, senza allagare il terminale.
 *
 * I caratteri di controllo vengono sostituiti prima di tutto: questo testo esce a schermo, e
 * arriva da un file che per definizione non è quello che ci aspettavamo. Una sequenza ANSI
 * lasciata passare non comparirebbe nel messaggio — lo ricolorerebbe, o cancellerebbe la riga
 * su cui il messaggio sta per essere scritto.
 */
const preview = (line) => {
  const pulita = line.trim().replace(/[\u0000-\u001f\u007f]/g, "·");
  const short = pulita.slice(0, 40);
  return short.length < pulita.length ? `${short}…` : short;
};
