// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Caratteri -> token -> costo, e la loro forma stampata. `formatCost` è l'unico posto in cui
// un costo diventa una stringa: nessuno lo formatta a mano da nessun'altra parte, stessa
// disciplina dei delimitatori in lib/markerSyntax.js.

// Costante di partenza, sovrastimata per il cinese e corretta dal secondo run in poi tramite
// il rapporto misurato sul campo (vedi llmLedger.js).
export const CHARS_PER_TOKEN = 4;
// Una traduzione è mediamente più lunga del sorgente.
export const OUTPUT_EXPANSION = 1.15;

// `+ 6` per voce: la sintassi JSON che torna indietro (`"": ,` più spazio). Su una label da
// bottone la chiave pesa più del valore, ed è giusto che si veda nella stima.
const JSON_OVERHEAD_PER_KEY = 6;

function estimateTokens(chars, ratio) {
  return chars / (ratio || CHARS_PER_TOKEN);
}

/**
 * Stima caratteri e token di un run, in ingresso e in uscita.
 *
 * @param {{
 *   items: Array<{ key: string, text: string, where: string }>,
 *   contextChars: number,
 *   systemChars: number,
 *   nBatch: number,
 *   ratios?: { ratioIn?: number, ratioOut?: number },
 * }} params
 */
export function estimateRun({ items, contextChars, systemChars, nBatch, ratios }) {
  const serializedChars = items.reduce(
    (sum, item) => sum + JSON.stringify({ k: item.key, t: item.text, where: item.where }).length,
    0
  );
  const sourceChars = items.reduce((sum, item) => sum + item.text.length, 0);
  const keyChars = items.reduce((sum, item) => sum + item.key.length + JSON_OVERHEAD_PER_KEY, 0);

  const charsIn = (systemChars + contextChars) * nBatch + serializedChars;
  const charsOut = sourceChars * OUTPUT_EXPANSION + keyChars;

  return {
    charsIn,
    charsOut,
    tokensIn: estimateTokens(charsIn, ratios?.ratioIn),
    tokensOut: estimateTokens(charsOut, ratios?.ratioOut),
  };
}

/**
 * Il costo in valuta, o `undefined` se i due prezzi non sono configurati: in quel caso non si
 * stampa nessuna riga di costo, solo i token.
 *
 * @param {{ tokensIn: number, tokensOut: number, connection: { costMillionInput?: number, costMillionOutput?: number } }} params
 */
export function costOf({ tokensIn, tokensOut, connection }) {
  const { costMillionInput, costMillionOutput } = connection ?? {};
  if (costMillionInput == null || costMillionOutput == null) return undefined;

  const costIn = (tokensIn / 1e6) * costMillionInput;
  const costOut = (tokensOut / 1e6) * costMillionOutput;
  return { cost: costIn + costOut, costIn, costOut };
}

/** L'unico posto in cui un costo diventa una stringa. `costUnity` sta davanti al numero, e
 *  dentro la parte "minore di" (`< $0.0001`, non `$< 0.0001`). */
export function formatCost(n, costUnity = "$") {
  if (n === 0) return `${costUnity}0`;
  if (n < 0.0001) return `< ${costUnity}0.0001`;
  if (n < 1) return `${costUnity}${n.toFixed(4)}`;
  return `${costUnity}${n.toFixed(2)}`;
}

/** `62100` -> `"62.1k"`. */
export function formatTokens(n) {
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1e6).toFixed(1)}M`;
}
