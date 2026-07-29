// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { useContext } from "react";
import { TranslateContext } from "./TranslateContext.js";
import { interpolate } from "./interpolate.js";
import { resolveEntry } from "./resolveEntry.js";
import { markerKey, stripSourceMarker } from "./parseCompiledMarker.js";
// Tabella importata staticamente dal plugin: è la sola garantita presente nel bundle, quindi
// il fallback universale disponibile anche prima che il context abbia caricato una lingua, e
// in produzione dove il fallback non è più embeddato nel marcatore. È la lingua sorgente
// quando è fra le precaricate, altrimenti la prima delle precaricate — indifferente, da
// quando ogni tabella compilata porta con sé il testo della sorgente per ciò che non è
// tradotto (vedi compileLanguageModule).
import { fallbackTable } from "virtual:vitetranslate/languages";

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

export default function Translate({ t = false, a = false, children = false }) {
  const lang = useContext(TranslateContext);

  // Niente useMemo: le voci senza segnaposto sono elementi costruiti una volta sola alla
  // valutazione del modulo di lingua, quindi la stabilità referenziale che permette a React
  // di saltare la riconciliazione del sottoalbero arriva già dalla tabella. Quelle con
  // segnaposto riallocano a ogni render, ma sono sottoalberi di pochi nodi. Un useMemo qui
  // dipenderebbe da `t` e `a`, che nell'uso normale sono literal (`t={[testo, arg]}`,
  // `a={[arg]}`) e cambiano identità a ogni render: costo certo, beneficio quasi mai.
  try {
    //
    // errore mancata scelta.
    // Il confronto è con la sentinella `false` (il default delle prop), non con la verità del
    // valore: `t=""` è una prop passata a tutti gli effetti, e insieme a dei children era il
    // caso che sfuggiva al controllo — la stringa vuota vinceva e i children sparivano senza
    // che nulla lo segnalasse.
    if (t !== false && children !== false) throw new Error("Translate: cannot use both `t` and `children`");
    //
    // errore testo assente
    const source = t !== false ? t : children;
    if (!source) return "";
    //
    // formato t=[text, arg1, arg2, ...]
    let text, args;
    if (Array.isArray(source)) {
      if (a !== false) throw new Error(`Translate: "a" cannot be set when using the t:${JSON.stringify(t)} array form`);
      [text, ...args] = source;
    }
    //
    // formato classico t="..." a=[arg1, arg2, ...]
    else {
      if (t && typeof t === "object") throw new Error(`Translate: "t" cannot be an object, got t:${JSON.stringify(t)}`);
      text = source;
      args = a ?? [];
    }
    //
    // dovrebbe essere testo ora
    if (!(typeof text === "string" || text instanceof String)) throw new Error(`Translate: "t" or "children" must be a string, got ${typeof text}`);
    // Un argomento può ora essere un elemento React: nella tabella compilata i segnaposto
    // sono figli JSX, non pezzi di stringa, quindi `<Translate t={["_%_ciao <b>%s</b>_%_", <Link/>]} />`
    // produce l'elemento dentro il <b>. Finché l'interpolazione era testuale non poteva
    // funzionare, ed era per questo che veniva rifiutato.
    //
    // Ora la stringa dovrebbe essere frutto di vitetranslate, con sintassi _<_codice_/_fallback_>_
    if (text?.startsWith("_<_") && text.endsWith("_>_")) {
      const key = markerKey(text);
      // Ordine di fallback: lingua attiva -> tabella eager (fallbackTable, sempre
      // importata) -> fallback embeddato nel marcatore (solo dev) -> chiave grezza.
      return resolveEntry(lang?.table, fallbackTable, key, args, text);
    }
    //
    // Stringa non ancora formattata per la traduzione (marcatore _%_..._%_
    // dimenticato, o file non processato da vitetranslate). In sviluppo è
    // un errore esplicito, stesso trattamento degli altri usi scorretti sopra
    // (catturato dal try/catch qui sotto -> console.error + placeholder "[...]").
    // In produzione degrada mostrando il testo così com'è, senza rompere l'app.
    if (import.meta.env?.DEV) {
      throw new Error(`Translate: text is not marked with _%_..._%_ (forgotten?): "${text}"`);
    }
    // Testo mai passato dal compilatore: non esiste una voce di tabella da cui partire,
    // quindi resta l'interpolazione testuale. Un eventuale markup non viene interpretato.
    //
    // I delimitatori vanno tolti prima di mostrarlo, come già faceva ts(): sono sintassi
    // interna, e senza questo passaggio l'utente finale leggeva "_%_Benvenuto_%_" a schermo.
    // Non è un caso di scuola — ci si arriva ogni volta che un file sfugge al transform
    // (errore di parsing ingoiato con un avviso, marcatore dentro node_modules), e in
    // produzione è proprio dove non c'è un errore in console a segnalarlo.
    return interpolate(stripSourceMarker(text), args);
    //
    //
  } catch (error) {
    logErrorOnce(error); 
    return "[...]";
  }
}
