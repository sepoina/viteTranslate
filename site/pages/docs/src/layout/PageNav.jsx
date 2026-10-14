import { Trans } from "@sepoina/vitetranslate/react";
import { ROUTES } from "../generated/routes.js";
import { BASE } from "./router.js";
import { ORDER, go } from "./Sidebar.jsx";

// Precedente e successivo, nell'ordine della colonna di sinistra.
export default function PageNav({ route }) {
  const i = ORDER.indexOf(route);
  const link = (r, dir) =>
    r && (
      <a className={`d-pagenav-${dir}`} href={`${BASE}${r}/`} onClick={go(`${BASE}${r}/`)}>
        <span className="d-pagenav-dir">{dir === "prev" ? <Trans>_%_← Previous_%_</Trans> : <Trans>_%_Next →_%_</Trans>}</span>
        <span className="d-pagenav-title">
          <Trans t={ROUTES[r].meta.title} />
        </span>
      </a>
    );
  return (
    <nav className="d-pagenav">
      {link(ORDER[i - 1], "prev")}
      {link(ORDER[i + 1], "next")}
    </nav>
  );
}
