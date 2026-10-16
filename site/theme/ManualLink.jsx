// A link into the manual from the pages written in Italian (landing, playground, edge cases): the bar's book,
// "NEL MANUALE ･" and the name of where it lands. `manual` is "route#id" (siteLinks.js, docsUrl); the page
// writes it as a literal field or prop, `manual: "…"` or `manual="…"`, so that testRelease can check it.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import { Trans } from "@sepoina/vitetranslate/react";
import { docsUrl } from "../siteLinks.js";
import { ICONS } from "./SiteBar.jsx";

/**
 * @param {object} props
 * @param {string} props.manual the target in the manual, "route#id"
 * @param {import("react").ReactNode} props.children its name, already translated (a <Trans>)
 * @param {string} [props.className] for the page's own placement
 */
export default function ManualLink({ manual, children, className }) {
  return (
    <a className={className ? `manual-link ${className}` : "manual-link"} href={docsUrl(manual)}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS.docs.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      <span className="manual-link-k">
        <Trans>_%_Nel manuale_%_</Trans>
      </span>
      <span className="manual-link-t">{children}</span>
      <span className="manual-link-go" aria-hidden="true">
        →
      </span>
    </a>
  );
}
