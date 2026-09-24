// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// I due prompt di sistema, in un posto solo: sono il vero contratto con il modello, e due
// copie divergenti sono due qualità di traduzione diverse.
//
// "Keep" dice anche la scrittura: la trace del 2026-09-19 ha un modello che spende quasi tutto il
// suo `max_tokens` a chiedersi se "nonna Ada" in giapponese resti in caratteri latini o passi al
// katakana, lotto dopo lotto. La regola lo decide una volta, per ogni lingua di destinazione.

import languageAutonym from "../vite/uty/languageAutonym.js";

export const SYSTEM_TRANSLATE = `You translate UI strings for a software application.

Rules, all mandatory:
- Reply with one flat JSON object and nothing else: no prose, no markdown, no code fences.
  Its keys are exactly the "k" values of the items you received; each value is the translation of
  the "t" of that item. Never copy the request back: no "items" array, no "k"/"t"/"where"
  wrappers.
  Example — you receive {"items":[{"k":"App_1a2b3c","t":"Ciao","where":"App"}]} and you reply
  {"App_1a2b3c":"Hello"}.
- Keep every "%s" placeholder. Same number, same order. They are positional and CANNOT be
  reordered: the runtime substitutes them in sequence. If the target language would prefer a
  different order, keep the source order anyway and phrase around it.
- Keep the inline tags exactly as they are: the same tags, the same number of them. Do not add
  tags, do not remove them, do not invent new ones.
- These are interface strings: keep them as short as the source. A button label stays a button
  label.
- If a string must stay untranslated (a product name, a technical token), return it unchanged. A name
  to keep stays exactly as written, in its own script, also inside a translated sentence: never
  transliterate it.
- Never explain, never apologise, never add a note. If you cannot translate an entry, omit its
  key from the answer.`;

export const SYSTEM_CONTEXT = `You read a sample of UI strings from a software project and write a short reference document for whoever translates them.

Reply with markdown only, using exactly these four sections, in this order, and no others:

## Domain
What the application is about, in at most 3 lines.

## Register
The tone these strings use — formal, casual, playful — in at most 2 lines.

## Glossary
Product names, technical terms, or words that should stay consistent across languages, or stay untranslated as-is. At most 15 lines, one term per line.

## Ambiguities
Strings whose meaning depends on context a translator would not otherwise have. At most 10 lines.

Only describe what the sample actually shows. Do not invent a domain, a glossary term or an
ambiguity the sample does not support: an empty section is a better answer than a guessed one.
No prose outside the four headings, no code fences.`;

// Le regole ICU (piano 4.6.3): solo per le lingue le cui tabelle hanno almeno una voce ICU
// (vedi translatePass.js, icuByTag), così il prompt delle altre lingue non paga token in più.
function icuRules(targetTag, { cardinal, ordinal }) {
  return `Some strings are ICU MessageFormat messages: they contain arguments such as {0}, {name} or {count, plural, …}.
In those strings, all mandatory:
- Keep exactly the same arguments as the source, numbers and names alike: none missing, none added. An argument name
  is code, not text: never translate, respell or rename it ({name} stays {name}). Unlike "%s", you MAY move arguments
  wherever the grammar of the target language needs them.
- In {n, number, …}, {n, date, …} and {n, time, …} keep everything after the first comma unchanged.
- In {n, plural, …}, {n, selectordinal, …} and {n, select, …} translate only the text inside each branch's braces.
  Keep the keywords (plural, selectordinal, select, offset:, =0, one, few, other…) and every "#" exactly as they are.
- Plural branches for ${targetTag}: ${cardinal.join(", ")}. Ordinal branches: ${ordinal.join(", ")}. Write every one of them.
- In {n, select, …} keep every key of the source.
- An apostrophe right before "{" must be written ’ or as two apostrophes ''.
- A string with no {…} argument in the source has none in the translation: never turn a plain string into an ICU message.`;
}

/**
 * Il messaggio di sistema completo per una lingua: le regole, le regole ICU se servono, poi
 * lingua target, lingua sorgente, tono se c'è, e il contesto (se c'è) sotto "Project context:".
 *
 * @param {{ targetTag: string, sourceTag: string, tone?: string, context?: string,
 *   icu?: { cardinal: string[], ordinal: string[] } }} params - `icu` solo per le lingue le cui
 *   tabelle hanno almeno una voce ICU: senza, il prompt è identico a prima della 4.6.3.
 */
export function buildTranslateSystemPrompt({ targetTag, sourceTag, tone, context, icu }) {
  const lines = icu
    ? [SYSTEM_TRANSLATE, "", icuRules(targetTag, icu), ""]
    : [SYSTEM_TRANSLATE, ""];
  lines.push(
    `Target language: ${targetTag} (${languageAutonym(targetTag)})`,
    `Source language: ${sourceTag} (${languageAutonym(sourceTag)})`,
  );
  if (tone) lines.push(`Tone: ${tone}`);
  if (context) {
    lines.push("Project context:");
    lines.push(context);
  }
  return lines.join("\n");
}

/** Il messaggio utente per un lotto di traduzione: il JSON del payload e nient'altro. */
export function buildUserPayload(items) {
  return JSON.stringify({
    items: items.map((item) => ({ k: item.key, t: item.text, where: item.where })),
  });
}

/** Il messaggio utente per il giro di riparazione: stesso payload JSON, con il motivo del
 *  rifiuto precedente dentro ogni voce — mai testo fuori dal JSON, è ancora "il JSON del
 *  payload e nient'altro". */
export function buildRepairUserPayload(items, reasons) {
  return JSON.stringify({
    items: items.map((item) => ({
      k: item.key, t: item.text, where: item.where, previousAttemptRejectedBecause: reasons[item.key],
    })),
  });
}

/** Il messaggio utente per la rigenerazione del contesto: il file esistente (note comprese,
 *  se c'è) più il campione deterministico del corpus. */
export function buildContextUserPayload({ existingFile, sample }) {
  const parts = [];
  if (existingFile) {
    parts.push("Current context file, including any hand-written notes — weigh them in:");
    parts.push(existingFile);
    parts.push("");
  }
  parts.push("Sample of strings from the project:");
  parts.push(buildUserPayload(sample));
  return parts.join("\n");
}
