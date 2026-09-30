// Dalla risposta di markedProbe.mjs alle righe della sezione Marked: l'albero dei file di srcDir
// che contengono voci marcate, e sotto ogni file le sue voci, nell'ordine del sorgente.
//
// Stesse righe di summarize.mjs, con in più: `key` (l'id del TreeItem al posto dell'etichetta:
// due voci con lo stesso testo nello stesso file hanno la stessa etichetta), `kind` ("file" o
// "folder": l'icona la sceglie il tema dei file dell'editor, da `resource`) e `line`/`column`
// (dove portare il cursore al clic). Nessun import di `vscode`.
//
// Ogni voce porta davanti al testo un glifo solo, nessuna icona: i glifi dei suoi problemi (vedi
// markedProbe.mjs), quelli di `errorSolve.mark` del progetto — chi li ha cambiati in vite.config
// li ritrova qui uguali a come li vede a schermo nell'app — oppure, se è a posto, un glifo verde
// che dice in che forma è scritta nel sorgente (PASSED). In testa alla sezione il filtro, un
// elenco a scelta singola (choiceList.mjs, lo stesso di Configs): solo le voci con problemi, o
// tutte. Qui le sue voci (filterItems); le righe col segno le fa MarkedTree.
import path from "node:path";
import { errorLine } from "./summarize.mjs";

// Oltre, l'etichetta di una voce si tronca: il testo intero è nel tooltip.
const MAX_LABEL = 80;

const unaRiga = (testo) => {
  const piatto = String(testo).replace(/\s+/g, " ").trim();
  return piatto.length <= MAX_LABEL ? piatto : `${piatto.slice(0, MAX_LABEL - 1)}…`;
};

const plurale = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;

// I default di errorSolve.mark (lib/errorSolve.js, ERROR_SOLVE_DEFAULTS): se la libreria li
// cambia, vanno cambiati anche qui. `notSynced` non è di errorSolve — a schermo una voce mai
// sincronizzata non esiste ancora — ed è solo del pannello.
const GLYPHS = { malformed: "‼️", notSynced: "🔄", untranslated: "🔸", notFullyTranslated: "🔹" };

// Il glifo verde di una voce a posto, per forma (il `form` di onMarker in extractMarkers.js).
// Quattro famiglie, non sette: conta come la si scrive, non il nodo che Babel ci vede.
export const PASSED = {
  string: "🦎", // "_%_…_%_" in una stringa o in un template senza valori, nel codice
  jsxText: "♻️", // nel JSX: testo fra i tag…
  attribute: "🍃", // …o valore di un attributo
  translate: "🍀", // la macro <Translate>…</Translate>…
  sentence: "🌿", // …o una frase marcata spezzata da tag o valori (autoWrap)
  template: "✳️", // un template marcato con `${…}`…
  ts: "🥦", // …o ts`…`
};
// Una libreria che non riporta la forma (4.6.3 e prima).
const PASSED_DEFAULT = PASSED.jsxText;

const FORMA = {
  string: "a marked string in code",
  jsxText: "a marked JSX text",
  attribute: "a marked JSX attribute",
  translate: "<Translate>…</Translate>",
  sentence: "a marked sentence with tags or values",
  template: "a marked template with values",
  ts: "ts`…`",
};

// Nell'ordine in cui compaiono davanti al testo e nel tooltip: prima ciò che non funziona, poi
// ciò che manca.
const KINDS = ["malformed", "notSynced", "untranslated", "notFullyTranslated"];

const SPIEGA = {
  malformed: (d) => d,
  notSynced: (d) => `not in the language files yet (${d.join(", ")}): run the sync`,
  untranslated: (d) => `untranslated: ${d.join(", ")}`,
  notFullyTranslated: (d) => `still missing in ${d.join(", ")}`,
};

/**
 * I glifi del progetto: `errorSolve.mark` come scritto in vite.config, e il default dove non c'è.
 * Un mark spento (`""`, `false`) prende il default: qui un problema deve pur vedersi.
 */
export function glyphsOf(errorSolve) {
  const mark = errorSolve?.mark ?? {};
  const fuori = { ...GLYPHS };
  for (const k of KINDS) if (typeof mark[k] === "string" && mark[k] !== "") fuori[k] = mark[k];
  return fuori;
}

/** I due modi del filtro. */
export const FILTERS = ["problems", "all"];

const conProblemi = (e) => e.problems?.length > 0;

/** Quante voci in tutto e quante con problemi. */
export function markedCounts(marked) {
  let tutte = 0;
  let problemi = 0;
  for (const f of marked?.files ?? []) {
    for (const e of f.entries) {
      tutte++;
      if (conProblemi(e)) problemi++;
    }
  }
  return { all: tutte, problems: problemi };
}

/**
 * Le due voci del filtro, in testa alla sezione, con i loro conteggi. Diventano righe col segno
 * nel ChoiceList di MarkedTree (choiceList.mjs); solo se la scansione ha trovato qualcosa
 * (hasEntries): un filtro sopra un errore non filtra niente.
 */
export function filterItems(marked) {
  const n = markedCounts(marked);
  return [
    { value: "problems", label: "Problematic only", description: `${n.problems} of ${n.all}` },
    { value: "all", label: "All", description: String(n.all) },
  ];
}

/** La scansione è riuscita e ha trovato qualcosa da elencare. */
export const hasEntries = (marked) => Boolean(marked?.ok && marked.files.length);

/**
 * Gli argomenti di markedProbe.mjs, dalla risposta di probe.mjs. Se il vite.config non dice
 * dove stanno i sorgenti, la riga che spiega perché.
 *
 * @returns {{ input: object } | { rows: object[] }}
 */
export function markedInput(probe) {
  if (probe.untrusted) {
    return { rows: [{ label: "Restricted Mode", description: "trust the workspace to scan the source", icon: "shield" }] };
  }
  if (!probe.ok) {
    return { rows: [{ label: "vite.config not read", description: errorLine(probe), tooltip: probe.error, icon: "error" }] };
  }
  const c = probe.vitetranslate;
  if (!c) return { rows: [{ label: "vitetranslate is not registered in vite.config", icon: "warning" }] };
  return {
    input: { baseDir: c.baseDir ?? ".", srcDir: c.srcDir ?? "src", localeDir: c.localeDir, sourceLanguage: c.sourceLanguage, autoWrap: c.autoWrap ?? false },
    glyphs: glyphsOf(c.errorSolve),
  };
}

/** Il riassunto di una scansione, per l'intestazione della sezione o la riga del progetto. */
export function markedSummary(marked) {
  if (!marked?.ok) return undefined;
  const n = markedCounts(marked);
  const file = marked.files.filter((f) => f.entries.some((e) => e.id !== null)).length;
  return `${n.all} marked · ${plurale(file, "file", "files")}` + (n.problems ? ` · ${n.problems} to check` : "");
}

/**
 * @param {object} p
 * @param {string} p.dir - cartella del progetto
 * @param {object} p.input - da markedInput
 * @param {object} p.marked - la risposta di markedProbe.mjs
 * @param {"problems" | "all"} [p.filter] - quali voci
 * @param {Record<string, string>} [p.glyphs] - da glyphsOf
 */
export function markedChildren({ dir, input, marked, filter = "all", glyphs = GLYPHS }) {
  if (!marked.ok) {
    const perché = {
      NO_LIBRARY: "run npm install in the project",
      NO_SRCDIR: "check srcDir in vite.config",
      VT_NO_BABEL: "@babel/core is a peer dependency of @sepoina/vitetranslate",
    };
    return [{ label: String(marked.error).split("\n")[0], description: perché[marked.code], tooltip: marked.error, icon: "error" }];
  }
  if (!marked.files.length) {
    return [{
      label: "nothing marked yet",
      description: `${plurale(marked.scanned, "file", "files")} scanned in ${input.srcDir}/`,
      tooltip: "Wrap a string in _%_…_%_, or use <Translate>, to see it here.",
      icon: "info",
    }];
  }
  const baseDir = path.resolve(dir, input.baseDir);
  const senzaRiga = marked.files.some((f) => f.entries.some((e) => e.id !== null && e.line === null));
  const files = filter === "problems"
    ? marked.files.map((f) => ({ ...f, entries: f.entries.filter(conProblemi) })).filter((f) => f.entries.length || f.error)
    : marked.files;
  if (!files.length) {
    return [{ label: "nothing to check", description: "every marked entry is translated everywhere", icon: "pass" }];
  }
  const righe = folderRows(buildTree(files), baseDir, "", glyphs);
  if (senzaRiga) {
    righe.push({
      label: `@sepoina/vitetranslate ${marked.version} does not report lines`,
      description: "update it to jump to each entry",
      icon: "info",
    });
  }
  return righe;
}

// I percorsi `rel` di walkSource, sempre con "/", relativi a baseDir.
function buildTree(files) {
  const radice = { dirs: new Map(), files: [] };
  for (const file of files) {
    const parti = file.rel.split("/");
    parti.pop();
    let nodo = radice;
    for (const parte of parti) {
      if (!nodo.dirs.has(parte)) nodo.dirs.set(parte, { dirs: new Map(), files: [] });
      nodo = nodo.dirs.get(parte);
    }
    nodo.files.push(file);
  }
  return radice;
}

const perNome = (a, b) => a.label.localeCompare(b.label);

// Cartelle prima, poi file, come l'Explorer. Una catena di cartelle con un'unica sottocartella e
// nessun file diventa una riga sola ("src/components"), come le cartelle compatte dell'Explorer.
function folderRows(nodo, baseDir, rel, glyphs) {
  const cartelle = [...nodo.dirs].map(([nome, figlio]) => {
    let etichetta = nome;
    let percorso = rel ? `${rel}/${nome}` : nome;
    while (figlio.files.length === 0 && figlio.dirs.size === 1) {
      const [[nomeFiglio, nipote]] = figlio.dirs;
      etichetta += `/${nomeFiglio}`;
      percorso += `/${nomeFiglio}`;
      figlio = nipote;
    }
    return {
      label: etichetta,
      key: etichetta,
      kind: "folder",
      resource: path.join(baseDir, percorso),
      expanded: true,
      children: folderRows(figlio, baseDir, percorso, glyphs),
    };
  });
  return [...cartelle.sort(perNome), ...nodo.files.map((f) => fileRow(f, glyphs)).sort(perNome)];
}

function fileRow(file, glyphs) {
  const base = { label: path.posix.basename(file.rel), kind: "file", resource: file.path, tooltip: file.rel };
  if (file.error) return { ...base, description: file.error, icon: "warning", open: file.path };
  return {
    ...base,
    description: String(file.entries.length),
    children: file.entries.map((e, i) => entryRow(e, i, file.path, glyphs)),
  };
}

function entryRow(e, i, file, glyphs) {
  const problemi = [...(e.problems ?? [])].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  const verde = PASSED[e.form] ?? PASSED_DEFAULT;
  const segni = problemi.map((p) => glyphs[p.kind]).join("") || verde;
  const spiegazioni = problemi.length
    ? problemi.map((p) => `${glyphs[p.kind]} ${SPIEGA[p.kind](p.detail)}`)
    : [`${verde} passed${FORMA[e.form] ? `: ${FORMA[e.form]}` : ""}`];
  return {
    label: `${segni} ${unaRiga(e.text)}`,
    key: e.id === null ? `warning#${i}` : e.line === null ? `${e.id}#${i}` : `${e.id}@${e.line}:${e.column}`,
    description: e.line === null ? undefined : `:${e.line}`,
    // Una voce senza chiave è un avviso: il suo testo è già la spiegazione.
    tooltip: e.id === null ? e.text : [e.text, spiegazioni.join("\n"), e.id].filter(Boolean).join("\n\n"),
    open: file,
    line: e.line,
    column: e.column,
  };
}
