// Lo stato della sezione Project (una webview, projectPage.mjs): quello che l'estensione le manda
// con postMessage. Nessun import di `vscode`: si prova in Node puro.
//
// Le righe sono quelle di summarize.mjs (projectChildren), tradotte per la pagina:
//   - la prima, "yml tables", diventa Languages: un file di lingua per riga, nello stile di Config.
//     Senza file (localeDir assente, vite.config non letto…) resta la sua frase, in una nota;
//   - le altre (vitetranslate, package.json, vite.config) diventano l'albero di Details.
// I colori di tema delle icone (`iconColor`, un id come "testing.iconPassed") diventano la variabile
// CSS che VS Code dà alla webview (--vscode-testing-iconPassed). Il clic su una riga con `open`
// rimanda `{ cmd: "open", value }`: lo apre l'estensione.
import { projectChildren } from "./summarize.mjs";
import { LLM_OFF, LLM_ICON } from "./projectPage.mjs";

export const NO_PROJECTS = "No Vite project in this workspace: no vite.config.* was found.";
export const NO_SELECTION = "Select a project in Selector to see its setup.";
export const READING = "Reading vite.config…";

/**
 * Dove sta la chiave `id` nel testo di un file di lingua: la riga che comincia con `id:` (le
 * chiavi stanno a colonna 0, in tabella o sotto "to be translated"), e la colonna del valore.
 * Da 1, o null se la chiave non c'è (non ancora sincronizzata).
 *
 * @param {string} testo
 * @param {string} id
 * @returns {{ line: number, column: number } | null}
 */
export function keyPosition(testo, id) {
  const righe = String(testo).split(/\r?\n/);
  const i = righe.findIndex((r) => r.startsWith(`${id}:`));
  if (i === -1) return null;
  const dopo = righe[i].slice(id.length + 1);
  return { line: i + 1, column: id.length + 2 + (dopo.length - dopo.trimStart().length) };
}

const colore = (id) => (id ? `var(--vscode-${id.replace(/\./g, "-")})` : undefined);

// Una riga di Details, con i figli. L'id è il percorso delle etichette: la pagina lo usa per
// ricordare cosa è aperto fra un disegno e l'altro.
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
 * @param {object | null} [p.stats] - i conteggi delle tabelle dall'ultima scansione di Results
 * @param {boolean} [p.llm] - il progetto ha un blocco `llm` nelle opzioni del plugin
 * @param {string | null} [p.jumpKey] - la chiave scelta per ultima in Results, se è di questo
 *   progetto: il clic su una lingua apre il file lì, e la pagina lo segnala con un lampo
 */
export function projectState({ hasProjects, project, title = null, dati, stats = null, llm = false, jumpKey = null }) {
  const acceso = !!project && !!llm;
  const stato = {
    title: project ? title : null,
    message: null,
    languages: null,
    languagesNote: null,
    languagesTooltip: null,
    jumpKey: null,
    details: null,
    // Il bottone LLM: col sottomenu solo con un progetto selezionato che ha `llm`; altrimenti il
    // `?` e il tooltip che manda a Help.
    llm: acceso,
    llmOff: LLM_OFF,
    llmIcon: LLM_ICON[acceso ? "on" : "off"],
  };
  if (!hasProjects) return { ...stato, message: NO_PROJECTS };
  if (!project) return { ...stato, message: NO_SELECTION };
  // Finché la lettura non arriva, mai le righe di un altro progetto né di un config cambiato.
  if (!dati) return { ...stato, message: READING };

  const [tabelle, ...resto] = projectChildren({ project, ...dati, stats });
  if (tabelle.children) {
    stato.languages = tabelle.children.map((r) => ({
      value: r.open,
      label: r.label,
      description: r.description,
      tooltip: r.tooltip,
      icon: r.icon,
      color: colore(r.iconColor),
      badge: r.badge,
    }));
    stato.languagesTooltip = tabelle.tooltip ?? null;
    // Il lampo solo se c'è dove cliccare.
    stato.jumpKey = jumpKey ?? null;
  } else {
    stato.languagesNote = { text: tabelle.description, tooltip: tabelle.tooltip, icon: tabelle.icon };
  }
  stato.details = resto.map((r) => nodo(r, project.dir));
  return stato;
}
