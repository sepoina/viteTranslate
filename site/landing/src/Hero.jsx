import { Translate, version } from "@sepoina/vitetranslate/react";
import CopyCommand from "./CopyCommand.jsx";
import { Icon } from "./icons.jsx";
import { REPO } from "./links.js";
import { siteUrl } from "./siteLinks.js";
import SIZE from "./theme/runtimeSize.json";

// Il comando che si scrive da solo sopra il titolo: la novità della release, da terminale.
// È codice, non una frase: niente <Translate>.
const LLM_CMD = "npx vitetranslate --llm-translate";

export default function Hero() {
  return (
    <section className="hero grid-backdrop">
      <div className="wrap hero-in">
        <p className="term">
          <span aria-hidden="true">$</span>
          <span className="term-text" style={{ "--n": LLM_CMD.length }}>
            {LLM_CMD}
          </span>
          <span className="term-cursor" aria-hidden="true" />
        </p>

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
            <Icon name="arrow" size={16} />
          </a>
        </div>

        {/* Le cifre vengono da Features.jsx: stesse frasi, così le traduzioni le seguono. */}
        <div className="stats" data-hero>
          <div className="stat">
            <p className="stat-n">
              <span data-count={SIZE.gzipBytes}>{SIZE.gzipBytes}</span>
            </p>
            <p className="stat-l">
              <Translate>_%_byte di runtime, in gzip_%_</Translate>
            </p>
            <p className="stat-d">
              <Translate t={["_%_%s, misurati dalla suite di test: non una promessa a parole._%_", SIZE.real]} />
            </p>
          </div>
          <div className="stat">
            <p className="stat-n">0</p>
            <p className="stat-l">
              <Translate>_%_dipendenze a runtime_%_</Translate>
            </p>
            <p className="stat-d">
              <Translate>_%_Babel, Vite e React sono peer: girano sulla tua macchina e non entrano mai nel bundle._%_</Translate>
            </p>
          </div>
        </div>
      </div>

      <div className="hero-strip">
        <div className="wrap hero-strip-in">
          <a className="release" href={`${REPO}/releases`}>
            <span className="tag tag-accent">v{version}</span>
            <Translate>_%_Nuovo: traduzione automatica con LLM_%_</Translate>
            <Icon name="arrow" size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
