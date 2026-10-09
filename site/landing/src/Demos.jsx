import { Trans } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { PAGES } from "./pages.js";
import ProjectLinks from "./ProjectLinks.jsx";
import { siteUrl } from "./siteLinks.js";

// Le pagine del sito, subito sotto l'hero: una card per pagina, con lo screenshot della pagina vera.
// La card apre la pagina; sotto, sorgente, StackBlitz e zip del suo progetto.
export default function Demos() {
  return (
    <section className="section section-demos" data-section="demos">
      <div className="wrap demos" data-stagger>
        {PAGES.map((page) => (
          <article key={page.slug} className="card demo-card">
            <a className="demo-card-main" href={siteUrl(page.slug)}>
              <div className="shot" aria-hidden="true">
                <img src={`${import.meta.env.BASE_URL}${page.preview}`} alt="" width="960" height="600" loading="lazy" />
                <span className="shot-open">
                  <Trans>_%_Apri_%_</Trans>
                  <Icon name="arrow" size={12} />
                </span>
              </div>
              <div className="demo-body">
                <h3>
                  <Trans t={page.title} />
                </h3>
                <p className="demo-path">/{page.slug}/</p>
                <p className="demo-text">
                  <Trans t={page.text} />
                </p>
              </div>
            </a>
            <ProjectLinks source={page.source} zip={`zip/${page.slug}.zip`} />
          </article>
        ))}
      </div>
    </section>
  );
}
