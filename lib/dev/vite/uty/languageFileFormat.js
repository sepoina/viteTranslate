// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Estensione dei file di lingua. Unico punto in cui compare: il resto della libreria passa
 * da qui, così cambiarla resta una riga sola.
 *
 * Dalla 4.0 è `.yml` e non più `.js`. La ragione non è la leggibilità: è che un file di
 * lingua è un DATO, e finché era un modulo JS bisognava eseguirlo per leggerlo. Da lì venivano
 * il contesto `vm` senza globali, il ripiego su `import()` e tutta la manutenzione della cache
 * dei moduli ESM di Node (che non si svuota mai e non ha API di sfratto). Con un formato dati
 * la lettura è `readFileSync` + parse, e quel ramo di codice non esiste più.
 *
 * Il bundle non cambia: i file di lingua non entrano MAI nel grafo così come sono: il
 * transform `vitetranslate:compile-locale` li sostituisce con il modulo compilato (vedi
 * vitetranslate.js). L'estensione decide solo chi li legge da disco, non cosa finisce nel
 * chunk — che resta un `.js` per lingua, identico a prima.
 */
export const LANG_EXT = ".yml";

/** Estensione dei file di lingua fino alla 3.x: serve solo a riconoscerli e a segnalarli. */
export const LEGACY_LANG_EXT = ".js";

/** Nome del file di lingua per un tag BCP 47 (es. "it-IT" -> "it-IT.yml"). */
export const languageFileName = (tag) => `${tag}${LANG_EXT}`;

/** Il file è un file di lingua? (solo il nome, la cartella la controlla il chiamante) */
export const isLanguageFileName = (file) => file.endsWith(LANG_EXT);

/** Il tag BCP 47 dal nome del file (es. "it-IT.yml" -> "it-IT"). */
export const tagFromFileName = (file) => file.slice(0, -LANG_EXT.length);
