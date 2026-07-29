import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import { vitetranslate } from "@sepoina/vitetranslate";
import pluginOnlyForPlayground from "./pluginOnlyForPlayground.js";

export default defineConfig({
  plugins: [
    pluginOnlyForPlayground({ useLocalLibrary: false }),
    vitetranslate({
      localeDir: "src/locale",   // cartella con i moduli JS delle traduzioni (dentro src, non in public)
      sourceLanguage: "it-IT",   // lingua dei testi originali (quelli scritti nel sorgente)
      // Lingue importate staticamente: nessuna sospensione al primo render. Essendocene una,
      // in build la sorgente NON viene precaricata (ogni tabella compilata è autonoma) — in
      // dev sì. La prima della lista è la lingua iniziale di default di <TranslateContainer>.
      preloadedLanguages: ["en-US"],
    }),
    react(),
    mkcert(),
  ],
  // La libreria è linkata (`"@sepoina/vitetranslate": "file:.."`), quindi in build Vite
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
