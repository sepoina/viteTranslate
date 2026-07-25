import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import { vitetranslate } from "@sepoina/vitetranslate";
import pluginOnlyForPlayground from "./pluginOnlyForPlayground.js";

export default defineConfig({
  plugins: [
    pluginOnlyForPlayground({ useLocalLibrary: false }),
    vitetranslate({
      localeDir: "src/locale",   // cartella con i file json delle traduzioni (va nella zona dei bundle)
      defaultLanguage: "it-IT",  // lingua dei testi originali (quelli scritti nel sorgente)
      preloadedLanguages: ["en-US"], // lingue precaricate staticamente (nessun suspence)
    }),
    react(),
    mkcert(),
  ],
  server: {
    port: 3000,
    open: false,
  },
});
