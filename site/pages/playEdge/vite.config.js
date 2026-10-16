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
          // Cline's API (docs.cline.bot/api): the same setup the manual is translated with.
          // Before: baseURL 'https://api.deepseek.com', model 'deepseek-flash', apiKeyEnv 'DEEPSEEK_API_KEY',
          // costMillionInput 0.6, costMillionOutput 1.2, no driver.
          baseURL: 'https://api.cline.bot/api/v1',
          model: 'deepseek/deepseek-v4.1-flash',
          // generic name for api key
          apiKeyEnv: 'CLINE_API_KEY',
          // $ per milione di token (OpenRouter's for this model; Cline's reply says the real cost)
          costMillionInput: 0.15,
          costMillionOutput: 0.6,
          // Di suo il modello ragiona: riempiva max_tokens e la risposta tornava vuota.
          providerOptions: { reasoning: { enabled: false } },
          modelClass: 'standard', // lotti fino a ~3k token di output / 100 chiavi
        },
        // LINKED-DATA: the same driver is in site/pages/docs/vite.config.js, in the example of
        // site/pages/docs/content/llm/custom-endpoint.mdx (#cline-step-by-step) and in the cline template
        // of site/pages/docs/content/llm/tested-endpoints.mdx: change them together.
        // Cline wraps a Chat Completions reply in { success, data }, which the built-in client doesn't read.
        // The library's `fetch` handles timeout, errors, retries and the key; `{ content, truncated, usage }`
        // hands the text back to the library's own parser.
        driver: async ({ connection, apiKey, systemPrompt, userPayload, mode, maxTokens, fetch }) => {
          const reply = await fetch(`${connection.baseURL}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: connection.model,
              temperature: connection.temperature,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPayload },
              ],
              ...(mode === 'translate' ? { response_format: { type: 'json_object' } } : {}),
              ...(maxTokens ? { max_tokens: maxTokens } : {}),
              ...connection.providerOptions,
            }),
          });
          const {
            choices: [choice],
            usage,
          } = (await reply.json()).data;
          return { content: choice.message.content ?? '', truncated: choice.finish_reason === 'length', usage };
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
