// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime", "Cosa NON è esportato".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// DOCS-PAGE: components/translate-container, concepts/preloading — the user manual describes this behaviour; update it and run npm run docs:seal (AGENTS.md).

import { createContext } from "react";
export const TranslateContext = createContext(null);
