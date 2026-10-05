// Lo script della sezione facoltativa, quella che prende il posto di Results: gira dentro la
// webview, per tutte e tre le sue pagine. Esce in dist/optionalWebview.js.
//   - Help (helpPage.mjs): solo bottoni, `{ cmd }` col loro data-cmd.
//   - LLM (llmPage.mjs): disegna lo stato che manda l'estensione (`{ type: "state" }`,
//     llmPanel.mjs) — i controlli e le azioni — e rimanda `{ cmd: "action", value: id }` dal clic
//     su un'azione, `{ cmd }` dai bottoni.
//   - Inspector (inspectorPage.mjs): disegna l'albero dello stato (inspectorState.mjs) e rimanda
//     `{ cmd: "open", value }` dal clic su una riga col suo file. Le righe aperte si ricordano per
//     id (il percorso delle etichette), anche quando la pagina si ricrea: vscode.setState vive
//     quanto la sezione. Una riga mai vista si apre se lo dice lo stato (`expanded`).
// LLM e Inspector, al caricamento, chiedono lo stato (`ready`).
// I testi (un errore del modello, un percorso, quelli di vite.config e dei package.json) si
// scrivono con textContent, mai come HTML.
import "@vscode-elements/elements/dist/vscode-button/index.js";
import "@vscode-elements/elements/dist/vscode-tree/index.js";
import "@vscode-elements/elements/dist/vscode-tree-item/index.js";
import "@vscode-elements/elements/dist/vscode-icon/index.js";

const vscode = acquireVsCodeApi();

const $ = (id) => document.getElementById(id);

const ICONA = { ok: "pass", warning: "warning", error: "error", running: "loading" };

// ------------------------------------------------------------------------------ LLM

function controlli(voci) {
  $("checks").replaceChildren(
    ...voci.map((c) => {
      const riga = document.createElement("div");
      riga.className = "check";
      riga.dataset.state = c.state;
      if (c.tooltip) riga.title = c.tooltip;
      const icona = document.createElement("vscode-icon");
      icona.name = ICONA[c.state] ?? "circle-outline";
      if (c.state === "running") icona.spin = true;
      const testo = document.createElement("span");
      testo.textContent = c.text;
      riga.append(icona, testo);
      if (c.description) {
        const d = document.createElement("span");
        d.className = "desc";
        d.textContent = c.description;
        riga.append(d);
      }
      return riga;
    })
  );
}

// Le azioni non cambiano: si disegnano una volta (si perderebbe il focus).
let disegnate = null;
function azioni(voci) {
  const firma = JSON.stringify(voci);
  if (firma === disegnate) return;
  disegnate = firma;
  $("actions").replaceChildren(
    ...voci.map((a) => {
      const item = document.createElement("vscode-tree-item");
      item.className = "ciro";
      item.dataset.value = a.id;
      item.title = a.tooltip;
      const icona = document.createElement("vscode-icon");
      icona.name = a.icon;
      icona.slot = "icon-leaf";
      const d = document.createElement("span");
      d.slot = "description";
      d.textContent = a.detail;
      item.append(icona, document.createTextNode(a.label), d);
      return item;
    })
  );
}

function disegna(stato) {
  controlli(stato.checks);
  azioni(stato.actions);
  $("recheck").disabled = stato.checking;
}

// ------------------------------------------------------------------------------ Inspector

const aperti = new Map(Object.entries(vscode.getState()?.aperti ?? {})); // id -> aperta
let firmaAlbero = null; // le righe disegnate: righe uguali non si ricostruiscono

function icona(nome, colore, slot) {
  const i = document.createElement("vscode-icon");
  i.name = nome;
  if (slot) i.slot = slot;
  if (colore) i.style.color = colore;
  return i;
}

// Le righe aperte adesso, nella mappa: prima di ricostruire, e dopo un clic.
function ricorda() {
  for (const item of $("tree").querySelectorAll("vscode-tree-item[data-id]")) {
    if (item.querySelector(":scope > vscode-tree-item")) aperti.set(item.dataset.id, item.open);
  }
  vscode.setState({ aperti: Object.fromEntries(aperti) });
}

// Una riga: etichetta, descrizione, tooltip, il file che apre il clic, e i figli.
function nodo(n) {
  const item = document.createElement("vscode-tree-item");
  item.append(document.createTextNode(n.label));
  if (n.description) {
    const d = document.createElement("span");
    d.slot = "description";
    d.textContent = n.description;
    item.append(d);
  }
  if (n.tooltip) item.title = n.tooltip;
  if (n.open) item.dataset.open = n.open;
  item.dataset.id = n.id;
  if (n.children) {
    if (n.icon) item.append(icona(n.icon, n.color, "icon-branch"), icona(n.icon, n.color, "icon-branch-opened"));
    for (const figlio of n.children) {
      const f = nodo(figlio);
      f.slot = "children";
      item.append(f);
    }
    item.open = aperti.has(n.id) ? aperti.get(n.id) : n.expanded;
  } else if (n.icon) {
    item.append(icona(n.icon, n.color, "icon-leaf"));
  }
  return item;
}

function albero(stato) {
  $("message").hidden = !stato.message;
  $("message").textContent = stato.message ?? "";
  const tree = $("tree");
  tree.hidden = !stato.details;
  if (!stato.details) return;
  const firma = JSON.stringify(stato.details);
  if (firma === firmaAlbero) return;
  ricorda();
  firmaAlbero = firma;
  tree.replaceChildren(...stato.details.map(nodo));
}

// ------------------------------------------------------------------------------ la pagina

window.addEventListener("message", (e) => {
  if (e.data?.type !== "state") return;
  if ($("checks")) disegna(e.data);
  else if ($("tree")) albero(e.data);
});

$("actions")?.addEventListener("vsc-tree-select", (e) => {
  const righe = Array.isArray(e.detail) ? e.detail : e.detail?.selectedItems ?? [];
  const id = righe[0]?.dataset.value;
  if (id) vscode.postMessage({ cmd: "action", value: id });
});

// Il clic (o Invio) su una riga col suo file (package.json, vite.config): lo apre l'estensione.
$("tree")?.addEventListener("vsc-tree-select", (e) => {
  const righe = Array.isArray(e.detail) ? e.detail : e.detail?.selectedItems ?? [];
  const file = righe[0]?.dataset.open;
  if (file) vscode.postMessage({ cmd: "open", value: file });
});
// Una riga aperta o chiusa: la si ricorda quando l'albero ha finito di cambiare.
for (const evento of ["click", "keyup"]) $("tree")?.addEventListener(evento, () => setTimeout(ricorda));

document.addEventListener("click", (e) => {
  const bottone = e.target.closest?.("[data-cmd]");
  if (bottone && !bottone.disabled) vscode.postMessage({ cmd: bottone.dataset.cmd });
});

if ($("checks") || $("tree")) vscode.postMessage({ cmd: "ready" });
