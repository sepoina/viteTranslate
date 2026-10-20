// The parts every prototype is made of. Each builds its piece of page from plain data, with the
// classes of card.css, and says how it enters (data-enter: an effect of motion.js). A prototype
// decides where and when; the parts decide what and how.
// LINKED-DATA: commons/layout/darkStyle.md § "Parts" describes each one; card.css holds their look.
(() => {
  const el = (tag, cls = "", text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const entra = (n, effetto, config) => {
    n.dataset.enter = effetto;
    if (config) n.dataset.enterConfig = JSON.stringify(config);
    return n;
  };
  const regione = (r) => document.querySelector(`.frame-${r}`);
  const SVG = "http://www.w3.org/2000/svg";
  // Where the stamp and the QR sit (the `corner` param): card.css places .frame-over by it.
  const CORNERS = ["bottom-right", "top-right", "bottom-left", "top-left"];

  // A line of text with `code` (a chip) and **bold** in it.
  const inline = (n, testo) => {
    for (const pezzo of String(testo).split(/(`[^`]+`|\*\*[^*]+\*\*)/).filter(Boolean)) {
      if (pezzo.startsWith("`")) n.append(el("code", "chip", pezzo.slice(1, -1)));
      else if (pezzo.startsWith("**")) n.append(el("b", "", pezzo.slice(2, -2)));
      else n.append(pezzo);
    }
    return n;
  };

  // The stamp's ink: gaps and ragged edges, an SVG filter put in the page once.
  const inchiostro = () => {
    if (document.getElementById("ink")) return;
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.innerHTML = `<filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="grana" />
      <feColorMatrix in="grana" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.45" result="buchi" />
      <feComposite in="SourceGraphic" in2="buchi" operator="in" result="inchiostro" />
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="onde" />
      <feDisplacementMap in="inchiostro" in2="onde" scale="4" xChannelSelector="R" yChannelSelector="G" />
    </filter>`;
    document.body.append(svg);
  };

  window.parts = {
    /** A centered column of whatever it's given (nulls skipped). */
    stack(...figli) {
      const s = el("div", "stack");
      s.append(...figli.filter(Boolean));
      return s;
    },
    logo() {
      const i = entra(el("img", "logo"), "rise");
      i.src = "../../../theme/logo.svg";
      i.alt = "viteTranslate";
      return i;
    },
    headline(text, { role = "heading", tag = "h1" } = {}) {
      return entra(el(tag, `headline t-${role}`, text), "rise");
    },
    /** A line with a green half after it; wraps within --measure. */
    lead(line, accent) {
      const p = entra(el("p", "lead t-lead"), "rise");
      if (line) p.append(line);
      if (line && accent) p.append(" ");
      if (accent) p.append(el("b", "", accent));
      return p;
    },
    /** A command, monospace, on one line as large as it fits. */
    chip(text) {
      const c = entra(el("code", "chip t-body", text), "rise", { y: 28 });
      c.dataset.fit = "";
      return c;
    },
    /** A grid of tiles, one per item; `fill(tile, item)` puts its content in. */
    tiles(items, fill) {
      const grid = el("div", "grid");
      const tiles = items.map((item) => {
        const t = entra(el("div", "tile"), "hit");
        fill(t, item);
        grid.append(t);
        return t;
      });
      return { el: grid, tiles };
    },
    /** Tile content: a big line (one line, fit) and a small one (wraps). */
    bigSmall(tile, [big, small = ""]) {
      const b = el("div", "big t-hero", big);
      b.dataset.fit = "";
      tile.append(b, el("div", "small t-body", small));
    },
    /** Words in a row that wraps, dots between them, waiting barely visible. `role`: their type (display of serie). */
    words(list, { role = "display" } = {}) {
      const ul = el("ul", `cluster t-${role}`);
      const words = [], dots = [];
      list.forEach((w, i) => {
        if (i) ul.append(dots[dots.push(entra(el("li", "dot", "·"), "light")) - 1]);
        ul.append(words[words.push(entra(el("li", "word", w), "pop")) - 1]);
      });
      return { el: ul, words, dots };
    },
    /** Tile content: a heading, then items with a drawn tick. */
    group(tile, [heading, ...items]) {
      tile.classList.add("group");
      const ul = el("ul", "stack");
      ul.style.setProperty("--gap", "var(--space-m)");
      for (const item of items) {
        const li = entra(el("li", "t-text"), "rise", { duration: 0.5 });
        const tick = el("span", "tick");
        const svg = document.createElementNS(SVG, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        const path = document.createElementNS(SVG, "path");
        path.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5");
        entra(path, "draw");
        svg.append(path);
        tick.append(svg);
        li.append(tick, el("span", "", item));
        ul.append(li);
      }
      tile.append(el("h2", "t-text", heading), ul);
    },
    /** Lines in a column; `code` in backticks becomes a chip, **this** goes bold. */
    lines(list) {
      const ul = el("ul", "stack lines t-body");
      ul.style.setProperty("--gap", "var(--space-m)");
      const items = list.map((line) => {
        const li = entra(inline(el("li"), line), "rise");
        ul.append(li);
        return li;
      });
      return { el: ul, items };
    },
    /** A small grey line, at the bottom. */
    note(text) {
      const p = entra(el("p", "note t-small", text), "fade");
      regione("foot").append(p);
      return p;
    },
    /** The music credits, small at the bottom; the first line a little brighter. */
    credits(lines) {
      const d = entra(el("div", "credits t-fine"), "rise", { y: 20 });
      for (const line of lines) d.append(el("p", "", line));
      regione("foot").append(d);
      return d;
    },
    /** A rubber stamp over the card, in its corner (bottom right): one line, or "small|BIG|small". */
    stamp(text) {
      inchiostro();
      const s = el("div", "stamp");
      const pezzi = String(text).split("|").map((p) => p.trim());
      pezzi.forEach((t, k) => s.append(el(pezzi.length === 3 && k !== 1 ? "small" : "span", "", t)));
      regione("over").append(s);
      return s;
    },
    /** A QR on white over the card, in its corner, under the stamp; a line under it. */
    qr(src, label) {
      const f = el("figure", "qr");
      const i = el("img");
      i.src = src;
      i.alt = "";
      f.append(i);
      if (label) f.append(el("figcaption", "t-fine", label));
      regione("over").append(f);
      return f;
    },
    /** The common params, for every prototype: note, stamp, qr, corner. A prototype moves noteAt's default with card.noteAt. */
    common() {
      const p = card.param;
      const angolo = p("corner", "bottom-right");
      if (!CORNERS.includes(angolo)) throw new Error(`corner: one of ${CORNERS.join(", ")}, not "${angolo}"`);
      regione("over").dataset.corner = angolo;
      if (p("note")) card.enter(parts.note(p("note")), Number(p("noteAt", String(card.noteAt ?? 1))));
      if (p("stamp")) card.fx("stamp", parts.stamp(p("stamp")), Number(p("stampAt", "1"))); // also when still
      if (p("qr")) card.fx("rise", parts.qr(card.asset(p("qr")), p("qrLabel")), Number(p("qrAt", "1.5")), { y: 20, duration: 0.6 });
    },
  };
})();
