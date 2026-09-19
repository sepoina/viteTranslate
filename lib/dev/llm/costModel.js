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

const CJK = new Set(["zh", "ja", "ko"]);

/** Il rapporto caratteri/token di partenza per una lingua. È un'euristica per il **primo** run
 *  (i sistemi di scrittura CJK pesano più token per carattere): dal secondo vale la misura
 *  del ledger, per (modello, lingua di destinazione). Si chiede per la lingua **sorgente**,
 *  anche in uscita: i caratteri di `itemCharsOut` sono quelli del sorgente, e una risposta in
 *  giapponese ha meno caratteri ma più token per carattere — le due cose si compensano. */
export function initialRatio(tag) {
  return CJK.has(tag.split("-")[0].toLowerCase()) ? 1.5 : CHARS_PER_TOKEN;
}

// Le formule che trasformano una voce in caratteri stanno qui e in nessun altro posto: le
// usano i lotti (buildBatches.js) e la stima. Sono materia prima: il limite si esprime in token.

/** Quello che si spedisce davvero: la stessa forma che prompts.js mette nel payload. */
export function itemCharsIn(item) {
  return JSON.stringify({ k: item.key, t: item.text, where: item.where }).length;
}

/** Quello che torna indietro, stimato. */
export function itemCharsOut(item) {
  return item.text.length * OUTPUT_EXPANSION + item.key.length + JSON_OVERHEAD_PER_KEY;
}

/**
 * I token di uscita di una voce: la risposta (`itemCharsOut / ratioOut`) più il ragionamento.
 * Sono due grandezze diverse e si tarano separatamente (llmLedger.js): la risposta cresce con i
 * caratteri, il ragionamento di un modello che pensa cresce con le chiavi — lo stesso per una
 * label di tre lettere e per una frase, in qualunque lingua. `reasoningPerKey` è 0 per chi non
 * ragiona, e per chi non dice nell'`usage` quanto ha ragionato: lì la taratura della risposta
 * assorbe tutto, come prima.
 *
 * @param {{ key: string, text: string }} item
 * @param {{ ratioOut?: number, reasoningPerKey?: number }} calibration
 */
export function itemTokensOut(item, { ratioOut, reasoningPerKey = 0 } = {}) {
  return estimateTokens(itemCharsOut(item), ratioOut) + reasoningPerKey;
}

/**
 * Stima caratteri e token di un run, in ingresso e in uscita, dai lotti già costruiti.
 * `systemChars` contiene già il contesto (lo include `buildTranslateSystemPrompt`): non si
 * somma una seconda volta.
 *
 * @param {{
 *   languages: Array<{
 *     systemChars: number,
 *     batches: Array<Array<{ key: string, text: string, where: string }>>,
 *     ratioIn?: number, ratioOut?: number, reasoningPerKey?: number,
 *   }>,
 * }} params
 */
export function estimateRun({ languages }) {
  let charsIn = 0;
  let charsOut = 0;
  let tokensIn = 0;
  let tokensOut = 0;

  for (const { systemChars, batches, ratioIn, ratioOut, reasoningPerKey } of languages) {
    const items = batches.flat();
    const langCharsIn = systemChars * batches.length + items.reduce((sum, item) => sum + itemCharsIn(item), 0);
    charsIn += langCharsIn;
    charsOut += items.reduce((sum, item) => sum + itemCharsOut(item), 0);
    tokensIn += estimateTokens(langCharsIn, ratioIn);
    tokensOut += items.reduce((sum, item) => sum + itemTokensOut(item, { ratioOut, reasoningPerKey }), 0);
  }

  return { charsIn, charsOut, tokensIn, tokensOut };
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
