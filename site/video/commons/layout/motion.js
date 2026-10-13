// The motion of every prototype: curves and effects, on GSAP.
// Every effect sets both its ends (fromTo), so it doesn't depend on the CSS it starts from; light
// and glow start from the current state, and say so. Durations are times --tempo, read when the
// effect is made (after `look`); colors come from --accent.
// LINKED-DATA: commons/layout/darkStyle.md § "Motion" describes each effect; parts.js says which one each
// part enters with (data-enter). Change an effect, change those, and look at the gallery again.
(() => {
  gsap.registerPlugin(CustomEase);
  CustomEase.create("vt", "0.2,0.7,0.2,1"); // entrances: a quick start, a soft landing
  CustomEase.create("vt.out", "0,0,0.58,1"); // lights, fades, glows
  CustomEase.create("vt.press", "0.6,0,0.9,0.4"); // the stamp: speeding up to the hit

  const root = document.documentElement;
  const tempo = () => parseFloat(getComputedStyle(root).getPropertyValue("--tempo")) || 1;
  const accent = (a) => {
    const hex = getComputedStyle(root).getPropertyValue("--accent").trim() || "#4ade80";
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };
  // Every effect: its defaults, its duration times --tempo.
  const fx = (name, defaults, effect) =>
    gsap.registerEffect({ name, defaults, extendTimeline: true, effect: (t, c) => effect(t, { ...c, duration: c.duration * tempo() }) });

  // Up from below, fading in.
  fx("rise", { y: 24, duration: 0.9, stagger: 0 }, (t, c) =>
    gsap.fromTo(t, { opacity: 0, y: c.y }, { opacity: 1, y: 0, duration: c.duration, stagger: c.stagger, ease: "vt" }));

  // A tile landing: up, a little past full size, a green flash on its border.
  fx("hit", { duration: 0.7 }, (t, c) => {
    const half = c.duration / 2;
    return gsap.timeline()
      .fromTo(t, { opacity: 0, y: 40, scale: 0.9, borderColor: accent(1) }, { opacity: 1, y: 0, scale: 1.04, borderColor: accent(0.9), duration: half, ease: "vt" }, 0)
      .to(t, { scale: 1, borderColor: accent(0.35), duration: half, ease: "vt" }, half)
      .fromTo(t, { boxShadow: `0 0 80px ${accent(0.5)}` }, { boxShadow: `0 0 0px ${accent(0)}`, duration: c.duration, ease: "vt" }, 0);
  });

  // A waiting word lighting up: from barely visible, a small pop, a glow that settles.
  fx("pop", { duration: 0.6 }, (t, c) =>
    gsap.timeline()
      .fromTo(t, { opacity: 0.08 }, { opacity: 1, duration: c.duration * 0.6, ease: "vt.out" }, 0)
      .fromTo(t, { scale: 0.86 }, { scale: 1.06, duration: c.duration * 0.45, ease: "vt", immediateRender: false }, 0)
      .to(t, { scale: 1, duration: c.duration * 0.55, ease: "vt" }, c.duration * 0.45)
      .fromTo(t, { textShadow: `0 0 96px ${accent(0.9)}` }, { textShadow: `0 0 48px ${accent(0.35)}`, duration: c.duration, ease: "vt", immediateRender: false }, 0));

  // From the current opacity to `to`.
  fx("light", { to: 1, duration: 0.35 }, (t, c) => gsap.to(t, { opacity: c.to, duration: c.duration, ease: "vt.out" }));

  fx("fade", { duration: 0.8 }, (t, c) => gsap.fromTo(t, { opacity: 0 }, { opacity: 1, duration: c.duration, ease: "vt.out" }));

  // An SVG stroke drawn (stroke-dasharray as long as `length`).
  fx("draw", { duration: 0.4, length: 30 }, (t, c) =>
    gsap.fromTo(t, { strokeDashoffset: c.length }, { strokeDashoffset: 0, duration: c.duration, ease: "vt.out" }));

  // A glow once, back to the current background.
  fx("glow", { duration: 1.2 }, (t, c) => {
    const base = gsap.getProperty(gsap.utils.toArray(t)[0], "backgroundColor");
    return gsap.timeline()
      .to(t, { backgroundColor: accent(0.55), boxShadow: `0 0 28px ${accent(0.6)}`, duration: c.duration * 0.3, ease: "vt.out" })
      .to(t, { backgroundColor: base, boxShadow: `0 0 0px ${accent(0)}`, duration: c.duration * 0.7, ease: "vt.out" });
  });

  // A small shake, as from a blow.
  fx("thud", { duration: 0.2, x: 2, y: 3 }, (t, c) =>
    gsap.timeline()
      .to(t, { x: c.x, y: c.y, duration: c.duration * 0.3, ease: "vt.out" })
      .to(t, { x: -c.x / 2, y: -c.y / 3, duration: c.duration * 0.35, ease: "vt.out" })
      .to(t, { x: 0, y: 0, duration: c.duration * 0.35, ease: "vt.out" }));

  // A rubber stamp pressed on the card, tilted, with a thud on `shake`. thud goes through fx too:
  // called with its defaults, it gets --tempo on its own.
  fx("stamp", { duration: 0.3, angle: -10, shake: ".frame", thudAt: 0.22 }, (t, c) => {
    const tl = gsap.timeline()
      .fromTo(t, { opacity: 0, rotation: -3, scale: 2.4 }, { opacity: 0.95, rotation: c.angle, scale: 0.95, duration: c.duration * 0.75, ease: "vt.press" }, 0)
      .to(t, { opacity: 0.9, scale: 1, duration: c.duration * 0.25, ease: "vt.press" });
    if (c.shake) tl.add(gsap.effects.thud(c.shake), c.thudAt * tempo());
    return tl;
  });
})();
