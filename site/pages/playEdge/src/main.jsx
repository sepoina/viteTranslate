import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TranslateContainer, useTranslateLanguage } from '@sepoina/vitetranslate/react';
import App from './App';
import { pickLanguage, RememberLanguage } from './siteLanguage';
import { applySavedTheme } from './theme/boot.js';
import './theme/theme.css';
import './edge.css';

// Lingua iniziale: l'ultima scelta sul sito, se c'è tra queste tabelle; altrimenti la sorgente.
// La colonna "Atteso" della tabella descrive il risultato con la sourceLanguage attiva: partendo
// da un'altra lingua ogni riga mostra una traduzione (o un 🔸) e il confronto cambia di senso,
// ma il selettore in alto (IT) riporta subito all'italiano.
function Root() {
  const { languages } = useTranslateLanguage();
  return (
    <TranslateContainer initialLanguage={pickLanguage(languages, 'it-IT')}>
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
