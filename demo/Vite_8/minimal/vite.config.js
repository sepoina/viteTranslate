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
  server: {
    host: true,
  },
});
