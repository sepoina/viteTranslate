// Lo stato della sezione Selector (una webview, selectorPage.mjs): quello che l'estensione le manda
// con postMessage. Nessun import di `vscode`: si prova in Node puro.
//
// Due elenchi a scelta singola, ciascuno solo se c'è davvero da scegliere, e un campo di ricerca:
//   - projects: i progetti Vite del workspace, se più di uno (con uno solo, quello è il selezionato
//     e non c'è niente da chiedere);
//   - filters: le scelte del filtro di Results (filterItems in markedRows.mjs), se oltre ad All ce
//     n'è almeno una che trova qualcosa;
//   - search: il testo che restringe Results (searchFiles in markedRows.mjs). Si vede se col filtro
//     scelto Results ha qualcosa da mostrare, e resta finché c'è un testo: una ricerca che non trova
//     niente non deve far sparire il campo in cui la si sta scrivendo.
// La webview non decide niente: disegna questo, e rimanda i clic.
import { projectRow } from "../../core/summarize.mjs";
import { filterItems, shownCount } from "../../views/results/markedRows.mjs";

/**
 * @param {object} p
 * @param {Array<{ dir: string, configFile: string }>} p.projects - l'elenco dei progetti
 * @param {string | null} p.selected - la cartella del selezionato (l'unico, se ce n'è uno solo)
 * @param {string[]} p.roots - le cartelle del workspace, per la descrizione di ogni riga
 * @param {(dir: string) => string | null} p.nameOf - il name del package.json
 * @param {object | null} [p.marked] - l'ultima scansione del selezionato (markedScan.mjs)
 * @param {string} [p.filter] - il filtro scelto: una voce di FILTERS
 * @param {string} [p.search] - il testo di ricerca
 * @param {string | null} [p.starting] - all'avvio, cosa si sta preparando: la pagina mostra solo questo
 * @returns {{ empty: boolean, projects: object[] | null, selected: string | null,
 *   filters: object[] | null, filter: string, search: string, searchVisible: boolean, starting: string | null }}
 */
export function selectorState({ projects, selected, roots, nameOf, marked = null, filter = "all", search = "", starting = null }) {
  const righe = projects.length > 1
    ? projects.map((p) => {
      const { label, description, tooltip } = projectRow(p, { roots, name: nameOf(p.dir) });
      return { value: p.dir, label, description, tooltip };
    })
    : null;
  const voci = selected && marked ? filterItems(marked) : [];
  const filtro = voci.some((v) => v.value === filter) ? filter : "all";
  return {
    empty: projects.length === 0,
    projects: righe,
    selected,
    filters: voci.length ? voci : null,
    // Un filtro che non trova più niente non si vede: la scelta mostrata è All.
    filter: filtro,
    search,
    searchVisible: search !== "" || (!!selected && shownCount(marked, filtro) > 0),
    starting,
  };
}
