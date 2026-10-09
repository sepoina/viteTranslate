import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TransContainer } from '@sepoina/vitetranslate/react';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* --- first language (from state, localStorage, webService...) --- */}
    <TransContainer initialLanguage="it-IT">
      <App />
    </TransContainer>
  </StrictMode>
);
