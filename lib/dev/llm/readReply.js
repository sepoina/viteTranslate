// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Dalla risposta del modello alla mappa `chiave -> candidato` di un lotto. Il prompt chiede un
// oggetto piatto, `{ "<k>": "<traduzione>" }`; un modello meno preciso a volte ricopia invece
// la forma della domanda — `{ "items": [{ "k", "t", "where" }] }`, trace della demo del
// 2026-09-18: traduzioni giuste, pagate, e buttate — oppure avvolge la risposta in un oggetto
// in più. Qui quelle forme si riconoscono.
//
// Tollerante sulla forma, mai sul contenuto:
//   - si accetta una forma solo quando la lettura è una sola. Due letture possibili (due
//     involucri con dentro chiavi del lotto, la stessa chiave con due valori) non si scelgono:
//     quelle chiavi restano senza risposta, cioè `null` nel file, come prima;
//   - le chiavi si confrontano esatte, carattere per carattere: niente trim, niente maiuscole;
//   - i valori passano così come sono, senza conversioni: è validateTranslation che decide se
//     sono una stringa scrivibile. Nel file di lingua non arriva niente che non sia una chiave
//     del lotto con una stringa validata — il formato della tabella non cambia di una virgola.

// Un blocco di codice attorno a tutto il testo, con o senza linguaggio (```json, ```markdown).
const FENCE_RE = /^```[\w-]*[ \t]*\n?([\s\S]*?)\n?[ \t]*```$/;

// I campi di una voce ricopiata che possono portare la traduzione: `t` è quello della domanda,
// gli altri sono i nomi con cui un modello lo rinomina quando la ricopia.
const VALUE_FIELDS = ["t", "translation", "text", "value"];
const KEY_FIELDS = ["k", "key"];

const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** Il testo senza il blocco di codice che lo avvolge per intero, se c'è; altrimenti com'è. */
export function stripOuterFence(text) {
  const trimmed = String(text).trim();
  const match = trimmed.match(FENCE_RE);
  return match ? match[1].trim() : trimmed;
}

/**
 * Il JSON di una risposta testuale. Nell'ordine: il testo com'è, poi senza il blocco di codice
 * attorno, poi il pezzo che va dalla prima `{` all'ultima `}` — il caso di chi scrive una frase
 * prima o dopo il JSON pur essendogli stato chiesto di no. Se nemmeno quello è JSON, lancia:
 * nessun tentativo di indovinare dove comincia un oggetto dentro un testo che ne ha più d'uno.
 *
 * @param {string} text
 * @returns {unknown}
 */
export function parseJsonReply(text) {
  const tries = [String(text).trim()];
  tries.push(stripOuterFence(tries[0]));
  const start = tries[0].indexOf("{");
  const end = tries[0].lastIndexOf("}");
  if (start !== -1 && end > start) tries.push(tries[0].slice(start, end + 1));

  let lastError;
  for (const candidate of tries) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Le coppie complete di una risposta tagliata da `max_tokens` (trace della demo del 2026-09-19:
 * 33 traduzioni su 38 già scritte, buttate insieme alle 5 mancanti). Legge l'oggetto piatto che
 * comincia alla prima `{`, una coppia `"chiave": "valore"` alla volta, e si ferma alla prima che
 * non è chiusa o il cui valore non è una stringa: una coppia a metà non si completa mai, e una
 * stringa di cui è arrivata la virgoletta di chiusura è finita per definizione. Una chiave
 * ripetuta con due valori diversi non si sceglie, come in `readReply`. Il risultato è un oggetto
 * piatto qualunque: quali chiavi sono del lotto lo decide `readReply`, come per ogni risposta.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function salvageTruncated(text) {
  const s = String(text);
  // Una Map e non un oggetto: una chiave `__proto__` scritta dal modello resta una chiave.
  const pairs = new Map();
  const conflicts = new Set();
  let i = s.indexOf("{");
  if (i === -1) return {};
  i++;

  const skipSpaces = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };
  // Una stringa JSON che comincia in `i`, decodificata; `undefined` se non si chiude.
  const readString = () => {
    if (s[i] !== '"') return undefined;
    let end = i + 1;
    while (end < s.length && s[end] !== '"') end += s[end] === "\\" ? 2 : 1;
    if (end >= s.length) return undefined;
    let value;
    try {
      value = JSON.parse(s.slice(i, end + 1));
    } catch {
      return undefined;
    }
    i = end + 1;
    return value;
  };

  for (let first = true; ; first = false) {
    skipSpaces();
    if (!first) {
      if (s[i] !== ",") break;
      i++;
      skipSpaces();
    }
    const key = readString();
    if (key === undefined) break;
    skipSpaces();
    if (s[i] !== ":") break;
    i++;
    skipSpaces();
    const value = readString();
    if (value === undefined) break;
    if (pairs.has(key) && pairs.get(key) !== value) conflicts.add(key);
    pairs.set(key, value);
  }
  for (const key of conflicts) pairs.delete(key);
  return Object.fromEntries(pairs);
}

/**
 * Il solo valore di una voce, oppure `undefined` se non ce n'è nessuno o se ce ne sono due
 * diversi: `{ "t": "Ciao", "translation": "Hello" }` non dice quale dei due sia la traduzione.
 */
function onlyValue(item) {
  const found = VALUE_FIELDS.filter((field) => field in item).map((field) => item[field]);
  if (found.length === 0) return undefined;
  return found.every((value) => value === found[0]) ? found[0] : undefined;
}

function onlyKey(item) {
  const found = KEY_FIELDS.filter((field) => typeof item[field] === "string").map((field) => item[field]);
  if (found.length === 0) return undefined;
  return found.every((key) => key === found[0]) ? found[0] : undefined;
}

/** `{ "<k>": { "t": "…" } }`: il valore ricopiato come oggetto. Tolto l'involucro solo se il
 *  valore è uno; altrimenti resta l'oggetto, e il validatore lo rifiuta come non-stringa. */
function unwrapValue(value) {
  if (!isPlainObject(value)) return value;
  const inner = onlyValue(value);
  return inner === undefined ? value : inner;
}

/** Oggetto piatto con almeno una chiave del lotto al primo livello. */
function readFlat(reply, keys) {
  const translations = {};
  const unknownKeys = [];
  for (const [key, value] of Object.entries(reply)) {
    if (keys.has(key)) translations[key] = unwrapValue(value);
    else unknownKeys.push(key);
  }
  return { translations, unknownKeys, conflicts: [] };
}

/** Un elenco di voci `{ k, t }`. Una chiave ripetuta con due valori diversi non si sceglie. */
function readItems(items, keys) {
  const translations = {};
  const unknownKeys = [];
  const conflicts = new Set();
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const key = onlyKey(item);
    if (key === undefined) continue;
    if (!keys.has(key)) {
      unknownKeys.push(key);
      continue;
    }
    const value = unwrapValue(onlyValue(item));
    if (value === undefined) continue;
    if (key in translations && translations[key] !== value) conflicts.add(key);
    translations[key] = value;
  }
  for (const key of conflicts) delete translations[key];
  return { translations, unknownKeys, conflicts: [...conflicts] };
}

const isItemList = (value) => Array.isArray(value) && value.some((item) => isPlainObject(item) && onlyKey(item) !== undefined);

/**
 * @param {unknown} reply - le `translations` come le ha restituite il driver: di norma un
 *   oggetto già parsato; una stringa (un driver che non l'ha parsata) si parsa qui.
 * @param {Iterable<string>} batchKeys - le chiavi del lotto
 * @returns {{
 *   translations: Record<string, unknown>,
 *   shape: "flat" | "items" | "wrapped" | "unreadable",
 *   unknownKeys: string[],
 *   conflicts: string[],
 * }} `shape`: quale forma è stata letta — "flat" è quella chiesta dal prompt. `unknownKeys`: le
 *   chiavi che non sono del lotto, ignorate. `conflicts`: le chiavi scartate perché la risposta
 *   dava loro due valori diversi.
 */
export default function readReply(reply, batchKeys) {
  const keys = new Set(batchKeys);
  let value = reply;
  if (typeof value === "string") {
    try {
      value = parseJsonReply(value);
    } catch {
      return { translations: {}, shape: "unreadable", unknownKeys: [], conflicts: [] };
    }
  }

  if (Array.isArray(value)) {
    return isItemList(value)
      ? { shape: "items", ...readItems(value, keys) }
      : { translations: {}, shape: "unreadable", unknownKeys: [], conflicts: [] };
  }
  if (!isPlainObject(value)) {
    return { translations: {}, shape: "unreadable", unknownKeys: [], conflicts: [] };
  }

  // La forma chiesta: basta una chiave del lotto al primo livello. Il resto sono chiavi
  // sconosciute, contate e ignorate come sempre.
  if (Object.keys(value).some((key) => keys.has(key))) {
    return { shape: "flat", ...readFlat(value, keys) };
  }

  // Nessuna chiave del lotto al primo livello: si guarda dentro, ma solo dove c'è un posto
  // solo in cui guardare.
  const members = Object.entries(value);
  const lists = members.filter(([, member]) => isItemList(member));
  const wrappers = members.filter(([, member]) => isPlainObject(member) && Object.keys(member).some((key) => keys.has(key)));

  if (lists.length + wrappers.length === 1) {
    const [name, member] = lists[0] ?? wrappers[0];
    const read = lists.length ? readItems(member, keys) : readFlat(member, keys);
    const others = members.map(([key]) => key).filter((key) => key !== name);
    return {
      shape: lists.length ? "items" : "wrapped",
      translations: read.translations,
      unknownKeys: [...others, ...read.unknownKeys],
      conflicts: read.conflicts,
    };
  }

  return { translations: {}, shape: "unreadable", unknownKeys: members.map(([key]) => key), conflicts: [] };
}
