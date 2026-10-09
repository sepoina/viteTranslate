import { Trans, version } from "@sepoina/vitetranslate/react";
import CopyCommand from "./CopyCommand.jsx";
import { REPO } from "./links.js";
import { siteUrl } from "./siteLinks.js";
import SIZE from "./theme/runtimeSize.json";

// Il comando che si scrive da solo sopra il titolo: la novità della release, da terminale.
// È codice, non una frase: niente <Trans>.
const LLM_CMD = "npx vitetranslate --llm-translate";

export default function Hero() {
  return (
    <section className="hero">
      <div className="wrap">
        <p className="term">
          <span className="term-prompt" aria-hidden="true">
            $
          </span>
          <span className="term-text" style={{ "--n": LLM_CMD.length }}>
            {LLM_CMD}
          </span>
          <span className="term-cursor" aria-hidden="true" />
        </p>

        {/* Due frasi e non una: la seconda riga è grigia, e il dialetto HTML delle frasi non ha <span>. */}
        <h1 data-hero>
          <Trans t="_%_Scrivi il testo <em>una volta</em>._%_" />
          <br />
          <span className="hero-rest">
            <Trans>_%_Vite fa il resto._%_</Trans>
          </span>
        </h1>

        <div className="hero-cols">
          <div className="hero-main">
            <p className="lead" data-hero>
              <Trans>
                _%_Estrai i testi da tradurre direttamente dal JSX. Nessuna chiave da mantenere, nessun flusso di estrazione a parte,
                nessuna dipendenza a runtime._%_
              </Trans>
            </p>

            <div className="cta-row" data-hero>
              <CopyCommand tone="accent" />
              <a className="btn btn-outline" href={siteUrl("playground")}>
                <Trans>_%_Prova il playground_%_</Trans>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          {/* Le cifre vengono da Features.jsx: stesse frasi, così le traduzioni le seguono. */}
          <div className="stats" data-hero>
            <div className="stat">
              <p className="stat-n">
                <span data-count={SIZE.gzipBytes}>{SIZE.gzipBytes}</span>
              </p>
              <p className="stat-l">
                <Trans>_%_byte di runtime, in gzip_%_</Trans>
              </p>
              <p className="stat-d">
                <Trans t={["_%_%s, misurati dalla suite di test: non una promessa a parole._%_", SIZE.real]} />
              </p>
            </div>
            <div className="stat">
              <p className="stat-n">0</p>
              <p className="stat-l">
                <Trans>_%_dipendenze a runtime_%_</Trans>
              </p>
              <p className="stat-d">
                <Trans>_%_Babel e Vite girano sulla tua macchina e non entrano mai nel bundle; React è quello che la tua app ha già._%_</Trans>
              </p>
            </div>
          </div>
        </div>

        <a className="release" href={`${REPO}/releases`}>
          <span className="badge">v{version}</span>
          <span>
            <Trans>_%_Nuovo: traduzione automatica con LLM_%_</Trans> <span aria-hidden="true">→</span>
          </span>
        </a>
      </div>
    </section>
  );
}
