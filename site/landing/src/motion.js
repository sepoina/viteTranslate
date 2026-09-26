// Il movimento della landing. GSAP, ScrollTrigger e Lenis arrivano da CDN (index.html) e restano
// globali: nessun import, nessuna dipendenza nel bundle. Se una CDN non risponde, o l'utente ha
// chiesto meno movimento, non si anima niente e la pagina è già nel suo stato finale: gli elementi
// non hanno uno stato "nascosto" scritto nel CSS, lo imposta gsap.from() solo quando parte davvero.

let lenis = null;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Scorre fino alla sezione con `data-section="<nome>"`. Niente ancore: main.jsx rimanda ogni hash al playground. */
export function scrollToSection(name) {
  const el = document.querySelector(`[data-section="${name}"]`);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -64, duration: 1.2 });
  else el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
}

/**
 * Attiva entrate, contatori, parallasse e scroll morbido sotto `root`.
 * @param {HTMLElement} root
 * @returns {() => void} lo smontaggio
 */
export function initMotion(root) {
  const { gsap, ScrollTrigger, Lenis } = window;
  if (!gsap || !ScrollTrigger || reducedMotion()) return () => {};
  gsap.registerPlugin(ScrollTrigger);

  if (Lenis) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }
  function tick(time) {
    lenis?.raf(time * 1000);
  }

  const ctx = gsap.context(() => {
    // Entrata dell'hero, all'apertura.
    gsap.from("[data-hero]", { y: 12, opacity: 0, duration: 0.6, ease: "power4.out", stagger: 0.08, delay: 0.1 });

    // Ogni [data-reveal] entra quando arriva in vista; [data-stagger] fa entrare i figli uno dopo l'altro.
    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      gsap.from(el, {
        y: 16,
        opacity: 0,
        duration: 0.6,
        ease: "power4.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
      });
    });
    gsap.utils.toArray("[data-stagger]").forEach((group) => {
      gsap.from(group.children, {
        y: 16,
        opacity: 0,
        duration: 0.5,
        ease: "power4.out",
        stagger: 0.06,
        scrollTrigger: { trigger: group, start: "top 86%", once: true },
      });
    });

    // Contatori: il testo nel markup è già il valore finale. Si scrive nel nodo di testo che React
    // possiede (nodeValue) invece di sostituirlo, così un rendering successivo non lo perde.
    gsap.utils.toArray("[data-count]").forEach((el) => {
      const node = el.firstChild;
      const target = Number(el.dataset.count);
      if (!node || !Number.isFinite(target)) return;
      const state = { v: 0 };
      node.nodeValue = "0";
      gsap.to(state, {
        v: target,
        duration: 2,
        ease: "power2.out",
        onUpdate: () => (node.nodeValue = String(Math.round(state.v))),
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      });
    });
  }, root);

  return () => {
    ctx.revert();
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
  };
}
