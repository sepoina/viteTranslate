import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vitetranslate } from "../../lib/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@sepoina/vitetranslate/react", replacement: path.resolve(__dirname, "../../lib/react/index.js") },
      { find: "@sepoina/vitetranslate", replacement: path.resolve(__dirname, "../../lib/index.js") },
    ],
  },
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
