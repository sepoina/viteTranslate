import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitetranslate } from '@sepoina/vitetranslate';

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: 'locale', // lang dir
      sourceLanguage: 'it-IT', // source Language
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
        },
        budget: 'safe', // 50 chiavi e 20 richieste per run
        context: { mode: 'auto' }, // l'abstract di contesto nasce (e si aggiorna) da solo
        costGuard: 0.01, // sotto questa stima non chiede conferma
      },
    }),
  ],
  server: {
    host: true,
  },
});
