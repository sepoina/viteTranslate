// Architettura d'insieme: doc/structure.md § "Fase 4 — Runtime", "Cosa NON è esportato".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { createContext } from "react";
export const TranslateContext = createContext(null);
