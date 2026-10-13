// The clock and the boot of every prototype. Time zero is the start of the clip, not the page load;
// everything that moves sits on one GSAP timeline (card.tl), started at zero.
// LINKED-DATA: urlCard() and ciak() in commons/cli/director.mjs (the URL, the "take" event, card.ready and
// card.errors); site/video/README.md § "Cards"; commons/layout/darkStyle.md. Change one, change the others.
//
// Times in the params are seconds from that zero: the voice's own seconds, where the word n falls
// at about lead + n / rate. Opened by hand in a browser (no clock=take), a card starts on load.
// Lists are one item per line; inside an item, `|` splits its parts.
(() => {
  const q = new URLSearchParams(location.search);
  gsap.ticker.lagSmoothing(0); // the timeline's time is the real time: a hitch doesn't push the entrances off the voice
  const tl = gsap.timeline({ paused: true });
  const errors = [];
  const still = q.has("still");
  let build = null, proto = null, ready = false, started = false;

  const start = () => {
    if (started) return;
    started = true;
    document.documentElement.classList.add("go");
    tl.play(0);
  };
  const param = (name, fallback = "") => (q.has(name) ? q.get(name) : fallback);
  const fx = (name, targets, seconds, config = {}) => {
    if (!gsap.effects[name]) return errors.push(`no effect "${name}" in motion.js (${Object.keys(gsap.effects).join(", ")})`);
    tl.add(gsap.effects[name](targets, config), seconds);
  };
  const TWEENS = ["fx", "set", "to", "from", "fromTo"];

  window.card = {
    /** A param, or its fallback. */
    param,
    /** A list param: one item per line, each split on `|`. */
    list(name, fallback = []) {
      if (!q.has(name)) return fallback;
      return q
        .get(name)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split("|").map((part) => part.trim()));
    },
    /** `count` times from a param ("2.1, 3.4, 5"); the missing ones come every `step` seconds. */
    times(count, { name = "at", first = 1, step = 0.8 } = {}) {
      const given = param(name).split(/[\s,]+/).filter(Boolean).map(Number);
      const out = [];
      for (let i = 0; i < count; i++) out.push(given[i] ?? (i ? out[i - 1] + step : first));
      return out;
    },
    tl,
    errors,
    still,
    get ready() {
      return ready;
    },
    get started() {
      return started;
    },
    /** The prototype's script calls this once, with the function that builds it. */
    define(fn) {
      build = fn;
    },
    /** A part's entrance at `seconds`, with the effect the part declares (data-enter); `still`: none. */
    enter(node, seconds, override = {}) {
      if (still || !node) return;
      const { fx: nome = node.dataset.enter, ...config } = override;
      fx(nome, node, seconds, { ...JSON.parse(node.dataset.enterConfig ?? "{}"), ...config });
    },
    fx,
    /** Runs `fn` at `seconds`. Prefer tweens: a call can't be seeked back. */
    at(seconds, fn) {
      tl.call(fn, null, seconds);
    },
    /** A file next to the prototype (an image, a QR). */
    asset(name) {
      return new URL(name, proto ?? location.href).href;
    },
    /**
     * The scene's `anim`: effects and raw tweens added to the timeline (README.md § "Cards").
     * Each entry has one of fx | set | to | from | fromTo, a `target` (a CSS selector) and `at`
     * (seconds, default 0). fx names an effect of motion.js, its other keys are the effect's config;
     * set, to and from carry GSAP vars; fromTo is [from vars, to vars].
     */
    apply(list) {
      for (const [i, voce] of (Array.isArray(list) ? list : [list]).entries()) {
        const dove = `anim[${i}]`;
        const tipo = TWEENS.filter((k) => k in (voce ?? {}));
        if (tipo.length !== 1) {
          errors.push(`${dove}: one of ${TWEENS.join(", ")}`);
          continue;
        }
        const { [tipo[0]]: valore, target, at = 0, ...resto } = voce;
        const nodi = document.querySelectorAll(target);
        if (!nodi.length) {
          errors.push(`${dove}: no element matches "${target}"`);
          continue;
        }
        if (tipo[0] === "fx") fx(valore, nodi, at, resto);
        else if (tipo[0] === "fromTo") tl.fromTo(nodi, valore[0], valore[1], at);
        else tl[tipo[0]](nodi, valore, at);
      }
    },
    /** The card as it is at `seconds`, still: for pictures, never during a take. */
    seek(seconds) {
      started = true;
      document.documentElement.classList.add("go");
      tl.pause().seek(seconds, false);
    },
    /** Builds the prototype named in the URL; the flow is in commons/layout/darkStyle.md § "The frame". */
    async boot() {
      try {
        layout.look(errors);
        const src = q.get("proto");
        if (!src) throw new Error("no proto in the URL");
        proto = new URL(src, location.href).href;
        await new Promise((ok, ko) => {
          const s = Object.assign(document.createElement("script"), { src: proto });
          s.onload = ok;
          s.onerror = () => ko(new Error(`prototype not found: ${src}`));
          document.body.append(s);
        });
        if (!build) throw new Error(`${src} doesn't call card.define()`);
        const regione = (r) => document.querySelector(`.frame-${r}`);
        build({ ...card, parts, head: regione("head"), body: regione("body"), foot: regione("foot"), over: regione("over") });
        parts.common(); // note, stamp, qr: every prototype has them
        // Measured with its images and fonts in: a logo still loading is 0 px tall.
        await Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]);
        layout.arrange();
        if (q.has("anim")) card.apply(JSON.parse(q.get("anim")));
        layout.check(errors);
      } catch (e) {
        errors.push(e.message);
      }
      for (const e of errors) console.error(`card: ${e}`);
      ready = true;
      if (q.get("clock") === "take") {
        addEventListener("take", start);
        setTimeout(start, 6000); // no take at all: better late than a blank card
      } else start();
    },
  };
})();
