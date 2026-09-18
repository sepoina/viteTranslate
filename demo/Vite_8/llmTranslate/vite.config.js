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
      // legge solo il comando (`vitetranslate --translate`, da terminale), mai `vite dev` e mai la build.
      llm: {
        connection: {
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', // endpoint OpenAI-compatibile
          model: 'gemini-2.5-flash',
          apiKeyEnv: 'VITETRANSLATE_API_KEY', // il NOME della variabile, mai la chiave
          costMillionInput: 0.3, // $ per milione di token, per la stima: o entrambi o nessuno
          costMillionOutput: 2.5,
        },
        budget: 'safe', // 50 chiavi e 20 richieste per run
        context: { mode: 'auto' }, // l'abstract di contesto nasce (e si aggiorna) da solo
      },
    }),
  ],
  server: {
    host: true,
  },
});
