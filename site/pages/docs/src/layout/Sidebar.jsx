import { useEffect, useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { NAV } from "../nav.js";
import { ROUTES } from "../generated/routes.js";
import { BASE, navigate, resolveTo } from "./router.js";

/** Le pagine del manuale nell'ordine di NAV (per "precedente / successivo"). */
export const ORDER = NAV.flatMap((g) => g.items.filter((i) => typeof i === "string"));

/** Il gruppo di NAV che contiene la pagina. */
export const groupOf = (route) => NAV.find((g) => g.items.includes(route));

/** Il click di un link interno: va col router, salvo clic con tasto modificatore (scheda nuova). `from`: see navigate(). */
export const go = (href, from) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(href, from);
};

// Il gruppo della pagina, o il primo se la pagina non c'è (404).
const groupIndex = (route) => Math.max(0, NAV.indexOf(groupOf(route)));

// La colonna di sinistra: i gruppi di NAV, le pagine con il loro titolo, i link fuori dal manuale.
// Ogni gruppo si apre e si chiude a mano; a ogni pagina (all'arrivo, da una voce o da un link nel testo)
// resta aperto solo il suo gruppo. Il gruppo della pagina non si chiude (data-locked). Freccia e linea del gruppo aperto si vedono solo se è l'unico aperto (data-multi
// sulla colonna, docs.css). Sotto i 760 px è un cassetto, aperto dal pulsante Menu della barra (App.jsx).
export default function Sidebar({ route, open, onClose }) {
  const trans = useTrans();
  const [expanded, setExpanded] = useState(() => new Set([groupIndex(route)]));
  useEffect(() => {
    const g = groupIndex(route);
    setExpanded((s) => (s.size === 1 && s.has(g) ? s : new Set([g])));
  }, [route]);
  // -1 sulla 404: lì il primo gruppo è aperto ma si può chiudere.
  const locked = NAV.indexOf(groupOf(route));
  const toggle = (g) => {
    if (g === locked) return;
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(g)) next.add(g);
      return next;
    });
  };
  return (
    <>
      <div className="d-scrim" data-open={open || undefined} onClick={onClose} aria-hidden="true" />
      <nav id="d-sidebar" className="d-sidebar" data-open={open || undefined} data-multi={expanded.size > 1 || undefined} aria-label={trans("_%_Manual navigation_%_")}>
        {NAV.map((group, g) => (
          <div className="d-group" key={g} data-open={expanded.has(g) || undefined} data-locked={g === locked || undefined}>
            <button
              type="button"
              className="d-group-label"
              aria-expanded={expanded.has(g)}
              aria-controls={`d-group-${g}`}
              aria-disabled={g === locked || undefined}
              onClick={() => toggle(g)}
            >
              <Trans t={group.label} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
            <div className="d-group-body" id={`d-group-${g}`}>
              <ul>
                {group.items.map((item) =>
                  typeof item === "string" ? (
                    <li key={item}>
                      <a href={`${BASE}${item}/`} aria-current={item === route ? "page" : undefined} onClick={go(`${BASE}${item}/`)}>
                        <Trans t={ROUTES[item].meta.title} />
                      </a>
                    </li>
                  ) : (
                    <li key={item.href}>
                      <a href={resolveTo(item.href).href} target="_blank" rel="noopener">
                        <Trans t={item.label} /> <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
