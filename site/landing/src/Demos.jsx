import { Translate, useTranslateToString } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { PAGES } from "./pages.js";
import { REPO } from "./links.js";
import { SITE_ROOT, siteUrl } from "./siteLinks.js";

// Le tre pagine del sito, sotto lo slogan: ognuna con lo screenshot della pagina vera.
export default function Demos() {
  const ts = useTranslateToString();
  return (
    <div className="demos" data-section="demos">
      {PAGES.map((page) => (
        <article key={page.slug} className="demo-card" data-hero>
          <a className="demo-card-main" href={siteUrl(page.slug)}>
            <div className="shot" aria-hidden="true">
              <div className="shot-bar">
                <i />
                <i />
                <i />
                <span>/{page.slug}/</span>
              </div>
              <img src={`${import.meta.env.BASE_URL}${page.preview}`} alt="" width="960" height="600" loading="lazy" />
            </div>
            <div className="demo-body">
              <h3>
                <span aria-hidden="true">{page.icon}</span>
                <Translate t={page.title} />
              </h3>
              <p>
                <Translate t={page.text} />
              </p>
              <span className="demo-open">
                <Translate>_%_Apri_%_</Translate>
                <Icon name="arrow" size={18} />
              </span>
            </div>
          </a>
          <div className="demo-foot">
            <a href={`${REPO}/tree/main/${page.source}`}>
              <Icon name="github" size={15} />
              <Translate>_%_Sorgente_%_</Translate>
            </a>
            {/* Lo zip lo scrive site/build.mjs in site/dist/zip: il progetto della pagina, pronto per StackBlitz. */}
            <a href={`${SITE_ROOT}zip/${page.slug}.zip`} download title={ts("_%_Il progetto della pagina, da importare su stackblitz.com_%_")}>
              <Icon name="download" size={15} />
              <Translate>_%_Zip per StackBlitz_%_</Translate>
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
