import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TranslateContainer, useTranslateLanguage } from '@sepoina/vitetranslate/react';
import App from './App';
import { pickLanguage, RememberLanguage } from './siteLanguage';
import { applySavedTheme } from './theme/boot.js';
import './theme/theme.css';
import './docs.css';

// Lingua iniziale: l'ultima scelta sul sito, se c'è tra queste tabelle; altrimenti l'inglese (sorgente).
function Root() {
  const { languages } = useTranslateLanguage();
  return (
    <TranslateContainer initialLanguage={pickLanguage(languages, 'en-US')}>
      <RememberLanguage />
      <App />
    </TranslateContainer>
  );
}

// Il tema scelto sul sito (src/theme/boot.js), prima del primo rendering.
applySavedTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
