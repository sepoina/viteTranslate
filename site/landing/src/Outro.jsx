import { Trans, version } from "@sepoina/vitetranslate/react";
import CopyCommand from "./CopyCommand.jsx";
import { DOCS, NPM, REPO } from "./links.js";

// La banda verde finale e il piè di pagina. La banda è uguale nei due temi.
export default function Outro() {
  return (
    <>
      <section className="cta">
        <div className="wrap" data-reveal>
          <h2>
            <Trans t="_%_Traduci la tua prima frase <em>in un minuto</em>._%_" />
          </h2>
          <p className="cta-text">
            <Trans>_%_Un pacchetto, un plugin, una riga nel vite.config. Il resto lo vedi succedere._%_</Trans>
          </p>
          <div className="cta-row">
            <CopyCommand tone="ink" />
            <a className="btn btn-ink" href={DOCS}>
              <Trans>_%_Leggi la documentazione_%_</Trans>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-in">
          <span>
            viteTranslate <b>v{version}</b> · Apache-2.0
          </span>
          <nav>
            <a href={REPO}>GitHub</a>
            <a href={NPM}>npm</a>
            <a href="https://www.buymeacoffee.com/giancarlogy">
              <Trans>_%_Offrimi un caffè_%_</Trans>
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
