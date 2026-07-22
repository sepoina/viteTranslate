import { Translate } from "@sepoina/vitetranslate/react";
import DocSection from "./playgroundComponents/DocSection.jsx";
import TableOfContents from "./playgroundComponents/TableOfContents.jsx";
import BadgeRotateLanguage from "./playgroundComponents/BadgeRotateLanguage.jsx";
import TopLanguageSwitch from "./playgroundComponents/TopLanguageSwitch.jsx";
import InstallSection from "./playgroundComponents/InstallSection.jsx";
import StrengthsSection from "./playgroundComponents/StrengthsSection.jsx";
import snippetList from "./snippets/ZZZ_snippetList.js";
import installSubsections from "./snippets/installSubsections.js";

function App() {
  return (
    <>
      <TableOfContents items={snippetList} installItems={installSubsections} />
      <BadgeRotateLanguage />
      <div className="markdown-body playground-container">
        <h1>viteTranslate</h1>
        <TopLanguageSwitch />
        <p>
          <Translate
            t={"_%_Plugin Babel + Vite per estrarre stringhe dal sorgente (marcatore %s e componente <code>&#60;Translate&#62;</code> ) e generare/sincronizzare le tabelle di traduzione JSON. I file di lingua vengono raggruppati in src (non in public, per evitare di servire JSON iniettabili) e caricati pigramente uno alla volta: il cambio lingua a runtime scarica solo il chunk necessario, senza appesantire il bundle iniziale con le lingue non usate._%_"}
            a={["<code>_%_testo_%_</code>"]}
          />
        </p>

        <StrengthsSection />

        <section id="playground">
          <h2><Translate>_%_Playground_%_</Translate></h2>
          {snippetList.map(({ id, title, description, code, Example }) => (
            <DocSection key={id} id={id} title={title} description={description} code={code}>
              <Example />
            </DocSection>
          ))}
        </section>

        <InstallSection />
      </div>
    </>
  );
}

export default App;

/*
Plugin Babel + Vite per estrarre stringhe dal sorgente (marcatore %s e componente <code>&#60;Translate&#60;</code>) e generare/sincronizzare le tabelle di traduzione JSON. I file di lingua vengono raggruppati in src (non in public, per evitare di servire JSON iniettabili) e caricati pigramente uno alla volta: il cambio lingua a runtime scarica solo il chunk necessario, senza appesantire il bundle iniziale con le lingue non usate.
*/