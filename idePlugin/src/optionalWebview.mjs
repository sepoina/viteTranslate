// Lo script della sezione facoltativa, quella che prende il posto di Results: gira dentro la
// webview, per tutte e due le sue pagine. Esce in dist/optionalWebview.js.
//   - Help (helpPage.mjs): solo bottoni, `{ cmd }` col loro data-cmd.
//   - LLM (llmPage.mjs): disegna lo stato che manda l'estensione (`{ type: "state" }`,
//     llmPanel.mjs) — i controlli e le azioni — e rimanda `{ cmd: "action", value: id }` dal clic
//     su un'azione, `{ cmd }` dai bottoni. Al caricamento chiede lo stato (`ready`).
// I testi (un errore del modello, un percorso) si scrivono con textContent, mai come HTML.
import "@vscode-elements/elements/dist/vscode-button/index.js";
import "@vscode-elements/elements/dist/vscode-tree/index.js";
import "@vscode-elements/elements/dist/vscode-tree-item/index.js";
import "@vscode-elements/elements/dist/vscode-icon/index.js";

const vscode = acquireVsCodeApi();

const $ = (id) => document.getElementById(id);

const ICONA = { ok: "pass", warning: "warning", error: "error", running: "loading" };

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

window.addEventListener("message", (e) => {
  if (e.data?.type === "state" && $("checks")) disegna(e.data);
});

$("actions")?.addEventListener("vsc-tree-select", (e) => {
  const righe = Array.isArray(e.detail) ? e.detail : e.detail?.selectedItems ?? [];
  const id = righe[0]?.dataset.value;
  if (id) vscode.postMessage({ cmd: "action", value: id });
});

document.addEventListener("click", (e) => {
  const bottone = e.target.closest?.("[data-cmd]");
  if (bottone && !bottone.disabled) vscode.postMessage({ cmd: bottone.dataset.cmd });
});

if ($("checks")) vscode.postMessage({ cmd: "ready" });
