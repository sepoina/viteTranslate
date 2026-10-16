import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import { vitetranslate } from "@sepoina/vitetranslate";
import pluginOnlyForPlayground from "./pluginOnlyForPlayground.js";

export default defineConfig({
  plugins: [
    pluginOnlyForPlayground({ useLocalLibrary: false }),
    vitetranslate({
      localeDir: "locale",   // cartella con i file .yml delle traduzioni, accanto a src
      sourceLanguage: "it-IT",   // lingua dei testi originali (quelli scritti nel sorgente)
      // Lingue importate staticamente: nessuna sospensione al primo render. Essendocene una,
      // in build la sorgente NON viene precaricata (ogni tabella compilata è autonoma) — in
      // dev sì. La prima della lista è la lingua iniziale di default di <TranslateContainer>.
      preloadedLanguages: ["en-US","it-IT","zh-CN"],
      // Acceso per l'esempio "autoWrap" (src/snippets/AutoWrapExample.jsx): il testo JSX e gli
      // attributi marcati sotto un tag HTML si traducono senza <Translate> né ts().
      autoWrap: true,
      // The OpenRouter setup template of the manual (llm/tested-endpoints), on a model being tried:
      // z-ai/glm-5.3-flash (before it: qwen/qwen3.8-flash, $0.15 / $0.47, reasoning off). The key goes
      // in .env next to this file (git-ignored): OPENROUTER_API_KEY=…
      // Read only by `npx vitetranslate --llm-…`: neither `vite dev` nor the build ever calls the model.
      llm: {
        connection: {
          // OpenRouter's OpenAI-compatible API: the client adds /chat/completions to it.
          baseURL: "https://openrouter.ai/api/v1",
          model: "z-ai/glm-5.3-flash",
          // The NAME of the variable that holds the key, never the key: looked up in the
          // environment, then in .env.local and .env in this folder.
          apiKeyEnv: "OPENROUTER_API_KEY",
          // The price per million tokens, input and output (OpenRouter, October 2026): the
          // estimate, the budget and costGuard count with these.
          costMillionInput: 0.025,
          costMillionOutput: 0.64,
          // How much the model takes at once: batches of up to 100 keys, ~3k output tokens.
          modelClass: "standard",
          // A GLM 4.7 batch took ~65 s: past the default 60 s, so the wait goes up to 120 s.
          timeoutMs: 120000,
          // Added as is to every request, and the field is OpenRouter's own. On GLM 5.3 reasoning
          // can't be switched off (enabled: false gets a 400): the least of it, then.
          providerOptions: { reasoning: { effort: "low" } },
        },
        // The spending caps: $0.10 a run, $0.50 a day (the "safe" preset, with the prices above).
        budget: "safe",
        // Below this estimated cost, in $, the run starts without asking.
        costGuard: 0.2,
        // The context abstract (what the app is about, for the model) writes and refreshes itself.
        context: { mode: "auto" },
      },
    }),
    react(),
    // HTTPS in dev con un certificato locale. Non su StackBlitz: nel WebContainer (che si
    // riconosce da process.versions.webcontainer) mkcert non può girare, e lì l'HTTPS c'è già.
    ...(process.versions.webcontainer ? [] : [mkcert()]),
  ],
  // La libreria è linkata (workspace di npm: `"@sepoina/vitetranslate": "^<versione>"` diventa un link alla radice), quindi in build Vite
  // risolve il path reale del suo dist e da lì cerca "react" risalendo le cartelle: se ne
  // trova una copia sopra alla root del repo, il bundle finisce con due React e gli hook
  // della libreria girano su quello che react-dom non sta usando ("Cannot read properties
  // of null (reading 'useState')", #root vuoto). In dev non si vede: il pre-bundling
  // deduplica da solo. dedupe forza una copia sola, e copre anche chi prova la libreria
  // con `npm link`.
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3000,
    open: false,
  },
});
