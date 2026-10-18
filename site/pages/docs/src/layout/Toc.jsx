import { useEffect, useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { go } from "./router.js";

/**
 * La sezione che si sta leggendo: l'ultimo titolo il cui bordo alto è salito sopra il 25% dello
 * schermo (come useCurrentSection di site/landing/src/Nav.jsx). `key` cambia a ogni pagina.
 */
export function useActiveHeading(ids, key) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      let found = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < innerHeight * 0.25) found = id;
      }
      // In fondo alla pagina l'ultima sezione può non arrivare mai in cima: lì vale come attiva.
      if (ids.length && innerHeight + scrollY >= document.documentElement.scrollHeight - 2) found = ids.at(-1);
      setActive(found);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifica la pagina, `ids` ne dipende
  }, [key]);
  return active;
}

function Links({ headings, active }) {
  return (
    <ul className="d-toc-list">
      {headings.map((h) => (
        <li key={h.id} data-depth={h.depth}>
          {/* go(): the router, unless a modifier asks for a new tab or window. */}
          <a href={`#${h.id}`} aria-current={h.id === active ? "location" : undefined} onClick={go(`#${h.id}`)}>
            <Trans t={h.title} a={h.a} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The icons of the right column: 16 px, the stroke of the site bar's a little lighter. */
export const ICON = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

// "In questa pagina". Da 1280 px in su sono le sezioni nella colonna di destra (variant "side"), sotto il
// titolo della pagina (Rail.jsx); sotto è un <details> sopra il testo (variant "inline"). Il CSS mostra
// l'una o l'altro. Una pagina senza sezioni non ha indice.
export default function Toc({ headings, active, variant }) {
  const trans = useTrans();
  if (!headings.length) return null;
  if (variant === "inline") {
    return (
      <details className="d-toc-inline">
        <summary>
          <Trans>_%_On this page_%_</Trans>
        </summary>
        <Links headings={headings} active={active} />
      </details>
    );
  }
  return (
    <nav aria-label={trans("_%_On this page_%_")}>
      <Links headings={headings} active={active} />
    </nav>
  );
}
