// Lo script della sezione Selector: gira DENTRO la webview (un browser), non nell'extension host.
// Esce da solo in dist/webview.js (rolldown.config.mjs), con i soli componenti di
// @vscode-elements/elements che usa: importare il pacchetto intero vorrebbe dire 233 kB.
//
// Non decide niente. Disegna lo stato che manda l'estensione (`{ type: "state" }`, vedi
// selectorState.mjs) e rimanda i clic: `{ cmd: "select" | "filter" | "search", value }` dagli
// elenchi e dalla ricerca, `{ cmd }` dai bottoni (il loro `data-cmd`). Al caricamento chiede lo stato (`ready`): la webview
// si ricrea da zero ogni volta che la sezione torna in vista.
//
// I testi arrivano dai package.json dei progetti: si scrivono con textContent, mai come HTML.
import "@vscode-elements/elements/dist/vscode-button/index.js";
import "@vscode-elements/elements/dist/vscode-tree/index.js";
import "@vscode-elements/elements/dist/vscode-tree-item/index.js";
import "@vscode-elements/elements/dist/vscode-textfield/index.js";
import "@vscode-elements/elements/dist/vscode-icon/index.js";

// Una volta sola per pagina: chiamarla due volte lancia.
const vscode = acquireVsCodeApi();

const $ = (id) => document.getElementById(id);

// Per ogni elenco: la firma delle righe disegnate e il valore scelto. Righe uguali non si
// ricostruiscono (si perderebbe il focus): cambia solo la selezione.
const disegnati = new Map();

function riempi(tree, voci, scelto) {
  const firma = JSON.stringify(voci);
  const prima = disegnati.get(tree);
  if (prima?.firma !== firma) {
    tree.replaceChildren(
      ...voci.map((v) => {
        const item = document.createElement("vscode-tree-item");
        item.dataset.value = v.value;
        item.className = "ciro";
        item.append(document.createTextNode(v.label));
        if (v.description) {
          const d = document.createElement("span");
          d.slot = "description";
          d.textContent = v.description;
          item.append(d);
        }
        if (v.tooltip) item.title = v.tooltip;
        return item;
      })
    );
  }
  // Dopo l'inserimento: la riga prende il contesto dell'albero solo quando è dentro.
  for (const item of tree.querySelectorAll("vscode-tree-item")) item.selected = item.dataset.value === scelto;
  disegnati.set(tree, { firma, scelto });
}

// Il campo di ricerca porta aria-selected="true" quando contiene un testo che cerca davvero
// (non solo spazi: searchFiles li toglie), "false" altrimenti. Lo legge lo stile della pagina
// (`.ciro[aria-selected="true"]`), come per le righe scelte degli elenchi.
// Con lui si accende l'icona che svuota il campo: con il campo vuoto non c'è niente da pulire.
function segnaRicerca() {
  const campo = $("query");
  campo.setAttribute("aria-selected", campo.value.trim() ? "true" : "false");
  $("clear").setAttribute("aria-hidden", campo.value ? "false" : "true");
}

function disegna(stato) {
  $("config").hidden = !stato.projects;
  if (stato.projects) riempi($("projects"), stato.projects, stato.selected);
  $("filter").hidden = !stato.filters;
  if (stato.filters) riempi($("filters"), stato.filters, stato.filter);
  $("search").hidden = !stato.searchVisible;
  // Il campo non si tocca mentre ci si scrive: lo stato che torna indietro è quello di un attimo fa.
  const campo = $("query");
  if (document.activeElement !== campo && campo.value !== stato.search) campo.value = stato.search;
  segnaRicerca();
  $("empty").hidden = !stato.empty;
}

window.addEventListener("message", (e) => {
  if (e.data?.type === "state") disegna(e.data);
});

// Una scelta dell'utente in un elenco. Solo se cambia davvero: l'albero emette l'evento anche su
// un clic sulla riga già scelta.
const scelta = (tree, cmd) =>
  tree.addEventListener("vsc-tree-select", (e) => {
    const righe = Array.isArray(e.detail) ? e.detail : e.detail?.selectedItems ?? [];
    const value = righe[0]?.dataset.value;
    const disegnato = disegnati.get(tree);
    if (value === undefined || !disegnato || value === disegnato.scelto) return;
    disegnato.scelto = value;
    vscode.postMessage({ cmd, value });
  });
scelta($("projects"), "select");
scelta($("filters"), "filter");

// La ricerca parte quando si smette di scrivere (200 ms), o subito con Invio.
let attesa;
const cerca = () => {
  clearTimeout(attesa);
  vscode.postMessage({ cmd: "search", value: $("query").value });
};
$("query").addEventListener("input", () => {
  segnaRicerca();
  clearTimeout(attesa);
  attesa = setTimeout(cerca, 200);
});
// Svuotare il campo: con Esc, o con l'icona alla sua destra (che poi rimette il focus nel campo).
const svuota = () => {
  $("query").value = "";
  segnaRicerca();
  cerca();
};
$("query").addEventListener("keydown", (e) => {
  if (e.key === "Enter") cerca();
  else if (e.key === "Escape" && $("query").value) svuota();
});
$("clear").addEventListener("click", () => {
  if (!$("query").value) return;
  svuota();
  $("query").focus();
});

document.addEventListener("click", (e) => {
  const bottone = e.target.closest?.("vscode-button[data-cmd]");
  if (bottone && !bottone.disabled) vscode.postMessage({ cmd: bottone.dataset.cmd });
});

vscode.postMessage({ cmd: "ready" });
