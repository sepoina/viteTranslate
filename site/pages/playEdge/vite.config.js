import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitetranslate } from '@sepoina/vitetranslate';

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: 'locale',
      sourceLanguage: 'it-IT',
      // Una sola lingua precaricata: il pulsante in cima commuta fra sorgente e
      // traduzione senza sospensione al primo render.
      preloadedLanguages: ['en-US'],
      // Una RegExp e non `true`: e' anche la dimostrazione del caso 10 di
      // autoWrapCases.jsx — <blockquote> non e' nell'elenco, quindi resta "opaque" e
      // autoWrap non lo tocca, di proposito. Verificato (extractMarkers + re-parse) che
      // accenderla non cambia una riga di output per nessun sorgente preesistente di questa
      // cartella: i soli marcatori nudi sotto un elemento host sono quelli nuovi qui sotto.
      autoWrap: /^(p|div|span|li|ul|ol|h[1-6]|b|strong|em|code|a|button|label)$/,
      errorSolve: {
        mark: {
          badData: '🚫', // a value that is not text and never will be
          malformed: '‼️', // text nobody marked, or incompatible props
          untranslated: '🔸', // no translation in the current language
          notFullyTranslated: '🔹', // translated here, missing in some other language
          absentDataInArray: '⁇', // a %s left without a value
        },
        // Questa pagina esiste per mostrare i mark: spegnerli in build vorrebbe dire
        // pubblicare la tabella senza la colonna che la giustifica. In un'app vera
        // questo resta `true`, il default della libreria.
        markOnlyDev: false,
        warningDev: true, // runtime console in development
        warningBuild: false, // runtime console in production
      },
      // Come parlare col modello. Da qui non parte nessuna chiamata: questo blocco lo
      // legge solo il comando (`vitetranslate --llm-translate`, da terminale), mai `vite dev` e mai la build.
      llm: {
        connection: {
          // endpoint OpenAI-compatibile
          baseURL: 'https://api.deepseek.com',
          // model to use
          model: 'deepseek-flash',
          // generic name for api key
          apiKeyEnv: 'DEEPSEEK_API_KEY',
          // $ per milione di token
          costMillionInput: 0.6,
          costMillionOutput: 1.2,
          modelClass: 'standard', // lotti fino a ~3k token di output / 100 chiavi
        },
        budget: 'safe', // $0.10 per run, $0.50 al giorno (con i prezzi qui sopra)
        context: { mode: 'auto' }, // l'abstract di contesto nasce (e si aggiorna) da solo
        costGuard: 0.2, // sotto questa stima non chiede conferma
      },
    }),
  ],
  // La libreria è un link al working tree (workspace di npm): il suo dist vive fuori da
  // questa cartella e Vite risale le cartelle a cercare "react". Se ne trova una copia
  // sopra alla root del repo, nel bundle finiscono due React e gli hook della libreria
  // girano su quello che react-dom non sta usando (#root vuoto). È lo stesso inciampo
  // documentato in site/pages/playground/vite.config.js.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    // Porta fissa, una per progetto del sito: playground 3000, questa pagina 3001,
    // landing 3002, llmRestaurant 3003.
    port: 3001,
  },
});
