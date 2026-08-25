import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TranslateContainer } from '@sepoina/vitetranslate/react';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* --- Lingua iniziale: qui la sorgente, non una qualunque. La colonna "Atteso"
            della tabella descrive il risultato con la sourceLanguage attiva; partendo
            da en-US ogni riga mostrerebbe una traduzione (o un 🔸) e il confronto
            perderebbe senso. In un'app vera qui ci sono stato, localStorage, un
            webService... --- */}
    <TranslateContainer initialLanguage="it-IT">
      <App />
    </TranslateContainer>
  </StrictMode>
);
