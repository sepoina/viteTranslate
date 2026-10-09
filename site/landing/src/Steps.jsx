import { Trans } from "@sepoina/vitetranslate/react";
import { Code } from "./theme/Code.jsx";
import SectionHead from "./SectionHead.jsx";

const MARK = `<Trans>
  Benvenuto in viteTranslate
</Trans>`;

const SYNC = `$ npx vitetranslate

✓ it-IT  source language
✓ en-US  all ok!
✓ fr-FR  2 keys added`;

const TRANSLATE = `$ npx vitetranslate --llm-translate

✓ fr-FR  2 keys translated
✓ validator: 0 rejected
✓ budget: within limit`;

export default function Steps() {
  return (
    <section className="section" data-section="how">
      <div className="wrap">
        <SectionHead
          eyebrow={<Trans>_%_Come funziona_%_</Trans>}
          title={<Trans t="_%_Tre passi, <em>zero</em> burocrazia._%_" />}
        />

        <ol className="steps" data-stagger>
          <li className="step">
            <span className="step-n">01</span>
            <h3>
              <Trans>Scrivi la frase</Trans>
            </h3>
            <p>
              <Trans>Nel JSX, dove serve: variabili e tag compresi. Nessun file di chiavi, nessun nome da inventare.</Trans>
            </p>
            <Code code={MARK} lang="jsx" className="step-code" />
          </li>

          <li className="step">
            <span className="step-n">02</span>
            <h3>
              <Trans>_%_Sincronizza_%_</Trans>
            </h3>
            <p>
              <Trans>_%_Un comando, oppure il server di sviluppo: le tabelle YAML restano allineate al codice._%_</Trans>
            </p>
            <Code code={SYNC} lang="sh" className="step-code" />
          </li>

          <li className="step">
            <span className="step-n">03</span>
            <h3>
              <Trans>_%_Traduci_%_</Trans>
            </h3>
            <p>
              <Trans>_%_A mano, da un traduttore, o con un LLM che rispetta segnaposto e tag. Poi pubblichi._%_</Trans>
            </p>
            <Code code={TRANSLATE} lang="sh" className="step-code" />
          </li>
        </ol>
      </div>
    </section>
  );
}
