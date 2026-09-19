import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";
import { siteUrl } from "../siteLinks.js";

export default function TableOfContents({ items, installItems }) {
  const ts = useTranslateToString();

  return (
    <nav className="toc" aria-label={ts("_%_Indice delle sezioni_%_")}>
      <p className="toc-title"><Translate>_%_Indice_%_</Translate></p>
      <ul>
        <li className="toc-group-label">
          <a href="#punti-di-forza"><Translate>_%_Punti di forza_%_</Translate></a>
        </li>
        <li>
          <a href="#playground" className="toc-group-label"><Translate>_%_Playground_%_</Translate></a>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}><Translate>{item.title}</Translate></a>
              </li>
            ))}
          </ul>
        </li>
        <li>
          <a href="#install" className="toc-group-label"><Translate>_%_Installazione_%_</Translate></a>
          <ul>
            {installItems.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}><Translate>{item.title}</Translate></a>
              </li>
            ))}
          </ul>
        </li>
        {/* Pagine a sé, non ancore: niente "#" e nessuna sottolista. */}
        <li>
          <a href={siteUrl()} className="toc-group-label">
            <Translate>_%_Tutte le demo_%_</Translate> ↗
          </a>
        </li>
        <li>
          <a href={siteUrl("edge")} className="toc-group-label">
            <Translate>_%_Edge case_%_</Translate> ↗
          </a>
        </li>
      </ul>
    </nav>
  );
}
