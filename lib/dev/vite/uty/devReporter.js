// Architettura d'insieme: doc/structure.md § "Fase 3 — The virtual module and code splitting",
// "Console output during dev".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import { hash } from "../../babel/markerCore.js";
import { logWarning, logEchoColored } from "../../../utility.js";
import { readSession, writeSession } from "./sessionStore.js";

// Quanto silenzio chiude un giro di raccolta. Abbastanza da tenere insieme i transform di un
// caricamento di pagina intero, abbastanza poco da non far sembrare l'avviso scollegato dal
// salvataggio che l'ha prodotto.
const RITARDO_MS = 250;

/**
 * Un raccoglitore di avvisi per sessione di dev: un errore di battitura in un file di lingua
 * non deve produrre una riga per ogni rigenerazione del manifest (cioè a ogni salvataggio).
 *
 * Il giro si chiude DA SOLO, poco dopo l'ultimo `report`. È l'unica cosa che funziona in `vite
 * dev`: lì non esiste un "abbiamo finito" — `buildEnd` non scatta mai e `generateLanguagesModule`
 * gira solo quando il modulo virtuale si invalida, cioè quasi mai — e legare il flush a quei
 * punti vuol dire che tutto ciò che i `transform` raccolgono dopo l'ultimo di essi non viene
 * stampato mai. Il timer chiude la raccolta quando la raffica si esaurisce, che è anche il
 * momento in cui i conteggi sono giusti: un caricamento di pagina intero diventa un blocco solo.
 *
 * @param {object} p
 * @param {string} p.baseDir
 * @param {string} p.cliName - come nominare il comando nella riga di rimando ("vtranslate-cli")
 * @param {number} [p.ritardoMs] - quanto silenzio chiude il giro; parametro solo per i test
 * @returns {{ report(categoria: string, messaggio: string): void, flush(): void }}
 */
export default function creaReporter({ baseDir, cliName, ritardoMs = RITARDO_MS }) {
  let visti = new Map(); // categoria -> { message, count }
  let ordine = [];
  // Il timer del flush automatico, quando ce n'è uno armato.
  let attesa = null;
  // Firma dell'ultimo giro STAMPATO in questo processo: azzera la ripetizione della stessa
  // ricarica. Non sopprime mai la prima stampa di un processo nuovo, perché parte da `null` e
  // nessuna firma reale può valere `null`.
  let firmaProcesso = null;

  function report(categoria, messaggio) {
    // Riarmato a ogni avviso, non solo al primo: durante un caricamento di pagina i transform
    // arrivano a pochi millisecondi l'uno dall'altro, e un timer a partenza fissa spezzerebbe
    // la stessa raffica in due o tre blocchi, ognuno col proprio conteggio parziale.
    if (attesa !== null) clearTimeout(attesa);
    attesa = setTimeout(flush, ritardoMs);
    // Il raccoglitore non è un motivo per tenere vivo il processo: se non resta altro da fare,
    // si esce senza aspettarlo.
    attesa.unref?.();

    const voce = visti.get(categoria);
    if (voce) { voce.count++; return; }
    visti.set(categoria, { message: messaggio, count: 1 });
    ordine.push(categoria);
  }

  function firmaGiro() {
    const parti = ordine
      .map((c) => { const v = visti.get(c); return `${c}:${v.count}:${v.message}`; })
      .sort();
    return hash(parti.join("\n")).toString(36);
  }

  function azzera() {
    visti = new Map();
    ordine = [];
  }

  function flush() {
    if (attesa !== null) { clearTimeout(attesa); attesa = null; }
    if (ordine.length === 0) return;
    const firma = firmaGiro();

    if (firma === firmaProcesso) {
      // Stessi problemi del giro precedente, nello stesso processo: è la ricarica di una
      // pagina con gli stessi problemi di prima, e ripeterli è il rumore che questo punto
      // esiste per togliere.
      azzera();
      return;
    }
    firmaProcesso = firma;

    let nascosti = 0;
    for (const categoria of ordine) {
      const { message, count } = visti.get(categoria);
      logWarning(message);
      nascosti += count - 1;
    }

    if (nascosti > 0) {
      const precedente = readSession(baseDir)?.lastDevWarnings;
      const uguale = precedente?.signature === firma;
      const rimando = `+${nascosti} more: run "npx ${cliName} --status" for the full list`;
      logEchoColored("", uguale ? `${rimando} (same as the previous session)` : rimando);
    }

    const totale = ordine.reduce((n, c) => n + visti.get(c).count, 0);
    writeSession(baseDir, { lastDevWarnings: { signature: firma, count: totale, at: new Date().toISOString() } });

    azzera();
  }

  return { report, flush };
}
