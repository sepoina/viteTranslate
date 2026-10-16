import { useState } from "react";
import { Trans } from "@sepoina/vitetranslate/react";
import { ICONS } from "../theme/SiteBar.jsx";
import PageTools from "./PageTools.jsx";
import Related from "./Related.jsx";
import Toc, { ICON } from "./Toc.jsx";

// In cima, lo stesso movimento dei salti di sezione: morbido, salvo chi ha chiesto meno animazioni.
const toTop = () => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

// The right column, from 1280 px: the page title with the bar's book (a click goes back to the top), the page's sections,
// "On the same topic", and pinned at the bottom the small tools with a helper line under them. Whatever the
// pointer or the keyboard is on (the title, a related link, a tool) says what it does in that line.
export default function Rail({ route, title, headings, active, editHref }) {
  // `tip` outlives `shown`: the text stays while it fades.
  const [tip, setTip] = useState(null);
  const [shown, setShown] = useState(false);
  /** The events that put `node` in the helper line, for a link or a button. */
  const hint = (node) => ({
    onPointerEnter: (e) => {
      if (e.pointerType === "touch") return;
      setTip(node);
      setShown(true);
    },
    onPointerLeave: () => setShown(false),
    onFocus: (e) => {
      if (!e.currentTarget.matches(":focus-visible")) return;
      setTip(node);
      setShown(true);
    },
    onBlur: () => setShown(false),
  });

  return (
    <>
      {/* What scrolls when the page has many sections; the tools stay at the column's foot. */}
      <div className="d-rail-body">
        <button type="button" className="d-rail-title" onClick={toTop} {...hint(<Trans>_%_Scroll to top_%_</Trans>)}>
          <svg {...ICON}>
            {ICONS.docs.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          <span>
            <Trans t={title} />
            <span className="sr-only">
              {" "}
              <Trans>_%_Scroll to top_%_</Trans>
            </span>
          </span>
        </button>
        <Toc headings={headings} active={active} variant="side" />
        <Related route={route} hint={hint} />
      </div>
      <div className="d-tools">
        <PageTools route={route} editHref={editHref} hint={hint} />
        {/* The controls carry their own names: this line is for the eyes only. */}
        <p className="d-tools-tip" data-shown={shown && tip ? "" : undefined} aria-hidden="true">
          {tip}
        </p>
      </div>
    </>
  );
}
