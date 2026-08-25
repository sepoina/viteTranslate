import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitetranslate } from '@sepoina/vitetranslate';

export default defineConfig({
  plugins: [
    react(),
    vitetranslate({
      localeDir: 'src/locale',
      sourceLanguage: 'it-IT',
      // Una sola lingua precaricata: il pulsante in cima commuta fra sorgente e
      // traduzione senza sospensione al primo render.
      preloadedLanguages: ['en-US'],
      errorSolve: {
        mark: {
          badData: '🚫', // a value that is not text and never will be
          malformed: '‼️', // text nobody marked, or incompatible props
          untranslated: '🔸', // no translation in the current language
          notFullyTranslated: '🔹', // translated here, missing in some other language
          absentDataInArray: '⁇', // a %s left without a value
        },
        // Questa pagina esiste per mostrare i mark: spegnerli in build vorrebbe dire
        // pubblicare la tabella senza la colonna che la giustifica. In un'app vera
        // questo resta `true`, il default della libreria.
        markOnlyDev: false,
        warningDev: true, // runtime console in development
        warningBuild: false, // runtime console in production
      },
    }),
  ],
  // Quando la pagina viene buildata contro il working tree della libreria (vedi README),
  // il dist della lib vive fuori da questa cartella e Vite risale le cartelle a cercare
  // "react": se ne trova una copia sopra alla root del repo, nel bundle finiscono due
  // React e gli hook della libreria girano su quello che react-dom non sta usando
  // (#root vuoto). È lo stesso inciampo documentato in playground/vite.config.js.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    // Porta fissa: con i due dev server accesi i link fra playground (3000) e
    // questa pagina (3001) sanno dove puntare.
    port: 3001,
  },
});
