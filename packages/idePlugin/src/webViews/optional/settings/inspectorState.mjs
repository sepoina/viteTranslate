// L'albero di Settings, la pagina della sezione facoltativa (al posto di Results) che apre
// l'ingranaggio di Project: la sintesi del progetto selezionato in un vscode-tree, sotto l'accordion
// Highlight style. Nessun import di `vscode`: si prova in Node puro.
//
// Le righe sono quelle di summarize.mjs (projectChildren) dopo la prima ("yml tables", che è
// Translations in Project): vitetranslate, package.json, vite.config. Il clic su una riga con `open`
// rimanda `{ cmd: "open", value }`: lo apre l'estensione. Con l'albero viaggia la sezione VERSION
// (versionsState).
import { projectChildren } from "../../../core/summarize.mjs";
import { colore, NO_PROJECTS, NO_SELECTION, READING } from "../../project/projectState.mjs";
import { LIB_MIN, IDE_API_MIN } from "../../../probes/markedScan.mjs";

// `versione` più vecchia di `minimo`, solo su major.minor.patch: una 4.6.4-rc.3 vale la 4.6.4.
export function olderThan(versione, minimo) {
  const n = (v) => String(v).split(/[-+]/)[0].split(".").map((x) => Number(x) || 0);
  const [a, b] = [n(versione), n(minimo)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

// La libreria del progetto selezionato, in VERSION: `old` se manca o è sotto LIB_MIN.
function libreriaDi(library, selected) {
  if (!selected) return { text: "—", old: false, tip: "The vitetranslate library of the selected project.\nPick one in Selector." };
  if (!library) return { text: "not installed", old: true, tip: "vitetranslate is not installed in this project." };
  if (olderThan(library, LIB_MIN)) return { text: library, old: true, tip: `The vitetranslate library installed in this project.\nOlder than ${LIB_MIN}: update it, Results needs it.` };
  return { text: library, old: false, tip: "The vitetranslate library installed in this project." };
}

// L'IDE_API che quella libreria dichiara (lib/ide/scan.js): lo sa solo una scansione, che la carica
// (markedScan.mjs). `old` se manca o è sotto IDE_API_MIN; senza scansione, ancora niente da dire.
function ideDi(marked, selected) {
  const tip = "The IDE API of the project's library: what Results reads it through.";
  if (!selected) return { text: "—", old: false, tip: `${tip}\nPick a project in Selector.` };
  if (typeof marked?.ideApi === "number") {
    if (marked.ideApi < IDE_API_MIN) return { text: String(marked.ideApi), old: true, tip: `${tip}\nOlder than ${IDE_API_MIN}: update the library.` };
    return { text: String(marked.ideApi), old: false, tip };
  }
  if (marked?.code === "NO_LIBRARY") return { text: "none", old: true, tip: `${tip}\nNo library, no IDE API.` };
  if (marked?.code === "TOO_OLD") return { text: "none", old: true, tip: `${tip}\nThis library predates it: update the library.` };
  if (marked?.code === "UNREADABLE_LIBRARY") return { text: "?", old: true, tip: `${tip}\nThe library won't load, so it can't tell.` };
  return { text: "—", old: false, tip: `${tip}\nKnown once Results has scanned the project.` };
}

/**
 * La sezione VERSION di Settings: la versione di questa estensione, e per il progetto selezionato
 * la libreria installata e il suo IDE_API, ognuna col suo testo, il giallo (`old`) e il fumetto.
 * Le minime che l'estensione chiede (LIB_MIN, IDE_API_MIN) le scrive la pagina, fisse.
 * @param {object} p
 * @param {string | null} [p.extension] - la versione dell'estensione
 * @param {boolean} [p.selected] - c'è un progetto selezionato
 * @param {string | null} [p.library] - @sepoina/vitetranslate nel suo node_modules, null se manca
 * @param {{ code?: string, ideApi?: number } | null} [p.marked] - la sua ultima scansione, se c'è
 */
export function versionsState({ extension = null, selected = true, library = null, marked = null } = {}) {
  return { extension: extension ?? "—", library: libreriaDi(library, selected), ide: ideDi(marked, selected) };
}

// Una riga, con i figli. L'id è il percorso delle etichette: la pagina lo usa per ricordare cosa è
// aperto fra un disegno e l'altro. Settings si apre tutto chiuso (`expanded` falso): si apre quello
// che interessa, e la pagina lo ricorda.
function nodo(riga, padre) {
  const id = `${padre}/${riga.label}`;
  const children = riga.children?.length ? riga.children.map((f) => nodo(f, id)) : undefined;
  return {
    id,
    label: riga.label,
    description: riga.description,
    tooltip: riga.tooltip,
    icon: riga.icon,
    color: colore(riga.iconColor),
    open: riga.open,
    expanded: false,
    children,
  };
}

/**
 * @param {object} p
 * @param {boolean} p.hasProjects - il workspace ha almeno un progetto Vite
 * @param {{ dir: string, configFile: string } | null} p.project - il selezionato
 * @param {string | null} [p.title] - il suo nome, per l'intestazione della sezione
 * @param {{ pkg: object, probe: object } | undefined} [p.dati] - la sua lettura, se è arrivata
 * @param {string | null} [p.cli] - la versione di @sepoina/vitetranslate installata nel progetto
 * @param {object | null} [p.marked] - la sua ultima scansione, per l'IDE_API (VERSION)
 * @param {string | null} [p.extension] - la versione di questa estensione (VERSION)
 */
export function inspectorState({ hasProjects, project, title = null, dati, cli = null, marked = null, extension = null }) {
  const versions = versionsState({ extension, selected: !!project, library: cli, marked });
  const stato = { title: project ? title : null, message: null, details: null, versions };
  if (!hasProjects) return { ...stato, message: NO_PROJECTS };
  if (!project) return { ...stato, message: NO_SELECTION };
  // Finché la lettura non arriva, mai le righe di un altro progetto né di un config cambiato.
  if (!dati) return { ...stato, message: READING };
  const [, ...resto] = projectChildren({ project, ...dati });
  return { ...stato, details: resto.map((r) => nodo(r, project.dir)) };
}
