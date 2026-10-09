import { useEffect, useState } from "react";
import { Trans } from "@sepoina/vitetranslate/react";
import { scrollToSection } from "./motion.js";
import { REPO } from "./links.js";
import { SECTIONS } from "./sections.js";
import SiteBar from "./theme/SiteBar.jsx";

/**
 * La sezione che si sta leggendo: l'ultima [data-section] il cui bordo alto è salito sopra il 35%
 * dello schermo. null in cima alla pagina, sull'hero. Lenis scorre con window.scrollTo, quindi
 * l'evento scroll arriva anche con lo scroll morbido.
 */
function useCurrentSection() {
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      let found = null;
      for (const el of document.querySelectorAll("[data-section]")) {
        if (el.getBoundingClientRect().top < innerHeight * 0.35) found = el.dataset.section;
      }
      setCurrent(found);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return current;
}

// La barra del sito (src/theme/SiteBar.jsx): accanto al logo la sezione corrente, poi il menu
// delle sezioni e, fra gli strumenti, il link a GitHub.
export default function Nav() {
  const current = useCurrentSection();
  const section = current ? SECTIONS[current] : null;

  return (
    <SiteBar
      home={import.meta.env.BASE_URL}
      tools={
        <a className="bar-gh" href={REPO}>
          GitHub <span aria-hidden="true">↗</span>
        </a>
      }
    >
      {/* Ripete il titolo che si sta leggendo: per chi usa un lettore di schermo non aggiunge niente. */}
      {section && (
        <span key={current} className="bar-crumb" aria-hidden="true">
          <span className="bar-crumb-n">{section.n}</span>
          <Trans t={section.label} />
        </span>
      )}
      <nav className="bar-nav">
        <button type="button" onClick={() => scrollToSection("features")}>
          <Trans>_%_Funzioni_%_</Trans>
        </button>
        <button type="button" onClick={() => scrollToSection("how")}>
          <Trans>_%_Come funziona_%_</Trans>
        </button>
        <button type="button" onClick={() => scrollToSection("compare")}>
          <Trans>_%_Confronto_%_</Trans>
        </button>
        <button type="button" onClick={() => scrollToSection("demos")}>
          <Trans>_%_Demo_%_</Trans>
        </button>
      </nav>
    </SiteBar>
  );
}
