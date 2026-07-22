import { Translate } from "@sepoina/vitetranslate/react";
import CodeBlock from "./CodeBlock.jsx";
import installSubsections from "../snippets/installSubsections.js";

const [configPlugin, esecuzioneDev, buildLinguistico, nuovaLingua] = installSubsections;

export default function InstallSection() {
  return (
    <section id="install" className="doc-section">
      <h2><Translate>_%_Installazione_%_</Translate></h2>

      <section id={configPlugin.id} className="doc-subsection">
        <h3><Translate>{configPlugin.title}</Translate></h3>

        <p className="doc-description">
          <Translate>_%_Installa il pacchetto nel tuo progetto Vite + React: React e Vite sono peer dependency, quindi devono già essere presenti._%_</Translate>
        </p>
        <CodeBlock language="bash" code={`npm install @sepoina/vitetranslate`} />

        <p className="doc-description">
          <Translate>_%_Registra il plugin viteTranslate in vite.config.js: gli va indicata la cartella dei file di lingua e la lingua di default. Il plugin si occupa sia dell'estrazione delle stringhe da tradurre via Babel sia della generazione del modulo virtuale che elenca le lingue disponibili._%_</Translate>
        </p>
        <CodeBlock code={`import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    vitetranslate({
      localeDir: "src/locale",   // cartella con i file json delle traduzioni
      defaultLanguage: "it-IT",  // lingua di default
    }),
    react(),
  ],
});`} />

        <p className="doc-description">
          <Translate>_%_Ecco come appare src una volta configurato il plugin: locale è una sottocartella come le altre, indicata da localeDir, con dentro un file JSON per ogni lingua._%_</Translate>
        </p>
        <CodeBlock language="text" code={`src/
├── main.jsx
├── App.jsx
├── components/
│   └── ...
└── locale/              ← localeDir
    ├── it-IT.json       ← lingua di default
    ├── en-US.json
    └── zh-CN.json`} />
      </section>

      <section id={esecuzioneDev.id} className="doc-subsection">
        <h3><Translate>{esecuzioneDev.title}</Translate></h3>

        <p className="doc-description">
          <Translate>_%_Prima del primo avvio serve che localeDir esista già come cartella e contenga il file della lingua di default: TranslateContainer lo cerca subito e, se manca, il caricamento fallisce. Se non l'hai ancora generato, lancia una volta il comando descritto in Build linguistico: alla fine avrai già una cartella con dentro la tabella della lingua di default, pronta per essere letta._%_</Translate>
        </p>
        <p className="doc-description">
          <Translate>_%_Avvolgi l'app in TranslateContainer indicando la lingua iniziale da caricare: espone il contesto usato da Translate e dagli altri hook per leggere la tabella di traduzione corrente. In sviluppo il fallback resta incorporato nel codice compilato, quindi l'app mostra già il testo tradotto senza dover lanciare altri comandi._%_</Translate>
        </p>
        <CodeBlock code={`import { TranslateContainer } from "@sepoina/vitetranslate/react";

ReactDOM.createRoot(document.getElementById("root")).render(
  <TranslateContainer predefined="it-IT">
    <App />
  </TranslateContainer>
);`} />
      </section>

      <section id={buildLinguistico.id} className="doc-subsection">
        <h3><Translate>{buildLinguistico.title}</Translate></h3>

        <p className="doc-description">
          <Translate>_%_Prima della build di produzione, sincronizza le tabelle JSON con tutte le stringhe trovate nel sorgente lanciando il comando come step "prebuild": garantisce che la lingua di default sia sempre completa._%_</Translate>
        </p>
        <CodeBlock language="json" code={`{
  "scripts": {
    "prebuild": "vitetranslate-prepare-translation-table",
    "build": "vite build"
  }
}`} />

        <p className="doc-description">
          <Translate>_%_Lanciando semplicemente questo comando, anche a progetto appena creato e senza altri file di lingua presenti, viene generata la prima tabella linguistica: quella della lingua indicata come lingua di default in_%_</Translate>
          {" "}
          <a href="#install-config-plugin">Config del plugin</a>
          <Translate>_%_. È esattamente il file che localeDir deve già contenere al primo avvio, come richiesto in Esecuzione dev._%_</Translate>
        </p>
        <CodeBlock language="json" code={`{
  "__lngVersion__": "260216",
  "BasicExample_1nke42v": "Benvenuto in viteTranslate",
  "DynamicExample_1wltsn1": "Ciao %s, come stai?",
  "PlaceholderExample_1dxcv5l": "Nome utente",
  "PlaceholderExample_1ebkbf3": "Il nome verrà usato nel saluto"
}`} />
      </section>

      <section id={nuovaLingua.id} className="doc-subsection">
        <h3><Translate>{nuovaLingua.title}</Translate></h3>

        <p className="doc-description">
          <Translate>_%_Ogni lingua è un file JSON dentro localeDir, con lo stesso nome del suo tag_%_</Translate>
          {" "}
          <a href="https://gist.github.com/typpo/b2b828a35e683b9bf8db91b5404f1bd1#file-bcp47-locales-md" target="_blank" rel="noopener noreferrer">BCP 47</a>
          <Translate>_%_. Il file della lingua di default viene creato e tenuto aggiornato in automatico dal comando di sincronizzazione: non va scritto a mano, solo tradotto se serve._%_</Translate>
        </p>
        <p className="doc-description">
          <Translate>_%_Per aggiungere una nuova lingua crea un file vuoto con il nome del tag scelto, poi rilancia il comando di sincronizzazione: aggiunge in coda tutte le chiavi mancanti con valore null e segnala nel log quali restano da tradurre. Basta sostituire quei null con il testo tradotto._%_</Translate>
        </p>
        <CodeBlock language="bash" code={`echo '{}' > src/locale/fr-FR.json
npx vitetranslate-prepare-translation-table`} />

        <p className="doc-description">
          <Translate>_%_Subito dopo il comando il file contiene già tutte le chiavi trovate nel sorgente, ma non tradotte (valore null): sotto la riga separatrice trovi l'elenco esatto di ciò che manca._%_</Translate>
        </p>
        <CodeBlock language="json" code={`{
  "__lngVersion__": "260216",
  "____________________________________________________________________________not translated__": "_____",
  "BasicExample_1nke42v": null,
  "DynamicExample_1wltsn1": null,
  "PlaceholderExample_1dxcv5l": null,
  "PlaceholderExample_1ebkbf3": null
}`} />

        <p className="doc-description">
          <Translate>_%_Le stesse chiavi compaiono, nello stesso momento, anche nel file della lingua di default: mai come null lì, ma raggruppate sotto la stessa riga separatrice finché restano da tradurre in almeno un'altra lingua. È un'occasione pratica: puoi copiare quel blocco (testo reale, non null) e incollarlo in un LLM per farlo tradurre, poi incollare la risposta al posto dei null nel file della lingua di destinazione._%_</Translate>
        </p>
        <CodeBlock language="json" code={`{
  "__lngVersion__": "260216",
  "____________________________________________________________________________not translated__": "_____",
  "BasicExample_1nke42v": "Benvenuto in viteTranslate",
  "DynamicExample_1wltsn1": "Ciao %s, come stai?",
  "PlaceholderExample_1dxcv5l": "Nome utente",
  "PlaceholderExample_1ebkbf3": "Il nome verrà usato nel saluto"
}`} />

        <p className="doc-description">
          <Translate>_%_Sostituendo ogni null con il testo tradotto (mantenendo invariati eventuali %s) il file risulta completo, pronto per essere usato come lingua disponibile._%_</Translate>
        </p>
        <CodeBlock language="json" code={`{
  "__lngVersion__": "260216",
  "BasicExample_1nke42v": "Bienvenue sur viteTranslate",
  "DynamicExample_1wltsn1": "Salut %s, comment ça va ?",
  "PlaceholderExample_1dxcv5l": "Nom d'utilisateur",
  "PlaceholderExample_1ebkbf3": "Le nom sera utilisé dans la salutation"
}`} />

        <p className="doc-description">
          <Translate>_%_Ogni file .json trovato in localeDir diventa automaticamente disponibile: useAvailableLanguages() lo elenca e TranslateContainer lo carica pigramente alla richiesta, senza bisogno di registrarlo altrove._%_</Translate>
        </p>
      </section>
    </section>
  );
}
