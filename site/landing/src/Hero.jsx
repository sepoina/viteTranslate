import { Translate, version } from "@sepoina/vitetranslate/react";
import CopyCommand from "./CopyCommand.jsx";
import { Icon } from "./icons.jsx";
import { REPO } from "./links.js";
import Demos from "./Demos.jsx";
import { siteUrl } from "./siteLinks.js";

export default function Hero() {
  return (
    <section className="hero">
      <div className="aurora" aria-hidden="true" data-parallax>
        <i className="blob b1" />
        <i className="blob b2" />
        <i className="blob b3" />
      </div>
      <div className="grid-bg" aria-hidden="true" />

      <div className="wrap hero-in">
        <a className="pill" href={`${REPO}/releases`} data-hero>
          <span className="pill-dot" />
          <Translate>_%_Nuovo: traduzione automatica con LLM_%_</Translate>
          <b>v{version}</b>
          <Icon name="arrow" size={14} />
        </a>

        <h1 data-hero>
          <Translate t="_%_Scrivi il testo <em>una volta</em>.<br>Vite fa il resto._%_" />
        </h1>

        <p className="lead" data-hero>
          <Translate>
            _%_Estrai i testi da tradurre direttamente dal JSX. Nessuna chiave da mantenere, nessun flusso di estrazione a parte,
            nessuna dipendenza a runtime._%_
          </Translate>
        </p>

        <div className="cta-row" data-hero>
          <CopyCommand />
          <a className="btn btn-primary" href={siteUrl("playground")}>
            <Translate>_%_Prova il playground_%_</Translate>
            <Icon name="arrow" size={18} />
          </a>
        </div>

        <Demos />
      </div>
    </section>
  );
}
