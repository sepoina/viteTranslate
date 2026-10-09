import { Trans } from "@sepoina/vitetranslate/react";
import { Code, M } from "./theme/Code.jsx";
import SectionHead from "./SectionHead.jsx";

const KEYLESS = `<Trans t={["${M}Ciao %s, come stai?${M}", nome]} />

<Trans>
  ${M}<b>Benvenuto</b> nel sito${M}
</Trans>`;

const TABLE = `# missing key: 0
Hero_1q8xz4: "Bienvenue"
Cta_8wea0s: "Installer"
Nav_1t0ndv: "Fonctions"`;

// La prima è la lingua di chi legge, l'unica scaricata; le altre restano tratteggiate.
const CHUNKS = ["it-IT", "en-US", "fr-FR", "de-DE", "pt-BR", "zh-CN", "ja-JP"];

// Cinque righe: a sinistra cosa fa, a destra come si vede.
export default function Features() {
  return (
    <section className="section" data-section="features">
      <div className="wrap">
        <SectionHead
          id="features"
          title={<Trans t="_%_Tutto ciò che serve. <em>Niente</em> di ciò che pesa._%_" />}
          text={
            <Trans>
              _%_Ogni libreria di questa categoria risolve lo stesso problema. Cambia quanta macchina devi far girare, e quanta ne spedisci ai
              tuoi utenti._%_
            </Trans>
          }
        />

        <div className="features" data-stagger>
          <article className="feature">
            <div className="feature-copy">
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
            <div className="feature-visual">
              <Code code={KEYLESS} lang="jsx" className="snippet" />
            </div>
          </article>

          <article className="feature">
            <div className="feature-copy">
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
            <div className="feature-visual">
              <Code code={TABLE} lang="yaml" className="snippet" />
            </div>
          </article>

          <article className="feature">
            <div className="feature-copy">
              <h3>
                <Trans>_%_Un LLM, ma con il paracadute_%_</Trans>
              </h3>
              <p>
                <Trans t="_%_<code>--llm-translate</code> riempie le chiavi mancanti con il modello che configuri. Il validatore scarta ciò che si romperebbe a runtime._%_" />
              </p>
            </div>
            <div className="feature-visual">
              <ul className="verdicts">
                <li className="bad">
                  <b aria-hidden="true">✕</b>
                  <s>"Ciao , come stai?"</s>
                </li>
                <li className="ok">
                  <b aria-hidden="true">✓</b>
                  <span>"Bonjour %s, ça va ?"</span>
                </li>
              </ul>
            </div>
          </article>

          <article className="feature">
            <div className="feature-copy">
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
            <div className="feature-visual">
              <div className="flow" aria-hidden="true">
                <span>JSX</span>
                <i>→</i>
                <span>Babel</span>
                <i>→</i>
                <span>Vite</span>
                <i>→</i>
                <span className="flow-end">.js</span>
              </div>
            </div>
          </article>

          <article className="feature">
            <div className="feature-copy">
              <h3>
                <Trans>_%_Ogni lingua è un file a sé_%_</Trans>
              </h3>
              <p>
                <Trans>_%_Caricata con import() solo quando la scegli. Chi legge in italiano non scarica mai il cinese._%_</Trans>
              </p>
            </div>
            <div className="feature-visual">
              <div className="chunks" aria-hidden="true">
                {CHUNKS.map((tag, n) => (
                  <span key={tag} className={n === 0 ? "is-loaded" : undefined}>
                    {tag}.js
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
