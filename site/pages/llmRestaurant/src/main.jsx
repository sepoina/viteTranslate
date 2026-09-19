import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root';
import './restaurant.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* --- first language: the one saved in the browser (see Root.jsx), else it-IT --- */}
    <Root />
  </StrictMode>
);
