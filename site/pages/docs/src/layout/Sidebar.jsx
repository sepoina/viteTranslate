import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { NAV } from "../nav.js";
import { ROUTES } from "../generated/routes.js";
import { BASE, navigate, resolveTo } from "./router.js";

/** Le pagine del manuale nell'ordine di NAV (per "precedente / successivo"). */
export const ORDER = NAV.flatMap((g) => g.items.filter((i) => typeof i === "string"));

/** Il gruppo di NAV che contiene la pagina. */
export const groupOf = (route) => NAV.find((g) => g.items.includes(route));

/** Il click di un link interno: va col router, salvo clic con tasto modificatore (scheda nuova). */
export const go = (href) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(href);
};

// La colonna di sinistra: i gruppi di NAV, le pagine con il loro titolo, i link fuori dal manuale.
// Sotto i 760 px è un cassetto, aperto dal pulsante Menu della barra (App.jsx).
export default function Sidebar({ route, open, onClose }) {
  const trans = useTrans();
  return (
    <>
      <div className="d-scrim" data-open={open || undefined} onClick={onClose} aria-hidden="true" />
      <nav id="d-sidebar" className="d-sidebar" data-open={open || undefined} aria-label={trans("_%_Manual navigation_%_")}>
        {NAV.map((group, g) => (
          <div className="d-group" key={g}>
            <p className="d-group-label">
              <Trans t={group.label} />
            </p>
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
        ))}
      </nav>
    </>
  );
}
