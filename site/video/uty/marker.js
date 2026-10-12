// Il pennarello delle riprese: segni a mano libera (cerchio, riquadro, sottolineatura, freccia)
// disegnati sopra la pagina. È un init script di ogni contesto (director.mjs, accanto al cursore
// finto): vive solo nel documento principale, in un livello SVG sopra a tutto, webview comprese, e
// sotto il cursore. Un reload lo azzera, come il cambio di scena (director.mjs, palco()).
//
// Nato nel prototipo "Stage Marker Lab". Ogni misura è in pixel del video da 1920: `scale`
// (1 / zoom della pagina) la porta in pixel CSS. Il caso ha un seme fisso, ricavato dalla scena e
// dal numero del segno: ogni ripresa disegna lo stesso segno nello stesso modo.
//
// LINKED-DATA: DEFAULTS e i nomi qui sotto sono quelli di README.md § "Marks" (nomi YAML tradotti da
// opzioniSegno in director.mjs) e di MARK_KEYS in storyboard.mjs. Cambiane uno, cambia gli altri.
(() => {
  if (window.top !== window || window.__vtMark) return;

  const SVGNS = "http://www.w3.org/2000/svg";
  const STEP = 1.5; // pixel CSS tra due campioni della linea
  const PIECE = 14; // pixel CSS per pezzo di una linea tratteggiata (uno spessore per pezzo)
  const COLORS = { green: "#4ade80", amber: "#fbbf24", coral: "#f87171", white: "#f4f7f5" };
  const DEFAULTS = {
    shape: "circle", w0: 10, w1: 3, pen: "brush", dash: 0, dashGap: 16, march: 24, color: "green", opacity: 0.9,
    shadow: true, draw: 0.6, boil: true, boilAmp: 1.2, boilRate: 10, boilDrawings: 3, dim: 0, dimTime: 0.4,
    overshoot: 0.12, wobble: 0.6, pad: 22, seed: 7,
  };

  // ------------------------------------------------------------------ caso con seme, rumore
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(s) {
    let h = 2166136261;
    for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Rumore liscio lungo la linea: un valore a caso ogni `step` pixel, raccordato, in [-1, 1].
  function valueNoise(rand, length, step) {
    const n = Math.ceil(length / step) + 2;
    const k = Array.from({ length: n }, () => rand() * 2 - 1);
    return (s) => {
      const x = s / step, i = Math.floor(x), f = x - i, u = (1 - Math.cos(f * Math.PI)) / 2;
      return k[Math.min(i, n - 1)] * (1 - u) + k[Math.min(i + 1, n - 1)] * u;
    };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  // ------------------------------------------------------------------ le linee centrali
  function addLine(out, a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP));
    for (let i = out.length ? 1 : 0; i <= n; i++) out.push([lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]);
  }
  function addArc(out, cx, cy, r, a0, a1) {
    const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / STEP));
    for (let i = 1; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  }

  const SHAPES = {
    // Un'ellisse un po' oltre il giro, appena inclinata, che si apre a spirale: il pezzo in più
    // corre accanto all'inizio invece di ripassarlo.
    circle(r, o, rand) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const rx = (r.w / 2) * 1.22 + o.pad, ry = (r.h / 2) * 1.22 + o.pad;
      const turns = 1 + o.overshoot;
      const start = -Math.PI * 0.62 + (rand() - 0.5) * 0.6;
      const tilt = (rand() - 0.5) * 0.12, cos = Math.cos(tilt), sin = Math.sin(tilt);
      const spiral = 0.05 + rand() * 0.05;
      const perim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
      const n = Math.max(48, Math.ceil((perim * turns) / STEP));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = start + Math.PI * 2 * turns * t, f = 1 + spiral * (t - 0.5);
        const x = rx * f * Math.cos(a), y = ry * f * Math.sin(a);
        pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
      }
      return [{ pts, w0: o.w0, w1: o.w1 }];
    },
    // Un riquadro arrotondato: un giro in senso orario dall'alto a sinistra, poi ancora un tratto in alto.
    box(r, o) {
      const x0 = r.x - o.pad, x1 = r.x + r.w + o.pad, y0 = r.y - o.pad * 0.75, y1 = r.y + r.h + o.pad * 0.75;
      const rad = Math.min(16 * o.scale, (y1 - y0) / 2, (x1 - x0) / 2);
      const pts = [];
      addLine(pts, [x0 + rad, y0], [x1 - rad, y0]);
      addArc(pts, x1 - rad, y0 + rad, rad, -Math.PI / 2, 0);
      addLine(pts, [x1, y0 + rad], [x1, y1 - rad]);
      addArc(pts, x1 - rad, y1 - rad, rad, 0, Math.PI / 2);
      addLine(pts, [x1 - rad, y1], [x0 + rad, y1]);
      addArc(pts, x0 + rad, y1 - rad, rad, Math.PI / 2, Math.PI);
      addLine(pts, [x0, y1 - rad], [x0, y0 + rad]);
      addArc(pts, x0 + rad, y0 + rad, rad, Math.PI, Math.PI * 1.5);
      const extra = (x1 - x0 - 2 * rad) * Math.min(1, o.overshoot * 3);
      if (extra > 1) addLine(pts, [x0 + rad, y0], [x0 + rad + extra, y0]);
      return [{ pts, w0: o.w0, w1: o.w1, spiral: 6 * o.scale }];
    },
    // Un tratto veloce sotto il bersaglio, che sale un poco verso la fine.
    underline(r, o, rand) {
      const y = r.y + r.h + o.pad * 0.45 + 2 * o.scale;
      const xa = r.x - o.pad * 0.3, xb = r.x + r.w + o.pad * 0.5;
      const rise = (r.w * 0.012 + 3 * o.scale) * (0.6 + rand() * 0.8);
      const bow = 3 * o.scale * (0.5 + rand());
      const n = Math.max(12, Math.ceil((xb - xa) / STEP));
      const pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([lerp(xa, xb, t), y - rise * t - bow * Math.sin(Math.PI * t)]); }
      return [{ pts, w0: o.w0, w1: o.w1 }];
    },
    // Un'asta curva dal lato dove c'è spazio, poi i due tratti della punta.
    arrow(r, o, rand, bounds) {
      const len = 170 * o.scale + o.pad * 2;
      const tip = (dx, dy) => [r.x + r.w * (dx < 0 ? 0.3 : 0.7), dy > 0 ? r.y + r.h + o.pad * 0.6 : r.y - o.pad * 0.6];
      const tail = (E, dx, dy) => [E[0] + dx * len * 0.8, E[1] + dy * len * 0.55];
      const inside = (p) => p[0] > bounds.x + 10 && p[0] < bounds.x + bounds.w - 10 && p[1] > bounds.y + 10 && p[1] < bounds.y + bounds.h - 10;
      let side = [-1, 1];
      for (const s of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) if (inside(tail(tip(...s), ...s))) { side = s; break; }
      const E = tip(...side), S = tail(E, ...side);
      const vx = E[0] - S[0], vy = E[1] - S[1], vl = Math.hypot(vx, vy);
      const bend = 0.18 * vl * (rand() < 0.5 ? 1 : -1);
      const C = [(S[0] + E[0]) / 2 - (vy / vl) * bend, (S[1] + E[1]) / 2 + (vx / vl) * bend];
      const shaft = [], n = Math.max(16, Math.ceil(vl / STEP));
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        shaft.push([a * S[0] + b * C[0] + c * E[0], a * S[1] + b * C[1] + c * E[1]]);
      }
      const tl = Math.hypot(E[0] - C[0], E[1] - C[1]), ux = (E[0] - C[0]) / tl, uy = (E[1] - C[1]) / tl;
      const head = 20 * o.scale + o.w1 * 1.5;
      const wing = (ang) => {
        const c = Math.cos(ang), s = Math.sin(ang);
        return [E[0] - (ux * c - uy * s) * head, E[1] - (ux * s + uy * c) * head];
      };
      const stroke = (A) => { const p = []; addLine(p, A, E); return p; };
      return [
        { pts: shaft, w0: o.w0, w1: o.w1 },
        { pts: stroke(wing(0.5)), w0: o.w1 * 1.6, w1: o.w1 },
        { pts: stroke(wing(-0.5)), w0: o.w1 * 1.6, w1: o.w1 },
      ];
    },
  };

  // ------------------------------------------------------------------ la mano e il tremolio
  function normalsOf(P) {
    const n = P.length;
    return P.map((_, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      return [-ty / l, tx / l];
    });
  }
  // La penna si posa leggera, preme, poi si assottiglia da w0 a w1.
  const widthAt = (st, t) => lerp(st.w0, st.w1, t) * (0.55 + 0.45 * smooth(clamp01(t / 0.06)));

  function prepare(lines, o, seed) {
    const handRand = rng(seed ^ 0x9e3779b9);
    return lines.map((st, si) => {
      const P = st.pts, n = P.length;
      const L = new Float32Array(n);
      for (let i = 1; i < n; i++) L[i] = L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      const total = L[n - 1] || 1;
      const hand = valueNoise(handRand, total, 70 * o.scale);
      const N0 = normalsOf(P);
      const Q = P.map((p, i) => {
        const off = o.wobble * 3.5 * o.scale * hand(L[i]) + (st.spiral || 0) * (L[i] / total - 0.5);
        return [p[0] + N0[i][0] * off, p[1] + N0[i][1] * off];
      });
      const W = Float32Array.from(L, (l) => widthAt(st, l / total));
      // Il tremolio: qualche disegno della stessa linea, mostrati a turno come nell'animazione a mano.
      const boil = [];
      for (let k = 0; k < o.boilDrawings; k++) {
        const nz = valueNoise(rng(seed + 1013 * (k + 1) + 7 * si), total, 40 * o.scale);
        boil.push(Float32Array.from(L, (l) => nz(l)));
      }
      return { Q, N: normalsOf(Q), W, L, total, boil };
    });
  }

  function boiled(s, i, k, amp) {
    const b = k >= 0 ? amp * s.boil[k][i] : 0;
    return [s.Q[i][0] + s.N[i][0] * b, s.Q[i][1] + s.N[i][1] * b];
  }
  function indexAt(L, l) {
    let lo = 0, hi = L.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (L[m] < l) lo = m + 1; else hi = m; }
    return lo;
  }
  function pointAt(s, l, k, amp) {
    const j = Math.max(1, indexAt(s.L, l));
    const f = clamp01((l - s.L[j - 1]) / (s.L[j] - s.L[j - 1] || 1));
    const a = boiled(s, j - 1, k, amp), b = boiled(s, j, k, amp);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }
  function widthOn(s, l) {
    const j = Math.max(1, indexAt(s.L, l));
    return lerp(s.W[j - 1], s.W[j], clamp01((l - s.L[j - 1]) / (s.L[j] - s.L[j - 1] || 1)));
  }

  // ------------------------------------------------------------------ il disegno
  // Pennello: il contorno della linea alla sua larghezza, pieno, con le estremità tonde.
  function drawBrush(el, s, upto, k, amp) {
    const vuoto = () => { el.path.setAttribute("d", ""); el.c0.setAttribute("r", 0); el.c1.setAttribute("r", 0); };
    if (upto <= 0) return vuoto();
    const { N, W, L } = s, n = s.Q.length;
    const pts = [], nor = [], wid = [];
    let i = 0;
    for (; i < n && L[i] <= upto; i++) { pts.push(boiled(s, i, k, amp)); nor.push(N[i]); wid.push(W[i]); }
    if (i < n && i > 0) { pts.push(pointAt(s, upto, k, amp)); nor.push(N[i]); wid.push(widthOn(s, upto)); }
    if (pts.length < 2) return vuoto();
    const left = [], right = [];
    for (let j = 0; j < pts.length; j++) {
      const h = wid[j] / 2;
      left.push(f1(pts[j][0] + nor[j][0] * h) + " " + f1(pts[j][1] + nor[j][1] * h));
      right.push(f1(pts[j][0] - nor[j][0] * h) + " " + f1(pts[j][1] - nor[j][1] * h));
    }
    el.path.setAttribute("d", "M" + left.join("L") + "L" + right.reverse().join("L") + "Z");
    const last = pts.length - 1;
    el.c0.setAttribute("cx", f1(pts[0][0])); el.c0.setAttribute("cy", f1(pts[0][1])); el.c0.setAttribute("r", f1(wid[0] / 2));
    el.c1.setAttribute("cx", f1(pts[last][0])); el.c1.setAttribute("cy", f1(pts[last][1])); el.c1.setAttribute("r", f1(wid[last] / 2));
  }

  // Tratteggio: la linea con stroke-dasharray, a pezzi corti perché lo spessore possa ancora
  // assottigliarsi (uno stroke-width per pezzo). Lo stroke-dashoffset di ogni pezzo è la sua
  // lunghezza d'arco meno la marcia: il motivo prosegue senza salti e scorre nel tempo.
  function drawDashes(el, s, upto, k, amp, phase) {
    const pieces = el.pieces;
    for (let p = 0; p < pieces.length; p++) {
      const from = p * PIECE, to = Math.min(upto, from + PIECE, s.total);
      const path = pieces[p];
      if (from >= to) { if (path.hasAttribute("d")) path.removeAttribute("d"); continue; }
      const pts = [pointAt(s, from, k, amp)];
      for (let j = indexAt(s.L, from); j < s.L.length && s.L[j] < to; j++) if (s.L[j] > from) pts.push(boiled(s, j, k, amp));
      pts.push(pointAt(s, to, k, amp));
      path.setAttribute("d", "M" + pts.map((q) => f1(q[0]) + " " + f1(q[1])).join("L"));
      path.setAttribute("stroke-width", f1(widthOn(s, (from + to) / 2)));
      path.setAttribute("stroke-dashoffset", f1(from - phase));
    }
  }

  // ------------------------------------------------------------------ i segni sulla pagina
  const marks = new Set();
  let layer = null;
  let running = false;

  function getLayer() {
    if (layer?.isConnected) return layer;
    layer = document.createElementNS(SVGNS, "svg");
    layer.id = "__vtMarks";
    layer.setAttribute("style", "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483645;overflow:visible");
    const defs = document.createElementNS(SVGNS, "defs");
    const filter = document.createElementNS(SVGNS, "filter");
    filter.id = "__vtLift";
    for (const [k, v] of Object.entries({ x: "-10%", y: "-10%", width: "120%", height: "120%" })) filter.setAttribute(k, v);
    const shadow = document.createElementNS(SVGNS, "feDropShadow");
    for (const [k, v] of Object.entries({ dx: 0, dy: 1, stdDeviation: 1.2, "flood-color": "#000", "flood-opacity": 0.55 })) shadow.setAttribute(k, v);
    filter.append(shadow);
    defs.append(filter);
    layer.append(defs);
    document.documentElement.append(layer);
    return layer;
  }

  // Quanto si vede un segno (0..1) perché uno più nuovo lo ha attenuato.
  function fadeOf(m, now) {
    const f = m.fade;
    if (!f) return 1;
    return f.dur <= 0 ? f.to : lerp(f.from, f.to, clamp01((now - f.t0) / (f.dur * 1000)));
  }
  const fading = (m, now) => m.fade && m.fade.dur > 0 && now - m.fade.t0 < m.fade.dur * 1000;
  const marching = (m) => m.o.pen === "dashes" && m.o.march !== 0;
  const boiling = (m) => m.o.boil && m.o.boilAmp > 0;

  function render(m, now) {
    const fade = fadeOf(m, now);
    if (fade !== m.lastFade) { m.g.setAttribute("opacity", (m.o.opacity * fade).toFixed(3)); m.lastFade = fade; }
    if (fade === 0 && !fading(m, now)) { m.g.remove(); marks.delete(m); return; }
    const t = (now - m.t0) / 1000;
    const p = clamp01(t / Math.max(0.01, m.o.draw));
    const k = boiling(m) ? Math.floor(Math.max(0, t) * m.o.boilRate) % m.o.boilDrawings : -1;
    if (p === m.lastP && k === m.lastK && !marching(m)) return;
    m.lastP = p; m.lastK = k;
    const phase = m.o.march * m.scale * Math.max(0, t);
    // I tratti si dividono il tempo del disegno in proporzione alla loro lunghezza.
    let budget = easeInOut(p) * m.length;
    m.strokes.forEach((s, i) => {
      const upto = Math.max(0, Math.min(s.total, budget));
      budget -= s.total;
      if (m.o.pen === "dashes") drawDashes(m.els[i], s, upto, k, m.amp, phase);
      else drawBrush(m.els[i], s, upto, k, m.amp);
    });
    m.done = p === 1;
  }

  function loop(now) {
    for (const m of [...marks]) render(m, now);
    running = [...marks].some((m) => fading(m, now) || !m.done || boiling(m) || marching(m));
    if (running) requestAnimationFrame(loop);
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

  /** Attenua tutti i segni a `level` (0..1) in `dur` secondi; a 0 spariscono. */
  function dim(level, dur) {
    const now = performance.now();
    for (const m of marks) m.fade = { from: fadeOf(m, now), to: level, t0: now, dur };
    kick();
  }

  /**
   * Un segno attorno a `rect` (pixel CSS della pagina). `opts` coi nomi di DEFAULTS, misure in
   * pixel del video; `scale` = 1 / zoom della pagina. I segni già presenti scendono a `opts.dim`.
   * @returns {{ draw: number }} i secondi del disegno, che director.mjs aspetta
   */
  function add(rect, opts = {}, { key = "", scale = 1 } = {}) {
    const o = { ...DEFAULTS, ...opts };
    o.color = COLORS[o.color] ?? o.color;
    if (!SHAPES[o.shape]) throw new Error(`mark: unknown shape "${o.shape}"`);
    dim(o.dim, o.dimTime);
    const scaled = { ...o, scale, w0: o.w0 * scale, w1: o.w1 * scale, pad: o.pad * scale };
    const seed = (hashString(key + "|" + o.shape) ^ (o.seed * 2654435761)) >>> 0;
    const bounds = { x: 0, y: 0, w: innerWidth, h: innerHeight };
    const strokes = prepare(SHAPES[o.shape](rect, scaled, rng(seed), bounds), scaled, seed);
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("opacity", o.opacity);
    if (o.shadow) g.setAttribute("filter", "url(#__vtLift)");
    if (o.pen === "dashes") {
      g.setAttribute("fill", "none");
      g.setAttribute("stroke", o.color);
      g.setAttribute("stroke-linecap", "round");
      g.setAttribute("stroke-linejoin", "round");
      g.setAttribute("stroke-dasharray", `${f1(Math.max(0.01, o.dash * scale))} ${f1(Math.max(0.5, o.dashGap * scale))}`);
    } else {
      g.setAttribute("fill", o.color);
    }
    const els = strokes.map((s) => {
      const sg = document.createElementNS(SVGNS, "g");
      g.append(sg);
      if (o.pen === "dashes") return { pieces: Array.from({ length: Math.ceil(s.total / PIECE) + 1 }, () => sg.appendChild(document.createElementNS(SVGNS, "path"))) };
      const path = document.createElementNS(SVGNS, "path");
      const c0 = document.createElementNS(SVGNS, "circle"), c1 = document.createElementNS(SVGNS, "circle");
      sg.append(path, c0, c1);
      return { path, c0, c1 };
    });
    getLayer().append(g);
    const m = {
      g, els, strokes, o, scale, amp: o.boilAmp * scale,
      length: strokes.reduce((a, s) => a + s.total, 0), t0: performance.now(), lastP: -1, lastK: -2, lastFade: -1, done: false,
    };
    marks.add(m);
    render(m, m.t0);
    kick();
    return { draw: o.draw };
  }

  /** Via tutti i segni, subito: il cambio di scena. */
  function clear() {
    for (const m of marks) m.g.remove();
    marks.clear();
  }

  window.__vtMark = { add, dim, clear, defaults: DEFAULTS };
})();
