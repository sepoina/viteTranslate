// Il tooltip delle webview, dal lato della pagina: un fumetto solo per pagina (lo stile è
// TOOLTIP_CSS in tooltip.mjs), al posto dei tooltip nativi. Lo installano gli script delle pagine
// (webview.mjs, projectWebview.mjs, optionalWebview.mjs) con installTooltips().
//   - Ogni `title`, scritto nell'HTML o messo dallo script, diventa data-tip appena compare (un
//     MutationObserver): il tooltip nativo non parte. Un title vuoto toglie il tooltip.
//   - Al passaggio del mouse, o col focus, dopo una breve attesa come uno nativo, il fumetto
//     mostra il testo dell'elemento più interno che ne ha uno; un elemento `.suggerito` col suo
//     fumetto dentro (tooltipHtml) mostra quello, righe impaginate e rilievo compresi.
//   - Sta sotto l'elemento, o sopra se sotto non c'è posto (la barra dei comandi è in fondo),
//     dentro la finestra (placeTooltip).
//   - Agli screen reader il testo resta: aria-description.
// Gli elementi dentro lo shadow DOM dei componenti non si vedono: il loro title (se ne mettono
// uno) resta nativo. Nessun import di `vscode`.

const ATTESA_MS = 300;
const MARGINE = 6; // dal bordo della finestra
const DISTANZA = 4; // dall'elemento

/**
 * Dove mettere il fumetto: sotto l'elemento, allineato a sinistra; sopra se sotto non c'è posto e
 * sopra sì; mai fuori dalla finestra.
 * @param {{ left: number, top: number, bottom: number }} anchor - getBoundingClientRect dell'elemento
 * @param {{ width: number, height: number }} size - il fumetto
 * @param {{ width: number, height: number }} viewport
 * @returns {{ left: number, top: number, above: boolean }}
 */
export function placeTooltip(anchor, size, viewport) {
  const left = Math.max(MARGINE, Math.min(anchor.left, viewport.width - size.width - MARGINE));
  const sotto = anchor.bottom + DISTANZA;
  const sopra = anchor.top - DISTANZA - size.height;
  const above = sotto + size.height > viewport.height - MARGINE && sopra >= MARGINE;
  return { left, top: above ? sopra : sotto, above };
}

/**
 * Il title di un elemento diventa data-tip (e aria-description); uno vuoto li toglie.
 * @param {Element} el
 */
export function adoptTitle(el) {
  const testo = el.getAttribute("title");
  if (testo === null) return;
  el.removeAttribute("title");
  if (testo) {
    el.setAttribute("data-tip", testo);
    el.setAttribute("aria-description", testo);
  } else {
    el.removeAttribute("data-tip");
    el.removeAttribute("aria-description");
  }
}

/** Installa il fumetto nella pagina. */
export function installTooltips(doc = document) {
  const fumetto = doc.createElement("div");
  fumetto.className = "fumetto mobile";
  fumetto.setAttribute("role", "tooltip");
  fumetto.hidden = true;
  doc.body.append(fumetto);

  for (const el of doc.querySelectorAll("[title]")) adoptTitle(el);
  new MutationObserver((cambi) => {
    for (const c of cambi) {
      if (c.type === "attributes") adoptTitle(c.target);
      else for (const n of c.addedNodes) if (n.nodeType === 1) [n, ...n.querySelectorAll("[title]")].forEach(adoptTitle);
    }
  }).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] });

  let timer = null;
  let attuale = null; // l'elemento di cui si mostra, o si aspetta di mostrare, il fumetto

  const bersaglio = (n) => n?.closest?.(".suggerito, [data-tip]") ?? null;

  function nascondi() {
    clearTimeout(timer);
    attuale = null;
    fumetto.classList.remove("acceso");
    fumetto.hidden = true;
  }

  // Il contenuto: il fumetto proprio di un `.suggerito` (copiato, senza gli id), o il testo.
  function riempi(el) {
    const proprio = el.classList.contains("suggerito") ? el.querySelector(":scope > .fumetto") : null;
    if (proprio) {
      const copia = [...proprio.childNodes].map((n) => n.cloneNode(true));
      for (const n of copia) if (n.nodeType === 1) [n, ...n.querySelectorAll("[id]")].forEach((e) => e.removeAttribute("id"));
      fumetto.replaceChildren(...copia);
      return true;
    }
    fumetto.textContent = el.dataset.tip ?? "";
    return !!el.dataset.tip;
  }

  function mostra(el) {
    if (!el.isConnected || !riempi(el)) return nascondi();
    fumetto.hidden = false;
    const r = el.getBoundingClientRect();
    const f = fumetto.getBoundingClientRect();
    const radice = doc.documentElement;
    const p = placeTooltip(r, f, { width: radice.clientWidth, height: radice.clientHeight });
    fumetto.style.left = `${p.left}px`;
    fumetto.style.top = `${p.top}px`;
    fumetto.classList.add("acceso");
  }

  function punta(el) {
    if (el === attuale) return;
    nascondi();
    if (!el) return;
    attuale = el;
    timer = setTimeout(() => attuale === el && mostra(el), ATTESA_MS);
  }

  doc.addEventListener("pointerover", (e) => punta(bersaglio(e.target)));
  doc.addEventListener("pointerout", (e) => !bersaglio(e.relatedTarget) && nascondi());
  doc.addEventListener("focusin", (e) => punta(bersaglio(e.target)));
  doc.addEventListener("focusout", nascondi);
  doc.addEventListener("pointerdown", nascondi);
  doc.addEventListener("keydown", (e) => e.key === "Escape" && nascondi());
  doc.addEventListener("scroll", nascondi, true);
}
