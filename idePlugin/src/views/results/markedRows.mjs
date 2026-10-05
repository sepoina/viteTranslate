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
// che dice in che forma è scritta nel sorgente (PASSED). Il filtro — tutte le voci, o solo quelle
// di un problema — si sceglie in Selector (selectorState.mjs): si vedono solo le scelte che
// trovano qualcosa, e il filtro intero solo se oltre ad All ce n'è almeno una. Qui le sue voci
// (filterItems), e l'albero già filtrato (markedChildren).
import path from "node:path";
import { errorLine } from "../../core/summarize.mjs";
import { pathKey } from "../../core/pickProject.mjs";

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

/** I modi del filtro, nell'ordine in cui si vedono. "all" è quello di partenza. */
export const FILTERS = ["all", "malformed", "notSynced", "untranslated"];

// Quali problemi mostra ogni filtro. Una voce con problemi di più famiglie compare in ognuna.
const FAMIGLIE = {
  malformed: ["malformed"],
  notSynced: ["notSynced"],
  untranslated: ["untranslated", "notFullyTranslated"],
};

// Le scelte del filtro oltre ad All: etichetta, tooltip, e cosa dire quando non trovano niente.
const SCELTE = {
  malformed: { label: "Malformed", tooltip: "the extraction complained, or the file could not be read", vuoto: ["nothing malformed", "the extraction has no complaints"] },
  notSynced: { label: "Not synced", tooltip: "not in the language files yet: run the sync", vuoto: ["nothing to sync", "every marked entry is in the language files"] },
  untranslated: { label: "Untranslated", tooltip: "missing in some target language, or in all", vuoto: ["nothing untranslated", "every marked entry is translated everywhere"] },
};

const conProblemi = (e) => e.problems?.length > 0;
const della = (filtro) => (e) => e.problems?.some((p) => FAMIGLIE[filtro].includes(p.kind)) ?? false;

/**
 * Quante voci in tutto, quante con un problema qualsiasi (issues) e quante per filtro. Un file
 * che non si è potuto leggere conta come un malformed: lo mostra quel filtro.
 */
export function markedCounts(marked) {
  const n = { all: 0, issues: 0, malformed: 0, notSynced: 0, untranslated: 0 };
  for (const f of marked?.files ?? []) {
    if (f.error) n.malformed++;
    for (const e of f.entries) {
      n.all++;
      if (conProblemi(e)) n.issues++;
      for (const filtro of Object.keys(FAMIGLIE)) if (della(filtro)(e)) n[filtro]++;
    }
  }
  return n;
}

/**
 * Le voci del filtro, con i loro conteggi: All e le scelte che trovano qualcosa. Diventano le righe
 * di Filter in Selector (selectorState.mjs). Vuoto se oltre ad All non c'è niente da scegliere
 * (anche su una scansione fallita): allora il filtro non si mostra.
 */
export function filterItems(marked) {
  if (!marked?.ok) return [];
  const n = markedCounts(marked);
  const scelte = Object.entries(SCELTE)
    .filter(([value]) => n[value] > 0)
    .map(([value, { label, tooltip }]) => ({ value, label, description: `${n[value]} of ${n.all}`, tooltip }));
  return scelte.length ? [{ value: "all", label: "All", description: String(n.all) }, ...scelte] : [];
}

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

/**
 * Quante voci mostra Results col filtro `filter`, prima della ricerca: Search in Selector compare
 * solo se è più di zero (selectorState.mjs). Un file illeggibile conta sotto Malformed.
 */
export function shownCount(marked, filter = "all") {
  if (!marked?.ok) return 0;
  const n = markedCounts(marked);
  return FAMIGLIE[filter] ? n[filter] : n.all;
}

// Il confronto della ricerca: senza maiuscole e senza accenti ("citta" trova "Città").
const normale = (testo) => String(testo ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * La ricerca di Selector sui file di una scansione: un file il cui percorso contiene il testo resta
 * intero; negli altri restano le voci il cui testo lo contiene. Un testo vuoto non toglie niente.
 *
 * @param {object[]} files - `files` di una scansione, già filtrati
 * @param {string} search
 * @returns {object[]}
 */
export function searchFiles(files, search) {
  const q = normale(search.trim());
  if (!q) return files;
  return files
    .map((f) => (normale(f.rel).includes(q) ? f : { ...f, entries: f.entries.filter((e) => normale(e.text).includes(q)), error: undefined }))
    .filter((f) => f.entries.length || f.error);
}

/** Il riassunto di una scansione, per l'intestazione della sezione o la riga del progetto. */
export function markedSummary(marked) {
  if (!marked?.ok) return undefined;
  const n = markedCounts(marked);
  const file = marked.files.filter((f) => f.entries.some((e) => e.id !== null)).length;
  return `${n.all} marked · ${plurale(file, "file", "files")}` + (n.issues ? ` · ${n.issues} to check` : "");
}

/**
 * @param {object} p
 * @param {string} p.dir - cartella del progetto
 * @param {object} p.input - da markedInput
 * @param {object} p.marked - la risposta di markedProbe.mjs
 * @param {string} [p.filter] - quali voci: una di FILTERS
 * @param {string} [p.search] - il testo di Search in Selector (searchFiles): vuoto, tutte
 * @param {Record<string, string>} [p.glyphs] - da glyphsOf
 */
export function markedChildren({ dir, input, marked, filter = "all", search = "", glyphs = GLYPHS }) {
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
  // Un file che non si è potuto leggere resta sotto Malformed.
  const files = FAMIGLIE[filter]
    ? marked.files.map((f) => ({ ...f, entries: f.entries.filter(della(filter)) })).filter((f) => f.entries.length || (filter === "malformed" && f.error))
    : marked.files;
  if (!files.length) {
    const [label, description] = SCELTE[filter].vuoto;
    return [{ label, description, icon: "pass" }];
  }
  const trovati = searchFiles(files, search);
  if (!trovati.length) {
    return [{ label: `nothing matches "${search.trim()}"`, description: SCELTE[filter] ? `in ${SCELTE[filter].label}` : undefined, icon: "search" }];
  }
  const righe = folderRows(buildTree(trovati), baseDir, "", glyphs);
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
    // La chiave della voce nei file di lingua: la ricorda l'estensione quando la si seleziona.
    keyId: e.id ?? undefined,
  };
}

/** La riga che tiene il posto di una sezione mentre carica: "Loading my-app…", con la rotella. */
export function loadingRow(label) {
  return { label, icon: "loading~spin" };
}

// Perché un file è bloccato: il segno sulla sua riga, e la spiegazione nel tooltip.
const BLOCCO = {
  saved: { badge: "⏳ updating", perché: "Saved: this file is being scanned again. Its lines may be out of date." },
  unsaved: { badge: "✎ unsaved", perché: "Unsaved changes: lines may be out of date until you save." },
};

/**
 * Un disegno superato, bloccato file per file: la riga di un file salvato o modificato porta il
 * segno, e le sue voci perdono il clic (la riga a cui portavano può non essere più quella). Il
 * resto non cambia. Gli id non cambiano (li calcola `fissa` da etichetta e chiave), quindi VS Code
 * ricorda cosa era aperto.
 *
 * @param {object[]} rows - le righe di Marked (albero, e il filtro davanti)
 * @param {Map<string, "saved" | "unsaved">} bloccati - per pathKey del file
 * @returns {object[]}
 */
export function frozenRows(rows, bloccati) {
  if (!bloccati.size) return rows;
  const giro = (righe) =>
    righe.map((r) => {
      const stato = r.kind === "file" && r.resource ? bloccati.get(pathKey(r.resource)) : undefined;
      if (stato) return bloccaFile(r, BLOCCO[stato]);
      return r.kind === "folder" && r.children ? { ...r, children: giro(r.children) } : r;
    });
  return giro(rows);
}

function bloccaFile(riga, { badge, perché }) {
  return {
    ...riga,
    description: riga.description ? `${badge} · ${riga.description}` : badge,
    tooltip: [riga.tooltip, perché].filter(Boolean).join("\n\n"),
    children: riga.children?.map((v) => ({ ...v, open: undefined, tooltip: [perché, v.tooltip].filter(Boolean).join("\n\n") })),
  };
}
