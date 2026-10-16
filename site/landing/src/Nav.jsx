import { useEffect, useState } from "react";
import { Trans } from "@sepoina/vitetranslate/react";
import { scrollToSection } from "./motion.js";
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

// The site bar (src/theme/SiteBar.jsx): the section being read goes in the middle. Here the Demos
// icon does not leave the page, it scrolls to the section.
export default function Nav() {
  const current = useCurrentSection();
  const section = current ? SECTIONS[current] : null;

  return (
    <SiteBar
      current="home"
      home={import.meta.env.BASE_URL}
      section={section && { id: current, mark: section.n, label: <Trans t={section.label} /> }}
      onNavigate={(place, e) => {
        if (place !== "demos") return;
        e.preventDefault();
        scrollToSection("demos");
      }}
    />
  );
}
