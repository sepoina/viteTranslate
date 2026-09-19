// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Dalle chiavi a null ai lotti da spedire. Deterministico: stesse voci, stesso ordine di
// lotti, indipendentemente dall'ordine di ingresso — è quello che rende il dry-run predittivo
// del run vero.
//
// I lotti si misurano in token (doc/ImplementationPlans/4_6_2.md, "Il concetto"). Con O
// l'overhead di ogni richiesta (prompt di sistema, contesto compreso) e P il carico utile:
//   - `k · O` è una **soglia minima**: si aggiunge la voce, *poi* si controlla se P l'ha
//     raggiunta, e in quel caso si chiude. È il lotto più piccolo con overhead <= 1/(1+k), e
//     un lotto più piccolo vuol dire meno allucinazioni;
//   - `maxOutputTokens` e `maxKeys` sono **soffitti**: si controllano *prima* di aggiungere la
//     voce, e se la voce li farebbe superare si chiude il lotto e la voce apre il successivo.
// Una voce da sola oltre un soffitto va comunque in un lotto da sola: una stringa non si spezza.

import { itemCharsIn, itemTokensOut } from "./costModel.js";

// `Basename_checksum` -> `Basename`: il nome del componente da cui viene la stringa, contesto
// gratis perché la chiave ce l'ha già dentro (vedi markerCore.js, che genera `nome_checksum`).
function whereFromKey(key) {
  const cut = key.lastIndexOf("_");
  return cut === -1 ? key : key.slice(0, cut);
}

/**
 * @param {Array<{ key: string, text: string }>} entries
 * @param {{
 *   overheadTokens: number,
 *   modelClass: { k: number, maxOutputTokens: number, maxKeys: number },
 *   ratioIn: number, ratioOut: number, reasoningPerKey?: number,
 * }} params
 *   `reasoningPerKey`: i token di ragionamento per chiave misurati (costModel.js,
 *   `itemTokensOut`). Contano nel soffitto `maxOutputTokens` come la risposta: si pagano uguale,
 *   e finiscono sotto lo stesso `max_tokens`.
 * @returns {Array<Array<{ key: string, text: string, where: string }>>} un array di lotti
 */
export default function buildBatches(entries, { overheadTokens, modelClass, ratioIn, ratioOut, reasoningPerKey = 0 }) {
  const { k, maxOutputTokens, maxKeys } = modelClass;

  // Locale esplicito "en" (invariante 7): senza, due macchine producono lotti diversi e il
  // dry-run smette di predire il run vero.
  const items = [...entries]
    .sort((a, b) => a.key.localeCompare(b.key, "en"))
    .map((entry) => ({ key: entry.key, text: entry.text, where: whereFromKey(entry.key) }));

  const batches = [];
  let current = [];
  let currentIn = 0;
  let currentOut = 0;

  for (const item of items) {
    const tIn = itemCharsIn(item) / ratioIn;
    const tOut = itemTokensOut(item, { ratioOut, reasoningPerKey });

    // 1. i soffitti, prima di aggiungere.
    if (current.length > 0 && (currentOut + tOut > maxOutputTokens || current.length + 1 > maxKeys)) {
      batches.push(current);
      current = [];
      currentIn = 0;
      currentOut = 0;
    }

    // 2. aggiunge la voce.
    current.push(item);
    currentIn += tIn;
    currentOut += tOut;

    // 3. la soglia minima, dopo aver aggiunto.
    if (currentIn >= k * overheadTokens) {
      batches.push(current);
      current = [];
      currentIn = 0;
      currentOut = 0;
    }
  }

  if (current.length > 0) batches.push(current);

  return batches;
}
