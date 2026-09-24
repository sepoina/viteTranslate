// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "2a. Estrazione: parse e splice".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { createRequire } from "module";
import parserOptionsFor from "./parserOptionsFor.js";
import {
  markedTextOf, rawTextOf, innerTextOf, escapeTemplateRaw, registerMarker,
  relPathOf, defaultWarn,
} from "./markerCore.js";
import { compiledMarker, SOURCE_OPEN, SOURCE_CLOSE, PLACEHOLDER, ICU_TRIGGER_RE } from "../../markerSyntax.js";
import { colorize } from "../../utility.js";
import { BABEL_PACKAGE, BABEL_MISSING, BABEL_NODE_TOO_OLD } from "./babelPeer.js";
import { scanComponents } from "./componentScan.js";

// L'estrazione dei marcatori, usata dal plugin Vite e dal comando di sync.
//
// Si ferma al parse: niente `File` di @babel/core, niente NodePath, niente scope, niente
// `generate()`. Misurato sui sorgenti del playground, il transform completo con generate e
// sourcemap costa 18,7 ms contro i 2,3 ms di `parseSync` — il parser non era il collo di
// bottiglia, lo era tutto il resto.
//
// Il modo ovvio di fare la stessa cosa — sostituire i nodi e lasciare che Babel rigeneri —
// è conservato in test/list/babelTranslateReference.mjs e serve da termine di paragone: è quello
// che dimostra che questa versione è corretta.
//
// Può permetterselo perché la riscrittura è puntuale: il plugin sostituisce solo nodi il cui
// valore è **per intero** un marcatore, quindi bastano gli offset dei nodi trovati e uno
// splice sul sorgente. Come effetto collaterale il codice non marcato esce byte per byte
// com'era entrato — commenti, formattazione e direttive (`@__PURE__`, `@vite-ignore`)
// compresi, che una rigenerazione avrebbe potuto alterare.

const SKIP_KEYS = new Set([
  "loc", "extra", "comments", "tokens",
  "leadingComments", "trailingComments", "innerComments",
]);

let parseSync = null;

/**
 * Carica `@babel/core` alla prima chiamata e non prima. `createRequire` lo prende senza rendere
 * asincrona l'estrazione: `extractMarkers` resta la funzione sincrona che è sempre stata, e i
 * suoi tre chiamanti non cambiano di una riga. Regge su entrambe le major supportate per due
 * motivi diversi: Babel 7 è CommonJS; Babel 8 è ESM, ma `require()` di un modulo ESM privo di
 * top-level await è sincrono su Node, e Babel 8 esige comunque un Node (>= 22.18) in cui lo è.
 *
 * `@babel/core` è una peer dependency obbligatoria: npm e pnpm la installano da soli. Non
 * arriva più di riflesso da `@vitejs/plugin-react`, che dalla 6 non dipende più da Babel, e
 * yarn si limita ad avvisare — quindi mancante può esserlo ancora. In quel caso questa
 * funzione lancia un errore con `code: "VT_NO_BABEL"` e il guasto allegato in `guasto` (vedi
 * babelPeer.js), che i tre chiamanti (`cli.js` via `loadConfig.js`, `autoSync.js`,
 * `vitetranslate.js`) rendono nella forma che serve a loro senza riscriverne il testo.
 */
export function ensureBabel() {
  if (parseSync) return;
  try {
    ({ parseSync } = createRequire(import.meta.url)(BABEL_PACKAGE));
  } catch (error) {
    const codice = error?.code;
    // Due guasti diversi sotto lo stesso `code`, perché per chi chiama la conseguenza è la
    // stessa — non si estrae niente — mentre per chi legge la cura non lo è affatto.
    // `ERR_REQUIRE_ESM` significa che Babel 8 c'è ed è questo Node a non poterlo caricare:
    // dirgli "non è installato" lo manderebbe a reinstallare ciò che ha già. Senza questo
    // ramo l'errore risaliva grezzo, che è la forma per cui VT_NO_BABEL esiste.
    const guasto = codice === "ERR_REQUIRE_ESM"
      ? BABEL_NODE_TOO_OLD
      : (codice === "MODULE_NOT_FOUND" || codice === "ERR_MODULE_NOT_FOUND" ? BABEL_MISSING : null);
    if (!guasto) throw error;
    const e = new Error(guasto.message);
    e.code = "VT_NO_BABEL";
    e.guasto = guasto;
    throw e;
  }
}

// Visita l'AST come oggetto semplice, portandosi dietro genitore e nonno, la pila delle
// funzioni annidate (per `nearestComponent`, vedi sotto) e la pila degli elementi JSX
// annidati (per il controllo "host" sugli attributi, vedi § 6.1 — due livelli di ascendenza
// bastano a distinguere `t="…"`/`t={"…"}` da un figlio (§ 6.1/§ 5.3), ma NON bastano a
// risalire fino all'elemento che porta l'attributo quando il marcatore è in forma
// espressione: lì l'elemento è a TRE salti dal valore (StringLiteral -> JSXExpressionContainer
// -> JSXAttribute -> JSXOpeningElement/JSXElement), uno oltre grand. Una pila dedicata,
// aggiornata come quella delle funzioni, risponde a qualunque profondità senza allargare la
// firma di ogni chiamata di un terzo ascendente generico. Verificato sull'AST, non dedotto.
function walk(node, parent, grand, visit, frames, hostFrames) {
  if (Array.isArray(node)) {
    // Un array non e' un livello: i suoi elementi hanno gli stessi due antenati.
    for (const child of node) walk(child, parent, grand, visit, frames, hostFrames);
    return;
  }
  if (node === null || typeof node !== "object" || typeof node.type !== "string") return;
  const isFn = node.type === "FunctionDeclaration" || node.type === "FunctionExpression" ||
               node.type === "ArrowFunctionExpression" || node.type === "ClassMethod" ||
               node.type === "ObjectMethod";
  if (isFn) frames.push(node);
  const isJsxEl = node.type === "JSXElement";
  if (isJsxEl) hostFrames.push(node);
  visit(node, parent, grand, frames, hostFrames);
  for (const key in node) {
    if (SKIP_KEYS.has(key)) continue;
    const child = node[key];
    if (child !== null && typeof child === "object") walk(child, node, parent, visit, frames, hostFrames);
  }
  if (isJsxEl) hostFrames.pop();
  if (isFn) frames.pop();
}

// Il componente in cui iniettare, risalendo dalla funzione piu' interna. Le arrow di callback
// (`items.map(i => <li>…</li>)`) non sono componenti e si attraversano senza fermarsi:
// `__vtNode` e `__vtStr` sono closure ordinarie, non hook, quindi possono essere CHIAMATE
// ovunque — anche dentro un event handler. Solo il punto di DICHIARAZIONE e' vincolato.
//
// La risalita si ferma su un metodo di classe: li' dentro non si inietta, e uscirne per
// iniettare nel componente funzione che sta piu' fuori metterebbe l'hook nel render sbagliato.
//
// Restituisce il frame verde anche quando `green.get(frame)` e' `null` (l'arrow a corpo
// conciso, vedi § 8 del piano) e si ferma li': non sale al componente che sta piu' fuori. Il
// controllo "verde E iniettabile" lo fa chi chiama, guardando `green.get(frame) === null`.
function nearestComponent(frames, green) {
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i];
    if (f.type === "ClassMethod" || f.type === "ObjectMethod") return null;
    if (green.has(f)) return f;
  }
  return null;
}

// Letterale JS per il testo compilato. `JSON.stringify` non fa l'escape dei non-ASCII, e va
// bene così: era proprio l'escape del generatore Babel (`è` -> `\xE8`) a rendere necessario
// avvolgere gli attributi JSX in un'espressione. U+2028/U+2029 sono validi in JSON ma non in
// ogni parser JS, quindi restano escapati a mano.
function countNewlines(text, from, to) {
  let n = 0;
  for (let i = from; i < to; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function jsString(value) {
  return JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// Tag che NON accettano un figlio elemento. Misurati in SSR su React 19, non dedotti:
// title/textarea/style rendono "[object Object]", script butta via il contenuto. Restano
// esclusi anche quando una RegExp dell'utente li accetterebbe: non e' questione di gusto.
const TEXT_ONLY_TAGS = new Set(["script", "style", "title", "textarea"]);

/**
 * La classe del genitore di un JSXText. Deliberatamente conservativa: nel dubbio "none".
 *
 *  "none"       -> non e' un elemento host: componente, <Foo.Bar>, <svg:rect>, niente genitore.
 *                  Non si tocca: il compilato va al componente, che lo inoltrera' a <Translate>.
 *  "textOnly"   -> host che accetta SOLO testo. Ammette l'hook stringa, mai un nodo.
 *  "opaque"     -> host escluso dalla RegExp dell'utente. Comportamento di oggi, senza avviso:
 *                  l'ha chiesto lui.
 *  "wrappable"  -> host che accetta qualunque figlio.
 *
 * Non sa niente di `wrapOn`, e non deve saperlo: con `tags` assente (autoWrap spento o
 * `autoWrap: true` senza RegExp) ogni host torna "wrappable" comunque. E' chi CHIAMA questa
 * funzione a dover testare `wrapOn` PRIMA — vedi i rami di emissione piu' sotto.
 */
function tagClassOf(parent, tags) {
  if (!parent) return "none";
  if (parent.type === "JSXFragment") return "wrappable";
  if (parent.type !== "JSXElement") return "none";
  const name = parent.openingElement?.name;
  if (name?.type !== "JSXIdentifier" || !/^[a-z]/.test(name.name)) return "none";
  if (TEXT_ONLY_TAGS.has(name.name)) return "textOnly";
  if (tags && !tags.test(name.name)) return "opaque";
  return "wrappable";
}

// Il marcatore spezzato da un tag, visto dai DUE pezzi che il parser JSX ne ricava.
//
// Il criterio e' la POSIZIONE FRA I FRATELLI, non la forma del testo: SOURCE_OPEN e
// SOURCE_CLOSE sono la STESSA stringa ("_%_"), quindi nel caso piu' comune di tutti —
// `<p>_%_hi <b>x</b>_%_</p>` — il pezzo che chiude e' esattamente "_%_", che apre E chiude
// insieme. Un criterio scritto sulle due forme non lo prenderebbe ne' di qua ne' di la'.
//
// Restituisce la causa da nominare, "muto" per il pezzo che non deve dire niente, o null se
// non e' questo il caso.
function splitByMarkup(node, parent, raw) {
  if (node.type !== "JSXText") return null;
  const figli = parent?.children;
  if (!Array.isArray(figli)) return null;
  const i = figli.indexOf(node);
  if (i === -1) return null;
  const nome = (n) =>
    n?.type === "JSXElement" ? `<${n.openingElement?.name?.name ?? "?"}>`
    : n?.type === "JSXExpressionContainer" ? "{…}"
    : null;

  // Il pezzo che APRE: comincia col delimitatore, non lo richiude, e ha del markup subito dopo.
  // Si prova per primo perche' deve vincere anche quando ha un fratello prima di se'.
  const dopo = nome(figli[i + 1]);
  if (dopo !== null && raw.startsWith(SOURCE_OPEN) && !raw.endsWith(SOURCE_CLOSE)) return dopo;

  // Il pezzo che CHIUDE, in qualunque forma: "_%_" nudo oppure "bye_%_". Ha del markup subito
  // prima, e la causa l'ha gia' detta l'altro.
  //
  // `raw.endsWith(SOURCE_CLOSE)` NON e' ridondante: senza, "muto" prenderebbe QUALUNQUE testo
  // che segua un elemento, zittendo anche un marcatore davvero malformato che si trova li' per
  // caso (`<p><b>x</b>_%_delimitatore dimenticato</p>` oggi stampa `malformed`, e senza questa
  // condizione smetterebbe di farlo). Un avviso perso e' peggio di un avviso doppio.
  if (raw.endsWith(SOURCE_CLOSE) && nome(figli[i - 1]) !== null) return "muto";
  return null;
}

// Quanto testo citare di una stringa malformata: abbastanza da riconoscerla nel file, non
// tanto da riempire la riga. Il marcatore sbagliato sta quasi sempre a un capo o all'altro.
const CITAZIONE = 60;
const cita = (testo) => (testo.length <= CITAZIONE ? testo : `${testo.slice(0, CITAZIONE)}…`);

// Un `%s` in un testo che finisce dentro una chiamata senza argomenti — `<__vtTranslate t=.../>`,
// `__vtNode("...")`, `__vtStr("...")` — non ha dove ricevere un valore: la forma emessa e' o
// autochiusa o a un solo argomento. Condiviso da tutti i rami che possono emettere una di
// queste tre forme, perche' la ragione e' sempre la stessa. Categoria a se' (vedi
// languageStatus.js) perche' printWarnings la elenca per esteso o a conteggio a seconda.
function warnIfPlaceholder(value, inner, filename, baseDir, warn) {
  if (value.includes(PLACEHOLDER)) {
    (warn ?? defaultWarn)(
      `auto-wrapped text with a "%s" placeholder in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: ` +
      `"${cita(inner)}" cannot receive arguments — write <Translate t={["${SOURCE_OPEN}...${SOURCE_CLOSE}", value]} /> instead.`,
      "autowrap-placeholder"
    );
    return;
  }
  // Stesso guaio, innesco ICU (piano 4.6.3): "{0}", "{nome}", "{n, plural...}" — un testo
  // auto-avvolto non ha dove ricevere l'argomento, esattamente come "%s".
  if (ICU_TRIGGER_RE.test(value)) {
    (warn ?? defaultWarn)(
      `auto-wrapped text with an ICU argument in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: ` +
      `"${cita(inner)}" cannot receive arguments — write <Translate t={["${SOURCE_OPEN}...${SOURCE_CLOSE}", value]} /> instead.`,
      "autowrap-placeholder"
    );
  }
}

/**
 * Trova i marcatori `_%_..._%_` di un file, li registra nella tabella e — se richiesto —
 * restituisce il sorgente riscritto con i marcatori compilati.
 *
 * @param {string} code
 * @param {object} options
 * @param {string} options.filename - percorso del file (decide il prefisso degli id e i parser plugin)
 * @param {Record<string,string>} options.table - accumulatore id -> testo originale, mutato
 * @param {boolean} [options.includeFallback=true] - incorpora il testo sorgente nel marcatore
 * @param {boolean} [options.rewrite=true] - false: solo estrazione, nessuno splice (comando di sync)
 * @param {boolean|RegExp} [options.autoWrap=false] - riscrive il testo JSX e gli attributi
 *   marcati perche' rendano davvero. `true` accende con i tag sicuri di serie; una RegExp
 *   accende e restringe ai soli tag che la soddisfano. Vedi doc/ImplementationPlans/4_4_0.md.
 * @param {boolean} [options.sourceMaps=false]
 * @param {string} [options.baseDir] - radice da cui relativizzare `filename` nel checksum
 * @param {(message: string, kind?: string) => void} [options.warn] -
 *   dove segnalare marcatori annidati, malformati, spezzati da un tag, collisioni di id, un
 *   a-capo dentro un attributo marcato e i casi di autoWrap che non hanno potuto riscrivere;
 *   il default è la console col prefisso del plugin (vedi markerCore). Il secondo argomento
 *   serve a chi vuole raggrupparli per tipo — il comando di sync ne elenca alcuni per esteso e
 *   altri a conteggio — e si può ignorare.
 * @returns {{ code: string, map: object|null } | null} null se non c'è nulla da riscrivere
 */
export default function extractMarkers(code, options) {
  ensureBabel();
  const {
    filename, table, includeFallback = true, rewrite = true, autoWrap = false,
    sourceMaps = false, baseDir, warn,
  } = options;

  const ast = parseSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    parserOpts: parserOptionsFor(filename),
  });

  // Due variabili invece di una perche' i due significati sono indipendenti: "acceso" e "quali
  // tag". Usare `autoWrap` come booleano dopo questa riga e' un errore: una RegExp e' truthy,
  // ma `autoWrap === true` no.
  const wrapOn = autoWrap === true || autoWrap instanceof RegExp;
  const wrapTags = autoWrap instanceof RegExp ? autoWrap : null;

  const edits = [];
  let wrapped = false;

  // frame verde -> Set di cio' che quel componente usa davvero ("node" e/o "str"). Si riempie
  // durante il walk e si trasforma in edit alla fine: un componente con dieci stringhe riceve
  // UNA const, non dieci.
  const inject = new Map();
  const registraUso = (frame, cosa) => {
    let usati = inject.get(frame);
    if (!usati) { usati = new Set(); inject.set(frame, usati); }
    usati.add(cosa);
  };

  // Il classificatore dei componenti: produce solo una mappa, non cambia niente da solo. Va
  // calcolato comunque, wrapOn spento compreso, perche' costa una visita dell'AST che il
  // resto della funzione userebbe se servisse — ma i rami di emissione la consultano solo
  // quando wrapOn e' acceso, quindi con l'opzione spenta la mappa resta semplicemente inerte.
  const { green } = scanComponents(ast);

  // Gli alias sono identificatori che il transform inietta nel file dell'utente: se per caso
  // esistono gia', ne ombreggerebbero uno suo. La ricerca e' per SOTTOSTRINGA e non per
  // identificatore vero, ed e' eccessiva apposta — costa una scansione lineare su un file che
  // stiamo gia' leggendo per intero, e sbagliarla costa un binding rubato in silenzio. Un solo
  // contatore condiviso da tutti e cinque i nomi: se uno collide, si spostano tutti, cosi'
  // restano leggibili insieme.
  const BASI = ["__vtTranslate", "__vtNode", "__vtStr", "__vtUseNode", "__vtUseStr"];
  let suffisso = "";
  if (wrapOn && rewrite) {
    let n = 1;
    while (BASI.some((b) => code.includes(b + suffisso))) suffisso = String(++n);
  }
  const [aT, aN, aS, aUseN, aUseS] = BASI.map((b) => b + suffisso);

  walk(ast.program, null, null, (node, parent, grand, frames, hostFrames) => {
    const type = node.type;
    if (type !== "StringLiteral" && type !== "JSXText" && type !== "TemplateElement") return;

    const marked = markedTextOf(node, code, parent);
    if (marked === null) {
      // Il caso che prima non lasciava traccia: una stringa che CONTIENE "_%_" senza esserne
      // avvolta per intero. Il riconoscimento guarda inizio e fine, quindi qui non c'è nessun
      // marcatore da estrarre — e finora l'unico segno era che la traduzione non compariva,
      // il che si scopre a schermo, molto dopo. Non è un errore di sintassi e non ferma niente:
      // è quasi sempre un delimitatore dimenticato, o un marcatore in mezzo alla frase.
      const raw = rawTextOf(node, code, parent);
      if (raw !== null && raw.includes(SOURCE_OPEN)) {
        // Il caso piu' specifico — un tag JSX ha spezzato il marcatore — si controlla prima:
        // dice la causa vera invece di uno dei due avvisi generici, e il pezzo "muto" non ne
        // stampa un secondo per lo stesso taglio.
        const causa = splitByMarkup(node, parent, raw);
        if (causa === "muto") return;
        if (causa) {
          (warn ?? defaultWarn)(
            `marker split by ${causa} in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: ` +
            `"${cita(raw)}" — a JSX tag inside a marked text splits it before extraction sees it, ` +
            `and nothing was extracted. Put the whole text in a string literal ` +
            `(<Translate t="${SOURCE_OPEN}hi <b>there</b>${SOURCE_CLOSE}" />), or use a "%s" with the element as argument.`,
            "marker-split"
          );
          return;
        }
        // Stesso canale — e stesso default — dei marcatori annidati: sono la stessa classe di
        // problema, e farne sentire uno solo in `vite dev` vorrebbe dire che il più comune dei
        // due si vede solo lanciando il comando di sync.
        (warn ?? defaultWarn)(
          `malformed marker in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: "${cita(raw)}" contains "${SOURCE_OPEN}" ` +
          `but is not wrapped by it — nothing was extracted. ` +
          `A marker must open AND close the whole string.`,
          "malformed"
        );
      }
      return;
    }

    const inner = innerTextOf(marked);

    // Un a-capo dentro un attributo marcato e' l'ultima divergenza rimasta fra due scritture
    // dello stesso testo dopo la normalizzazione qui sopra: un JSXText lo collassa (React
    // collassa), un attributo quotato no (React non collassa). Non si unifica — cambierebbe
    // cio' che l'utente vede — ma si segnala: chi lo scrive di solito ha solo mandato a capo
    // una riga diventata lunga, senza accorgersi di aver cambiato anche il testo e la chiave.
    if (parent?.type === "JSXAttribute" && inner.includes("\n")) {
      (warn ?? defaultWarn)(
        `newline inside a marked attribute in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: ` +
        `"${cita(inner)}" — the line break is part of the text AND of the key, and it renders. ` +
        `Join the line if you meant a single sentence: a JSX text collapses it, an attribute does not.`,
        "marker-newline"
      );
    }

    const id = registerMarker(inner, filename, table, baseDir, warn);
    if (!rewrite) return;

    const value = compiledMarker(id, inner, includeFallback);

    // Gli offset dei nodi coprono: virgolette comprese per StringLiteral, testo grezzo con
    // gli spazi attorno per JSXText, il solo contenuto fra i delimitatori per TemplateElement
    // (verificato sull'AST, non dedotto).
    let text;
    if (type === "TemplateElement") {
      // `raw` va ri-escapato: un "\" o un "`" nel testo cambierebbe il significato del
      // template. Il `tail` non si tocca perché lo splice non ricostruisce il nodo.
      text = escapeTemplateRaw(value);
    } else if (type === "JSXText") {
      // Espressione, non testo: il marcatore compilato contiene un "<" letterale, che in un
      // nodo di testo JSX non è sintassi valida. `{"..."}` lo tiene una stringa JS a tutti
      // gli effetti e lascia il JSX intatto per il plugin React del progetto.
      //
      // Gli a-capo inghiottiti vengono rimessi in coda. Un marcatore scritto sulla propria
      // riga occupa tre righe di sorgente e ne produrrebbe una sola, spostando in su tutto
      // il resto del file: la nostra sourcemap lo tiene, ma chi viene dopo legge le
      // posizioni dal codice che gli passiamo e le incide come VALORI, non come mappature —
      // il `lineNumber` che il plugin React mette in ogni jsxDEV, e gli stack di errore.
      // Reinserirli è gratis e inerte: un testo JSX di soli spazi che contiene un a-capo
      // viene scartato dal JSX stesso, esattamente come quello che stiamo sostituendo.
      const nl = "\n".repeat(countNewlines(code, node.start, node.end));
      const classe = wrapOn ? tagClassOf(parent, wrapTags) : "none";

      if (classe === "wrappable" || classe === "textOnly") {
        const frame = nearestComponent(frames, green);
        const iniettabile = frame !== null && green.get(frame) !== null;

        if (classe === "wrappable" && iniettabile) {
          // Il figlio diventa una chiamata di funzione: nessun elemento, nessun fiber, nessun
          // {" "} da reinserire (e' una chiamata, non un JSX a se' che il parser potrebbe
          // scartare). Gli spazi a cavallo restano affidati allo stesso meccanismo del ramo
          // sotto: JSX li scarta se contengono un a-capo, li conserva se no, e uno spazio
          // conservato attorno a un'espressione e' gia' testo a se' — non serve avvolgerlo.
          const raw = code.slice(node.start, node.end);
          const lead = /^\s+/.exec(raw)?.[0] ?? "";
          const tail = raw.length > lead.length ? (/\s+$/.exec(raw)?.[0] ?? "") : "";
          const pre = lead !== "" && !lead.includes("\n") ? '{" "}' : "";
          const post = tail !== "" && !tail.includes("\n") ? '{" "}' : "";
          text = `${pre}{${aN}(${jsString(value)})}${post}${nl}`;
          registraUso(frame, "node");
          warnIfPlaceholder(value, inner, filename, baseDir, warn);
        } else if (classe === "textOnly" && iniettabile) {
          // Un tag text-only accetta UN figlio, e uno solo: niente {" "} a cavallo, mai — vedi
          // doc/ImplementationPlans/4_4_0.md § 5.2. Con due o piu' figli (anche solo spazi)
          // <title>/<script> restano vuoti; <style> lo fa in silenzio, senza nemmeno un warning
          // di React.
          text = `{${aS}(${jsString(value)})}${nl}`;
          registraUso(frame, "str");
          warnIfPlaceholder(value, inner, filename, baseDir, warn);
        } else if (classe === "wrappable") {
          // Ripiego 4.3.0: nessun componente riconosciuto in cui iniettare l'hook, ma il tag
          // accetta un figlio elemento — <Translate> lo traduce comunque.
          const raw = code.slice(node.start, node.end);
          const lead = /^\s+/.exec(raw)?.[0] ?? "";
          const tail = raw.length > lead.length ? (/\s+$/.exec(raw)?.[0] ?? "") : "";
          const pre = lead !== "" && !lead.includes("\n") ? '{" "}' : "";
          const post = tail !== "" && !tail.includes("\n") ? '{" "}' : "";
          text = `${pre}<${aT} t={${jsString(value)}} />${post}${nl}`;
          wrapped = true;
          warnIfPlaceholder(value, inner, filename, baseDir, warn);
        } else {
          // textOnly senza componente riconosciuto: nessun ripiego a elemento possibile (il
          // tag non lo accetterebbe comunque), quindi resta il testo di oggi + un avviso che
          // dice perche' non e' stato riscritto.
          text = `{${jsString(value)}}${nl}`;
          (warn ?? defaultWarn)(
            `auto-wrap skipped in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: ` +
            `no enclosing component was recognised, so this text-only tag keeps the compiled ` +
            `marker and will show on screen. Use ts() here, or export the component.`,
            "autowrap-noscope"
          );
        }
      } else {
        // "opaque" (tag escluso dalla RegExp dell'utente, comportamento di oggi senza avviso:
        // l'ha chiesto lui) e "none" (componente, <Foo.Bar>, <svg:rect>, nessun genitore).
        text = `{${jsString(value)}}${nl}`;
      }
    } else {
      // type === "StringLiteral". Tre posizioni possibili, oltre a quella di sempre:
      //
      //  - figlio diretto di JSXAttribute (t="...")
      //  - figlio di JSXExpressionContainer il cui genitore e' JSXAttribute (t={"..."})
      //  - figlio di JSXExpressionContainer il cui genitore e' un elemento host/fragment
      //    (<p>{"..."}</p>) — § 5.3, la stessa emissione dei figli ma sul percorso espressione
      //
      // Ogni altra posizione (livello di modulo, dentro un array, un ramo di ternario) resta
      // sul percorso di sempre: e' li' che vive la maggioranza dei marcatori (vedi il piano,
      // § 6.3), e un componente non puo' render dentro quelle forme comunque.
      const attrNode = parent?.type === "JSXAttribute" ? parent
        : (parent?.type === "JSXExpressionContainer" && grand?.type === "JSXAttribute") ? grand
        : null;
      const isChildExpr = parent?.type === "JSXExpressionContainer" &&
        (grand?.type === "JSXElement" || grand?.type === "JSXFragment");

      if (attrNode) {
        // In un valore di attributo DIRETTO (t="...") la stringa rigenerata lascerebbe gli
        // escape non interpretati (il backslash lì non è un escape): serve un'espressione
        // costruita da zero, come oggi. In forma ESPRESSIONE (t={"..."}) le graffe sono
        // GIA' nel sorgente, fuori dall'intervallo del nodo che si sostituisce (che copre
        // solo il literal fra virgolette): aggiungerne un'altra coppia produce "{{...}}",
        // doppie e non valide — bug reale, misurato: `npm run build` su un progetto con
        // t={"_%_..._%_"} falliva con "Expected `:` but found `}`" prima di questa riga.
        const isAttrDirect = parent?.type === "JSXAttribute";
        const attrPlain = isAttrDirect ? `{${jsString(value)}}` : jsString(value);
        // Stessa distinzione per la forma iniettata: un'espressione (una chiamata) va
        // avvolta in graffe SOLO se il sorgente non le porta gia' con se'.
        const attrExpr = (call) => (isAttrDirect ? `{${call}}` : call);
        const attrName = attrNode.name?.name;

        if (!wrapOn) {
          text = attrPlain;
        } else if (attrName === "key" || attrName === "ref") {
          // Mai tradotti, ma vale la pena dirlo: un `key` tradotto cambia identita' al cambio
          // lingua e rimonta l'intera lista; un `ref` una stringa non la accetta nemmeno.
          text = attrPlain;
          (warn ?? defaultWarn)(
            `marked \`${attrName}\` in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: ` +
            `"${cita(inner)}" is never translated — a translated \`key\` changes with the ` +
            `language and remounts the whole list. Move the marker to a prop, and give ` +
            `\`${attrName}\` a stable id.`,
            "autowrap-noscope"
          );
        } else {
          // L'elemento che porta l'attributo e' host? Le classi di tag non contano qui — una
          // stringa e' una stringa, e <textarea placeholder="…"> va benissimo — quindi non si
          // usa tagClassOf: solo "e' un JSXElement il cui tag comincia per minuscola".
          const host = hostFrames[hostFrames.length - 1];
          const isHostAttr = host?.openingElement?.name?.type === "JSXIdentifier" &&
            /^[a-z]/.test(host.openingElement.name.name);

          if (!isHostAttr) {
            // Attributo su un componente: il compilato va inoltrato a ts()/<Translate>, che
            // traduce davvero. Nessun avviso: e' l'uso normale, non un gap.
            text = attrPlain;
          } else {
            const frame = nearestComponent(frames, green);
            const iniettabile = frame !== null && green.get(frame) !== null;
            if (iniettabile) {
              text = attrExpr(`${aS}(${jsString(value)})`);
              registraUso(frame, "str");
              warnIfPlaceholder(value, inner, filename, baseDir, warn);
            } else {
              text = attrPlain;
              (warn ?? defaultWarn)(
                `auto-wrap skipped in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: ` +
                `no enclosing component was recognised, so the marked attribute \`${attrName ?? "?"}\` ` +
                `keeps the compiled marker and will show on screen. Use ts() here, or export the component.`,
                "autowrap-noscope"
              );
            }
          }
        }
      } else if (isChildExpr) {
        // § 5.3: `<p>{"_%_ciao_%_"}</p>` — stessa emissione dei figli, sullo stesso ramo del
        // container che c'e' gia' nel sorgente: si sostituisce il solo literal.
        if (!wrapOn) {
          text = jsString(value);
        } else {
          const classe = tagClassOf(grand, wrapTags);
          if (classe === "none" || classe === "opaque") {
            text = jsString(value);
          } else {
            const frame = nearestComponent(frames, green);
            const iniettabile = frame !== null && green.get(frame) !== null;
            if (!iniettabile) {
              text = jsString(value);
              (warn ?? defaultWarn)(
                `auto-wrap skipped in ${colorize("nome", `"${relPathOf(filename, baseDir)}"`)}: ` +
                `no enclosing component was recognised, so this text keeps the compiled ` +
                `marker and will show on screen. Use ts() here, or export the component.`,
                "autowrap-noscope"
              );
            } else if (classe === "textOnly") {
              text = `${aS}(${jsString(value)})`;
              registraUso(frame, "str");
              warnIfPlaceholder(value, inner, filename, baseDir, warn);
            } else {
              text = `${aN}(${jsString(value)})`;
              registraUso(frame, "node");
              warnIfPlaceholder(value, inner, filename, baseDir, warn);
            }
          }
        }
      } else {
        text = jsString(value);
      }
    }

    edits.push({ start: node.start, end: node.end, text });
  }, [], []);

  if (!rewrite || edits.length === 0) return null;

  // Il walk scende in ordine di dichiarazione delle proprietà, non di posizione: lo splice
  // ha bisogno degli offset crescenti. Le iniezioni (§ 7.2) hanno `start === end`: un
  // inserimento sullo stesso offset di apertura del corpo, quindi si ordinano correttamente
  // insieme al resto senza bisogno di un criterio a parte.
  for (const [frame, usati] of inject) {
    const dichiarazioni =
      (usati.has("node") ? `const ${aN} = ${aUseN}();` : "") +
      (usati.has("str") ? `const ${aS} = ${aUseS}();` : "");
    const at = green.get(frame);
    edits.push({ start: at, end: at, text: dichiarazioni });
  }
  edits.sort((a, b) => a.start - b.start);

  // In FONDO, non in testa. Gli import ESM sono hoisted, quindi la posizione non conta per il
  // significato; conta eccome per tutto il resto. Appeso in coda, nessuna riga preesistente si
  // sposta: la nostra sourcemap resta l'identità, il `lineNumber` che il plugin React incide in
  // ogni jsxDEV resta giusto, gli stack di errore restano giusti, e una direttiva "use client"
  // resta il primo statement del file. In testa costerebbe tutto questo per niente.
  //
  // I tre flag: `wrapped` copre solo l'alias di <Translate>, come oggi. Gli altri due si
  // leggono dal registro delle iniezioni, che E' gia' l'elenco esatto di cio' che serve — non
  // si aggiungono due variabili da tenere in sync a mano durante il walk.
  let usedNode = false, usedStr = false;
  for (const usati of inject.values()) {
    if (usati.has("node")) usedNode = true;
    if (usati.has("str")) usedStr = true;
  }
  const specs = [];
  if (wrapped) specs.push(`Translate as ${aT}`);
  if (usedNode) specs.push(`useTranslateNode as ${aUseN}`);
  if (usedStr) specs.push(`useTranslateToString as ${aUseS}`);
  const tail = specs.length
    ? `${code.endsWith("\n") ? "" : "\n"}import { ${specs.join(", ")} } from "@sepoina/vitetranslate/react";\n`
    : "";

  return splice(code, edits, filename, sourceMaps, tail);
}

/**
 * Applica gli splice e, se servono, costruisce la sourcemap.
 *
 * La mappa è a livello di riga: ogni riga prodotta punta alla riga sorgente da cui viene.
 * Serve perché una sostituzione può cambiare il conteggio delle righe — un JSXText scritto
 * su tre righe diventa un `{"..."}` su una sola — e senza mappa tutto ciò che sta sotto
 * risulterebbe spostato per il resto della catena.
 */
function splice(code, edits, filename, sourceMaps, tail) {
  let out = "";
  let cursor = 0;
  let srcLine = 0;   // riga sorgente corrispondente a `cursor`
  let outLine = 0;
  const lineToSrc = sourceMaps ? [0] : null;

  // `limit` è la riga sorgente oltre la quale questo pezzo non può spingersi. Per il testo
  // copiato tale e quale non c'è limite: avanza di pari passo col sorgente. Per il testo
  // inserito è la riga in cui finisce il nodo sostituito — così gli a-capo che rimettiamo in
  // coda a un JSXText si riallineano uno a uno con quelli che avevano preso il posto (la
  // mappa torna l'identità), e una sostituzione che invece accorcia si ferma dove deve
  // invece di sfilare in avanti.
  const copy = (chunk, limit) => {
    out += chunk;
    if (!sourceMaps) return;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk.charCodeAt(i) !== 10) continue;
      outLine++;
      if (limit === undefined || srcLine < limit) srcLine++;
      lineToSrc[outLine] = srcLine;
    }
  };

  for (const { start, end, text } of edits) {
    copy(code.slice(cursor, start));
    const endLine = srcLine + countNewlines(code, start, end);
    copy(text, endLine);
    // Le righe sorgente coperte dal nodo sostituito sono consumate anche quando il testo
    // nuovo non le riproduce tutte.
    srcLine = endLine;
    cursor = end;
  }
  copy(code.slice(cursor));

  // La coda mappa sull'ultima riga sorgente: `limit` uguale a `srcLine` impedisce a `copy` di
  // far avanzare la riga sorgente sugli a-capo che stiamo aggiungendo noi. Senza, le righe
  // dell'import punterebbero oltre la fine del sorgente.
  if (tail) copy(tail, srcLine);

  return { code: out, map: sourceMaps ? buildMap(code, filename, lineToSrc) : null };
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function vlq(n) {
  let v = n < 0 ? (-n << 1) | 1 : n << 1;
  let out = "";
  do {
    let digit = v & 31;
    v >>>= 5;
    if (v > 0) digit |= 32;
    out += BASE64[digit];
  } while (v > 0);
  return out;
}

function buildMap(code, filename, lineToSrc) {
  let previous = 0;
  const mappings = new Array(lineToSrc.length);
  for (let i = 0; i < lineToSrc.length; i++) {
    const line = lineToSrc[i] ?? previous;
    // segmento [colonna generata 0, sorgente 0, delta riga, colonna sorgente 0]
    mappings[i] = `AA${vlq(line - previous)}A`;
    previous = line;
  }
  return {
    version: 3,
    sources: [filename],
    sourcesContent: [code],
    names: [],
    mappings: mappings.join(";"),
  };
}
