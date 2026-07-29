import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitetranslate } from '@sepoina/vitetranslate';

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: 'src/locale', // lang dir
      sourceLanguage: 'it-IT', // source Language
    }),
  ],
  // Serve SOLO con la 2.2.1, e solo su Vite 7: il pre-bundling delle dipendenze gira in un
  // processo esbuild separato, che non vede i plugin del progetto e quindi non sa risolvere
  // "virtual:vitetranslate/languages" -> il dev server muore in partenza.
  // Dalla versione successiva il plugin dichiara l'esclusione da sé e queste tre righe si
  // possono togliere. Su Vite 8 non serve: lì l'optimizer passa dal plugin container.
  optimizeDeps: {
    exclude: ['@sepoina/vitetranslate'],
  },
  server: {
    host: true,
  },
});
