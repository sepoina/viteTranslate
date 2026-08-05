// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime: la catena di risoluzione".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { isValidElement, useContext } from "react";
import { TranslateContext } from "./TranslateContext.js";
import { interpolate } from "./interpolate.js";
import { resolveEntry } from "./resolveEntry.js";
import { markerKey, stripSourceMarker } from "./parseCompiledMarker.js";
import { fromObjectForm } from "./normalizeSource.js";
import { withPrefix } from "./withPrefix.js";
import { resolveDiagnostics, reportOnce, describeValue } from "../errorSolve.js";
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

// Ultima risorsa quando dal componente non si riesce a recuperare NIENTE di testuale — una
// funzione, un simbolo, un elemento React nel primo posto della tupla. Prima era l'esito di
// ogni uso scorretto; ora è l'unico caso in cui il testo dell'utente non si può salvare.
//
// Al posto del vecchio `[...]`, uguale per tutti, si rende `mark.badData` seguito dal nome
// di ciò che si è trovato: `🚫[func]`. Il glifo non è un prefisso davanti a un testo — testo
// non ce n'è — ma tutto ciò che si rende, e `[func]` è la parte che dice dove guardare.
//
// È diagnostica a tutti gli effetti, quindi passa da `markOnlyDev` come gli altri tre: in una
// build di produzione con i default `diag.badData` è `""` e non si rende niente. Il `[...]`
// invece si vedeva anche lì, cioè lo pagava l'utente finale, che con quelle prop non c'entra.
// La segnalazione in console resta, sotto `warningDev`/`warningBuild` come sempre.

// --- COMPONENTE PRINCIPALE ---

export default function Translate({ t = false, a = false, o = false, children = false, skipMark = false }) {
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
    if (children !== false) return salvage({ t, a, o, children }, lang, 'Translate: cannot use both `t` and `children`');
    source = t;
  } else {
    source = children;
  }

  // La forma a oggetto `{ t, a }` torna a essere una delle due che il resto conosce.
  source = fromObjectForm(source);

  // errore testo assente
  //
  // Il confronto è esplicito e non sulla falsità del valore: `0` e `false` sono entrambi
  // falsy, ma solo il secondo è la sentinella delle prop non passate. Con `!source` un
  // conteggio, un interno, un codice numerico che valga zero spariva senza che niente lo
  // segnalasse — il controllo nato per intercettare il default prendeva anche i valori veri.
  // Resta indistinguibile un `t={false}` esplicito, che come testo non ha comunque senso.
  if (source === false || source === null || source === undefined || source === "") return "";

  // Un elemento React nella posizione del testo non è ambiguo: non può essere un marcatore
  // dimenticato, e sa già renderizzarsi. Passa senza diagnostica — è lo stesso caso di una
  // prop che a volte porta testo marcato e a volte un nodo già montato (una voce di menu che
  // per lo stato "sto caricando" è uno spinner), servita dallo stesso componente foglia.
  // Prima cadeva nel controllo qui sotto e il contenuto spariva dallo schermo.
  //
  // Solo qui, e non nel primo posto della forma tupla: là il testo è il testo, e un elemento
  // è davvero un errore che il ramo di salvataggio deve continuare a segnalare.
  if (isValidElement(source)) return source;

  // Un oggetto senza campo `t` non è la forma `{ t, a }` e non contiene testo: è "niente",
  // come null, non un testo da salvare. Esce qui — vuoto e senza prefisso — prima del
  // salvataggio; i valori che il salvataggio non può proprio leggere (una funzione, un
  // simbolo) arrivano più a valle e finiscono a `badData()`, che in sviluppo li nomina.
  // L'uso è comunque scorretto, e in console (se i flag `warningDev`/`warningBuild` lo
  // consentono) si segnala una volta.
  if (
    typeof source === "object" &&
    !Array.isArray(source) &&
    !(source instanceof String) &&
    !Object.hasOwn(source, "t")
  ) {
    // Chiave statica e valore costruito solo se si stampa: `describeValue` è un
    // `JSON.stringify`, e questo ramo è un esito normale a runtime — non un errore che
    // qualcuno correggerà — quindi girerebbe a ogni render anche a console spenta.
    reportOnce(
      diag,
      'Translate: object without a "t" field',
      () => `Translate: object without a "t" field is not a { t, a } form and renders empty: ${describeValue(source)}`,
    );
    return "";
  }

  // formato t=[text, arg1, arg2, ...]
  let text, args;
  if (Array.isArray(source)) {
    if (a !== false) {
      return salvage({ t, a, o, children }, lang,
        'Translate: "a" with the array form',
        () => `Translate: "a" cannot be set when using the t:${describeValue(t)} array form`);
    }
    [text, ...args] = source;
  }
  //
  // formato classico t="..." a=[arg1, arg2, ...]
  else {
    if (typeof source === "object" && !(source instanceof String)) {
      return salvage({ t, a, o, children }, lang,
        'Translate: "t" is not a supported form',
        () => `Translate: "t" must be a string, an array or a { t, a } object, got ${describeValue(source)}`);
    }
    text = source;
    args = a ?? [];
  }
  //
  // Un numero nella posizione del testo è dato di dominio, non un uso scorretto: un
  // conteggio, un interno, un codice. Marcato non può essere — dal sorgente non ci passa — e
  // farlo uscire dal salvataggio lo mostrerebbe preceduto da `‼️` per un errore che nessuno ha
  // commesso. Niente interpolazione: in "42" segnaposto non ce ne sono.
  if (typeof text === "number" || typeof text === "bigint") return String(text);
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
  // testo si vede, e in sviluppo se lo porta dietro il prefisso `‼️` — l'informazione che
  // serve, senza cancellare ciò che si voleva mostrare.
  //
  // I delimitatori vanno tolti prima di mostrarlo, come già faceva ts(): sono sintassi
  // interna, e senza questo passaggio l'utente finale leggeva "_%_Benvenuto_%_" a schermo.
  // Un eventuale markup non viene interpretato: non c'è una voce di tabella da cui partire.
  //
  // A meno che il chiamante non abbia dichiarato `skipMark`: lo stesso input ha due
  // significati opposti — marcatore dimenticato oppure valore che un marcatore non l'avrà
  // mai — e a saperlo è solo il punto di chiamata. Non vuol dire "non tradurre": se il testo
  // È marcato la prop non ha nessun effetto e la catena di risoluzione procede come sempre,
  // `🔸` e `🔹` compresi. Vuol dire "qui il non marcato non è un errore", che è ciò che serve a
  // una prop che a volte porta testo marcato e a volte dato di dominio.
  const plain = interpolate(stripSourceMarker(text), args, diag);
  if (skipMark) return plain;

  reportOnce(diag, `Translate: text is not marked with _%_..._%_ (forgotten?): "${text}"`);
  return withPrefix(diag.malformed, plain);
}

// --- SALVATAGGIO ---

/**
 * Prop incompatibili fra loro, o un valore che le regole non sanno leggere. Si recupera il
 * meglio che c'è e lo si rende preceduto da `‼️`, invece di cancellare tutto. Quando testo non
 * ce n'è per niente subentra `badData()`, che al posto del testo dice cosa si è trovato.
 *
 * La differenza si vede in produzione: un errore di combinazione delle prop cancellava il
 * testo per l'utente finale, che con quel bug non c'entra niente. Il testo era lì e si poteva
 * mostrare.
 *
 * `key` e `build` sono i due parametri di `reportOnce`: con la sola chiave il messaggio è
 * quello, con entrambi il messaggio si compone solo se verrà stampato. Vale per i due casi in
 * cui contiene un `describeValue`.
 */
function salvage(props, lang, key, build) {
  reportOnce(diag, key, build);

  const source = pickSource(props);
  const text = textOf(source);
  if (text === undefined) return badData(props);

  const args = argsOf(source) ?? (props.a === false ? undefined : props.a);
  // Il testo recuperato attraversa la catena normale — se è un marcatore compilato si traduce
  // per davvero — ma con i prefissi di traduzione spenti: `‼️` ha già vinto, e due prefissi
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
//
// Il limite di profondità vale quanto quello di `badDataKind`, e per la stessa ragione: la
// discesa segue riferimenti che il chiamante controlla, e `const a = []; a[0] = a;` la
// manderebbe avanti fino al RangeError — dentro un render, cioè un crash al posto di una
// diagnostica. Oltre il limite si dichiara che testo non ce n'è, che è la risposta giusta:
// quattro involucri annidati senza una stringa in fondo non sono la forma `{ t, a }`.
function textOf(value, depth = 0) {
  if (depth > 4) return undefined;
  if (value === false || value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof String) return String(value);
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? undefined : textOf(value[0], depth + 1);
  if (typeof value === "object") return textOf(value.t, depth + 1);
  return undefined;
}

// --- DATI CHE TESTO NON SONO ---

// Qui il salvataggio ha già fallito: non c'è testo da mostrare in nessuna delle prop, e
// l'unica cosa utile che resta da dire è COSA c'era al suo posto. `🚫[func]` si legge dallo
// schermo e indica il tipo di valore da cercare nel punto di chiamata; il vecchio `[...]`
// diceva solo che qualcosa era andato storto, che a quel punto si sapeva già.
//
// Spento il glifo, non si rende niente: il nome del tipo da solo sarebbe rumore per chi legge
// la pagina, e la resa vuota è già quella dell'altro "niente da mostrare" del componente —
// l'oggetto senza campo `t`. La segnalazione in console l'ha già fatta `salvage`.
function badData(props) {
  if (diag.badData === "") return "";
  return `${diag.badData}[${badDataKind(pickBadData(props))}]`;
}

// Fra le prop passate, la prima che contenga qualcosa. Non è `pickSource`: quella cerca il
// testo, questa cerca il valore da nominare, e quando si arriva qui il testo non c'è per
// definizione. Le sentinelle e la stringa vuota si saltano — `t=""` insieme a dei children è
// un caso reale, e il valore di cui vale la pena parlare è il secondo.
function pickBadData({ t, o, children }) {
  for (const value of [o, t, children]) {
    if (value === false || value === null || value === undefined || value === "") continue;
    return value;
  }
  return undefined;
}

// Il nome di ciò che si è trovato, in una parola sola.
//
// Si scende nella prima posizione utile — il primo elemento della tupla, il campo `t`
// dell'oggetto — perché è lì che il testo doveva essere: di `t={[<i/>]}` la cosa da dire è che
// c'è un nodo dove andava il testo, non che c'è un array. `array` e `nullArray` restano per le
// tuple in cui quella posizione non c'è o è vuota, dove il nome dell'involucro È l'informazione.
//
// Il limite di profondità non è teorico: `const a = []; a[0] = a;` è una struttura che si
// costruisce da sé, e senza guardia questa funzione ci girerebbe dentro fino al RangeError —
// dentro un render, cioè trasformando una diagnostica in un crash.
function badDataKind(value, depth = 0) {
  if (depth > 4) return "badData";
  if (typeof value === "function") return "func";
  if (typeof value === "symbol") return "symbol";
  // Solo `true` può arrivare qui: `false` è la sentinella delle prop non passate e pickBadData
  // l'ha già saltato. Il nome è il valore stesso, che è più diretto di "bool".
  if (typeof value === "boolean") return String(value);
  if (isValidElement(value)) return "badDom";
  if (Array.isArray(value)) {
    if (value.length === 0) return "array";
    const first = value[0];
    if (first === null || first === undefined) return "nullArray";
    return badDataKind(first, depth + 1);
  }
  if (value !== null && typeof value === "object" && Object.hasOwn(value, "t")) return badDataKind(value.t, depth + 1);
  return "badData";
}

// Gli argomenti che viaggiavano insieme a quel testo, se ce n'erano.
function argsOf(value) {
  if (Array.isArray(value)) return value.length > 1 ? value.slice(1) : undefined;
  if (value !== null && typeof value === "object" && !(value instanceof String) && Object.hasOwn(value, "a")) return value.a;
  return undefined;
}
