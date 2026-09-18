// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Catena di risoluzione della chiave API, in ordine: variabile d'ambiente, `.env.local` /
// `.env`, keyring opzionale. Tre regole che non si negoziano: la chiave non finisce mai in un
// log o in un messaggio d'errore (`redact`), non si accetta come valore letterale in
// `vite.config` (non esiste `connection.apiKey`: lo strato 1 rifiuta la chiave sconosciuta),
// e il keyring è sempre l'ultimo anello, mai obbligatorio.

import fs from "fs";
import path from "path";
import { KEYRING_SERVICE, KEYRING_MISSING, KEYRING_NO_BACKEND, keyringUnaRiga, KEYRING_PACKAGE } from "./keyringPeer.js";
import { CLI_NAME } from "../vite/uty/cliName.js";

/**
 * Un lettore di `.env` minimale: la CLI non carica Vite, quindi `loadEnv` non è disponibile.
 * Righe `CHIAVE=valore`, `export ` iniziale tollerato, virgolette singole o doppie tolte,
 * righe vuote e `#` ignorate. Nessuna espansione di variabili, nessun multilinea: è una chiave
 * API, non un file di configurazione.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseDotEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);

    env[key] = value;
  }
  return env;
}

async function loadKeyringModule() {
  try {
    return await import(KEYRING_PACKAGE);
  } catch {
    return null;
  }
}

/** Lettura silenziosa per la catena di risoluzione: pacchetto assente o nessun Secret Service
 *  valgono entrambi "salta", senza avviso — il keyring non è mai obbligatorio. */
async function readFromKeyring(account) {
  const mod = await loadKeyringModule();
  if (!mod) return null;
  try {
    return new mod.Entry(KEYRING_SERVICE, account).getPassword();
  } catch {
    return null;
  }
}

/** Lettura/scrittura esplicita per `--llm-key-set|status|clear`: qui l'assenza del pacchetto o del
 *  backend è un errore da spiegare, non da saltare in silenzio — l'utente l'ha chiesto apposta. */
export async function keyringSet(account, value) {
  const mod = await loadKeyringModule();
  if (!mod) throw new Error(`[vitetranslate] ${keyringUnaRiga(KEYRING_MISSING)}`);
  try {
    new mod.Entry(KEYRING_SERVICE, account).setPassword(value);
  } catch (cause) {
    throw new Error(`[vitetranslate] ${keyringUnaRiga(KEYRING_NO_BACKEND)}`, { cause });
  }
}

export async function keyringClear(account) {
  const mod = await loadKeyringModule();
  if (!mod) throw new Error(`[vitetranslate] ${keyringUnaRiga(KEYRING_MISSING)}`);
  try {
    new mod.Entry(KEYRING_SERVICE, account).deletePassword();
  } catch (cause) {
    throw new Error(`[vitetranslate] ${keyringUnaRiga(KEYRING_NO_BACKEND)}`, { cause });
  }
}

/** `{ available, present }`: mai un throw, per `--llm-status`. */
export async function keyringStatus(account) {
  const mod = await loadKeyringModule();
  if (!mod) return { available: false, present: false };
  try {
    const value = new mod.Entry(KEYRING_SERVICE, account).getPassword();
    return { available: true, present: Boolean(value) };
  } catch {
    return { available: true, present: false };
  }
}

/**
 * Risolve la chiave API, salvo `driver`. Restituisce `{ key, from }` dove `from` è una
 * stringa leggibile da stampare — mai la chiave.
 *
 * @param {{ connection: object, baseDir: string }} params
 * @returns {Promise<{ key: string, from: string }>}
 */
export async function resolveApiKey({ connection, baseDir }) {
  const envValue = process.env[connection.apiKeyEnv];
  if (envValue) return { key: envValue, from: `env:${connection.apiKeyEnv}` };

  for (const fileName of [".env.local", ".env"]) {
    try {
      const parsed = parseDotEnv(fs.readFileSync(path.join(baseDir, fileName), "utf8"));
      if (parsed[connection.apiKeyEnv]) return { key: parsed[connection.apiKeyEnv], from: fileName };
    } catch {
      // file assente o illeggibile: si passa al prossimo anello della catena
    }
  }

  const keyringValue = await readFromKeyring(connection.apiKeyEnv);
  if (keyringValue) return { key: keyringValue, from: "keyring" };

  throw new Error(
    `[vitetranslate] no API key found for "${connection.apiKeyEnv}". Looked in: ` +
    `the "${connection.apiKeyEnv}" environment variable, ".env.local" and ".env" in "${baseDir}", ` +
    "and the system keyring. Set the env var, add it to .env.local, or run " +
    `\`npx ${CLI_NAME} --llm-key-set\`.`
  );
}

/** Applicata a ogni percorso d'errore dello strato 9: il punto in cui la chiave scappa
 *  davvero è il dump di una richiesta andata in timeout, che stampa volentieri gli header. */
export function redact(text, key) {
  if (!key || typeof text !== "string") return text;
  return text.split(key).join("«redacted»");
}
