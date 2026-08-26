// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Nome della lingua nella lingua stessa (es. "it-IT" -> "italiano (Italia)"), via
 * Intl.DisplayNames. Se il tag non è risolvibile o l'ICU del runtime è ridotto (build
 * Node "small-icu" senza dati per quella lingua), ricade sul tag stesso.
 *
 * @param {string} tag - tag BCP 47 (es. "it-IT")
 * @returns {string}
 */
export default function languageAutonym(tag) {
  try {
    return new Intl.DisplayNames([tag], { type: "language" }).of(tag);
  } catch {
    return tag;
  }
}

/**
 * La regione fra parentesi in coda al nome, tonde o a tutta larghezza: "italiano (Italia)" e
 * "中文（中国）" la scrivono così, ognuno con le proprie.
 */
const REGIONE_IN_CODA = /\s*[(（][^()（）]*[)）]\s*$/;

/**
 * Il nome della lingua senza la regione fra parentesi: "italiano (Italia)" -> "italiano".
 *
 * Serve al riepilogo di una sincronizzazione, che nomina le lingue in fila su una riga sola:
 * lì la regione è quasi sempre rumore — le lingue di un progetto differiscono per lingua, non
 * per variante — e ripeterla per ognuna allunga la riga fino a mandarla a capo.
 *
 * NON è un identificativo, ed è il motivo per cui questa funzione non va usata da sola: la
 * regione non è sempre fra parentesi ("português europeu", "español de México" la incorporano
 * nella frase, e restano intatti), e dove lo è due varianti possono collassare sullo stesso
 * nome — "zh-CN" e "zh-TW" diventano entrambe "中文". Chi stampa più lingue insieme deve
 * disambiguare da sé (vedi `etichettaLingua` in cli.js), col nome del file.
 *
 * @param {string} tag
 * @returns {string}
 */
export function shortAutonym(tag) {
  const intero = languageAutonym(tag);
  const corto = String(intero).replace(REGIONE_IN_CODA, "");
  // Un tag che l'ICU non conosce non dà errore: lo rimanda indietro formattato ("xy-AB" ->
  // "xy (AB)"), e la parentesi lì dentro NON è una regione tradotta, è metà del codice.
  // Toglierla lascerebbe "xy", cioè un tag mutilato spacciato per un nome di lingua — e due
  // refusi diversi ("xy-AB", "xy-CD") diventerebbero la stessa riga. Nessun autonimo vero
  // coincide col proprio sottotag, quindi il confronto distingue i due casi.
  if (corto === tag.split("-")[0]) return tag;
  // Un nome fatto di sola parentesi non esiste, ma se esistesse restare senza niente da
  // stampare sarebbe peggio che tenersi la forma lunga.
  return corto === "" ? intero : corto;
}
