import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { PAGES } from "./pages.js";
import { REPO } from "./links.js";
import { SITE_ROOT, siteUrl } from "./siteLinks.js";

// Le pagine del sito, subito sotto l'hero: una card per pagina, con lo screenshot della pagina vera.
export default function Demos() {
  const ts = useTranslateToString();
  return (
    <section className="section section-demos" data-section="demos">
      <div className="wrap demos" data-stagger>
        {PAGES.map((page) => (
          <article key={page.slug} className="card demo-card">
            <a className="demo-card-main" href={siteUrl(page.slug)}>
              <div className="shot" aria-hidden="true">
                <img src={`${import.meta.env.BASE_URL}${page.preview}`} alt="" width="960" height="600" loading="lazy" />
                <span className="shot-open">
                  <Translate>_%_Apri_%_</Translate>
                  <Icon name="arrow" size={12} />
                </span>
              </div>
              <div className="demo-body">
                <h3>
                  <Translate t={page.title} />
                </h3>
                <p className="demo-path">/{page.slug}/</p>
                <p className="demo-text">
                  <Translate t={page.text} />
                </p>
              </div>
            </a>
            <div className="demo-foot">
              <a className="tag" href={`${REPO}/tree/main/${page.source}`}>
                <Icon name="github" size={12} />
                <Translate>_%_Sorgente_%_</Translate>
              </a>
              {/* Lo zip lo scrive site/build.mjs in site/dist/zip: il progetto della pagina, pronto per StackBlitz. */}
              <a
                className="tag"
                href={`${SITE_ROOT}zip/${page.slug}.zip`}
                download
                title={ts("_%_Il progetto della pagina, da importare su stackblitz.com_%_")}
              >
                <Icon name="download" size={12} />
                <Translate>_%_Zip per StackBlitz_%_</Translate>
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
