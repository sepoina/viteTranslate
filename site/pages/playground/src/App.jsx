import { useEffect } from "react";
import { Translate, version } from "@sepoina/vitetranslate/react";
import TopBar from "./playgroundComponents/TopBar.jsx";
import DocSection from "./playgroundComponents/DocSection.jsx";
import StrengthsSection from "./playgroundComponents/StrengthsSection.jsx";
import InstallSection from "./playgroundComponents/InstallSection.jsx";
import snippetList, { MARKER_EXAMPLE } from "./snippets/ZZZ_snippetList.js";
import installSubsections from "./snippets/installSubsections.js";
import { siteUrl } from "./siteLinks.js";

// Gli id in italiano di prima della 4.6.3: stanno nei README già pubblicati (anche su npm) e
// nei vecchi link alla landing, che li gira qui. Si riscrivono nell'id nuovo, senza rompere nulla.
const LEGACY_IDS = {
  "punti-di-forza": "strengths",
  playground: "examples",
  "cambio-lingua": "language-switch",
  "traduzione-statica": "static-text",
  "traduzione-dinamica": "dynamic-text",
  "placeholder-e-attributi": "attributes",
  "install-config-plugin": "install-config",
  "install-esecuzione-dev": "install-dev",
  "install-build-linguistico": "install-sync",
  "install-nuova-lingua": "install-new-language",
};

function App() {
  // Le ancore arrivano prima delle sezioni: al caricamento il browser cerca l'id quando React
  // non ha ancora reso niente, e non lo trova. Si riprova qui, una volta, a pagina montata.
  useEffect(() => {
    let id = decodeURIComponent(location.hash.slice(1));
    if (LEGACY_IDS[id]) {
      id = LEGACY_IDS[id];
      history.replaceState(null, "", `#${id}`);
    }
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <>
      <TopBar />

      <main className="wrap">
        <section className="hero">
          <p className="eyebrow">
            <Translate t={"_%_Playground · v%s_%_"} a={version} />
          </p>
          <h1>
            <Translate t={"_%_Tutto viteTranslate, <em>dal vivo</em>_%_"} />
          </h1>
          <p className="lead">
            <Translate>
              _%_Ogni esempio gira in questa pagina: cambia lingua in alto e guardalo tradursi.
              Accanto a ciascuno, il codice che lo produce._%_
            </Translate>
          </p>
          <a className="lead-more" href="#note">
            <Translate>_%_Cos’è viteTranslate, in breve ↓_%_</Translate>
          </a>

          <nav className="toc">
            <div className="toc-group">
              <span className="toc-label">
                <Translate>_%_Esempi_%_</Translate>
              </span>
              {snippetList.map(({ id, title }) => (
                <a key={id} href={`#${id}`}>
                  <Translate t={title} />
                </a>
              ))}
            </div>
            <div className="toc-group">
              <span className="toc-label">
                <Translate>_%_Installazione_%_</Translate>
              </span>
              {installSubsections.map(({ id, title }) => (
                <a key={id} href={`#${id}`}>
                  <Translate t={title} />
                </a>
              ))}
            </div>
            <div className="toc-group">
              <span className="toc-label">
                <Translate>_%_Altro_%_</Translate>
              </span>
              <a href="#strengths">
                <Translate>_%_Punti di forza_%_</Translate>
              </a>
              <a href={siteUrl("edge")}>
                <Translate>_%_Edge case_%_</Translate> ↗
              </a>
            </div>
          </nav>
        </section>

        <section id="examples" className="part">
          <h2>
            <Translate>_%_Esempi dal vivo_%_</Translate>
          </h2>
          {snippetList.map(({ id, title, description, code, file, Example }) => (
            <DocSection key={id} id={id} title={title} description={description} code={code} file={file}>
              <Example />
            </DocSection>
          ))}
        </section>

        <InstallSection />

        <StrengthsSection />

        <footer id="note" className="notes">
          <h2>
            <Translate>_%_Cos’è viteTranslate, in breve_%_</Translate>
          </h2>
          <ul>
            <li>
              <Translate
                t={"_%_Plugin Vite per estrarre stringhe dal sorgente (marcatore %s e componente <code>&#60;Translate&#62;</code> ) e generare/sincronizzare le tabelle di traduzione. I file di lingua sono dati (.yml), non moduli JS, e stanno in una cartella tutta loro, indicata da localeDir, caricati pigramente uno alla volta: il cambio lingua a runtime scarica solo il chunk necessario, senza appesantire il bundle iniziale con le lingue non usate._%_"}
                a={[MARKER_EXAMPLE]}
              />
            </li>
            <li>
              <Translate t={"_%_I testi di questa pagina sono scritti in italiano, la lingua sorgente; si parte in inglese, o nell’ultima lingua scelta sul sito. Il selettore in alto cambia lingua a tutto, esempi compresi._%_"} />
            </li>
            <li>
              <Translate t={"_%_Ogni sezione ha un indirizzo suo (<code>#icu-plural</code>, <code>#autowrap</code>, <code>#install-llm</code>…): il <code>#</code> accanto al titolo è il link da condividere. I vecchi indirizzi in italiano portano ancora al posto giusto._%_"} />
            </li>
            <li>
              <Translate t={"_%_Marcatori rotti, argomenti mancanti, valori che testo non sono: i comportamenti di confine stanno nella pagina dei casi limite, uno per riga._%_"} />{" "}
              <a href={siteUrl("edge")}>
                <Translate>_%_Edge case_%_</Translate> ↗
              </a>
            </li>
          </ul>
        </footer>
      </main>
    </>
  );
}

export default App;
