// L'albero di Settings, la pagina della sezione facoltativa (al posto di Results) che apre
// l'ingranaggio di Project: la sintesi del progetto selezionato in un vscode-tree, sotto l'accordion
// Highlight style. Nessun import di `vscode`: si prova in Node puro.
//
// Le righe sono quelle di summarize.mjs (projectChildren) dopo la prima ("yml tables", che è
// Translations in Project): vitetranslate, package.json, vite.config. Il clic su una riga con `open`
// rimanda `{ cmd: "open", value }`: lo apre l'estensione.
import { projectChildren } from "../../../core/summarize.mjs";
import { colore, NO_PROJECTS, NO_SELECTION, READING } from "../../project/projectState.mjs";
import { LIB_MIN } from "../../../probes/markedScan.mjs";

// `versione` più vecchia di `minimo`, solo su major.minor.patch: una 4.6.4-rc.3 vale la 4.6.4.
export function olderThan(versione, minimo) {
  const n = (v) => String(v).split(/[-+]/)[0].split(".").map((x) => Number(x) || 0);
  const [a, b] = [n(versione), n(minimo)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

/**
 * Il riquadro in testa a Settings: la versione del CLI (la libreria installata nel progetto
 * selezionato, null se manca), `old` se è sotto la minima che l'estensione chiede o manca, e il
 * fumetto della sua icona. Senza progetto selezionato, niente da dire: solo il fumetto.
 * @param {string | null} cli
 * @param {boolean} [selected] - c'è un progetto selezionato
 */
export function versionsState(cli, selected = true) {
  if (!selected) return { cli: null, old: false, tip: "The vitetranslate CLI of the selected project.\nPick one in Selector." };
  if (!cli) return { cli: null, old: true, tip: "vitetranslate is not installed in this project." };
  if (olderThan(cli, LIB_MIN)) return { cli, old: true, tip: `The vitetranslate CLI installed in this project.\nOlder than ${LIB_MIN}: update it to get everything in Results.` };
  return { cli, old: false, tip: "The vitetranslate CLI installed in this project." };
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
 */
export function inspectorState({ hasProjects, project, title = null, dati, cli = null }) {
  const stato = { title: project ? title : null, message: null, details: null, versions: versionsState(cli, !!project) };
  if (!hasProjects) return { ...stato, message: NO_PROJECTS };
  if (!project) return { ...stato, message: NO_SELECTION };
  // Finché la lettura non arriva, mai le righe di un altro progetto né di un config cambiato.
  if (!dati) return { ...stato, message: READING };
  const [, ...resto] = projectChildren({ project, ...dati });
  return { ...stato, details: resto.map((r) => nodo(r, project.dir)) };
}
