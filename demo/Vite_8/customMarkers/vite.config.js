import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitetranslate } from '@sepoina/vitetranslate';

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: 'locale', // lang dir
      sourceLanguage: 'it-IT', // source Language
      // Your own delimiters instead of _%_: two very rare Unicode symbols (U+227C, U+227D), which never
      // show up in real text — so a marker can't be mistaken for punctuation. See doc/plugin-options.md#markers.
      markerStart: '≼',
      markerEnd: '≽',
      // Con autoWrap un testo marcato fra i tag (≼così≽) si traduce da solo: niente <Trans> da scrivere.
      // Spento (il default), resterebbe a schermo col suo marcatore compilato.
      autoWrap: true,
    }),
  ],
  server: {
    host: true,
  },
});
