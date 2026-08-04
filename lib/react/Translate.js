// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { useContext } from "react";
import { TranslateContext } from "./TranslateContext.js";
import { interpolate } from "./interpolate.js";
import { resolveEntry } from "./resolveEntry.js";
import { markerKey, stripSourceMarker } from "./parseCompiledMarker.js";
import { fromObjectForm } from "./normalizeSource.js";
import { withPrefix } from "./withPrefix.js";
import { resolveDiagnostics, reportOnce } from "../errorSolve.js";
// Tabella importata staticamente dal plugin: è la sola garantita presente nel bundle, quindi
// il fallback universale disponibile anche prima che il context abbia caricato una lingua, e
// in produzione dove il fallback non è più embeddato nel marcatore. È la lingua sorgente
// quando è fra le precaricate, altrimenti la prima delle precaricate — indifferente, da
// quando ogni tabella compilata porta con sé il testo della sorgente per ciò che non è
// tradotto (vedi compileLanguageModule).
import { fallbackTable } from "virtual:vitetranslate/languages";
// Il namespace, e non un import nominato, perché `errorSolve` e `partiallyTranslated` sono
// export recenti: un manifest che non li ha (scritto a mano nei test, o generato da una
// versione precedente del plugin) romperebbe il collegamento ESM invece di ricadere sui
// default. Su un namespace un export assente è semplicemente `undefined`.
import * as manifest from "virtual:vitetranslate/languages";

// Costante di modulo: la configurazione è decisa a build time dal plugin e non cambia mentre
// la pagina è aperta, quindi non c'è niente da ricalcolare a ogni render.
const diag = resolveDiagnostics(manifest);

// Un marcatore compilato è "_<_chiave_/_fallback_>_" (dev) o "_<_chiave_>_" (build).
const isCompiledMarker = (text) => text.startsWith("_<_") && text.endsWith("_>_");

// Ultima risorsa quando dal componente non si riesce a recuperare NIENTE di testuale — un `t`
// che è un oggetto senza campo `t`, una funzione, un simbolo. Prima era l'esito di ogni uso
// scorretto; ora è l'unico caso in cui il testo dell'utente non si può salvare.
const NOTHING = "[...]";

// --- COMPONENTE PRINCIPALE ---

export default function Translate({ t = false, a = false, o = false, children = false }) {
  const lang = useContext(TranslateContext);

  // Niente useMemo: le voci senza segnaposto sono elementi costruiti una volta sola alla
  // valutazione del modulo di lingua, quindi la stabilità referenziale che permette a React
  // di saltare la riconciliazione del sottoalbero arriva già dalla tabella. Quelle con
  // segnaposto riallocano a ogni render, ma sono sottoalberi di pochi nodi. Un useMemo qui
  // dipenderebbe da `t` e `a`, che nell'uso normale sono literal (`t={[testo, arg]}`,
  // `a={[arg]}`) e cambiano identità a ogni render: costo certo, beneficio quasi mai.
  //
  // Niente più try/catch nemmeno: gli usi scorretti non lanciano più. Ognuno sceglie
  // esplicitamente la propria via di salvataggio, che è l'unico modo per poter dire davvero
  // cosa mostrare al posto del testo mancante.
  //
  // errore mancata scelta.
  // Il confronto è con la sentinella `false` (il default delle prop), non con la verità del
  // valore: `t=""` è una prop passata a tutti gli effetti, e insieme a dei children era il
  // caso che sfuggiva al controllo — la stringa vuota vinceva e i children sparivano senza
  // che nulla lo segnalasse.
  let source;
  if (o !== false) {
    if (t !== false || children !== false) return salvage({ t, a, o, children }, lang, 'Translate: cannot use `o` together with `t` or `children`');
    source = o;
  } else if (t !== false) {
    if (children !== false) return salvage({ t, a, o, children }, lang, "Translate: cannot use both `t` and `children`");
    source = t;
  } else {
    source = children;
  }

  // La forma a oggetto `{ t, a }` torna a essere una delle due che il resto conosce.
  source = fromObjectForm(source);

  // errore testo assente
  if (!source) return "";

  // Un oggetto senza campo `t` non è la forma `{ t, a }` e non contiene testo: è "niente",
  // come null, non un testo da salvare. Esce qui — vuoto e senza prefisso — prima del
  // salvataggio; `[...]` resta per i valori che il salvataggio non può proprio leggere
  // (una funzione, un simbolo), che arrivano più a valle. L'uso è comunque scorretto, e in
  // console (se i flag `warningDev`/`warningBuild` lo consentono) si segnala una volta.
  if (
    typeof source === "object" &&
    !Array.isArray(source) &&
    !(source instanceof String) &&
    !Object.hasOwn(source, "t")
  ) {
    reportOnce(diag, `Translate: object without a "t" field is not a { t, a } form and renders empty: ${JSON.stringify(source)}`);
    return "";
  }

  // formato t=[text, arg1, arg2, ...]
  let text, args;
  if (Array.isArray(source)) {
    if (a !== false) return salvage({ t, a, o, children }, lang, `Translate: "a" cannot be set when using the t:${JSON.stringify(t)} array form`);
    [text, ...args] = source;
  }
  //
  // formato classico t="..." a=[arg1, arg2, ...]
  else {
    if (typeof source === "object" && !(source instanceof String)) {
      return salvage({ t, a, o, children }, lang, `Translate: "t" must be a string, an array or a { t, a } object, got ${JSON.stringify(source)}`);
    }
    text = source;
    args = a ?? [];
  }
  //
  // dovrebbe essere testo ora
  if (!(typeof text === "string" || text instanceof String)) {
    return salvage({ t, a, o, children }, lang, `Translate: "t" or "children" must be a string, got ${typeof text}`);
  }
  // Un argomento può ora essere un elemento React: nella tabella compilata i segnaposto
  // sono figli JSX, non pezzi di stringa, quindi `<Translate t={["_%_ciao <b>%s</b>_%_", <Link/>]} />`
  // produce l'elemento dentro il <b>. Finché l'interpolazione era testuale non poteva
  // funzionare, ed era per questo che veniva rifiutato.
  //
  // Ora la stringa dovrebbe essere frutto di vitetranslate, con sintassi _<_codice_/_fallback_>_
  if (isCompiledMarker(text)) {
    // Ordine di fallback: lingua attiva -> tabella eager (fallbackTable, sempre
    // importata) -> fallback embeddato nel marcatore (solo dev) -> chiave grezza.
    return resolveEntry(lang?.table, fallbackTable, markerKey(text), args, text, diag);
  }
  //
  // Stringa mai passata dal compilatore. Due cose diverse che da qui si vedono uguali: un
  // marcatore `_%_..._%_` che il transform non ha mai visto (file non analizzabile, marcatore
  // dentro node_modules, stringa costruita a runtime), oppure un testo che marcato non è mai
  // stato — un numero di telefono, il nome di un campo configurato altrove, il messaggio di
  // un'eccezione, una descrizione che arriva dal server.
  //
  // Non è più un errore fatale. Prima in sviluppo lanciava, e il testo dell'utente spariva
  // dietro un "[...]": chi aveva dati di dominio da mostrare doveva ispezionare il marcatore
  // PRIMA di chiamare <Translate>, cioè riscrivere fuori una decisione che è di qui. Ora il
  // testo si vede, e in sviluppo se lo porta dietro il prefisso `⁂` — l'informazione che
  // serve, senza cancellare ciò che si voleva mostrare.
  //
  // I delimitatori vanno tolti prima di mostrarlo, come già faceva ts(): sono sintassi
  // interna, e senza questo passaggio l'utente finale leggeva "_%_Benvenuto_%_" a schermo.
  // Un eventuale markup non viene interpretato: non c'è una voce di tabella da cui partire.
  reportOnce(diag, `Translate: text is not marked with _%_..._%_ (forgotten?): "${text}"`);
  return withPrefix(diag.malformed, interpolate(stripSourceMarker(text), args, diag));
}

// --- SALVATAGGIO ---

/**
 * Prop incompatibili fra loro, o un valore che le regole non sanno leggere. Si recupera il
 * meglio che c'è e lo si rende preceduto da `⁂`, invece di sostituire tutto con "[...]".
 *
 * La differenza si vede in produzione: un errore di combinazione delle prop cancellava il
 * testo per l'utente finale, che con quel bug non c'entra niente. Il testo era lì e si poteva
 * mostrare.
 */
function salvage(props, lang, message) {
  reportOnce(diag, message);

  const source = pickSource(props);
  const text = textOf(source);
  if (text === undefined) return withPrefix(diag.malformed, NOTHING);

  const args = argsOf(source) ?? (props.a === false ? undefined : props.a);
  // Il testo recuperato attraversa la catena normale — se è un marcatore compilato si traduce
  // per davvero — ma con i prefissi di traduzione spenti: `⁂` ha già vinto, e due prefissi
  // davanti alla stessa stringa non aggiungono niente al primo.
  const quiet = diag.malformedOnly;
  const node = isCompiledMarker(text)
    ? resolveEntry(lang?.table, fallbackTable, markerKey(text), args, text, quiet)
    : interpolate(stripSourceMarker(text), args, quiet);

  return withPrefix(diag.malformed, node);
}

// Fra le prop passate, la prima che contiene qualcosa di testuale. `o` per prima: è il canale
// esplicito, chi lo usa lo usa apposta.
//
// La stringa vuota non conta come testo, e non è un dettaglio: il caso che ha reso necessario
// il controllo sulla sentinella `false` è proprio `t=""` insieme a dei children, dove la
// stringa vuota vinceva e il testo vero spariva. Salvare la vuota qui rifarebbe sparire lo
// stesso testo, per la stessa ragione, solo un passo più in là.
function pickSource({ t, o, children }) {
  for (const value of [o, t, children]) {
    const text = textOf(value);
    if (text !== undefined && text !== "") return value;
  }
  return undefined;
}

// Il testo dentro un valore di forma qualunque: la stringa stessa, il primo elemento di una
// tupla, il campo `t` di un oggetto, la rappresentazione di un numero. `undefined` quando non
// c'è proprio niente da mostrare — un elemento React, una funzione, un oggetto senza `t`.
function textOf(value) {
  if (value === false || value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof String) return String(value);
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? undefined : textOf(value[0]);
  if (typeof value === "object") return textOf(value.t);
  return undefined;
}

// Gli argomenti che viaggiavano insieme a quel testo, se ce n'erano.
function argsOf(value) {
  if (Array.isArray(value)) return value.length > 1 ? value.slice(1) : undefined;
  if (value !== null && typeof value === "object" && !(value instanceof String) && Object.hasOwn(value, "a")) return value.a;
  return undefined;
}
