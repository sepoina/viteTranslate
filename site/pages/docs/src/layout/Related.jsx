import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { RELATED } from "../generated/related.js";
import { BASE, go } from "./router.js";
import { ICON } from "./Toc.jsx";

// "On the same topic": the `related:` links of the page's frontmatter (src/generated/related.js), each a
// short label and a sentence that says what is there. In the right column (variant "side") the sentence
// goes to the column's helper line, under the tools (`hint`, from Rail.jsx); under 1280 px, at the end of
// the article (variant "inline"), it sits under its label. Following one remembers where the reader came
// from, so "Previous" leads back there (PageNav.jsx).
export default function Related({ route, variant, hint }) {
  const trans = useTrans();
  const items = RELATED[route] ?? [];
  if (!items.length) return null;
  const inline = variant === "inline";
  return (
    <nav className={`d-related${inline ? " d-related-inline" : ""}`} aria-label={trans("_%_On the same topic_%_")}>
      <p className="d-toc-label">
        <svg {...ICON}>
          <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8" />
        </svg>
        <Trans>_%_On the same topic_%_</Trans>
      </p>
      <ul>
        {items.map(({ route: to, id, label, detail }) => {
          const href = `${BASE}${to}/${id ? `#${id}` : ""}`;
          return (
            <li key={`${to}#${id}`}>
              <a href={href} onClick={go(href, route)} {...(inline ? {} : hint(<Trans t={detail} />))}>
                <span className="d-related-title">
                  <Trans t={label} />
                </span>
                {inline && (
                  <span className="d-related-detail">
                    <Trans t={detail} />
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
