import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TransContainer } from '@sepoina/vitetranslate/react';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* --- first language (from state, localStorage, webService...) --- */}
    <TransContainer initialLanguage="en-US">
      <App />
    </TransContainer>
  </StrictMode>
);
