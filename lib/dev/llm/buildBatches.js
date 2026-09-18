// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Dalle chiavi a null ai lotti da spedire. Deterministico: stesse voci, stesso ordine di
// lotti, indipendentemente dall'ordine di ingresso — è quello che rende il dry-run predittivo
// del run vero.

export const MAX_BATCH_CHARS = 4000;
export const MAX_BATCH_ITEMS = 50;

// `Basename_checksum` -> `Basename`: il nome del componente da cui viene la stringa, contesto
// gratis perché la chiave ce l'ha già dentro (vedi markerCore.js, che genera `nome_checksum`).
function whereFromKey(key) {
  const cut = key.lastIndexOf("_");
  return cut === -1 ? key : key.slice(0, cut);
}

// È quello che si spedisce davvero: la stessa forma che prompts.js mette nel payload.
function serializedChars(item) {
  return JSON.stringify({ k: item.key, t: item.text, where: item.where }).length;
}

/**
 * @param {Array<{ key: string, text: string }>} entries
 * @returns {Array<Array<{ key: string, text: string, where: string }>>} un array di lotti
 */
export default function buildBatches(entries) {
  // Locale esplicito "en" (invariante 7): senza, due macchine producono lotti diversi e il
  // dry-run smette di predire il run vero.
  const items = [...entries]
    .sort((a, b) => a.key.localeCompare(b.key, "en"))
    .map((entry) => ({ key: entry.key, text: entry.text, where: whereFromKey(entry.key) }));

  const batches = [];
  let current = [];
  let currentChars = 0;

  for (const item of items) {
    const chars = serializedChars(item);

    const wouldOverflow = currentChars + chars > MAX_BATCH_CHARS || current.length >= MAX_BATCH_ITEMS;
    if (current.length > 0 && wouldOverflow) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(item);
    currentChars += chars;

    // Una voce singola più lunga di MAX_BATCH_CHARS va da sola: non si spezza mai una stringa.
    if (currentChars > MAX_BATCH_CHARS) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
  }

  if (current.length > 0) batches.push(current);

  return batches;
}
