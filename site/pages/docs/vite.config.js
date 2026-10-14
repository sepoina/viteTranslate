import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitetranslate } from '@sepoina/vitetranslate';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDocs, watchDocs } from './scripts/compileDocs.mjs';
import { writeStaticRoutes } from './scripts/staticRoutes.mjs';

// Il manuale si compila a ogni caricamento della config (dev, build e CLI di vitetranslate): così
// src/generated/ esiste prima che la sync scansioni src/.
compileDocs();

// In dev ricompila a ogni modifica di content/. In build, a bundle scritto, copia la pagina per ogni
// route (dist/<route>/index.html) e crea i rimandi dei vecchi indirizzi: vedi scripts/staticRoutes.mjs.
function docsRoutes() {
  let config;
  return {
    name: 'docs-routes',
    configResolved(c) {
      config = c;
    },
    configureServer() {
      watchDocs();
    },
    closeBundle() {
      if (config.command !== 'build') return;
      const routes = JSON.parse(readFileSync(resolve(config.root, 'src/generated/routes.json'), 'utf8'));
      const { pages, redirects } = writeStaticRoutes({ outDir: resolve(config.root, config.build.outDir), base: config.base, routes });
      console.log(`docs: ${pages} static pages, ${redirects} redirects`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: 'locale',
      // L'inglese è la lingua sorgente del manuale; l'italiano e le altre arrivano solo dal comando
      // `vitetranslate --llm-translate`, mai a mano.
      sourceLanguage: 'en-US',
      errorSolve: { warningBuild: false },
      // Come parlare col modello. Da qui non parte nessuna chiamata: questo blocco lo legge solo il
      // comando (`vitetranslate --llm-translate`, da terminale), mai `vite dev` e mai la build.
      // Copia del blocco di site/pages/playEdge/vite.config.js.
      llm: {
        connection: {
          baseURL: 'https://api.deepseek.com',
          model: 'deepseek-flash',
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
    docsRoutes(),
  ],
  // La libreria è un link al working tree (workspace di npm): il suo dist vive fuori da questa
  // cartella e Vite risale le cartelle a cercare "react". Due React nel bundle = #root vuoto.
  // Stesso inciampo documentato in site/pages/playground/vite.config.js.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    // Porta fissa, una per progetto del sito: playground 3000, edge 3001, landing 3002,
    // llmRestaurant 3003, questa pagina (docs) 3004.
    port: 3004,
  },
});
