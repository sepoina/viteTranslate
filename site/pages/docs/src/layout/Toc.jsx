import { useEffect, useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { navigate } from "./router.js";

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
    <ul>
      {headings.map((h) => (
        <li key={h.id} data-depth={h.depth}>
          <a
            href={`#${h.id}`}
            aria-current={h.id === active ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(`#${h.id}`);
            }}
          >
            <Trans t={h.title} a={h.a} />
          </a>
        </li>
      ))}
    </ul>
  );
}

const ICON = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

// In cima, lo stesso movimento dei salti di sezione: morbido, salvo chi ha chiesto meno animazioni.
const toTop = () => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

// "In questa pagina". Da 1280 px in su è la colonna di destra (variant "side"), con in fondo la pagina
// su GitHub e il ritorno in cima; sotto è un <details> sopra il testo (variant "inline"), e "Modifica su
// GitHub" sta nel piede dell'articolo (App.jsx). Il CSS mostra l'una o l'altro.
export default function Toc({ headings, active, variant, editHref }) {
  const trans = useTrans();
  if (variant === "inline") {
    if (!headings.length) return null;
    return (
      <details className="d-toc-inline">
        <summary>
          <Trans>_%_On this page_%_</Trans>
        </summary>
        <Links headings={headings} active={active} />
      </details>
    );
  }
  if (!headings.length && !editHref) return null;
  return (
    <aside className="d-toc" aria-label={trans("_%_On this page_%_")}>
      {headings.length > 0 && (
        <>
          <p className="d-toc-label">
            <svg {...ICON}>
              <path d="M4 6h16M4 12h10M4 18h13" />
            </svg>
            <Trans>_%_On this page_%_</Trans>
          </p>
          <Links headings={headings} active={active} />
        </>
      )}
      <div className="d-toc-tools">
        {editHref && (
          <a href={editHref} target="_blank" rel="noopener">
            <svg {...ICON}>
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <Trans>_%_Edit this page on GitHub_%_</Trans>
          </a>
        )}
        <button type="button" onClick={toTop}>
          <svg {...ICON}>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 4-4 4 4M12 16V8" />
          </svg>
          <Trans>_%_Scroll to top_%_</Trans>
        </button>
      </div>
    </aside>
  );
}
