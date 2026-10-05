// Lo stato di Inspector, la pagina della sezione facoltativa (al posto di Results) che il clic
// sull'icona (i) di Project apre: la sintesi del progetto selezionato in un vscode-tree. Nessun
// import di `vscode`: si prova in Node puro.
//
// Le righe sono quelle di summarize.mjs (projectChildren) dopo la prima ("yml tables", che è
// Languages in Project): vitetranslate, package.json, vite.config. Il clic su una riga con `open`
// rimanda `{ cmd: "open", value }`: lo apre l'estensione.
import { projectChildren } from "../../../core/summarize.mjs";
import { colore, NO_PROJECTS, NO_SELECTION, READING } from "../../project/projectState.mjs";

// Una riga, con i figli. L'id è il percorso delle etichette: la pagina lo usa per ricordare cosa è
// aperto fra un disegno e l'altro.
function nodo(riga, padre) {
  const id = `${padre}/${riga.label}`;
  return {
    id,
    label: riga.label,
    description: riga.description,
    tooltip: riga.tooltip,
    icon: riga.icon,
    color: colore(riga.iconColor),
    open: riga.open,
    expanded: !!riga.expanded,
    children: riga.children?.length ? riga.children.map((f) => nodo(f, id)) : undefined,
  };
}

/**
 * @param {object} p
 * @param {boolean} p.hasProjects - il workspace ha almeno un progetto Vite
 * @param {{ dir: string, configFile: string } | null} p.project - il selezionato
 * @param {string | null} [p.title] - il suo nome, per l'intestazione della sezione
 * @param {{ pkg: object, probe: object } | undefined} [p.dati] - la sua lettura, se è arrivata
 */
export function inspectorState({ hasProjects, project, title = null, dati }) {
  const stato = { title: project ? title : null, message: null, details: null };
  if (!hasProjects) return { ...stato, message: NO_PROJECTS };
  if (!project) return { ...stato, message: NO_SELECTION };
  // Finché la lettura non arriva, mai le righe di un altro progetto né di un config cambiato.
  if (!dati) return { ...stato, message: READING };
  const [, ...resto] = projectChildren({ project, ...dati });
  return { ...stato, details: resto.map((r) => nodo(r, project.dir)) };
}
