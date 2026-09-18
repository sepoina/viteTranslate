// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Vive in `node_modules/.viteTranslate/llm.json`, accanto a `session.json` e `scan.json`, e
// riusa `leggiJson` / `scriviJson` di sessionStore.js: scrittura atomica, lettura che non
// lancia mai, niente scritture se `node_modules` non esiste. Non riscrive quelle due funzioni,
// costruisce sopra di loro un `updateLedger` analogo a `writeSession`.

import path from "path";
import { leggiJson, scriviJson, pkgVersion } from "../vite/uty/sessionStore.js";

const LEDGER_REL = ["node_modules", ".viteTranslate", "llm.json"];
const SCHEMA_VERSION = 1;

const todayISO = () => new Date().toISOString().slice(0, 10);

function emptyLedger() {
  return { day: todayISO(), keysToday: 0, costToday: 0, models: {}, failures: {}, context: {} };
}

/** Il percorso del ledger, senza toccare il disco. */
export function ledgerPath(baseDir) {
  return path.join(baseDir, ...LEDGER_REL);
}

/**
 * Legge il ledger applicando il rollover del giorno **in lettura**, non con un timer: se `day`
 * è diverso da oggi, `keysToday` e `costToday` valgono 0 nell'oggetto restituito — il file su
 * disco non cambia finché non arriva un `updateLedger`. Non lancia mai: un file corrotto o
 * assente vale "nessun ledger", contatori a zero.
 *
 * @param {string} baseDir
 */
export function readLedger(baseDir) {
  const stored = leggiJson(ledgerPath(baseDir), SCHEMA_VERSION);
  if (!stored) return emptyLedger();

  const day = todayISO();
  if (stored.day !== day) return { ...stored, day, keysToday: 0, costToday: 0 };
  return stored;
}

/**
 * Legge (rollover compreso), lascia modificare il draft da `mutate`, scrive in modo atomico.
 * Non lancia mai (vedi `scriviJson`).
 *
 * @param {string} baseDir
 * @param {(ledger: object) => void} mutate - modifica il draft in place
 * @returns {object} il ledger scritto
 */
export function updateLedger(baseDir, mutate) {
  const draft = readLedger(baseDir);
  mutate(draft);
  scriviJson(baseDir, ledgerPath(baseDir), {
    ...draft,
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    pkgVersion: pkgVersion(),
  });
  return draft;
}

/** Accumula l'uso di un run: chiavi e costo di oggi, e i contatori per modello. */
export function recordUsage(
  ledger,
  { model, keysAdded = 0, cost = 0, charsIn = 0, tokensIn = 0, charsOut = 0, tokensOut = 0 }
) {
  ledger.keysToday += keysAdded;
  ledger.costToday += cost;

  const current = ledger.models[model] ?? { charsIn: 0, tokensIn: 0, charsOut: 0, tokensOut: 0, runs: 0 };
  ledger.models[model] = {
    charsIn: current.charsIn + charsIn,
    tokensIn: current.tokensIn + tokensIn,
    charsOut: current.charsOut + charsOut,
    tokensOut: current.tokensOut + tokensOut,
    runs: current.runs + 1,
  };
}

// `failures` è per lingua: una chiave che il modello rifiuta in una lingua può benissimo
// passare in un'altra.
export function recordFailure(ledger, language, key, reason) {
  ledger.failures[language] ??= {};
  const current = ledger.failures[language][key];
  ledger.failures[language][key] = { count: (current?.count ?? 0) + 1, reason };
}

/** Una chiave che poi passa non resta marcata come fallita per sempre. */
export function clearFailure(ledger, language, key) {
  delete ledger.failures?.[language]?.[key];
}

/** A `count >= 2` la chiave si salta (vedi budgetGuard.js), salvo `--force`. */
export function failureCount(ledger, language, key) {
  return ledger.failures?.[language]?.[key]?.count ?? 0;
}

/** Il rapporto caratteri/token misurato per un modello, o `undefined` se non ancora tarato:
 *  in quel caso costModel.js ricade sulla costante `CHARS_PER_TOKEN`. */
export function ratiosFor(ledger, model) {
  const stats = ledger.models?.[model];
  if (!stats || !stats.tokensIn || !stats.tokensOut) return undefined;
  return { ratioIn: stats.charsIn / stats.tokensIn, ratioOut: stats.charsOut / stats.tokensOut };
}

export function recordContextGeneration(ledger, { keysAtGeneration, corpusHash }) {
  ledger.context = { keysAtGeneration, corpusHash, generatedAt: new Date().toISOString() };
}
