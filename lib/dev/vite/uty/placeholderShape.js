// Architettura d'insieme: doc/structure.md § "Phase 1 — Precompilation: the sync command".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Il rename "per forma" (4.6.4): due testi uguali a meno dei segnaposto — "Ciao %s" e
// "Ciao {name}" — sono la stessa frase, e la traduzione della vecchia chiave vale per la nuova
// dopo aver riscritto i segnaposto. Succede convertendo una stringa alla macro.

// Un segnaposto semplice: "%s", "{0}", "{nome}". Un argomento con tipo ("{n, plural, …}") no:
// resta nel testo, e due testi con tipi diversi hanno forme diverse.
const SEGNAPOSTO_RE = /%s|\{\s*(\d+|[\p{L}_][\p{L}\p{N}_]*)\s*\}/gu;
const SEGNO = String.fromCharCode(0);
// Il nome di un argomento dentro una traduzione, anche tipato: "{0}", "{ 0 , plural, …".
const NOME_ARG_RE = /\{(\s*)(\d+|[\p{L}_][\p{L}\p{N}_]*)(\s*)(?=[,}])/gu;

/** Il testo con ogni segnaposto sostituito da un segno, e i segnaposto nell'ordine. */
export function placeholderShape(text) {
  const tokens = [];
  const shape = text.replace(SEGNAPOSTO_RE, (m, nome) => { tokens.push(nome ?? "%s"); return SEGNO; });
  return { shape, tokens };
}

/**
 * Riscrive una traduzione dai segnaposto vecchi ai nuovi. `null` se non si può farlo con
 * certezza: meglio una voce a null che una che mostra l'argomento sbagliato.
 *
 * @param {unknown} value - la traduzione della vecchia chiave
 * @param {{ from: string[], to: string[] }} conversione - i segnaposto dei due sorgenti, in ordine
 * @returns {string|null}
 */
export function convertPlaceholders(value, { from, to }) {
  if (typeof value !== "string") return null;
  if (from.every((t) => t === "%s")) {
    // "%s" è posizionale e la traduzione lo tiene nell'ordine del sorgente (regola del prompt e
    // del validatore): il k-esimo diventa il k-esimo segnaposto nuovo.
    if ((value.match(/%s/g) ?? []).length !== from.length) return null;
    let k = 0;
    return value.replace(/%s/g, () => `{${to[k++]}}`);
  }
  if (from.includes("%s")) return null; // misto: non si indovina
  const mappa = new Map();
  for (let i = 0; i < from.length; i++) {
    if (mappa.has(from[i]) && mappa.get(from[i]) !== to[i]) return null;
    mappa.set(from[i], to[i]);
  }
  if (value.includes("%s")) return null;
  return value.replace(NOME_ARG_RE, (m, a, nome, b) => `{${a}${mappa.get(nome) ?? nome}${b}`);
}
