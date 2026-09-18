import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TranslateContainer } from '@sepoina/vitetranslate/react';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* --- first language (from state, localStorage, webService...) --- */}
    <TranslateContainer initialLanguage="it-IT">
      <App />
    </TranslateContainer>
  </StrictMode>
);
