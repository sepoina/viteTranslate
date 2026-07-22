import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "@sepoina/vitetranslate";

export default defineConfig({
  plugins: [
    vitetranslate({
      localeDir: "src/locale",
      defaultLanguage: "it-IT",
    }),
    react(),
  ],
  server: {
    port: 3001,
    open: false,
  },
});
