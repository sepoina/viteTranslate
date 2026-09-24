// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Normalizza `defs.icu` (l'opzione del plugin, non le opzioni di runtime di un singolo
// messaggio): il default di build per il fuso orario dei messaggi ICU date/time (vedi
// doc/icu.md). `null` se il blocco non c'è, come normalizeLlmOptions.

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @param {unknown} raw - `defs.icu`
 * @returns {{ timeZone: string } | null}
 */
export default function normalizeIcuOptions(raw) {
  if (raw === undefined || raw === null) return null;

  if (!isPlainObject(raw)) {
    throw new Error(`[vitetranslate] option "icu" must be an object, e.g. { timeZone: "Europe/Rome" }.`);
  }

  for (const key of Object.keys(raw)) {
    if (key !== "timeZone") {
      throw new Error(`[vitetranslate] option "icu.${key}" is not a recognised option: the only one is "timeZone".`);
    }
  }

  const { timeZone } = raw;
  if (timeZone === undefined) return null;

  let valid = typeof timeZone === "string";
  if (valid) {
    try {
      // eslint-disable-next-line no-new
      new Intl.DateTimeFormat("en-US", { timeZone });
    } catch {
      valid = false;
    }
  }
  if (!valid) {
    throw new Error(`[vitetranslate] option "icu.timeZone" must be an IANA time zone such as "Europe/Rome" or "UTC", got ${JSON.stringify(timeZone)}.`);
  }

  return { timeZone };
}
