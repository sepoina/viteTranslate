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
// Schema 2: contabilità per richiesta e taratura per lingua. Un ledger v1 si legge come assente
// (`leggiJson` scarta la versione diversa): si perdono la taratura e i contatori del giorno
// dell'aggiornamento, ed è accettato.
const SCHEMA_VERSION = 2;

const todayISO = () => new Date().toISOString().slice(0, 10);

function emptyLedger() {
  return { day: todayISO(), costToday: 0, tokensToday: 0, keysToday: 0, models: {}, failures: {}, context: {} };
}

/** Il percorso del ledger, senza toccare il disco. */
export function ledgerPath(baseDir) {
  return path.join(baseDir, ...LEDGER_REL);
}

/**
 * Legge il ledger applicando il rollover del giorno **in lettura**, non con un timer: se `day`
 * è diverso da oggi, `keysToday`, `costToday` e `tokensToday` valgono 0 nell'oggetto restituito — il file su
 * disco non cambia finché non arriva un `updateLedger`. Non lancia mai: un file corrotto o
 * assente vale "nessun ledger", contatori a zero.
 *
 * @param {string} baseDir
 */
export function readLedger(baseDir) {
  const stored = leggiJson(ledgerPath(baseDir), SCHEMA_VERSION);
  if (!stored) return emptyLedger();

  const day = todayISO();
  if (stored.day !== day) return { ...stored, day, keysToday: 0, costToday: 0, tokensToday: 0 };
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

// La taratura di uscita è una finestra sulle ultime risposte riuscite, per lingua: le più vecchie
// escono appena le altre coprono ~300 chiavi. Un modello che cambia comportamento — il
// ragionamento acceso o spento in `providerOptions`, un aggiornamento lato provider — si
// riflette entro un run, invece di annegare nella media di tutta la storia. `MAX_SAMPLES` tiene
// piccolo il file anche con lotti minuscoli.
const CALIBRATION_WINDOW_KEYS = 300;
const MAX_SAMPLES = 64;

// `out[tag]` è `{ samples: [{ chars, tokens, reasoning, keys }] }`, una voce per risposta. Fino
// alla 4.6.2-rc.2 era `{ chars, tokens }`, con i caratteri della risposta e il ragionamento dentro
// i token: numeri di un'altra grandezza, che qui si ignorano e alla prima scrittura si
// sostituiscono (lo schema resta 2: il resto del ledger vale).
const samplesOf = (out) => (Array.isArray(out?.samples) ? out.samples : null);

/**
 * Accumula una richiesta, una per tentativo che ha un `usage`. Costo e token del giorno si
 * aggiornano **sempre**, perché anche un tentativo fallito si paga. La taratura solo per le
 * risposte riuscite, cioè quando chi chiama passa i numeri che servono:
 *   - `charsIn` -> `charsIn`/`tokensIn` per modello (il rapporto di ingresso);
 *   - `charsOut` -> `chars`/`tokens` della voce di `out[tag]`: i caratteri **stimati**
 *     (`itemCharsOut` delle voci a cui la risposta ha dato un valore) contro i token della risposta
 *     **senza** il ragionamento. Stimati e non contati sulla risposta: la stima parte dal
 *     sorgente, e tarandola sulla stessa grandezza si corregge in un colpo anche l'espansione
 *     della lingua di destinazione;
 *   - `keys` -> `reasoning`/`keys`: i token di ragionamento (`usage.reasoningOut`) per chiave.
 * Con `tag` assente (la chiamata del contesto) l'uscita non si tocca. `cachedIn` si registra e
 * basta: la correzione con la cache del provider non c'è. `keysAdded` è solo informazione per
 * `--llm-status`, non è un tetto.
 */
export function recordRequest(ledger, { model, tag, usage, cost = 0, charsIn, charsOut, keys, keysAdded = 0 }) {
  ledger.costToday += cost;
  ledger.tokensToday += usage.tokensIn + usage.tokensOut;
  ledger.keysToday += keysAdded;

  const current = ledger.models[model] ?? { charsIn: 0, tokensIn: 0, cachedIn: 0, requests: 0, out: {} };
  const next = {
    charsIn: current.charsIn,
    tokensIn: current.tokensIn,
    cachedIn: current.cachedIn + (usage.cachedIn ?? 0),
    requests: current.requests + 1,
    out: { ...current.out },
  };
  if (typeof charsIn === "number") {
    next.charsIn += charsIn;
    next.tokensIn += usage.tokensIn;
  }
  if (tag && (typeof charsOut === "number" || typeof keys === "number")) {
    const reasoning = usage.reasoningOut ?? 0;
    const content = typeof charsOut === "number";
    const perKey = typeof keys === "number";
    const samples = [...(samplesOf(next.out[tag]) ?? []), {
      chars: content ? charsOut : 0,
      tokens: content ? Math.max(0, usage.tokensOut - reasoning) : 0,
      reasoning: perKey ? reasoning : 0,
      keys: perKey ? keys : 0,
    }];
    // Esce la più vecchia finché le altre coprono comunque la finestra.
    let windowKeys = samples.reduce((sum, sample) => sum + sample.keys, 0);
    while (samples.length > 1 && (windowKeys - samples[0].keys >= CALIBRATION_WINDOW_KEYS || samples.length > MAX_SAMPLES)) {
      windowKeys -= samples.shift().keys;
    }
    next.out[tag] = { samples };
  }
  ledger.models[model] = next;
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

/** A `count >= 2` la chiave si salta (vedi budgetGuard.js), salvo `--llm-auto`. */
export function failureCount(ledger, language, key) {
  return ledger.failures?.[language]?.[key]?.count ?? 0;
}

/** I rapporti misurati: `ratioIn` per modello; `ratioOut` (caratteri stimati per token di
 *  risposta) e `reasoningPerKey` (token di ragionamento per chiave) per (modello, lingua di
 *  destinazione). Ciascuno c'è solo se tarato (denominatore > 0): chi chiama ripiega su
 *  `initialRatio` di costModel.js, e su 0 per il ragionamento. */
export function ratiosFor(ledger, model, tag) {
  const stats = ledger.models?.[model];
  const result = {};
  if (stats?.tokensIn > 0) result.ratioIn = stats.charsIn / stats.tokensIn;
  const samples = samplesOf(tag ? stats?.out?.[tag] : undefined);
  if (!samples) return result;
  const sum = (field) => samples.reduce((total, sample) => total + sample[field], 0);
  if (sum("tokens") > 0) result.ratioOut = sum("chars") / sum("tokens");
  if (sum("keys") > 0) result.reasoningPerKey = sum("reasoning") / sum("keys");
  return result;
}

export function recordContextGeneration(ledger, { keysAtGeneration, corpusHash }) {
  ledger.context = { keysAtGeneration, corpusHash, generatedAt: new Date().toISOString() };
}
