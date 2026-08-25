// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Forma dei tag accettati: `<lingua>-<REGIONE>`, la stessa dei nomi dei file in `localeDir`
 * e dell'elenco in doc/bcp47.md. Non è tutto BCP 47 — niente sottotag di scrittura, niente
 * varianti: è il sottoinsieme che la libreria usa davvero, e restringerlo qui è quello che
 * tiene i nomi dei file prevedibili e confrontabili.
 *
 * `{2,3}` e non `{2}`: "fil-PH" sta nell'elenco documentato, e un `^[a-z]{2}-[A-Z]{2}$`
 * scarterebbe proprio una delle lingue che diciamo di supportare.
 */
export const LANGUAGE_TAG_RE = /^[a-z]{2,3}-[A-Z]{2}$/;

/**
 * Nome di un codice in inglese, o `null` se il runtime non sa rispondere.
 *
 * La lingua di visualizzazione è fissata a `"en"` e non al tag stesso: l'inglese è l'unica
 * che una build "small-icu" di Node ha di sicuro, e qui serve sapere SE il codice esiste,
 * non come si scrive nella sua lingua (per quello c'è languageAutonym, che infatti usa il tag).
 */
const displayName = (type, value) => {
  try {
    return new Intl.DisplayNames(["en"], { type }).of(value);
  } catch {
    return null;
  }
};

/**
 * La forma canonica di un tag scritto storto, se esiste e rientra nel nostro sottoinsieme.
 * Serve solo a suggerirla nel messaggio d'errore: "IT-it" e "it_IT" sono i due modi in cui
 * il tag giusto viene digitato sbagliato, e dire *quale* era quello giusto costa una riga.
 */
function canonicalForm(tag) {
  try {
    const [canonico] = Intl.getCanonicalLocales(String(tag).replace(/_/g, "-"));
    return LANGUAGE_TAG_RE.test(canonico) && canonico !== tag ? canonico : null;
  } catch {
    return null;
  }
}

/**
 * Il tag è un tag di lingua utilizzabile come file di `localeDir`?
 *
 * Due controlli distinti, in quest'ordine: la **forma** (la nostra convenzione) e
 * l'**esistenza** (lingua e regione sono codici che esistono davvero). Il secondo serve
 * perché "xy-AB" passa il primo benissimo: senza, un errore di battitura diventa un file di
 * lingua a tutti gli effetti, che da lì in poi viene sincronizzato, compilato e spedito nel
 * bundle come qualsiasi altro.
 *
 * @param {string} tag - es. "fr-FR"
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export default function validateLanguageTag(tag) {
  if (typeof tag !== "string" || !LANGUAGE_TAG_RE.test(tag)) {
    const suggerito = canonicalForm(tag);
    return {
      ok: false,
      reason: `"${tag}" is not in the expected <language>-<REGION> form (e.g. "fr-FR")` +
        (suggerito ? `, did you mean "${suggerito}"?` : ""),
    };
  }

  const [lingua, regione] = tag.split("-");

  // Intl.DisplayNames restituisce l'input quando il codice non lo conosce ("zz" -> "zz",
  // mentre "it" -> "Italian"): è l'unico modo di distinguere un tag ben formato ma inventato
  // da uno vero, perché un elenco enumerabile non c'è (Intl.supportedValuesOf non copre né
  // lingue né regioni). Se invece il runtime non risponde affatto, si passa: una limitazione
  // dell'ICU locale non è un buon motivo per rifiutare una lingua che esiste.
  const nomeLingua = displayName("language", lingua);
  if (nomeLingua === null) return { ok: true };
  if (nomeLingua === lingua) {
    return { ok: false, reason: `"${tag}": "${lingua}" is not a known language code` };
  }

  // "ZZ" è il codice riservato CLDR per "regione sconosciuta": ha un nome (quindi non viene
  // restituito uguale a sé stesso) ma non è una regione, e va escluso a mano.
  const nomeRegione = displayName("region", regione);
  if (nomeRegione !== null && (nomeRegione === regione || regione === "ZZ")) {
    return { ok: false, reason: `"${tag}": "${regione}" is not a known region code` };
  }

  return { ok: true };
}
