import { Trans } from "@sepoina/vitetranslate/react";
import { Code, M } from "./theme/Code.jsx";
import { Icon } from "./icons.jsx";
import SectionHead from "./SectionHead.jsx";

const KEYLESS = `<Trans t={["${M}Ciao %s, come stai?${M}", nome]} />

<Trans>
  ${M}<b>Benvenuto</b> nel sito${M}
</Trans>`;

const TABLE = `# missing key: 0
Hero_1q8xz4: "Bienvenue"
Cta_8wea0s: "Installer"
Nav_1t0ndv: "Fonctions"`;

const CHUNKS = ["it-IT", "en-US", "fr-FR", "de-DE", "pt-BR", "zh-CN", "ja-JP"];

export default function Features() {
  return (
    <section className="section" data-section="features">
      <div className="wrap">
        <SectionHead
          eyebrow={<Trans>_%_Perché viteTranslate_%_</Trans>}
          title={<Trans t="_%_Tutto ciò che serve. <em>Niente</em> di ciò che pesa._%_" />}
          text={
            <Trans>
              _%_Ogni libreria di questa categoria risolve lo stesso problema. Cambia quanta macchina devi far girare, e quanta ne spedisci ai
              tuoi utenti._%_
            </Trans>
          }
        />

        <div className="bento" data-stagger>
          <article className="tile t-keyless">
            <div className="tile-copy">
              <span className="tile-ico">
                <Icon name="braces" />
              </span>
              <h3>
                <Trans>_%_Niente chiavi da inventare_%_</Trans>
              </h3>
              <p>
                <Trans>
                  _%_Scrivi la frase dove serve, tra i delimitatori. La chiave la genera il plugin: non devi inventarla, e non devi tenerla
                  d'occhio._%_
                </Trans>
              </p>
            </div>
            <Code code={KEYLESS} lang="jsx" className="tile-code" />
          </article>

          <article className="tile t-yaml">
            <div className="tile-copy">
              <span className="tile-ico">
                <Icon name="sync" />
              </span>
              <h3>
                <Trans>_%_Tabelle YAML sempre allineate_%_</Trans>
              </h3>
              <p>
                <Trans>
                  _%_Un comando sincronizza ogni lingua: chiavi nuove aggiunte, obsolete tolte. Una frase spostata si porta dietro la sua
                  traduzione._%_
                </Trans>
              </p>
            </div>
            <Code code={TABLE} lang="yaml" className="tile-code" />
          </article>

          <article className="tile t-llm">
            <div className="tile-copy">
              <span className="tile-ico">
                <Icon name="sparkle" />
              </span>
              <h3>
                <Trans>_%_Un LLM, ma con il paracadute_%_</Trans>
              </h3>
              <p>
                <Trans t="_%_<code>--llm-translate</code> riempie le chiavi mancanti con il modello che configuri. Il validatore scarta ciò che si romperebbe a runtime._%_" />
              </p>
            </div>
            <ul className="verdicts">
              <li className="bad">
                <Icon name="x" size={16} />
                <span>"Ciao , come stai?"</span>
              </li>
              <li className="ok">
                <Icon name="check" size={16} />
                <span>"Bonjour %s, ça va ?"</span>
              </li>
            </ul>
          </article>

          <article className="tile t-build">
            <div className="tile-copy">
              <span className="tile-ico">
                <Icon name="server" />
              </span>
              <h3>
                <Trans>_%_Compilato in build, nessun parser a runtime_%_</Trans>
              </h3>
              <p>
                <Trans>
                  _%_Le tabelle diventano valori già pronti al momento della build. Niente parser HTML nel browser, e per questo il testo tradotto
                  si rende anche lato server._%_
                </Trans>
              </p>
            </div>
            <div className="flow" aria-hidden="true">
              <span>JSX</span>
              <i />
              <span>Babel</span>
              <i />
              <span>Vite</span>
              <i />
              <span className="flow-end">.js</span>
            </div>
          </article>

          <article className="tile t-lazy">
            <div className="tile-copy">
              <span className="tile-ico">
                <Icon name="layers" />
              </span>
              <h3>
                <Trans>_%_Ogni lingua è un file a sé_%_</Trans>
              </h3>
              <p>
                <Trans>_%_Caricata con import() solo quando la scegli. Chi legge in italiano non scarica mai il cinese._%_</Trans>
              </p>
            </div>
            <div className="chunks" aria-hidden="true">
              {CHUNKS.map((tag, n) => (
                <span key={tag} style={{ "--n": n }}>
                  {tag}.js
                </span>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
