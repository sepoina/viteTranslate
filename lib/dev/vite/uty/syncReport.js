// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { shortAutonym } from "./languageAutonym.js";
import { languageFileName } from "./languageFileFormat.js";
import { logRule, logEchoColored, colorize } from "../../../utility.js";
import packageVersion from "./packageVersion.js";

/**
 * L'intestazione, identica per la sincronizzazione e per `--status`: nome, versione, e le due
 * cartelle con quanto c'è dentro. Sono i due parametri che decidono tutto il resto, e
 * nominarle su righe separate toglie di mezzo l'equivoco fra "dove cerco i marcatori" e "dove
 * stanno le tabelle" — che il vecchio paragrafo unico, andando a capo a metà, confondeva.
 *
 * Il conteggio fra parentesi dopo `sources:` sono le chiavi trovate NEL CODICE, cioè quante
 * dovrebbero essercene in ogni tabella: non quante ne contiene un file. Quando le due cose non
 * coincidono lo dice la colonna KEYS di `--status`, riga per riga.
 *
 * Parametri espliciti invece di `(service, srcRoot, files)`: la chiama anche il percorso
 * veloce di `--fastverify`, che non ha né l'uno né l'altro — solo i valori già pronti nel
 * record dell'ultima scansione.
 *
 * Nessuna traversa di chiusura: il corpo del comando prosegue sotto senza interruzioni, e la
 * traversa si vede una sola volta prima degli avvisi finali — vedi il commento sopra
 * `printWarnings` più sotto, sullo stesso principio già usato da `printStatus`.
 *
 * @param {{ srcLabel: string, fileCount: number, keyCount: number, localeLabel: string,
 *   languageCount: number }} p
 */
export function printHeader({ srcLabel, fileCount, keyCount, localeLabel, languageCount }) {
  const quanti = (n, cosa) => `${n} ${cosa}${n === 1 ? "" : "s"}`;
  const versione = packageVersion();
  // Con una sola lingua sul disco è quella sorgente per costruzione — nessuna sub-lingua può
  // esistere senza di lei — quindi "1 language" direbbe il vero ma nasconderebbe la notizia:
  // non c'è ancora nulla da tradurre.
  const contoLingue = languageCount === 1 ? "only source language" : quanti(languageCount, "language");
  logRule();
  logEchoColored("viteTranslate",
    `sources: ${colorize("nome", `"${srcLabel}"`)} (${quanti(fileCount, "file")}, ${quanti(keyCount, "sentence")})`);
  logEchoColored(versione ? `⌘ ${versione}` : "",
    `translations: ${colorize("nome", `"${localeLabel}"`)} (${contoLingue})`);
}

/**
 * Perché si sta facendo il giro lungo dopo che `--fastverify` ha trovato del lavoro: una frase
 * corta, senza il "since the last sync" e il "running the full sync" che il chiamante già dice
 * col prefisso "skip fastverify:" — il motivo basta da solo, ripeterlo due volte nella stessa
 * riga non aggiunge informazione.
 *
 * @param {{ reason: string, detail?: string, others?: number }} motivo
 */
export function testoMotivo({ reason, detail, others }) {
  const nome = (s) => colorize("nome", `"${s}"`);
  switch (reason) {
    case "no-record":
      return "no previous sync on record";
    case "version-changed":
      return "viteTranslate changed";
    case "config-changed":
      return `${nome(detail ?? "vite.config")} changed`;
    case "config-mismatch":
      return "the last sync used a different configuration";
    case "locale-changed":
      return `the tables in ${nome(detail ?? "locale")} changed`;
    case "source-changed":
      return `${nome(detail)} changed${others ? ` (+${others} more)` : ""}`;
    case "markers-removed":
      return `${nome(detail)} has no markers any more`;
    case "source-gone":
      return `${nome(detail)} is gone`;
    case "unreadable":
    default:
      return `could not check what changed (${detail ?? "unknown reason"})`;
  }
}

/**
 * Come nominare le lingue di un riepilogo: col loro nome nella loro lingua, accorciato della
 * regione ("italiano", non "italiano (Italia)").
 *
 * L'accorciamento però NON è un identificativo — "zh-CN" e "zh-TW" diventano entrambe "中文",
 * e due varianti della stessa lingua sono esattamente il caso in cui sapere di quale si parla
 * conta di più. Da qui la disambiguazione: si guardano tutti i tag di QUESTO riepilogo insieme
 * e, dove un nome ne copre più d'uno, gli si mette accanto il file, che è unico per
 * costruzione ed è comunque la cosa che si va ad aprire.
 *
 * @param {string[]} tags - tutti i tag che compariranno, sorgente compresa
 * @returns {(tag: string, conFile?: boolean) => string}
 */
export function nomeLingua(tags) {
  const corto = new Map(tags.map((t) => [t, shortAutonym(t)]));
  const quante = new Map();
  for (const nome of corto.values()) quante.set(nome, (quante.get(nome) ?? 0) + 1);
  return (tag, conFile = false) => {
    const nome = corto.get(tag) ?? tag;
    return conFile || quante.get(nome) > 1 ? `${nome} (${languageFileName(tag)})` : nome;
  };
}

/**
 * Il riepilogo di una sincronizzazione, in tre tipi di riga invece di una per lingua.
 *
 * Prima ogni lingua aveva la sua, tutte uguali tranne il nome, e la sola che contava — chi ha
 * ancora chiavi da tradurre — era in mezzo alle altre. Le lingue a posto si raggruppano in una
 * riga sola perché "non c'è niente da fare" è la stessa notizia per tutte; quelle con del
 * lavoro restano una per riga, perché il lavoro è diverso per ciascuna — e portano il nome del
 * file, perché è quello che si va ad aprire per farlo.
 *
 * @param {{ file: string, action: string, written: boolean, languages: object[] }} esito
 * @param {string} sourceLanguage
 */
export function printSyncSummary({ action, written, languages }, sourceLanguage) {
  // "no changes detected" e file riscritto lo stesso non è una contraddizione: le chiavi sono
  // le stesse, ma può essere cambiato quali risultano tradotte altrove — e quello nel file
  // della lingua sorgente si vede, sotto la riga separatrice.
  const coda = action === "no changes detected" && written ? "no key changes, table rewritten" : action;
  const nome = nomeLingua([sourceLanguage, ...languages.map((l) => l.tag)]);

  logEchoColored("", `${nome(sourceLanguage)} - source language, ${coda}`);

  const complete = languages.filter((l) => l.note === null && l.missing === 0);
  if (complete.length) {
    logEchoColored("", `${complete.map((l) => nome(l.tag)).join(", ")} - all ok!`);
  }
  // Il colore acceso resta a queste righe, ed è tutto il suo senso: in un blocco altrimenti
  // uniforme, "manca ancora del lavoro" è la sola cosa da trovare senza leggere. Acceso per
  // intero e non sul solo conteggio, perché a doversi vedere è QUALE lingua, non quanto.
  for (const l of languages.filter((x) => x.note !== null || x.missing > 0)) {
    const stato = l.missing > 0 ? `${l.missing} key(s) missing` : "complete";
    // Il nome/file in evidenza (lo stesso stile di un dato in mezzo al testo), il resto della
    // riga acceso: due colori affiancati, non uno annidato nell'altro — annidare due colorize
    // vorrebbe dire che il reset del primo spegne anche il secondo a metà riga.
    logEchoColored("", `${colorize("nome", nome(l.tag, true))} - ${colorize("warning", `${l.note ? `${l.note}, ` : ""}${stato}`)}`);
  }
}
