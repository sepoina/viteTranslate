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
      localeDir: "locale",       // cartella con i file di traduzione
      sourceLanguage: "it-IT",   // lingua di default
    }),
    react(),
  ],
});`} />

        <p className="doc-description">
          <Translate>_%_Ecco come appare il progetto una volta configurato il plugin: locale è una cartella accanto a src, indicata da localeDir, con dentro un file .yml per ogni lingua._%_</Translate>
        </p>
        <CodeBlock language="text" code={`.
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   └── components/
└── locale/              ← localeDir
    ├── it-IT.yml        ← lingua di default
    ├── en-US.yml
    └── zh-CN.yml`} />
      </section>

      <section id={esecuzioneDev.id} className="doc-subsection">
        <h3><Translate>{esecuzioneDev.title}</Translate></h3>

        <p className="doc-description">
          <Translate>_%_Prima del primo avvio serve che il file della lingua di default esista già: TranslateContainer lo cerca subito e, se manca, il caricamento fallisce (la cartella localeDir non serve che esista in anticipo, la crea il plugin). Se non l'hai ancora generato, lancia una volta il comando descritto in Build linguistico: alla fine avrai già la tabella della lingua di default, pronta per essere letta._%_</Translate>
        </p>
        <p className="doc-description">
          <Translate>_%_Avvolgi l'app in TranslateContainer indicando la lingua iniziale da caricare: espone il contesto usato da Translate e dagli altri hook per leggere la tabella di traduzione corrente. In sviluppo il fallback resta incorporato nel codice compilato, quindi l'app mostra già il testo tradotto senza dover lanciare altri comandi._%_</Translate>
        </p>
        <CodeBlock code={`import { TranslateContainer } from "@sepoina/vitetranslate/react";

ReactDOM.createRoot(document.getElementById("root")).render(
  <TranslateContainer initialLanguage="it-IT">
    <App />
  </TranslateContainer>
);`} />
      </section>

      <section id={buildLinguistico.id} className="doc-subsection">
        <h3><Translate>{buildLinguistico.title}</Translate></h3>

        <p className="doc-description">
          <Translate>_%_Prima della build di produzione, sincronizza le tabelle di traduzione con tutte le stringhe trovate nel sorgente lanciando il comando come step "prebuild": garantisce che la lingua di default sia sempre completa._%_</Translate>
        </p>
        <CodeBlock language="json" code={`{
  "scripts": {
    "prebuild": "vtranslate-cli",
    "build": "vite build"
  }
}`} />

        <p className="doc-description">
          <Translate>_%_Lanciando semplicemente questo comando, anche a progetto appena creato e senza altri file di lingua presenti, viene generata la prima tabella linguistica: quella della lingua indicata come lingua di default in_%_</Translate>
          {" "}
          <a href="#install-config-plugin">Config del plugin</a>
          <Translate>_%_. È esattamente il file che localeDir deve già contenere al primo avvio, come richiesto in Esecuzione dev._%_</Translate>
        </p>
        <CodeBlock language="yaml" code={`#  -------------------------------------------------
#      italiano (Italia) (sourceLanguage)
#       |    code: it-IT
#       |    missing key: 0
#       |    processed: 2026-08-24 12:37
#  -------------------------------------------------
__builder__: {"v":260824,"languageName":"italiano (Italia)"}
#  -------------------------------------------------
BasicExample_1nke42v: "Benvenuto in viteTranslate"
DynamicExample_1wltsn1: "Ciao %s, come stai?"
PlaceholderExample_1dxcv5l: "Nome utente"
PlaceholderExample_1ebkbf3: "Il nome verrà usato nel saluto"`} />
      </section>

      <section id={nuovaLingua.id} className="doc-subsection">
        <h3><Translate>{nuovaLingua.title}</Translate></h3>

        <p className="doc-description">
          <Translate>_%_Ogni lingua è un file .yml dentro localeDir, con lo stesso nome del suo tag_%_</Translate>
          {" "}
          <a href="https://github.com/sepoina/viteTranslate/blob/main/doc/bcp47.md" target="_blank" rel="noopener noreferrer">BCP 47</a>
          <Translate>_%_. Il file della lingua di default viene creato e tenuto aggiornato in automatico dal comando di sincronizzazione: non va scritto a mano, solo tradotto se serve._%_</Translate>
        </p>
        <p className="doc-description">
          <Translate>_%_Per aggiungere una nuova lingua usa il flag --add del comando di sincronizzazione: crea subito il file con il tag scelto, già popolato con tutte le chiavi trovate nel sorgente (valore null), e chiude con il riepilogo di quante restano da tradurre. Basta sostituire quei null con il testo tradotto._%_</Translate>
        </p>
        <CodeBlock language="bash" code={`npx vtranslate-cli --add fr-FR`} />

        <p className="doc-description">
          <Translate>_%_Subito dopo il comando il file contiene già tutte le chiavi trovate nel sorgente, ma non tradotte (valore null): sotto la riga separatrice trovi l'elenco esatto di ciò che manca._%_</Translate>
        </p>
        <CodeBlock language="yaml" code={`#  -------------------------------------------------
#      français
#       |    code: fr-FR
#       |    missing key: 4
#       |    processed: 2026-08-24 12:37
#  -------------------------------------------------
__builder__: {"v":260824,"languageName":"français","incomplete":true}
#  -------------------------------------------------

#  ----to be translated------------------------------------------
BasicExample_1nke42v: null
DynamicExample_1wltsn1: null
PlaceholderExample_1dxcv5l: null
PlaceholderExample_1ebkbf3: null`} />

        <p className="doc-description">
          <Translate>_%_Le stesse chiavi compaiono, nello stesso momento, anche nel file della lingua di default: mai come null lì, ma raggruppate sotto la stessa riga separatrice finché restano da tradurre in almeno un'altra lingua. È un'occasione pratica: puoi copiare quel blocco (testo reale, non null) e incollarlo in un LLM per farlo tradurre, poi incollare la risposta al posto dei null nel file della lingua di destinazione._%_</Translate>
        </p>
        <CodeBlock language="yaml" code={`#  -------------------------------------------------
#      italiano (Italia) (sourceLanguage)
#       |    code: it-IT
#       |    missing key: 4
#       |    processed: 2026-08-24 12:37
#  -------------------------------------------------
__builder__: {"v":260824,"languageName":"italiano (Italia)","incomplete":true}
#  -------------------------------------------------

#  ----to be translated------------------------------------------
BasicExample_1nke42v: "Benvenuto in viteTranslate"
DynamicExample_1wltsn1: "Ciao %s, come stai?"
PlaceholderExample_1dxcv5l: "Nome utente"
PlaceholderExample_1ebkbf3: "Il nome verrà usato nel saluto"`} />

        <p className="doc-description">
          <Translate>_%_Sostituendo ogni null con il testo tradotto (mantenendo invariati eventuali %s) il file risulta completo, pronto per essere usato come lingua disponibile._%_</Translate>
        </p>
        <CodeBlock language="yaml" code={`#  -------------------------------------------------
#      français
#       |    code: fr-FR
#       |    missing key: 0
#       |    processed: 2026-08-24 12:41
#  -------------------------------------------------
__builder__: {"v":260824,"languageName":"français"}
#  -------------------------------------------------
BasicExample_1nke42v: "Bienvenue sur viteTranslate"
DynamicExample_1wltsn1: "Salut %s, comment ça va ?"
PlaceholderExample_1dxcv5l: "Nom d'utilisateur"
PlaceholderExample_1ebkbf3: "Le nom sera utilisé dans la salutation"`} />

        <p className="doc-description">
          <Translate>_%_Ogni file .yml trovato in localeDir diventa automaticamente disponibile: useTranslateLanguage() lo elenca e TranslateContainer lo carica pigramente alla richiesta, senza bisogno di registrarlo altrove._%_</Translate>
        </p>
      </section>
    </section>
  );
}
