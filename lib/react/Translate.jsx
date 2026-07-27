import { useContext } from "react";
import { TranslateContext } from "./TranslateContext";
import { interpolate } from "./interpolate.js";
import { resolveEntry } from "./resolveEntry.js";
import { parseCompiledMarker } from "./parseCompiledMarker";
// Tabella della lingua sorgente, importata staticamente dal plugin: fallback universale
// sempre disponibile (anche prima che il context abbia caricato una lingua, e in produzione
// dove il fallback non è più embeddato nel marcatore).
import { sourceTable } from "virtual:vitetranslate/languages";

// Un uso scorretto di <Translate> è un errore di codice: si ripresenta identico a ogni
// render finché non lo si corregge. Loggarlo ogni volta seppellirebbe la console senza
// aggiungere informazione, quindi si segnala una volta per messaggio distinto (stessa
// strategia dei warning di React). Il tetto evita che il Set cresca senza limite quando
// il messaggio contiene testo dinamico.
const loggedErrors = new Set();
const LOGGED_ERRORS_MAX = 100;

function logErrorOnce(error) {
  const message = error.message;
  if (loggedErrors.has(message)) return;
  if (loggedErrors.size >= LOGGED_ERRORS_MAX) loggedErrors.clear();
  loggedErrors.add(message);
  console.error("Translate: error", message, error);
}

// --- COMPONENTE PRINCIPALE ---

export default function Translate({ "data-translate": dataTranslate = false, t = false, a = false, children = false }) {
  const lang = useContext(TranslateContext);

  // Niente useMemo: la parte costosa (il parsing dell'HTML) è già memoizzata per stringa
  // risolta dentro basicHtmlToNodes, che a parità di testo restituisce lo stesso elemento
  // — quindi la stabilità referenziale che permette a React di saltare la riconciliazione
  // del sottoalbero c'è comunque. Un useMemo qui dipenderebbe da `t` e `a`, che nell'uso
  // normale sono literal (`t={[testo, arg]}`, `a={[arg]}`) e cambiano identità a ogni
  // render: costo certo, beneficio quasi mai.
  try {
    //
    // errore mancata scalta
    if (t && children) throw new Error("Translate: non puoi usare entrambi t e children");
    //
    // errore testo assente
    const source = t !== false ? t : children;
    if (!source && !dataTranslate) return ""; // throw new Error(`Translate: manca il testo da tradurre ${JSON.stringify({ dataTranslate, t, a, children })}`);
    //
    // Traduzione via data-translate (iniettato da vitetranslate)
    if (dataTranslate) {
      return resolveEntry(lang?.table, sourceTable, dataTranslate, a, source);
    }
    //
    // formato t=[text, arg1, arg2, ...]
    let text, args;
    if (Array.isArray(source)) {
      if (a !== false) throw new Error(`Translate: "a" non può essere definito se usi formato t:${JSON.stringify(t)}`);
      [text, ...args] = source;
    }
    //
    // formato classico t="..." a=[arg1, arg2, ...]
    else {
      if (t && typeof t === "object") throw new Error(`Translate: "t" non puo' essere un oggetto se usi formato t:${JSON.stringify(t)}`);
      text = source;
      args = a ?? [];
    }
    //
    // dovrebbe essere testo ora
    if (!(typeof text === "string" || text instanceof String)) throw new Error(`Translate: "t" o "children" devono essere stringhe non ${typeof text}`);
    // Un argomento può ora essere un elemento React: nella tabella compilata i segnaposto
    // sono figli JSX, non pezzi di stringa, quindi `<Translate t={["_%_ciao <b>%s</b>_%_", <Link/>]} />`
    // produce l'elemento dentro il <b>. Finché l'interpolazione era testuale non poteva
    // funzionare, ed era per questo che veniva rifiutato.
    //
    // Ora la stringa dovrebbe essere frutto di vitetranslate, con sintassi _<_codice_/_fallback_>_
    if (text?.startsWith("_<_") && text.endsWith("_>_")) {
      const { key, fallback } = parseCompiledMarker(text);
      // Ordine di fallback: lingua attiva -> lingua sorgente (sourceTable, sempre
      // importata) -> fallback embeddato nel marcatore (solo dev) -> chiave grezza.
      return resolveEntry(lang?.table, sourceTable, key, args, fallback);
    }
    //
    // Stringa non ancora formattata per la traduzione (marcatore _%_..._%_
    // dimenticato, o file non processato da vitetranslate). In sviluppo è
    // un errore esplicito, stesso trattamento degli altri usi scorretti sopra
    // (catturato dal try/catch qui sotto -> console.error + placeholder "[...]").
    // In produzione degrada mostrando il testo così com'è, senza rompere l'app.
    if (import.meta.env?.DEV) {
      throw new Error(`Translate: testo non marcato con _%_..._%_ (dimenticato?): "${text}"`);
    }
    // Testo mai passato dal compilatore: non esiste una voce di tabella da cui partire,
    // quindi resta l'interpolazione testuale. Un eventuale markup non viene interpretato.
    return interpolate(text, args);
    //
    //
  } catch (error) {
    logErrorOnce(error);
    return "[...]";
  }
}
