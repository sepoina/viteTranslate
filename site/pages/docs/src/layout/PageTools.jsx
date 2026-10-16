import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { ROUTES } from "../generated/routes.js";
import { BASE } from "./router.js";
import { backClick, neighbours } from "./PageNav.jsx";
import { go } from "./Sidebar.jsx";
import { ICON } from "./Toc.jsx";

// Lucide icons (ISC).
const PATHS = {
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"],
  prev: ["m12 19-7-7 7-7", "M19 12H5"],
  back: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"],
  next: ["M5 12h14", "m12 5 7 7-7 7"],
};

// The small icons at the bottom of the right column: the page on GitHub, previous, next. Each names
// itself in the column's helper line (`hint`, from Rail.jsx): the action, or the title of the page it
// leads to. "Previous" goes back to the page the reader jumped from ("On the same topic"), with its own
// icon. Back to the top is the page title at the head of the column. Under 1280 px the article's foot
// and PageNav do the same job.
export default function PageTools({ route, editHref, hint }) {
  const trans = useTrans();
  const { prev, back, next } = neighbours(route);
  const title = (r) => ROUTES[r].meta.title;

  const tools = [
    {
      key: "edit",
      label: trans("_%_Edit this page on GitHub_%_"),
      tip: <Trans>_%_Edit this page on GitHub_%_</Trans>,
      link: { href: editHref, target: "_blank", rel: "noopener" },
    },
    {
      key: back ? "back" : "prev",
      off: !prev,
      label: prev && trans([back ? "_%_Back to %s_%_" : "_%_Previous page: %s_%_", trans(title(prev))]),
      tip: prev && <Trans t={title(prev)} />,
      link: prev && { href: `${BASE}${prev}/`, onClick: back ? backClick : go(`${BASE}${prev}/`) },
    },
    {
      key: "next",
      off: !next,
      label: next && trans(["_%_Next page: %s_%_", trans(title(next))]),
      tip: next && <Trans t={title(next)} />,
      link: next && { href: `${BASE}${next}/`, onClick: go(`${BASE}${next}/`) },
    },
  ];

  return (
    <div className="d-tools-row">
      {tools.map((t) => {
        const icon = (
          <svg {...ICON} width="17" height="17">
            {PATHS[t.key].map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
        );
        // The first or the last page: the place stays, dimmed, so the icons never shift.
        return t.off ? (
          <span key={t.key} className="d-tool" data-off="" aria-hidden="true">
            {icon}
          </span>
        ) : (
          <a key={t.key} className="d-tool" aria-label={t.label} {...t.link} {...hint(t.tip)}>
            {icon}
          </a>
        );
      })}
    </div>
  );
}
