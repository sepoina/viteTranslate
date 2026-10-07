// Lo script della sezione facoltativa, quella che prende il posto di Results: gira dentro la
// webview, per tutte le sue pagine. Esce in dist/optionalWebview.js.
//   - Help (helpPage.mjs): solo bottoni, `{ cmd }` col loro data-cmd.
//   - LLM (llmPage.mjs): disegna lo stato che manda l'estensione (`{ type: "state" }`,
//     llmPanel.mjs) — i controlli e le azioni — e rimanda `{ cmd: "action", value: id }` dal clic
//     (o Invio, Spazio) su un'azione, `{ cmd }` dai bottoni. Il ? nella barra si vede solo con un
//     controllo andato male (`trouble`).
//   - Settings (settingsPage.mjs): due accordion dallo stato, e in mezzo due righe-azione
//     (Vite config, Detailed config) che rimandano il loro `{ cmd }`, col clic o Invio e Spazio; in
//     fondo VERSION, le versioni col loro fumetto (`versions`, versionsState in inspectorState.mjs).
//       · Highlight style: gli stili col loro campione (`highlight`, highlightState.mjs); rimanda
//         `{ cmd: "style", value: id }` dal clic (o Invio, Spazio) su uno stile.
//       · Local file status: l'albero (inspectorState.mjs); rimanda `{ cmd: "open", value }` dal
//         clic su una riga col suo file.
//     Le righe aperte si ricordano per id (il percorso delle etichette), gli accordion aperti pure
//     (rememberAccordions), anche quando la pagina si ricrea: vscode.setState vive quanto la
//     sezione. Una riga mai vista si apre se lo dice lo stato (`expanded`).
//   - Library (libraryPage.mjs): il guasto della libreria, dallo stato (`library`, libraryState);
//     i bottoni rimandano il loro `{ cmd }`.
//   - Loading (loadingPage.mjs): l'avvio del pannello; scrive la tappa che arriva (`loading`).
// LLM, Settings, Library e Loading, al caricamento, chiedono lo stato (`ready`).
// I testi (un errore del modello, un percorso, quelli di vite.config e dei package.json) si
// scrivono con textContent, mai come HTML.
import "@vscode-elements/elements/dist/vscode-button/index.js";
import "@vscode-elements/elements/dist/vscode-tree/index.js";
import "@vscode-elements/elements/dist/vscode-tree-item/index.js";
import "@vscode-elements/elements/dist/vscode-icon/index.js";
import { installTooltips } from "../tooltip/tooltipScript.mjs";
import { rememberAccordions } from "../accordion/accordionScript.mjs";
import { watchCommandBar } from "../commandBar/commandBarScript.mjs";

const vscode = acquireVsCodeApi();
installTooltips(); // i title diventano il fumetto della pagina (tooltipScript.mjs)
watchCommandBar(); // andata a capo, la seconda riga si centra (commandBarScript.mjs)

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

// Le azioni non cambiano: si disegnano una volta (si perderebbe il focus). Una riga: icona e nome,
// sotto la descrizione (llmPage.mjs).
let disegnate = null;
function azioni(voci) {
  const firma = JSON.stringify(voci);
  if (firma === disegnate) return;
  disegnate = firma;
  $("actions").replaceChildren(
    ...voci.map((a) => {
      const riga = document.createElement("div");
      riga.className = "azione ciro";
      riga.setAttribute("role", "button");
      riga.tabIndex = 0;
      riga.dataset.value = a.id;
      riga.title = a.tooltip;
      const icona = document.createElement("vscode-icon");
      icona.name = a.icon;
      const nome = document.createElement("span");
      nome.textContent = a.label;
      const d = document.createElement("span");
      d.className = "desc";
      d.textContent = a.detail;
      riga.append(icona, nome, d);
      return riga;
    })
  );
}

function disegna(stato) {
  controlli(stato.checks);
  azioni(stato.actions);
  $("recheck").disabled = stato.checking;
  $("help").hidden = !stato.trouble;
}

// ------------------------------------------------------------------------------ Settings: l'albero

// Quello che l'utente ha aperto, per tutta la vita della sezione: le righe dell'albero e l'accordion.
const memoria = vscode.getState() ?? {};
const aperti = new Map(Object.entries(memoria.righe ?? {})); // id -> aperta
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
  memoria.righe = Object.fromEntries(aperti);
  vscode.setState(memoria);
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

// ------------------------------------------------------------------------------ Settings: Highlight style

// Il campione di uno stile: i delimitatori e il testo, ognuno col CSS della sua parte; il chip
// (`match`) avvolge tutto o solo il testo, come nell'editor (cover).
function campione(sample, testi) {
  const parte = (testo, stile) => {
    const s = document.createElement("span");
    s.textContent = testo;
    s.style.cssText = stile;
    return s;
  };
  const chip = (...figli) => {
    const s = document.createElement("span");
    s.style.cssText = sample.match;
    s.append(...figli);
    return s;
  };
  const apre = parte(testi.open, sample.delimiters);
  const chiude = parte(testi.close, sample.delimiters);
  const testo = parte(testi.text, sample.text);
  const c = document.createElement("span");
  c.className = "campione";
  c.setAttribute("aria-hidden", "true");
  if (sample.cover === "content") c.append(apre, chip(testo), chiude);
  else c.append(chip(apre, testo, chiude));
  return c;
}

// Le righe si rifanno solo se cambia il catalogo (o il tema, per gli stili deboli); cambiare
// stile sposta solo il segno, e il focus resta dov'era.
let firmaStili = null;
function stili(stato) {
  const firma = JSON.stringify([stato.styles, stato.sample]);
  if (firma !== firmaStili) {
    firmaStili = firma;
    $("styles").replaceChildren(
      ...stato.styles.map((s) => {
        const riga = document.createElement("div");
        riga.className = "stile ciro";
        riga.setAttribute("role", "radio");
        riga.tabIndex = 0;
        riga.dataset.value = s.id;
        const segno = icona("circle-large-outline");
        segno.classList.add("segno");
        const nome = document.createElement("span");
        const titolo = document.createElement("span");
        titolo.textContent = s.name;
        const d = document.createElement("span");
        d.className = "desc";
        d.textContent = s.description;
        nome.append(titolo, d);
        if (s.weak) {
          const w = icona("warning");
          w.classList.add("debole");
          w.title = "Hard to see on this theme";
          nome.append(w);
        }
        riga.append(segno, nome, campione(s.sample, stato.sample));
        return riga;
      })
    );
  }
  for (const riga of $("styles").children) {
    const scelto = riga.dataset.value === stato.current;
    riga.setAttribute("aria-checked", String(scelto));
    riga.setAttribute("aria-selected", String(scelto));
    riga.firstChild.name = scelto ? "pass-filled" : "circle-large-outline";
  }
}

// ------------------------------------------------------------------------------ Settings: VERSION

// L'estensione, e del progetto la libreria e il suo IDE_API: in giallo se mancano o sono troppo
// vecchi, e il fumetto dice perché.
function versioni(v) {
  $("extensionVersion").textContent = v.extension;
  for (const [riga, valore, voce] of [["libraryRow", "libraryVersion", v.library], ["ideRow", "ideVersion", v.ide]]) {
    $(valore).textContent = voce.text;
    $(riga).toggleAttribute("data-old", voce.old);
    $(riga).title = voce.tip;
  }
}

// ------------------------------------------------------------------------------ Library

// Cosa non va, il comando che lo sistema, dove lanciarlo e l'errore com'è.
function guasto(l) {
  $("libHeading").textContent = l.heading;
  $("libIntro").textContent = l.intro;
  $("libCommand").textContent = l.command;
  $("libWhere").textContent = l.where;
  $("libDetail").textContent = l.detail ?? "";
  $("libDetail").hidden = !l.detail;
}

// ------------------------------------------------------------------------------ la pagina

window.addEventListener("message", (e) => {
  if (e.data?.type !== "state") return;
  if ($("loading")) return e.data.loading && ($("loadingText").textContent = e.data.loading);
  if ($("library")) return e.data.library && guasto(e.data.library);
  if ($("checks")) return disegna(e.data);
  if ($("versions") && e.data.versions) versioni(e.data.versions);
  if ($("styles") && e.data.highlight) stili(e.data.highlight);
  if ($("tree")) albero(e.data);
});

// Gli accordion di Settings: chiusi la prima volta, poi come li ha lasciati l'utente.
rememberAccordions(memoria, () => vscode.setState(memoria));

// Il clic, o Invio e Spazio, su uno stile: lo sceglie l'estensione.
const scegli = (e) => {
  const id = e.target.closest?.(".stile")?.dataset.value;
  if (id) vscode.postMessage({ cmd: "style", value: id });
  return !!id;
};
$("styles")?.addEventListener("click", scegli);
$("styles")?.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && scegli(e)) e.preventDefault();
});

// Il clic, o Invio e Spazio, su un'azione: la lancia l'estensione.
const lancia = (e) => {
  const id = e.target.closest?.(".azione")?.dataset.value;
  if (id) vscode.postMessage({ cmd: "action", value: id });
  return !!id;
};
$("actions")?.addEventListener("click", lancia);
$("actions")?.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && lancia(e)) e.preventDefault();
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
// Le righe-azione scritte nell'HTML (actionRowHtml, in Settings): Invio e Spazio come il clic.
document.addEventListener("keydown", (e) => {
  if ((e.key !== "Enter" && e.key !== " ") || !e.target.matches?.('[role="button"][data-cmd]')) return;
  e.preventDefault();
  vscode.postMessage({ cmd: e.target.dataset.cmd });
});

if ($("checks") || $("tree") || $("styles") || $("library") || $("loading")) vscode.postMessage({ cmd: "ready" });
