import { Translate } from "@sepoina/vitetranslate/react";
import { Code } from "../theme/Code.jsx";
import { AnchorTitle } from "./DocSection.jsx";
import installSubsections from "../snippets/installSubsections.js";

const [configPlugin, esecuzioneDev, buildLinguistico, nuovaLingua, llm] = installSubsections;

export default function InstallSection() {
  return (
    <section id="install" className="part">
      <h2>
        <Translate>_%_Installazione_%_</Translate>
      </h2>

      <section id={configPlugin.id} className="doc">
        <AnchorTitle id={configPlugin.id}>
          <Translate t={configPlugin.title} />
        </AnchorTitle>

        <p className="doc-text">
          <Translate>_%_Installa il pacchetto nel tuo progetto Vite + React: React e Vite sono peer dependency, quindi devono già essere presenti._%_</Translate>
        </p>
        <Code lang="bash" title="terminal" code={`npm install @sepoina/vitetranslate`} />

        <p className="doc-text">
          <Translate>_%_Registra il plugin viteTranslate in vite.config.js: gli va indicata la cartella dei file di lingua e la lingua di default. Il plugin si occupa sia dell'estrazione delle stringhe da tradurre via Babel sia della generazione del modulo virtuale che elenca le lingue disponibili._%_</Translate>
        </p>
        <Code title="vite.config.js" code={`import { defineConfig } from "vite";
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

        <p className="doc-text">
          <Translate>_%_Ecco come appare il progetto una volta configurato il plugin: locale è una cartella accanto a src, indicata da localeDir, con dentro un file .yml per ogni lingua._%_</Translate>
        </p>
        <Code lang="text" title="tree" code={`.
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

      <section id={esecuzioneDev.id} className="doc">
        <AnchorTitle id={esecuzioneDev.id}>
          <Translate t={esecuzioneDev.title} />
        </AnchorTitle>

        <p className="doc-text">
          <Translate>_%_Dalla 4.2 non serve preparare nulla prima del primo avvio: il plugin sincronizza le tabelle da solo, dentro l'hook di configurazione di Vite, prima ancora che il server esista. Al primo npm run dev il file della lingua di default viene creato in automatico (vedi Build linguistico), pronto per essere letto da TranslateContainer._%_</Translate>
        </p>
        <p className="doc-text">
          <Translate>_%_Avvolgi l'app in TranslateContainer indicando la lingua iniziale da caricare: espone il contesto usato da Translate e dagli altri hook per leggere la tabella di traduzione corrente. In sviluppo il fallback resta incorporato nel codice compilato, quindi l'app mostra già il testo tradotto senza dover lanciare altri comandi._%_</Translate>
        </p>
        <Code title="main.jsx" code={`import { TranslateContainer } from "@sepoina/vitetranslate/react";

ReactDOM.createRoot(document.getElementById("root")).render(
  <TranslateContainer initialLanguage="it-IT">
    <App />
  </TranslateContainer>
);`} />
      </section>

      <section id={buildLinguistico.id} className="doc">
        <AnchorTitle id={buildLinguistico.id}>
          <Translate t={buildLinguistico.title} />
        </AnchorTitle>

        <p className="doc-text">
          <Translate>_%_Dalla 4.2 la sincronizzazione avviene da sola: un controllo rapido a ogni avvio del dev server, una scansione completa prima di ogni build di produzione. Nessuno script da scrivere, nessun comando da ricordare._%_</Translate>
        </p>

        <p className="doc-text">
          <Translate>_%_Il comando resta comunque disponibile, per lanciarlo a mano o da una pipeline di CI:_%_</Translate>
        </p>
        <Code lang="bash" title="terminal" code={`npx vitetranslate`} />

        <p className="doc-text">
          <Translate t={"_%_Per un controllo in CI che non scrive nulla c’è <code>--status</code>: riporta lo stato di ogni tabella ed esce con 1 solo se trova errori._%_"} />
        </p>
        <Code lang="bash" title="terminal" code={`npx vitetranslate --status`} />

        <p className="doc-text">
          <Translate>_%_Che parta da sola o lanciato a mano, il risultato è lo stesso: anche a progetto appena creato e senza altri file di lingua presenti, viene generata la prima tabella linguistica, quella della lingua indicata come lingua di default in_%_</Translate>
          {" "}
          <a href={`#${configPlugin.id}`}>
            <Translate t={configPlugin.title} />
          </a>
          <Translate>_%_. È lo stesso file che il plugin crea da solo al primo avvio, descritto in Esecuzione dev._%_</Translate>
        </p>
        <Code lang="yaml" title="locale/it-IT.yml" code={`#  -------------------------------------------------
#      italiano (Italia) (sourceLanguage)
#       |    code: it-IT
#       |    missing key: 0
#       |    processed: 2026-08-24 12:37
#       |    TableVersion: 260905
#  -------------------------------------------------
#
BasicExample_1nke42v: "Benvenuto in viteTranslate"
DynamicExample_1wltsn1: "Ciao %s, come stai?"
PlaceholderExample_1dxcv5l: "Nome utente"
PlaceholderExample_1ebkbf3: "Il nome verrà usato nel saluto"`} />
      </section>

      <section id={nuovaLingua.id} className="doc">
        <AnchorTitle id={nuovaLingua.id}>
          <Translate t={nuovaLingua.title} />
        </AnchorTitle>

        <p className="doc-text">
          <Translate>_%_Ogni lingua è un file .yml dentro localeDir, con lo stesso nome del suo tag_%_</Translate>
          {" "}
          <a href="https://github.com/sepoina/viteTranslate/blob/main/doc/bcp47.md" target="_blank" rel="noopener noreferrer">BCP 47</a>
          <Translate>_%_. Il file della lingua di default viene creato e tenuto aggiornato in automatico dal comando di sincronizzazione: non va scritto a mano, solo tradotto se serve._%_</Translate>
        </p>
        <p className="doc-text">
          <Translate>_%_Per aggiungere una nuova lingua usa il flag --add del comando di sincronizzazione: crea subito il file con il tag scelto, già popolato con tutte le chiavi trovate nel sorgente (valore null), e chiude con il riepilogo di quante restano da tradurre. Basta sostituire quei null con il testo tradotto._%_</Translate>
        </p>
        <Code lang="bash" title="terminal" code={`npx vitetranslate --add fr-FR`} />

        <p className="doc-text">
          <Translate>_%_Subito dopo il comando il file contiene già tutte le chiavi trovate nel sorgente, ma non tradotte (valore null): sotto la riga separatrice trovi l'elenco esatto di ciò che manca._%_</Translate>
        </p>
        <Code lang="yaml" title="locale/fr-FR.yml" code={`#  -------------------------------------------------
#      français
#       |    code: fr-FR
#       |    missing key: 4
#       |    processed: 2026-08-24 12:37
#       |    TableVersion: 260905
#  -------------------------------------------------
#

#  ----to be translated------------------------------------------
BasicExample_1nke42v: null
DynamicExample_1wltsn1: null
PlaceholderExample_1dxcv5l: null
PlaceholderExample_1ebkbf3: null`} />

        <p className="doc-text">
          <Translate>_%_Le stesse chiavi compaiono, nello stesso momento, anche nel file della lingua di default: mai come null lì, ma raggruppate sotto la stessa riga separatrice finché restano da tradurre in almeno un'altra lingua. È un'occasione pratica: puoi copiare quel blocco (testo reale, non null) e incollarlo in un LLM per farlo tradurre, poi incollare la risposta al posto dei null nel file della lingua di destinazione._%_</Translate>
        </p>
        <Code lang="yaml" title="locale/it-IT.yml" code={`#  -------------------------------------------------
#      italiano (Italia) (sourceLanguage)
#       |    code: it-IT
#       |    missing key: 4
#       |    processed: 2026-08-24 12:37
#       |    TableVersion: 260905
#  -------------------------------------------------
#

#  ----to be translated------------------------------------------
BasicExample_1nke42v: "Benvenuto in viteTranslate"
DynamicExample_1wltsn1: "Ciao %s, come stai?"
PlaceholderExample_1dxcv5l: "Nome utente"
PlaceholderExample_1ebkbf3: "Il nome verrà usato nel saluto"`} />

        <p className="doc-text">
          {/* a="%s": il %s del testo è da mostrare, non da riempire (senza argomento diventerebbe ⁇) */}
          <Translate t={"_%_Sostituendo ogni null con il testo tradotto (mantenendo invariati eventuali %s) il file risulta completo, pronto per essere usato come lingua disponibile._%_"} a="%s" />
        </p>
        <Code lang="yaml" title="locale/fr-FR.yml" code={`#  -------------------------------------------------
#      français
#       |    code: fr-FR
#       |    missing key: 0
#       |    processed: 2026-08-24 12:41
#       |    TableVersion: 260905
#  -------------------------------------------------
#
BasicExample_1nke42v: "Bienvenue sur viteTranslate"
DynamicExample_1wltsn1: "Salut %s, comment ça va ?"
PlaceholderExample_1dxcv5l: "Nom d'utilisateur"
PlaceholderExample_1ebkbf3: "Le nom sera utilisé dans la salutation"`} />

        <p className="doc-text">
          <Translate>_%_Ogni file .yml trovato in localeDir diventa automaticamente disponibile: useTranslateLanguage() lo elenca e TranslateContainer lo carica pigramente alla richiesta, senza bisogno di registrarlo altrove._%_</Translate>
        </p>
      </section>

      <section id={llm.id} className="doc">
        <AnchorTitle id={llm.id}>
          <Translate t={llm.title} />
        </AnchorTitle>

        <p className="doc-text">
          <Translate t={"_%_Il blocco da tradurre puoi anche non copiarlo tu: l’opzione <code>llm</code> punta il comando a un modello con API compatibili OpenAI (Gemini, OpenAI, OpenRouter, Groq, Ollama…). Nella configurazione va il nome della variabile d’ambiente con la chiave, mai la chiave._%_"} />
        </p>
        <Code title="vite.config.js" code={`vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",
  llm: {
    connection: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.5-flash",
      apiKeyEnv: "VITETRANSLATE_API_KEY", // il NOME della variabile, mai la chiave
    },
  },
});`} />

        <p className="doc-text">
          <Translate t={"_%_Poi un comando: stima il costo e chiede conferma prima di spendere, e ogni traduzione passa da un validatore che scarta un <code>%s</code> perso o un tag rovinato. Gira solo dalla CLI, mai dentro <code>vite dev</code>._%_"} a="%s" />
        </p>
        <Code lang="bash" title="terminal" code={`npx vitetranslate --llm-translate

::: LLM            ║  "gemini-2.5-flash" · standard
:::                ║  - (2/2) incomplete tables - 128 missing keys - 2 api requests
:::                ║  - token (in ~13.1k - out ~9.3k) ≈ $0.0190 < costGuard ($0.2000)
:::                ║  ✔ < 64 new keys français. Full translate!    3s`} />

        <p className="doc-text">
          <Translate>_%_Costi, limiti di spesa, la chiave nel portachiavi di sistema e tutte le opzioni:_%_</Translate>{" "}
          <a href="https://github.com/sepoina/viteTranslate/blob/main/doc/llm.md" target="_blank" rel="noopener noreferrer">
            doc/llm.md
          </a>
        </p>
      </section>
    </section>
  );
}
