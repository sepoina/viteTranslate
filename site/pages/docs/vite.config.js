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
      // Come parlare col modello. Da qui non parte nessuna chiamata: questo blocco lo
      // legge solo il comando (`vitetranslate --llm-translate`, da terminale), mai `vite dev` e mai la build.
         // OPENROUTER_API_KEY to VS Code's terminals (vscode.env in the YAML).
      llm: {
        connection: {
          baseURL: "https://openrouter.ai/api/v1",
          // Il modello ★★★ della tabella di llm/setup (#tested-endpoints): ~20 s per lotto.
          model: "deepseek/deepseek-v4.1-flash",
          apiKeyEnv: "OPENROUTER_API_KEY",
          costMillionInput: 0.15, // OpenRouter, October 2026
          costMillionOutput: 0.6,
          // Di suo il modello ragiona: riempiva max_tokens e ogni risposta tornava vuota.
          providerOptions: { reasoning: { enabled: false } }, // il campo di OpenRouter
          // Provati anche, ottobre 2026 (i promossi sono nella tabella di llm/setup):
          // - anthropic/claude-haiku-5.5 ($0.10 / $0.50, reasoning { enabled: false }): veloce,
          //   7-20 s per lotto, buon cinese, ma un lotto intero (100 chiavi) restituito in inglese,
          //   identico al sorgente: accettato dai controlli, poi riportato a null a mano. Bocciato.
          // - z-ai/glm-4.7-flash ($0.06 / $0.40): ~65 s per lotto, vuole timeoutMs: 120000 e
          //   provider: { sort: "throughput" } (un provider giù teneva le richieste appese). Sui GLM
          //   5.3 il ragionamento è obbligatorio: enabled: false -> 400.
          // - qwen/qwen3-235b-a22b-2507 ($0.09 / $0.55): 53-74 s per lotto, buona qualità; OpenRouter
          //   ha diviso i lotti fra provider più cari, conto vero ~60% sopra la stima.
          // - xiaomi/mimo-v2.5 ($0.14 / $0.28): 75-100 s per lotto, un lotto oltre i 120 s.
          // - openai/gpt-5-nano ($0.05 / $0.40, ragionamento obbligatorio, effort "minimal"): ~25 s
          //   per lotto, ma tag persi, chiavi storpiate, testo mescolato fra chiavi. Annullato.
          // - thinkingmachines/inkling:free: 403, OpenRouter lo dà solo alle app "agentic harness".
          // - nvidia/nemotron-3-ultra-550b-a55b:free: 100-120 s per lotto, risposte non JSON, timeout.
          // - google/gemma-4-31b-it:free: solo 429, provider saturo e 20 richieste/minuto sui :free.
        },
        costGuard: 0.05, // a few keys cost far less: no question on camera
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
