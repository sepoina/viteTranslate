import { Trans } from "@sepoina/vitetranslate/react";
import { ROUTES } from "../generated/routes.js";
import { BASE, cameFrom, go, goBack } from "./router.js";
import { ORDER } from "./Sidebar.jsx";

/**
 * Where "Previous" and "Next" lead: the order of the left column, except that a page reached through
 * "On the same topic" goes back to the page it came from (`back`), and from there back again.
 * Read at render time: it depends on the history entry, and the page renders again at every navigation.
 */
export function neighbours(route) {
  const i = ORDER.indexOf(route);
  const from = cameFrom();
  const back = from && from !== route && ROUTES[from] ? from : null;
  return { prev: back ?? ORDER[i - 1] ?? null, back: !!back, next: ORDER[i + 1] ?? null };
}

/** The click of "Previous" when it goes back: history, unless a modifier asks for a new tab. */
export const backClick = (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  goBack();
};

// Precedente e successivo sotto il testo, solo sotto i 1280 px: più in largo li ha la colonna di destra (PageTools.jsx).
export default function PageNav({ route }) {
  const { prev, back, next } = neighbours(route);
  const link = (r, dir) =>
    r && (
      <a className={`d-pagenav-${dir}`} href={`${BASE}${r}/`} onClick={dir === "prev" && back ? backClick : go(`${BASE}${r}/`)}>
        <span className="d-pagenav-dir">
          {dir === "next" ? <Trans>_%_Next →_%_</Trans> : back ? <Trans>_%_← Back_%_</Trans> : <Trans>_%_← Previous_%_</Trans>}
        </span>
        <span className="d-pagenav-title">
          <Trans t={ROUTES[r].meta.title} />
        </span>
      </a>
    );
  return (
    <nav className="d-pagenav">
      {link(prev, "prev")}
      {link(next, "next")}
    </nav>
  );
}
