// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Il percorso con i separatori di Windows normalizzati a "/".
 *
 * Serve ovunque un percorso del filesystem debba essere confrontato con un id di Vite (che è
 * sempre posix) o scritto in un messaggio. Era la stessa espressione ripetuta a mano in nove
 * punti: non è un rischio di divergenza, è rumore che nasconde cosa la riga sta davvero
 * facendo.
 */
export const toPosix = (p) => p.replace(/\\/g, "/");
