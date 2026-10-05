// Lo script della sezione Project (projectPage.mjs): gira dentro la webview. Esce in
// dist/projectWebview.js coi soli componenti che usa.
//
// Non decide niente, come webview.mjs: disegna lo stato che manda l'estensione (`{ type: "state" }`,
// projectState.mjs) e rimanda i clic: `{ cmd: "openLanguage", value }` da un file di lingua,
// `{ cmd }` dai bottoni e dalle icone della barra (commandBar.mjs, il loro `data-cmd`). Al
// caricamento chiede lo stato (`ready`).
//
// I testi arrivano da vite.config: si scrivono con textContent, mai come HTML.
import "@vscode-elements/elements/dist/vscode-button/index.js";
import "@vscode-elements/elements/dist/vscode-tree/index.js";
import "@vscode-elements/elements/dist/vscode-tree-item/index.js";
import "@vscode-elements/elements/dist/vscode-icon/index.js";
import "@vscode-elements/elements/dist/vscode-badge/index.js";
import { installTooltips } from "../tooltip/tooltipScript.mjs";
import { watchCommandBar } from "../commandBar/commandBarScript.mjs";

const vscode = acquireVsCodeApi();
installTooltips(); // i title diventano il fumetto della pagina (tooltipScript.mjs)
watchCommandBar(); // andata a capo, la seconda riga si centra (commandBarScript.mjs)

const $ = (id) => document.getElementById(id);

const firme = new Map(); // albero -> firma delle righe disegnate: righe uguali non si ricostruiscono

function icona(nome, colore, slot) {
  const i = document.createElement("vscode-icon");
  i.name = nome;
  if (slot) i.slot = slot;
  if (colore) i.style.color = colore;
  return i;
}

// Una riga: etichetta, descrizione, tooltip, e il file che apre il clic.
function riga(v) {
  const item = document.createElement("vscode-tree-item");
  item.append(document.createTextNode(v.label));
  if (v.description) {
    const d = document.createElement("span");
    d.slot = "description";
    d.textContent = v.description;
    item.append(d);
  }
  if (v.tooltip) item.title = v.tooltip;
  if (v.value) item.dataset.open = v.value;
  return item;
}

// Le lingue: righe piatte come Config in Selector, con l'icona colorata e il badge dei mancanti.
function lingue(voci) {
  const tree = $("langs");
  const firma = JSON.stringify(voci);
  if (firme.get(tree) === firma) return;
  firme.set(tree, firma);
  tree.replaceChildren(
    ...voci.map((v) => {
      const item = riga(v);
      item.className = "ciro";
      if (v.icon) item.append(icona(v.icon, v.color, "icon-leaf"));
      if (v.badge) {
        const b = document.createElement("vscode-badge");
        b.variant = "counter";
        b.slot = "decoration";
        b.textContent = v.badge.text;
        b.title = v.badge.tooltip;
        item.append(b);
      }
      return item;
    })
  );
}

// Il cuore accanto a Translations: una chiave scelta in Results, il clic su una lingua apre il
// file lì. Il tooltip (tooltip.mjs) dice quale, a metà delle sue tre righe; agli screen reader
// lo dice aria-label. A ogni chiave nuova batte.
let chiavePrima = null;
function cuore(chiave) {
  const c = $("jump");
  c.hidden = !chiave;
  $("jumpKey").textContent = chiave ?? "";
  c.setAttribute("aria-label", chiave ? `Click a translation file to open it at ${chiave}, the entry picked in Results` : "");
  if (chiave && chiave !== chiavePrima) {
    c.classList.remove("nuovo");
    void c.offsetWidth; // l'animazione riparte solo dopo un reflow
    c.classList.add("nuovo");
  }
  chiavePrima = chiave ?? null;
}

function disegna(stato) {
  $("message").hidden = !stato.message;
  $("message").textContent = stato.message ?? "";

  $("languages").hidden = !stato.languages && !stato.languagesNote;
  $("languages").title = stato.languagesTooltip ?? "";
  cuore(stato.jumpKey);
  $("langs").hidden = !stato.languages;
  if (stato.languages) lingue(stato.languages);
  const nota = $("langNote");
  nota.hidden = !stato.languagesNote;
  if (stato.languagesNote) {
    const n = stato.languagesNote;
    nota.replaceChildren(...(n.icon ? [icona(n.icon)] : []), document.createTextNode(n.text ?? ""));
    nota.title = n.tooltip ?? "";
  }

  // LLM: sempre cliccabile. Col progetto che ha `llm` la freccia del sottomenu; senza, il `?` e
  // un tooltip che dice che il clic porta a Help.
  const llm = $("btn-llm");
  llm.iconAfter = stato.llmIcon;
  llm.title = stato.llm ? llm.dataset.title : stato.llmOff;
}

// Il primo disegno: la pagina compare (fino a lì è invisibile, vedi projectPage.mjs) e lo dice
// all'estensione, che annota i tempi d'avvio.
window.addEventListener("message", (e) => {
  if (e.data?.type !== "state") return;
  disegna(e.data);
  if (!("drawn" in document.body.dataset)) {
    document.body.dataset.drawn = "";
    vscode.postMessage({ cmd: "drawn" });
  }
});

// Il clic (o Invio) su un file di lingua: l'estensione lo apre sulla chiave scelta per ultima in
// Results, se c'è.
$("langs").addEventListener("vsc-tree-select", (e) => {
  const righe = Array.isArray(e.detail) ? e.detail : e.detail?.selectedItems ?? [];
  const file = righe[0]?.dataset.open;
  if (file) vscode.postMessage({ cmd: "openLanguage", value: file });
});

// I bottoni e le icone-bottone della barra: il loro data-cmd.
document.addEventListener("click", (e) => {
  const bottone = e.target.closest?.("footer [data-cmd]");
  if (bottone && !bottone.disabled) vscode.postMessage({ cmd: bottone.dataset.cmd });
});

vscode.postMessage({ cmd: "ready" });
