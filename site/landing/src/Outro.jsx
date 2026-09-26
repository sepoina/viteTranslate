import { Translate, version } from "@sepoina/vitetranslate/react";
import CopyCommand from "./CopyCommand.jsx";
import { Icon } from "./icons.jsx";
import { DOCS, NPM, REPO } from "./links.js";

export default function Outro() {
  return (
    <>
      <section className="section outro-sec">
        <div className="wrap">
          <div className="outro" data-reveal>
            <h2>
              <Translate t="_%_Traduci la tua prima frase <em>in un minuto</em>._%_" />
            </h2>
            <p className="lead">
              <Translate>_%_Un pacchetto, un plugin, una riga nel vite.config. Il resto lo vedi succedere._%_</Translate>
            </p>
            <div className="cta-row">
              <CopyCommand />
              <a className="btn btn-ghost" href={DOCS}>
                <Translate>_%_Leggi la documentazione_%_</Translate>
                <Icon name="arrow" size={18} />
              </a>
            </div>
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
              <Translate>_%_Offrimi un caffè_%_</Translate>
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
