import { Translate } from "@sepoina/vitetranslate/react";
import { Code, M } from "./Code.jsx";
import SectionHead from "./SectionHead.jsx";

const MARK = `<Translate>
  ${M}Benvenuto in viteTranslate${M}
</Translate>`;

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
          eyebrow={<Translate>_%_Come funziona_%_</Translate>}
          title={<Translate t="_%_Tre passi, <em>zero</em> burocrazia._%_" />}
        />

        <ol className="steps" data-stagger>
          <li className="step">
            <span className="step-n">01</span>
            <h3>
              <Translate>_%_Marca la frase_%_</Translate>
            </h3>
            <p>
              <Translate>_%_Dove la scrivi, nel JSX. Nessun file di chiavi da aprire, nessun nome da trovare._%_</Translate>
            </p>
            <Code src={MARK} lang="jsx" className="step-code" />
          </li>

          <li className="step">
            <span className="step-n">02</span>
            <h3>
              <Translate>_%_Sincronizza_%_</Translate>
            </h3>
            <p>
              <Translate>_%_Un comando, oppure il server di sviluppo: le tabelle YAML restano allineate al codice._%_</Translate>
            </p>
            <Code src={SYNC} lang="sh" className="step-code" />
          </li>

          <li className="step">
            <span className="step-n">03</span>
            <h3>
              <Translate>_%_Traduci_%_</Translate>
            </h3>
            <p>
              <Translate>_%_A mano, da un traduttore, o con un LLM che rispetta segnaposto e tag. Poi pubblichi._%_</Translate>
            </p>
            <Code src={TRANSLATE} lang="sh" className="step-code" />
          </li>
        </ol>
      </div>
    </section>
  );
}
