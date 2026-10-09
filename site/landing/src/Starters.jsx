import { Trans } from "@sepoina/vitetranslate/react";
import { stackblitzUrl } from "./links.js";
import { DEMOS } from "./pages.js";
import ProjectLinks from "./ProjectLinks.jsx";
import SectionHead from "./SectionHead.jsx";

// Le demo di demo/, in fondo alla pagina prima della chiusura: quattro card in colonna, due o
// quattro per riga secondo lo spazio (mai tre più una). Non hanno una pagina nel sito, quindi la
// card apre il progetto su StackBlitz; sotto, gli stessi tre tasti delle pagine.
export default function Starters() {
  return (
    <section className="section" data-section="starters">
      <div className="wrap">
        <SectionHead
          id="starters"
          title={<Trans>_%_Un progetto minimo per ogni idea._%_</Trans>}
          text={<Trans>_%_Un clic e gira su StackBlitz, nel browser, senza installare niente. Lo zip è lo stesso progetto, da aprire in locale._%_</Trans>}
        />
        <div className="starters-box">
          <div className="starters" data-stagger>
            {DEMOS.map((demo) => (
              <article key={demo.slug} className="card starter-card">
                <a className="starter-main" href={stackblitzUrl(demo.source)} target="_blank" rel="noopener">
                  <p className="starter-top">
                    <span>{demo.stack}</span>
                    <span aria-hidden="true">↗</span>
                  </p>
                  <h3>
                    <Trans t={demo.title} />
                  </h3>
                  <p className="demo-path">{demo.source}/</p>
                  <p className="demo-text">
                    <Trans t={demo.text} />
                  </p>
                </a>
                <ProjectLinks source={demo.source} zip={`zip/demo/${demo.slug}.zip`} />
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
