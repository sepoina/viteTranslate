// The layout of every prototype: what CSS can't do on its own.
//   look()     the YAML's knobs and tokens, on :root, before anything is built
//   arrange()  grids in balanced rows; one-line texts as large as they fit; the body that tightens
//   check()    what still doesn't fit goes to card.errors: the take stops before it starts
// LINKED-DATA: commons/layout/card.css (tokens, primitives), commons/layout/darkStyle.md § "Adapting".
(() => {
  const q = new URLSearchParams(location.search);
  const root = document.documentElement;
  const token = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

  function look(errors) {
    let voci = {};
    try {
      voci = q.has("look") ? JSON.parse(q.get("look")) : {};
    } catch (e) {
      return errors.push(`look: ${e.message}`);
    }
    for (const [k, v] of Object.entries(voci)) {
      if (!token(root, `--${k}`)) errors.push(`look: no token --${k} (commons/layout/card.css, site/theme/tokens.css)`);
      else root.style.setProperty(`--${k}`, String(v));
    }
  }

  // n items, at most --cols-max a row, in rows as even as they get (5 → 3 + 2, 7 → 4 + 3). Two
  // tracks a column: a short last row starts half a column in for each item it misses, centered.
  function grids() {
    for (const g of document.querySelectorAll(".grid")) {
      const items = [...g.children];
      const n = items.length || 1;
      const max = Number(token(g, "--cols-max")) || 4;
      const cols = Math.ceil(n / Math.ceil(n / max));
      g.style.setProperty("--cols", String(cols));
      g.style.setProperty("--tracks", String(cols * 2));
      g.style.setProperty("--rows", String(Math.max(1, ...items.map((c) => c.children.length))));
      for (const c of items) c.style.gridColumnStart = "";
      const ultima = n % cols;
      if (ultima) items[n - ultima].style.gridColumnStart = String(cols - ultima + 1);
    }
  }

  // [data-fit]: one line, from its CSS size down to --type-min, as large as its box allows.
  function lines() {
    for (const el of document.querySelectorAll("[data-fit]")) {
      el.style.fontSize = "";
      const min = parseFloat(token(el, "--type-min")) || 26;
      for (let size = parseFloat(getComputedStyle(el).fontSize); size > min && el.scrollWidth > el.clientWidth + 1; size -= 2)
        el.style.fontSize = `${Math.max(min, size - 2)}px`;
    }
  }

  // The body holds what it's given: too much, and its spaces and type tighten together.
  function tighten() {
    const body = document.querySelector(".frame-body");
    const content = body?.firstElementChild;
    if (!content) return;
    body.style.removeProperty("--fit");
    lines();
    const over = () => content.scrollHeight > body.clientHeight + 1 || content.scrollWidth > body.clientWidth + 1;
    for (let f = 1; over() && f > 0.7; ) {
      f = +(f - 0.04).toFixed(2);
      body.style.setProperty("--fit", String(f));
      lines();
    }
  }

  function arrange() {
    grids();
    lines();
    tighten();
  }

  // Measured with every entrance done, then back to zero.
  function check(errors) {
    const W = innerWidth, H = innerHeight, tol = 2;
    const nome = (el) => (el.id ? `#${el.id}` : `${el.localName}${[...el.classList].map((c) => `.${c}`).join("")}`);
    const visti = new Set();
    const errore = (m) => !visti.has(m) && visti.size < 6 && (visti.add(m), errors.push(m));
    card.tl.progress(1, true);
    const body = document.querySelector(".frame-body");
    const content = body?.firstElementChild;
    if (content && (content.scrollHeight > body.clientHeight + tol || content.scrollWidth > body.clientWidth + tol))
      errore(`doesn't fit: the content needs ${content.scrollWidth}×${content.scrollHeight} px, the body has ${body.clientWidth}×${body.clientHeight} (even tightened to --fit 0.7)`);
    for (const el of document.querySelectorAll(".frame *, .frame-over *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.display === "inline" || el.closest("svg, [hidden]")) continue;
      if (el.clientWidth && el.scrollWidth > el.clientWidth + tol) errore(`${nome(el)}: the text runs ${el.scrollWidth - el.clientWidth} px past its box`);
      const r = el.getBoundingClientRect();
      if (r.width && (r.left < -tol || r.top < -tol || r.right > W + tol || r.bottom > H + tol)) errore(`${nome(el)}: past the edge of the frame`);
    }
    // What's over the card (the QR, the stamp) can't sit on the content.
    for (const o of content ? document.querySelectorAll(".frame-over > *") : []) {
      const a = o.getBoundingClientRect();
      const chi = o.classList.contains("qr") ? "the QR" : `the ${o.className}`;
      for (const el of content.querySelectorAll("*")) {
        const b = el.getBoundingClientRect();
        if (b.width && el.children.length === 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) errore(`${chi} covers ${nome(el)}`);
      }
    }
    card.tl.progress(0, true);
  }

  window.layout = { look, arrange, check };
})();
